import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sendWhatsAppMessage, sendWhatsAppText } from '@/lib/whatsapp';

export async function GET(request: Request) {
  // Check authorization (e.g. cron secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    // 1. Find all businesses that have WhatsApp enabled
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, business_name, whatsapp_config, active_discounts');

    if (!businesses) return NextResponse.json({ processed: 0 });

    let messagesSent = 0;

    for (const business of businesses) {
      if (!business.whatsapp_config?.enabled || !business.whatsapp_config?.token) continue;

      // 2. Find customers who haven't visited in 30 days
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, phone, updated_at')
        .eq('business_id', business.id)
        .lt('updated_at', thirtyDaysAgoStr)
        .limit(50); // Batch process

      if (!customers || customers.length === 0) continue;

      // 3. Filter out those who already received a winback this month
      const customerIds = customers.map(c => c.id);
      const { data: recentNotifs } = await supabase
        .from('notifications')
        .select('message') // we store customer_id in message for this type
        .eq('business_id', business.id)
        .eq('type', 'retention_winback')
        .gte('created_at', thirtyDaysAgoStr);

      const alreadySentIds = new Set(recentNotifs?.map(n => n.message) || []);
      const eligibleCustomers = customers.filter(c => !alreadySentIds.has(c.id) && c.phone);

      for (const customer of eligibleCustomers) {
        // Send WhatsApp Winback Message
        const message = `Hi ${customer.name || 'there'}! It's been a while since we saw you at ${business.business_name}. 🎱\n\nWe miss you! Come visit us this week and show this message at the counter for a special surprise discount on your next game!`;
        
        try {
          await sendWhatsAppText(customer.phone, message, false, business.whatsapp_config.token, business.whatsapp_config.phoneId);
          messagesSent++;
          
          // Log it so we don't spam them again for another 30 days
          await supabase.from('notifications').insert({
            business_id: business.id,
            title: 'Winback SMS Sent',
            message: customer.id,
            type: 'retention_winback'
          });
        } catch (e) {
          console.error(`Failed to send winback to ${customer.phone}:`, e);
        }
      }
    }

    return NextResponse.json({ success: true, messagesSent });
  } catch (error: any) {
    console.error('Retention Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
