import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabaseClient';
import { 
  sendBookingPaymentReminder, 
  formatPaymentReminderMessage 
} from '@/lib/services/paymentReminderService';
import { getAuthoritativeQKhataBalance } from '@/lib/services/qkhataBalanceService';

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

    // 2. Resolve Authoritative QKhata Ledger Balance for Customer (Do not substitute booking totals)
    const qkhataResult = await getAuthoritativeQKhataBalance(businessId, {
      customerId: customerId || customer?.id,
      phone: targetPhone,
      name: resolvedCustomerName
    });

    const outstandingAmount = qkhataResult.outstanding;

    // Stop reminders if payment is verified (balance <= 0)
    if (outstandingAmount <= 0) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'Customer has ₹0 outstanding balance on their QKhata ledger. Reminder safely skipped.'
      });
    }

    const finalCustomerName = qkhataResult.customerName || resolvedCustomerName;

    // 3. Format message strictly according to specification
    const message = formatPaymentReminderMessage({
      clubName: bName,
      customerName: finalCustomerName,
      outstanding: outstandingAmount,
      upiId
    });

    const config = business.whatsapp_config as any;
    const token = (config?.enabled !== false && config?.token) || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = (config?.enabled !== false && config?.phoneId) || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId || config?.enabled === false) {
      return NextResponse.json({ error: 'WhatsApp is not connected for this business. Please connect it in Settings.' }, { status: 400 });
    }

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
        recipientName: finalCustomerName,
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
