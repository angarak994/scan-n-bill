import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabaseClient';
import { 
  sendBookingPaymentReminder, 
  formatPaymentReminderMessage 
} from '@/lib/services/paymentReminderService';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, customerId, bookingId, force } = body;
    const businessId = sessionCookie.businessId;

    // Case 1: Specific Booking Reminder (Booking-specific authoritative calculation)
    if (bookingId) {
      const result = await sendBookingPaymentReminder({
        bookingId,
        businessId,
        forceSend: Boolean(force)
      });

      if (!result.success && result.skipped) {
        return NextResponse.json({
          success: false,
          skipped: true,
          message: result.reason || 'Payment reminder skipped.'
        });
      }

      if (!result.success) {
        return NextResponse.json({
          error: result.error || 'Failed to send payment reminder'
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        amount: result.outstanding,
        businessName: result.clubName,
        messageId: result.messageId
      });
    }

    // Case 2: General Customer / Phone Reminder
    if (!phone && !customerId) {
      return NextResponse.json({ error: 'Either bookingId, customerId, or phone is required' }, { status: 400 });
    }

    let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    // 1. Authoritative Business Context Resolution
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, business_name, payment_qr_config, pricing_rules, whatsapp_config')
      .eq('id', businessId)
      .single();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const bName = business.business_name;
    const qrConfig = business.payment_qr_config as any;
    const pricingRules = business.pricing_rules as any;
    const upiId = qrConfig?.upi_id || pricingRules?.globalSettings?.preferences?.business_upi_id || (business as any).upi_id || null;

    // 2. Try to resolve if customer has a specific booking with an outstanding balance
    let customerQuery = supabase
      .from('customers')
      .select('id, name, phone, outstanding_balance')
      .eq('business_id', businessId);

    if (customerId) {
      customerQuery = customerQuery.eq('id', customerId);
    } else if (cleanPhone) {
      customerQuery = customerQuery.or(`phone.eq.${phone},phone.eq.${cleanPhone}`);
    }

    const { data: customer } = await customerQuery.maybeSingle();
    const resolvedCustomerName = customer?.name || body.name || 'Valued Member';
    const targetPhone = cleanPhone || (customer?.phone ? customer.phone.replace(/\D/g, '') : '');

    if (!targetPhone || targetPhone.length < 10) {
      return NextResponse.json({ error: 'Valid customer phone number not found' }, { status: 400 });
    }

    // Look for any active/unsettled booking for this customer
    const { data: openBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('business_id', businessId)
      .eq('customer_phone', targetPhone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (openBookings && openBookings.length > 0) {
      // Delegate to authoritative booking reminder
      const result = await sendBookingPaymentReminder({
        bookingId: openBookings[0].id,
        businessId,
        forceSend: Boolean(force)
      });

      if (result.success || result.skipped) {
        return NextResponse.json({
          success: result.success,
          skipped: result.skipped,
          amount: result.outstanding || 0,
          businessName: result.clubName || bName,
          messageId: result.messageId || null,
          message: result.reason
        });
      }
    }

    // Fallback: Check customer ledger balance
    const outstandingAmount = Number(customer?.outstanding_balance || body.amount || 0);

    // Stop reminders if payment is verified (balance <= 0)
    if (outstandingAmount <= 0) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'Customer has ₹0 outstanding balance. Reminder safely skipped.'
      });
    }

    // 3. Format message strictly according to specification
    const message = formatPaymentReminderMessage({
      clubName: bName,
      customerName: resolvedCustomerName,
      outstanding: outstandingAmount,
      upiId
    });

    const config = business.whatsapp_config as any;
    const token = config?.enabled ? config?.token : undefined;
    const phoneId = config?.enabled ? config?.phoneId : undefined;

    // 4. Send and log to database
    const finalPhone = targetPhone.length === 10 ? `91${targetPhone}` : targetPhone;
    const result = await sendWhatsAppText(
      finalPhone,
      message,
      false,
      token,
      phoneId,
      {
        businessId,
        recipientName: resolvedCustomerName,
        content: message
      }
    );

    if (result && result.error) {
      return NextResponse.json({ error: result.error.message || 'Meta rejected reminder message' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      amount: outstandingAmount,
      businessName: bName,
      messageId: result?.messages?.[0]?.id || null
    });
  } catch (error: any) {
    console.error('WhatsApp Reminder Error:', error);
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 });
  }
}
