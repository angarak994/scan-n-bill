import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabaseClient';
import { getAuthoritativeQKhataBalance } from '@/lib/services/qkhataBalanceService';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, customers, template } = body;

    if (!businessId || !customers || !template) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (sessionCookie.businessId !== businessId) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    // Fetch authoritative business WhatsApp config and name
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, whatsapp_config, payment_qr_config, pricing_rules')
      .eq('id', businessId)
      .single();

    if (!business || !business.business_name?.trim()) {
      return NextResponse.json({ error: 'Business not found or business name missing' }, { status: 404 });
    }

    const businessName = business.business_name.trim();
    const config = business.whatsapp_config as any;
    const waToken = (config?.enabled !== false && config?.token) || process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const waPhoneId = (config?.enabled !== false && config?.phoneId) || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!waToken || !waPhoneId || config?.enabled === false) {
      return NextResponse.json({ error: 'WhatsApp is not connected for this business. Please connect it in Settings.' }, { status: 400 });
    }

    const qrConfig = business.payment_qr_config as any;
    const pricingRules = business.pricing_rules as any;
    const upiId = qrConfig?.upi_id || pricingRules?.globalSettings?.preferences?.business_upi_id || (business as any).upi_id || null;

    const isPaymentReminder = template.toLowerCase().includes('payment reminder') || template.includes('{{outstanding}}');

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;
    const errors: any[] = [];

    // Process sequentially to respect rate limits or use a controlled Promise.all
    for (const customer of customers) {
      if (!customer.phone) {
        failureCount++;
        continue;
      }
      
      const cleanPhone = customer.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        failureCount++;
        continue;
      }

      let outstanding = Number(customer.outstanding_balance || 0);

      // Real-time authoritative QKhata balance verification:
      // Always populate {{outstanding}} with actual verified ledger balance from QKhata
      if (isPaymentReminder) {
        const qkhataRes = await getAuthoritativeQKhataBalance(businessId, {
          customerId: customer.id,
          phone: customer.phone,
          name: customer.name
        });
        outstanding = qkhataRes.outstanding;

        // Skip reminders if balance is zero or settled
        if (outstanding <= 0) {
          skippedCount++;
          continue;
        }
      }

      // Replace template variables
      let message = template
        .replace(/\{\{name\}\}/g, customer.name || 'Member')
        .replace(/\{\{outstanding\}\}/g, outstanding.toFixed(0))
        .replace(/\{\{club\}\}/g, businessName)
        .replace(/\{\{business\}\}/g, businessName);

      if (isPaymentReminder && upiId && !message.includes('UPI ID:') && !message.includes(upiId)) {
        message += `\n\nUPI ID: ${upiId}`;
      }

      // Pre-log to database as queued
      let dbMessageId = null;
      const { data: dbMsg } = await supabase.from('whatsapp_messages').insert({
        business_id: businessId,
        recipient_phone: cleanPhone,
        recipient_name: customer.name || 'Member',
        content: message,
        status: 'queued'
      }).select('id').single();
      
      if (dbMsg) {
        dbMessageId = dbMsg.id;
      }

      try {
        const result = await sendWhatsAppText(cleanPhone, message, false, waToken, waPhoneId, {
          businessId,
          recipientName: customer.name || 'Member',
          content: message
        });
        
        if (result && result.error) {
          throw new Error(result.error.message || 'WhatsApp API rejected the message');
        }

        // Meta returns messages: [{ id: 'wamid.xxxxx' }]
        const wamid = result?.messages?.[0]?.id || null;

        if (dbMessageId) {
          await supabase.from('whatsapp_messages').update({
            message_id: wamid,
            status: 'sent'
          }).eq('id', dbMessageId);
        }

        successCount++;
        
        // Small delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        console.error('Failed to send to', customer.phone, err);
        failureCount++;
        errors.push({ phone: customer.phone, error: err.message || 'Unknown error' });

        if (dbMessageId) {
          await supabase.from('whatsapp_messages').update({
            status: 'failed',
            error_message: err.message || 'Unknown error'
          }).eq('id', dbMessageId);
        }
      }
    }

    return NextResponse.json({ 
        success: true, 
        successCount, 
        failureCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error: any) {
    console.error('WhatsApp Bulk Send Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
