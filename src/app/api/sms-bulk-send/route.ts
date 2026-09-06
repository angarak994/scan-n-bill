import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendSMS, SMSConfig } from '@/lib/services/smsService';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, customers, templateId, messageTemplate } = body;

    if (!businessId || !customers || !templateId || !messageTemplate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (sessionCookie.businessId !== businessId) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    // Fetch business SMS config
    const { data: business } = await supabase
      .from('businesses')
      .select('sms_config')
      .eq('id', businessId)
      .single();

    const config = business?.sms_config as SMSConfig;
    if (!config || !config.enabled || !config.authKey || !config.senderId) {
      return NextResponse.json({ error: 'SMS is not configured for this business. Please configure it in Settings.' }, { status: 400 });
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

      // Replace template variables for local context (MSG91 can use var1/var2 instead, but pre-rendering is fine for fallbacks)
      const message = messageTemplate
        .replace(/\{\{name\}\}/g, customer.name || 'Customer')
        .replace(/\{\{outstanding\}\}/g, Number(customer.outstanding_balance || 0).toFixed(0));

      try {
        const result = await sendSMS(businessId, cleanPhone, customer.name, message, templateId, config);
        
        if (!result.success) {
          throw new Error(result.error || 'SMS Provider Error');
        }
        
        successCount++;
        // Small delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        console.error('Failed to send SMS to', customer.phone, err);
        failureCount++;
        errors.push({ phone: customer.phone, error: err.message || 'Unknown error' });
      }
    }

    return NextResponse.json({ 
        success: true, 
        successCount, 
        failureCount,
        errors: errors.length > 0 ? errors : undefined 
    });

  } catch (error: any) {
    console.error('SMS Bulk Send Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
