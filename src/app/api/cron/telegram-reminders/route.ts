import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { calculateBilling } from '@/lib/billing';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
  } catch (e) {
    console.error('Failed to send reminder', e);
  }
}

export async function POST(request: Request) {
  // Can be triggered by Vercel Cron or manual ping
  // In a real app, require a CRON_SECRET for security, but for now we let it run

  try {
    // 1. Fetch all businesses
    const { data: businesses } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name, active_discounts');
    if (!businesses) return NextResponse.json({ success: true, message: 'No businesses found' });

    for (const business of businesses) {
      const gs = business.pricing_rules?.globalSettings;
      const allOwners = gs?.authorized_telegram_owners || [];
      
      const allChatIds: string[] = [];
      allOwners.forEach((o: any) => {
        if (o.status !== 'revoked' && o.chatId && !allChatIds.includes(String(o.chatId))) allChatIds.push(String(o.chatId));
      });

      const intervalVal = gs?.smart_reminder_interval_minutes;
      const intervalMins = intervalVal !== undefined ? intervalVal : 60;
      
      if (intervalMins === 0) continue;
      
      if (allChatIds.length === 0) continue;

      // 2. Fetch active sessions for this business
      const { data: sessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
      if (!sessions || sessions.length === 0) continue;

      const now = new Date().getTime();

      for (const session of sessions) {
        if (session.paused_at) continue; // Don't remind about paused sessions

        const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        const lastCheckedStr = session.last_checked_at || session.last_activity_at || startFull;
        const lastCheckedAt = new Date(lastCheckedStr).getTime();
        const minsSinceCheck = (now - lastCheckedAt) / 60000;

        if (minsSinceCheck >= intervalMins) {
          // 3. Send Telegram Reminder
          
          let billText = '₹0';
          let durationText = '0m';
          try {
            const activeDiscount = business.active_discounts?.[session.table_id];
            const res = calculateBilling(startFull, new Date().toISOString(), session.game_type, business.pricing_rules, session.num_players || 1, activeDiscount, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
            billText = `₹${Math.round(res.cost)}`;
            durationText = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
          } catch(e){}

          const msg = `⚠️ <b>Session Confirmation Required</b>\n\n<b>${session.customer_name}</b> is playing on <b>${session.table_id}</b>.\n\nDuration: ${durationText}\nCurrent Bill: ${billText}\n\nIs the player still playing?`;
          
          const buttons = [
            [
              { text: `✅ ${session.customer_name} is Still Playing`, callback_data: `confirm_${session.id}` }
            ],
            [
              { text: `🛑 End ${session.customer_name}'s Session — ${session.table_id}`, callback_data: `end_${session.id}` }
            ]
          ];
          
          for (const cid of allChatIds) {
            await sendTelegramMessage(cid, msg, { inline_keyboard: buttons });
          }

          // Prevent spamming by updating last_activity_at so it doesn't alert again immediately
          // In a perfectly strict system we'd use a different column, but reusing this prevents repeat messages 
          // until another interval passes.
          await supabase.from('sessions').update({ last_activity_at: new Date().toISOString() }).eq('id', session.id);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Reminders processed' });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
