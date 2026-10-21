import { supabase } from '../supabaseClient';
import { sendWhatsAppText } from '../whatsapp';

export interface BookingBalanceResult {
  isValid: boolean;
  reason?: string;
  isSettled?: boolean;
  bookingId?: string;
  businessId?: string;
  businessName?: string;
  customerName?: string;
  customerPhone?: string;
  totalPayable?: number;
  totalPaid?: number;
  outstandingAmount?: number;
  upiId?: string | null;
  currency?: string;
  disputed?: boolean;
}

/**
 * Authoritative, business-isolated calculation of a booking's outstanding balance.
 * Uses the centralized billing engine and reconciles session bills, table bookings,
 * discounts, and successful ledger payments.
 */
export async function calculateBookingOutstandingBalance(
  bookingId: string,
  businessId: string
): Promise<BookingBalanceResult> {
  if (!bookingId || !businessId) {
    return {
      isValid: false,
      reason: 'Both bookingId and businessId are required'
    };
  }

  try {
    // 1. Tenant-isolated booking retrieval
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (bookingErr || !booking) {
      return {
        isValid: false,
        reason: 'Booking not found or business mismatch (tenant isolation enforced)'
      };
    }

    // 2. Authoritative business verification
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, business_name, pricing_rules, payment_qr_config, whatsapp_config, currency')
      .eq('id', businessId)
      .maybeSingle();

    if (bizErr || !business || !business.business_name?.trim()) {
      return {
        isValid: false,
        reason: `Business not found or business name missing: ${bizErr?.message || 'null business'}`
      };
    }

    const businessName = business.business_name.trim();

    // 3. Extract verified UPI configuration (never hardcoded, strictly club-specific)
    const qrConfig = business.payment_qr_config as any;
    const pricingRules = business.pricing_rules as any;
    const upiId = (
      qrConfig?.upi_id ||
      pricingRules?.globalSettings?.preferences?.business_upi_id ||
      (business as any).upi_id ||
      null
    )?.trim() || null;

    // 4. Validate customer identity
    const customerName = (booking.customer_name || '').trim() || 'Valued Member';
    const rawPhone = (booking.customer_phone || '').replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 10) {
      return {
        isValid: false,
        reason: 'Missing or inconsistent customer phone number'
      };
    }
    const customerPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

    // 5. Authoritative Payable Amount Resolution
    let totalPayable = 0;
    let linkedSession: any = null;

    if (booking.session_id) {
      const { data: session, error: sessErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', booking.session_id)
        .eq('business_id', businessId)
        .maybeSingle();

      if (sessErr || !session) {
        return {
          isValid: false,
          reason: 'Linked session record is missing or corrupted'
        };
      }

      linkedSession = session;
      const rawCost = Number(session.cost);
      if (!isNaN(rawCost) && rawCost > 0) {
        totalPayable = rawCost;
      } else {
        // Fallback to recalculating session bill if cost not finalized
        const { calculateBilling } = await import('@/lib/billing');
        const startFull = session.start_time?.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        const endFull = session.paused_at || session.end_time || new Date().toISOString();
        const bill = calculateBilling(startFull, endFull, session.game_type, business.pricing_rules, session.num_players || 1);
        totalPayable = bill.cost;
      }
    } else {
      // Direct booking calculation without session
      if (booking.total_amount !== undefined && booking.total_amount !== null && !isNaN(Number(booking.total_amount))) {
        totalPayable = Number(booking.total_amount);
      } else if (booking.cost !== undefined && booking.cost !== null && !isNaN(Number(booking.cost))) {
        totalPayable = Number(booking.cost);
      } else if (booking.metadata?.cost !== undefined && !isNaN(Number(booking.metadata.cost))) {
        totalPayable = Number(booking.metadata.cost);
      } else if (booking.duration_minutes) {
        const rate = Number(booking.pricing_rate || 300);
        totalPayable = (Number(booking.duration_minutes) / 60) * rate;
      } else {
        return {
          isValid: false,
          reason: 'Unable to calculate authoritative booking payable amount'
        };
      }
    }

    if (isNaN(totalPayable) || totalPayable <= 0) {
      return {
        isValid: false,
        reason: 'Calculated payable amount is invalid or non-positive'
      };
    }

    // 6. Authoritative Payments Resolution (Strictly 'Paid', ignore 'Pending' or 'Failed')
    let paymentsQuery = supabase
      .from('payments')
      .select('*')
      .eq('business_id', businessId);

    if (booking.session_id) {
      paymentsQuery = paymentsQuery.or(`session_id.eq.${booking.session_id},metadata->>booking_id.eq.${booking.id}`);
    } else {
      paymentsQuery = paymentsQuery.eq('metadata->>booking_id', booking.id);
    }

    const { data: paymentRecords, error: payErr } = await paymentsQuery;

    if (payErr) {
      return {
        isValid: false,
        reason: 'Failed to retrieve payment records'
      };
    }

    let totalPaid = 0;
    let hasDispute = false;

    if (paymentRecords && paymentRecords.length > 0) {
      for (const p of paymentRecords) {
        const pStatus = (p.status || '').trim().toLowerCase();
        const pAmount = Number(p.amount || 0);

        if (pStatus === 'paid' || pStatus === 'completed') {
          totalPaid += pAmount;
        } else if (pStatus === 'refunded') {
          totalPaid -= pAmount;
        } else if (pStatus === 'disputed') {
          hasDispute = true;
        }
        // CRITICAL: 'Pending', 'Failed', 'Billed' do NOT reduce the outstanding balance!
      }
    } else if (linkedSession) {
      // If no double-entry rows exist yet in payments table, check session level status
      const sessionPaymentStatus = (linkedSession.payment_status || '').trim().toLowerCase();
      if (sessionPaymentStatus === 'paid') {
        totalPaid = Number(linkedSession.amount_paid ?? totalPayable);
      } else if (sessionPaymentStatus === 'partially paid') {
        totalPaid = Number(linkedSession.amount_paid || 0);
      }
    }

    if (hasDispute) {
      return {
        isValid: true,
        disputed: true,
        isSettled: false,
        reason: 'Booking payment is marked as disputed. Reminders paused.'
      };
    }

    const outstandingAmount = Math.max(0, Math.round((totalPayable - totalPaid) * 100) / 100);
    const isSettled = outstandingAmount <= 0;

    return {
      isValid: true,
      isSettled,
      bookingId: booking.id,
      businessId: business.id,
      businessName,
      customerName,
      customerPhone,
      totalPayable,
      totalPaid: Math.max(0, totalPaid),
      outstandingAmount,
      upiId,
      currency: (business as any)?.currency || 'INR'
    };
  } catch (error: any) {
    console.error('[paymentReminderService] Balance calculation error:', error);
    return {
      isValid: false,
      reason: error.message || 'Unexpected calculation error'
    };
  }
}

/**
 * Strictly formats the payment reminder according to WhatsApp and business specifications.
 * Format:
 * *Payment reminder — {{club}}*
 *
 * Hi {{name}}, your booking has an outstanding balance of ₹{{outstanding}}.
 *
 * Please review and complete the payment using UPI. If you've already paid, please disregard this reminder while we verify your status.
 */
export function formatPaymentReminderMessage(params: {
  clubName: string;
  customerName: string;
  outstanding: number;
  upiId?: string | null;
}): string {
  const { clubName, customerName, outstanding, upiId } = params;
  const formattedOutstanding = outstanding.toFixed(0);

  let message = `*Payment reminder — ${clubName}*\n\nHi ${customerName}, your booking has an outstanding balance of ₹${formattedOutstanding}.\n\nPlease review and complete the payment using UPI. If you've already paid, please disregard this reminder while we verify your status.`;

  if (upiId && upiId.trim()) {
    message += `\n\nUPI ID: ${upiId.trim()}`;
  }

  return message;
}

export interface SendReminderResult {
  success: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
  messageId?: string | null;
  businessId?: string;
  clubName?: string;
  customerName?: string;
  outstanding?: number;
  phone?: string;
  message?: string;
}

/**
 * Executes safe real-time verification and sends a personalized payment reminder.
 */
export async function sendBookingPaymentReminder(params: {
  bookingId: string;
  businessId: string;
  overrideToken?: string;
  overridePhoneId?: string;
  forceSend?: boolean;
}): Promise<SendReminderResult> {
  const { bookingId, businessId, overrideToken, overridePhoneId, forceSend } = params;

  // 1. Authoritative real-time balance check
  const balance = await calculateBookingOutstandingBalance(bookingId, businessId);

  // Missing or inconsistent financial data
  if (!balance.isValid) {
    return {
      success: false,
      skipped: false,
      error: balance.reason || 'Missing or inconsistent financial records prevent sending unverified reminder.'
    };
  }

  // Disputed payment
  if (balance.disputed) {
    return {
      success: false,
      skipped: true,
      reason: balance.reason || 'Payment is currently disputed.'
    };
  }

  // Real-time zero/negative balance check: auto-cancel reminder if fully paid
  if (balance.isSettled || !balance.outstandingAmount || balance.outstandingAmount <= 0) {
    return {
      success: false,
      skipped: true,
      reason: 'Customer has ₹0 outstanding balance or booking is fully settled. Reminder safely skipped.'
    };
  }

  // 2. Safe scheduling & idempotency check (prevent spamming within 4 hours)
  if (!forceSend) {
    const { data: recentMsg } = await supabase
      .from('whatsapp_messages')
      .select('id, created_at, status')
      .eq('business_id', businessId)
      .eq('recipient_phone', balance.customerPhone)
      .ilike('content', `%${balance.businessName}%`)
      .gt('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentMsg && (recentMsg.status === 'sent' || recentMsg.status === 'delivered' || recentMsg.status === 'read')) {
      return {
        success: false,
        skipped: true,
        reason: 'A payment reminder was already delivered to this member recently.'
      };
    }
  }

  // 3. Format message
  const message = formatPaymentReminderMessage({
    clubName: balance.businessName!,
    customerName: balance.customerName!,
    outstanding: balance.outstandingAmount,
    upiId: balance.upiId
  });

  // 4. Resolve WhatsApp credentials
  const { data: business } = await supabase
    .from('businesses')
    .select('whatsapp_config')
    .eq('id', businessId)
    .single();

  const config = business?.whatsapp_config as any;
  const token = overrideToken || (config?.enabled ? config?.token : undefined);
  const phoneId = overridePhoneId || (config?.enabled ? config?.phoneId : undefined);

  // 5. Audit trail & dispatch
  const result = await sendWhatsAppText(
    balance.customerPhone!,
    message,
    false,
    token,
    phoneId,
    {
      businessId,
      recipientName: balance.customerName,
      content: message
    }
  );

  if (result && result.error) {
    return {
      success: false,
      skipped: false,
      error: result.error.message || 'WhatsApp provider rejected message'
    };
  }

  const messageId = result?.messages?.[0]?.id || null;

  return {
    success: true,
    skipped: false,
    messageId,
    businessId,
    clubName: balance.businessName,
    customerName: balance.customerName,
    outstanding: balance.outstandingAmount,
    phone: balance.customerPhone,
    message
  };
}
