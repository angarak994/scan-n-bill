import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  try {
    if (!TELEGRAM_BOT_TOKEN) return;
    const body: any = { chat_id: chatId, text: text, parse_mode: 'HTML' };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Error sending telegram message:', e);
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_id, pricing_rules, tables } = body;

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    if (!business_id) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (pricing_rules !== undefined) updatePayload.pricing_rules = pricing_rules;
    if (tables !== undefined) updatePayload.tables = tables;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('businesses')
      .update(updatePayload)
      .eq('id', business_id);

    if (error) {
      console.error('Error updating business config in Supabase:', error);
      throw error;
    }
    

    return NextResponse.json({ success: true, pricing_rules, tables });
  } catch (error: any) {
    console.error('Update Business Config Error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update business configuration' }, { status: 500 });
  }
}
