import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { formatPaymentReminderMessage } from '@/lib/services/paymentReminderService';
import { getAuthoritativeQKhataBalance } from '@/lib/services/qkhataBalanceService';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customerId, customerPhone, customerName } = await request.json();

    if (!customerPhone && !customerId) {
      return NextResponse.json({ error: 'Missing customer phone or ID' }, { status: 400 });
    }

    const businessId = sessionCookie.businessId;

    // 1. Fetch business details & WhatsApp configuration
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('id, business_name, whatsapp_config, payment_qr_config, pricing_rules')
      .eq('id', businessId)
      .single();

    if (bizErr || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessName = business.business_name?.trim() || 'Our Club';
    const config = business.whatsapp_config as any;

    // 2. Authoritative WhatsApp Connection Check (Business config or Active Platform API)
    const waToken = (config?.enabled !== false && config?.token) || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const waPhoneId = (config?.enabled !== false && config?.phoneId) || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!waToken || !waPhoneId || config?.enabled === false) {
      return NextResponse.json(
        { error: 'WhatsApp is not connected for this business. Please connect WhatsApp in Settings.' },
        { status: 400 }
      );
    }

    // 3. Resolve Authoritative QKhata Ledger Balance
    const qkhataResult = await getAuthoritativeQKhataBalance(businessId, {
      customerId,
      phone: customerPhone,
      name: customerName
    });

    if (!qkhataResult.success || qkhataResult.outstanding <= 0) {
      return NextResponse.json(
        { error: 'Customer has ₹0 outstanding balance on their QKhata ledger.' },
        { status: 400 }
      );
    }

    const resolvedOutstanding = qkhataResult.outstanding;
    const resolvedName = qkhataResult.customerName || customerName || 'Valued Member';
    const targetPhone = qkhataResult.phone || customerPhone;

    const rawDigits = targetPhone.replace(/\D/g, '');
    const cleanPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;

    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Valid phone number is required to send reminder' }, { status: 400 });
    }

    // 4. Extract UPI configuration
    const qrConfig = business.payment_qr_config as any;
    const pricingRules = business.pricing_rules as any;
    const upiId = (
      qrConfig?.upi_id ||
      pricingRules?.globalSettings?.preferences?.business_upi_id ||
      (business as any).upi_id ||
      null
    )?.trim() || null;

    // 5. Format Message according to Meta compliance
    const messageBody = formatPaymentReminderMessage({
      clubName: businessName,
      customerName: resolvedName,
      outstanding: resolvedOutstanding,
      upiId
    });

    // 6. Send via official Meta WhatsApp Cloud API
    const result = await sendWhatsAppText(
      cleanPhone,
      messageBody,
      false,
      waToken,
      waPhoneId,
      {
        businessId,
        recipientName: resolvedName,
        content: messageBody
      }
    );

    if (result && result.error) {
      console.error('[send-reminder] WhatsApp send error:', result.error);
      return NextResponse.json(
        { error: result.error.message || 'WhatsApp message failed to deliver' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reminder sent successfully',
      outstanding: resolvedOutstanding,
      customerName: resolvedName,
      recipientPhone: cleanPhone,
      messageId: result?.messages?.[0]?.id || null
    });
  } catch (error: any) {
    console.error('Send Reminder API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
