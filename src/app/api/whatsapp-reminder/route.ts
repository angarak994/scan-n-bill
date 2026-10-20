import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, customerId, bookingId } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const businessId = sessionCookie.businessId;

    // 1. Authoritative Business Context Resolution (never trust client businessName)
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, business_name, whatsapp_config')
      .eq('id', businessId)
      .single();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const bName = business.business_name;

    // 2. Authoritative Payment Check (check verified ledger in customers or bookings table)
    let outstandingAmount = 0;
    let resolvedCustomerName = 'Valued Customer';

    // Check customer ledger
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, outstanding_balance')
      .eq('business_id', businessId)
      .or(`phone.eq.${phone},phone.eq.${cleanPhone}`)
      .maybeSingle();

    if (customer) {
      resolvedCustomerName = customer.name || resolvedCustomerName;
      outstandingAmount = Number(customer.outstanding_balance || 0);
    } else if (body.amount) {
      outstandingAmount = Number(body.amount);
    }

    // Stop reminders if payment is verified (balance <= 0)
    if (outstandingAmount <= 0) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: 'Customer has ₹0 outstanding balance. Reminder safely skipped.'
      });
    }

    // 3. Format message with single asterisks for bold text
    const bookingRef = bookingId ? `QC-${String(bookingId).substring(0, 6).toUpperCase()}` : 'your recent session';
    const message = `*Payment reminder — ${bName}*\n\nHi ${resolvedCustomerName}, your booking ${bookingRef} has an outstanding balance of *₹${outstandingAmount.toFixed(0)}*.\n\nPlease review your booking and complete the payment using your preferred payment method.\n\nIf you've already paid, you can safely ignore this reminder while our team verifies your payment status. Thank you!`;

    const config = business.whatsapp_config as any;
    const token = config?.enabled ? config?.token : undefined;
    const phoneId = config?.enabled ? config?.phoneId : undefined;

    // 4. Send and log to database
    const result = await sendWhatsAppText(
      cleanPhone,
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
