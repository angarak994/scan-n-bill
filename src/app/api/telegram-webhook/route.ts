import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { calculateBilling } from '@/lib/billing';
import { handleSessionIntervention } from '@/lib/services/interventionService';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
    return await res.json();
  } catch (e) {
    console.error('Failed to send telegram message', e);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text
      })
    });
  } catch (e) {}
}

async function getBusinessByChatId(chatId: string | number) {
  const { data: businesses } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name');
  if (!businesses) return null;
  return businesses.find(b => String(b.pricing_rules?.globalSettings?.telegram_chat_id || '').trim() === String(chatId).trim()) || null;
}

export async function POST(request: Request) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }

  try {
    const update = await request.json();

    // 1. Handle regular messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text === '/start') {
        await sendTelegramMessage(chatId, `🎱 <b>QControl Bot</b>\n\nYour Telegram Chat ID is: <code>${chatId}</code>\n\nPlease enter this ID in your QControl Dashboard Settings (under <i>Telegram & Smart Reminders</i>) to authorize this device.`);
        return NextResponse.json({ ok: true });
      }

      const business = await getBusinessByChatId(chatId);
      if (!business) {
        await sendTelegramMessage(chatId, `⚠️ Unauthorized.\n\nYour Chat ID is <code>${chatId}</code>. Please link it in your QControl Dashboard Settings.`);
        return NextResponse.json({ ok: true });
      }

      if (update.message.reply_to_message) {
        const replyText = update.message.reply_to_message.text;
        if (replyText.includes('Enter Customer Name') || replyText.includes('Enter player name')) {
          const lines = replyText.split('\n');
          const tableLine = lines.find((l: string) => l.startsWith('Table:') || l.startsWith('Enter player name for table:'));
          const gameLine = lines.find((l: string) => l.startsWith('Game:'));
          if (!tableLine || !gameLine) return NextResponse.json({ ok: true });
          
          const tableId = tableLine.replace('Table:', '').replace('Enter player name for table:', '').trim();
          const gameType = gameLine.replace('Game:', '').trim();
          const playerName = text;
          
          // Start the session!
          const now = new Date();
          const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          
          const sessionData = {
            business_id: business.id,
            date: localDateStr,
            customer_name: playerName,
            table_id: tableId,
            game_type: gameType,
            start_time: now.toISOString(),
            status: 'ACTIVE',
            last_activity_at: now.toISOString()
          };

          const { error } = await supabase.from('sessions').insert([sessionData]);
          if (error) {
            await sendTelegramMessage(chatId, `❌ Failed to start session: ${error.message}`);
          } else {
            await sendTelegramMessage(chatId, `✅ <b>Session Started</b>\n\nPlayer: ${playerName}\nTable: ${tableId}\nGame: ${gameType}\nStarted At: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
          }
          return NextResponse.json({ ok: true });
        }
      }

      // Handle Main Menu Commands
      if (text === '🎱 Start New Session') {
        const tables = business.tables || [];
        if (tables.length === 0) {
          await sendTelegramMessage(chatId, 'No tables configured for this business.');
          return NextResponse.json({ ok: true });
        }
        const buttons = tables.map((t: any) => [{ text: t.id, callback_data: `start_table_${t.id}` }]);
        await sendTelegramMessage(chatId, 'Select a table to start a new session:', { inline_keyboard: buttons });
      } 
      else if (text === '📋 Active Tables') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions running right now.');
          return NextResponse.json({ ok: true });
        }
        
        for (const session of activeSessions) {
          const isPaused = !!session.paused_at;
          const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          const endFull = isPaused ? session.paused_at : new Date().toISOString();
          
          let billText = '₹0';
          let durationText = '0m';
          try {
            const res = calculateBilling(startFull, endFull, session.game_type, business.pricing_rules, session.num_players || 1, undefined, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
            billText = `₹${Math.round(res.cost)}`;
            durationText = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
          } catch(e){}

          const status = isPaused ? '⏸ Paused' : '▶️ Active';
          const msg = `<b>${session.table_id}</b>\nPlayer: ${session.customer_name}\nGame: ${session.game_type}\nStatus: ${status}\nDuration: ${durationText}\nCurrent Bill: ${billText}`;
          
          const buttons = [
            [
              isPaused 
                ? { text: '▶️ Resume', callback_data: `resume_${session.id}` }
                : { text: '⏸ Pause', callback_data: `pause_${session.id}` },
              { text: '🛑 End', callback_data: `end_${session.id}` }
            ]
          ];
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
      }
      else if (text === '💰 Today\'s Revenue') {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const { data: completedSessions } = await supabase
          .from('sessions')
          .select('cost, duration')
          .eq('business_id', business.id)
          .eq('status', 'COMPLETED')
          .eq('date', dateStr);
          
        if (!completedSessions || completedSessions.length === 0) {
          await sendTelegramMessage(chatId, `No completed sessions today (${dateStr}).`);
        } else {
          let totalRevenue = 0;
          let totalDurationMins = 0;
          
          completedSessions.forEach(s => {
            totalRevenue += Number(s.cost) || 0;
            // duration is like "1 hr 30 min" or "45 min", we can just count sessions or try parsing.
            // Let's just do total revenue and session count.
          });
          
          const msg = `💰 <b>Today's Revenue</b> (${dateStr})\n\nTotal Sessions: ${completedSessions.length}\nTotal Revenue: ₹${Math.round(totalRevenue)}`;
          await sendTelegramMessage(chatId, msg);
        }
        return NextResponse.json({ ok: true });
      }
      else if (text === '📅 Today\'s Bookings') {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('business_id', business.id)
          .eq('booking_date', dateStr)
          .eq('status', 'confirmed')
          .order('start_time', { ascending: true });
          
        if (!bookings || bookings.length === 0) {
          await sendTelegramMessage(chatId, `No upcoming bookings for today (${dateStr}).`);
        } else {
          let msg = `📅 <b>Today's Bookings</b> (${dateStr})\n\n`;
          bookings.forEach((b, index) => {
            msg += `${index + 1}. <b>${b.table_id}</b> @ ${b.start_time}\n   Name: ${b.customer_name}\n   Duration: ${b.duration_minutes}m\n\n`;
          });
          await sendTelegramMessage(chatId, msg);
        }
        return NextResponse.json({ ok: true });
      }
      else {
        // Main Menu
        await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${business.business_name}\n\nPlease choose an action:`, {
          keyboard: [
            [{ text: '🎱 Start New Session' }, { text: '📋 Active Tables' }],
            [{ text: '💰 Today\'s Revenue' }, { text: '📅 Today\'s Bookings' }]
          ],
          resize_keyboard: true
        });
      }
    }

    // 2. Handle Callback Queries (Button Clicks)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const callbackQueryId = update.callback_query.id;

      // Immediately acknowledge the callback to remove the loading state in Telegram
      await answerCallbackQuery(callbackQueryId);

      const business = await getBusinessByChatId(chatId);
      if (!business) {
        await sendTelegramMessage(chatId, '⚠️ Unauthorized.');
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('start_table_')) {
        const tableId = callbackData.replace('start_table_', '');
        
        // Determine available game types
        const table = (business.tables || []).find((t: any) => t.id === tableId);
        let gameTypes: string[] = [];
        
        if (table && table.type) {
            gameTypes = [table.type];
        } else if (business.pricing_rules?.rules) {
            gameTypes = Object.keys(business.pricing_rules.rules);
        }

        if (gameTypes.length === 1) {
            // Only one game type available, skip selection and ask for name immediately
            const gameType = gameTypes[0];
            await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
                force_reply: true
            });
        } else if (gameTypes.length > 1) {
            // Show buttons for available game types
            const buttons = gameTypes.map((g) => [{ text: g.charAt(0).toUpperCase() + g.slice(1), callback_data: `start_game_${tableId}_${g}` }]);
            await sendTelegramMessage(chatId, `🎱 Select Game Type for Table: ${tableId}`, { inline_keyboard: buttons });
        } else {
            await sendTelegramMessage(chatId, `❌ No game types configured for this business.`);
        }
      }
      else if (callbackData.startsWith('start_game_')) {
        // start_game_TABLEID_GAMETYPE
        const parts = callbackData.replace('start_game_', '').split('_');
        const tableId = parts[0];
        const gameType = parts[1];
        
        await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
          force_reply: true
        });
      }
      else if (callbackData.startsWith('pause_') || callbackData.startsWith('resume_') || callbackData.startsWith('end_') || callbackData.startsWith('confirm_')) {
        const actionMap: Record<string, string> = {
          'pause': 'pause',
          'resume': 'resume',
          'end': 'force_end',
          'confirm': 'confirm_playing'
        };
        const actionPrefix = callbackData.split('_')[0];
        const sessionId = callbackData.substring(actionPrefix.length + 1);
        const action = actionMap[actionPrefix];

        if (action) {
          // Verify session exists
          const session = await sessionRepository.findById(sessionId, business.id);
          if (!session || session.status !== 'ACTIVE') {
            await answerCallbackQuery(callbackQueryId, 'Session is not active or not found.');
            return NextResponse.json({ ok: true });
          }

          // Use the identical intervene logic as dashboard
          try {
            await handleSessionIntervention({
              action,
              session_id: sessionId,
              business_id: business.id,
              amount_recovered: 0,
              performed_by: 'telegram_bot'
            });
            
            await answerCallbackQuery(callbackQueryId, `Success: ${actionPrefix}`);
            
            if (action === 'confirm_playing') {
              await sendTelegramMessage(chatId, `✅ Marked as still playing.`);
            } else if (action === 'force_end') {
              await sendTelegramMessage(chatId, `🛑 Session Ended successfully.`);
            } else {
              await sendTelegramMessage(chatId, `✅ Session ${actionPrefix}d.`);
            }
          } catch(e: any) {
             console.error('Intervention Error:', e);
             await sendTelegramMessage(chatId, `❌ Failed: ${e.message || 'Error executing action'}`);
          }
        }
      }

    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
