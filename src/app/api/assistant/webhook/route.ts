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

    // Normally we'd fire this response back to Twilio/WhatsApp API or Telegram send API here
    // For now, return it in the HTTP response for testing
    return NextResponse.json({ reply: responseText }, { status: 200 });

  } catch (error: any) {
    console.error('Assistant Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
