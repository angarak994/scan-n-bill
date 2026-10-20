import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { supabase } from '@/lib/supabaseClient';

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

    // Fetch business WhatsApp config and name
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, whatsapp_config')
      .eq('id', businessId)
      .single();

    const businessName = business?.business_name || 'QControl';
    const config = business?.whatsapp_config as any;
    if (!config || !config.enabled || !config.token || !config.phoneId) {
      return NextResponse.json({ error: 'WhatsApp is not connected for this business. Please connect it in Settings.' }, { status: 400 });
    }

    let successCount = 0;
    let failureCount = 0;
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

      // Replace template variables
      const message = template
        .replace(/\{\{name\}\}/g, customer.name || 'Customer')
        .replace(/\{\{outstanding\}\}/g, Number(customer.outstanding_balance || 0).toFixed(0))
        .replace(/\{\{club\}\}/g, businessName)
        .replace(/\{\{business\}\}/g, businessName);

      // Pre-log to database as queued
      let dbMessageId = null;
      const { data: dbMsg } = await supabase.from('whatsapp_messages').insert({
        business_id: businessId,
        recipient_phone: cleanPhone,
        recipient_name: customer.name || 'Customer',
        content: message,
        status: 'queued'
      }).select('id').single();
      
      if (dbMsg) {
        dbMessageId = dbMsg.id;
      }

      try {
        const result = await sendWhatsAppText(cleanPhone, message, false, config.token, config.phoneId);
        
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
        errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error: any) {
    console.error('WhatsApp Bulk Send Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
