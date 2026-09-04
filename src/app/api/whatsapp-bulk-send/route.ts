import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendWhatsAppText } from '@/lib/whatsapp';

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
        .replace(/\{\{outstanding\}\}/g, Number(customer.outstanding_balance || 0).toFixed(0));

      try {
        await sendWhatsAppText(cleanPhone, message);
        successCount++;
        
        // Small delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.error(`Failed to send message to ${cleanPhone}:`, error);
        failureCount++;
        errors.push({ phone: customer.phone, error: error.message });
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
