import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { processAssistantMessage } from '@/lib/services/assistantService';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Abstract webhook format (WhatsApp/Telegram unified entry point)
    // Expecting: { phone: string, text: string, platform: 'whatsapp' | 'telegram' }
    const { phone, text, platform } = payload;
    
    if (!phone || !text) {
        return NextResponse.json({ error: 'Missing phone or text' }, { status: 400 });
    }

    // Identify Global Customer
    let { data: globalCustomer } = await supabase
        .from('global_customers')
        .select('*')
        .eq('phone', phone)
        .single();
        
    if (!globalCustomer) {
        // Auto-create global identity if they interact
        const { data: newCustomer } = await supabase
            .from('global_customers')
            .insert({ phone })
            .select()
            .single();
        globalCustomer = newCustomer;
    }

    // Route message through our Assistant Service (AI intent parsing & logic)
    const responseText = await processAssistantMessage(globalCustomer, text, platform);

    // Fire this response back to WhatsApp API or Telegram send API
    if (platform === 'whatsapp') {
        const { sendWhatsAppText } = await import('@/lib/whatsapp');
        await sendWhatsAppText(phone, responseText);
    } else if (platform === 'telegram') {
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        if (TELEGRAM_BOT_TOKEN) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: phone, text: responseText })
            });
        }
    }

    return NextResponse.json({ reply: responseText }, { status: 200 });

  } catch (error: any) {
    console.error('Assistant Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
