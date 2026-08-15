import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { calculateBilling, getCurrentRate, formatTimeReadable } from '@/lib/billing';
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

      const business = await getBusinessByChatId(chatId);

      if (text === '/start' || text === '/menu') {
        if (!business) {
          await sendTelegramMessage(chatId, `🎱 <b>QControl Bot</b>\n\nYour Telegram Chat ID is: <code>${chatId}</code>\n\nPlease enter this ID in your QControl Dashboard Settings (under <i>Telegram & Smart Reminders</i>) to authorize this device.`);
        } else {
          await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${business.business_name}\n\nPlease choose an action:`, {
            keyboard: [
              [{ text: '🎱 Start New Session' }, { text: '🛑 Stop Session' }],
              [{ text: '📋 Active Tables' }, { text: '💰 Today\'s Revenue' }],
              [{ text: '📅 Today\'s Bookings' }]
            ],
            resize_keyboard: true
          });
        }
        return NextResponse.json({ ok: true });
      }

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
          const playersLine = lines.find((l: string) => l.startsWith('Players:'));
          if (!tableLine || !gameLine) return NextResponse.json({ ok: true });
          
          const tableId = tableLine.replace('Table:', '').replace('Enter player name for table:', '').trim();
          const gameType = gameLine.replace('Game:', '').trim();
          let numPlayers = 1;
          if (playersLine) {
            numPlayers = parseInt(playersLine.replace('Players:', '').trim()) || 1;
          }
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
            num_players: numPlayers,
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
                ? { text: `▶️ Resume ${session.customer_name}'s Session`, callback_data: `resume_${session.id}` }
                : { text: `⏸ Pause ${session.customer_name}'s Session`, callback_data: `pause_${session.id}` }
            ],
            [
              { text: `🛑 End ${session.customer_name}'s Session — ${session.table_id}`, callback_data: `end_${session.id}` }
            ]
          ];
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
      }
      else if (text === '🛑 Stop Session') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions to stop.');
          return NextResponse.json({ ok: true });
        }
        const buttons = activeSessions.map(s => [{ text: s.table_id, callback_data: `stop_select_${s.id}` }]);
        await sendTelegramMessage(chatId, `🛑 <b>Select Table to Stop</b>`, { inline_keyboard: buttons });
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
            [{ text: '🎱 Start New Session' }, { text: '🛑 Stop Session' }],
            [{ text: '📋 Active Tables' }, { text: '💰 Today\'s Revenue' }],
            [{ text: '📅 Today\'s Bookings' }]
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
            // Only one game type available, skip selection
            const gameType = gameTypes[0];
            if (gameType.toLowerCase() === 'ps5') {
              const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `ps5_players_${tableId}_${num}` }));
              await sendTelegramMessage(chatId, `🎮 <b>How many players?</b>`, { inline_keyboard: [buttons] });
            } else {
              await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
                  force_reply: true
              });
            }
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
        
        if (gameType.toLowerCase() === 'ps5') {
          const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `ps5_players_${tableId}_${num}` }));
          await sendTelegramMessage(chatId, `🎮 <b>How many players?</b>`, { inline_keyboard: [buttons] });
        } else {
          await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
            force_reply: true
          });
        }
      }
      else if (callbackData.startsWith('ps5_players_')) {
        const parts = callbackData.replace('ps5_players_', '').split('_');
        const tableId = parts[0];
        const numPlayers = parseInt(parts[1], 10);
        
        if (!business.pricing_rules || !business.pricing_rules.rules || !business.pricing_rules.rules['ps5']) {
          await sendTelegramMessage(chatId, `❌ No pricing configured for PS5. Please configure it in the dashboard first.`);
          return NextResponse.json({ ok: true });
        }
        
        const currentRate = getCurrentRate('ps5', Date.now(), business.pricing_rules, numPlayers);
        
        const msg = `🎮 <b>PS5 Session</b>\nPlayers: ${numPlayers}\nRate: ₹${currentRate.rate}/hour\n(${currentRate.slabName})`;
        const buttons = [
          [
            { text: '▶️ Start Session', callback_data: `ps5_start_${tableId}_${numPlayers}` },
            { text: '❌ Cancel', callback_data: 'cancel_action' }
          ]
        ];
        
        await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
      }
      else if (callbackData.startsWith('ps5_start_')) {
        const parts = callbackData.replace('ps5_start_', '').split('_');
        const tableId = parts[0];
        const numPlayers = parts[1];
        
        await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ps5\nPlayers: ${numPlayers}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
          force_reply: true
        });
      }
      else if (callbackData === 'cancel_action') {
        await sendTelegramMessage(chatId, '❌ Action cancelled.');
      }
      else if (callbackData === 'stop_menu_back') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions to stop.');
          return NextResponse.json({ ok: true });
        }
        const buttons = activeSessions.map(s => [{ text: s.table_id, callback_data: `stop_select_${s.id}` }]);
        await sendTelegramMessage(chatId, `🛑 <b>Select Table to Stop</b>`, { inline_keyboard: buttons });
      }
      else if (callbackData.startsWith('stop_select_')) {
        const sessionId = callbackData.replace('stop_select_', '');
        const session = await sessionRepository.findById(sessionId, business.id);
        if (!session || session.status !== 'ACTIVE') {
          await sendTelegramMessage(chatId, 'Session is not active or not found.');
          return NextResponse.json({ ok: true });
        }
        
        const isPaused = !!session.paused_at;
        const startFull = ((session.start_time || '').includes('T') ? session.start_time : `${session.date}, ${session.start_time}`) as string;
        const endFull = (isPaused ? session.paused_at : new Date().toISOString()) as string;
        
        let billText = '₹0';
        let billableDuration = '0m';
        try {
          const res = calculateBilling(startFull as string, endFull as string, session.game_type, business.pricing_rules, session.num_players || 1, undefined, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
          billText = `₹${Math.round(res.cost)}`;
          billableDuration = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
        } catch(e){}

        const pausedDurationMins = Math.floor((session.paused_duration_seconds || 0) / 60);
        const totalDurationMins = Math.max(0, Math.floor((new Date(endFull).getTime() - new Date(startFull).getTime()) / 60000));
        
        const pausedText = pausedDurationMins > 0 ? `${pausedDurationMins}m` : '0m';
        const totalText = totalDurationMins > 0 ? `${Math.floor(totalDurationMins/60)}h ${totalDurationMins%60}m` : '0m';
        
        const msg = `🎱 <b>Session Details</b>\n\n<b>Table:</b> ${session.table_id}\n<b>Game:</b> ${session.game_type}\n<b>Player:</b> ${session.customer_name}\n<b>Started:</b> ${formatTimeReadable(startFull)}\n<b>Current Time:</b> ${formatTimeReadable(endFull)}\n<b>Total Duration:</b> ${totalText}\n<b>Paused Time:</b> ${pausedText}\n<b>Billable Time:</b> ${billableDuration}\n<b>Current Bill:</b> ${billText}`;
        
        const buttons = [
          [{ text: `🛑 Stop This Session`, callback_data: `end_${session.id}` }],
          [{ text: `↩️ Back`, callback_data: `stop_menu_back` }]
        ];
        
        await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
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
              await sendTelegramMessage(chatId, `✅ Marked ${session.customer_name} on ${session.table_id} as still playing.`);
            } else if (action === 'force_end') {
              const updatedSession = await sessionRepository.findById(sessionId, business.id);
              if (updatedSession) {
                const startFull = ((updatedSession.start_time || '').includes('T') ? updatedSession.start_time : `${updatedSession.date}, ${updatedSession.start_time}`) as string;
                const endFull = (updatedSession.end_time || new Date().toISOString()) as string;
                const formattedStart = formatTimeReadable(startFull as string);
                const formattedEnd = formatTimeReadable(endFull as string);
                
                let finalCost = 0;
                let breakdownStr = '';
                let rateText = '₹0/hour';
                try {
                  const res = calculateBilling(startFull as string, endFull as string, updatedSession.game_type, business.pricing_rules, updatedSession.num_players || 1, undefined, updatedSession.paused_duration_seconds, updatedSession.locked_rate, updatedSession.locked_rate_name);
                  finalCost = Math.round(res.cost);
                  
                  if ((res as any).breakdown && (res as any).breakdown.length > 1) {
                    breakdownStr = '\n\n<b>Billing Breakdown</b>\n';
                    (res as any).breakdown.forEach((b: any) => {
                      breakdownStr += `• ${formatTimeReadable(new Date(b.startMs).toISOString())} – ${formatTimeReadable(new Date(b.endMs).toISOString())} → ₹${Math.round(b.cost)}\n`;
                    });
                    breakdownStr += `• <b>Total → ₹${finalCost}</b>`;
                  } else if ((res as any).breakdown && (res as any).breakdown.length === 1) {
                    rateText = `₹${(res as any).breakdown[0].rate}/hour`;
                  } else {
                    rateText = res.slabs_applied || 'Fixed Rate';
                  }
                } catch(e) {}
                
                const billText = `₹${finalCost}`;
                
                const totalMs = Math.max(0, new Date(endFull as string).getTime() - new Date(startFull as string).getTime());
                const totalDurationMins = Math.floor(totalMs / 60000);
                const totalText = totalDurationMins > 0 ? `${Math.floor(totalDurationMins/60)}h ${totalDurationMins%60}m` : '0m';
                
                const pausedDurationMins = Math.floor((updatedSession.paused_duration_seconds || 0) / 60);
                const pausedText = pausedDurationMins > 0 ? `${pausedDurationMins}m` : '0m';

                const billableDurationText = updatedSession.duration?.replace(' min', 'm').replace(' hr ', 'h ') || '0m';
                
                let msg = `✅ <b>Session Stopped Successfully</b>\n\n<b>Table:</b> ${updatedSession.table_id}\n<b>Game:</b> ${updatedSession.game_type}\n<b>Player:</b> ${updatedSession.customer_name}\n\n🕐 <b>Start:</b> ${formattedStart}\n🕐 <b>End:</b> ${formattedEnd}\n⏱️ <b>Total Time:</b> ${totalText}\n⏸️ <b>Paused:</b> ${pausedText}\n🎯 <b>Billable Time:</b> ${billableDurationText}\n\n`;
                
                if (breakdownStr) {
                  msg += `<b>Final Bill:</b> ${billText}${breakdownStr}\n\n`;
                } else {
                  msg += `<b>Rate:</b> ${rateText}\n💰 <b>Final Bill:</b> ${billText}\n\n`;
                }
                
                msg += `Table is now <b>Available</b>.`;
                
                await sendTelegramMessage(chatId, msg);
              } else {
                await sendTelegramMessage(chatId, `🛑 Session Ended successfully.`);
              }
            } else if (actionPrefix === 'resume') {
              const updatedSession = await sessionRepository.findById(sessionId, business.id);
              if (updatedSession) {
                let billText = '₹0';
                try {
                  const startFull = updatedSession.start_time.includes('T') ? updatedSession.start_time : `${updatedSession.date}, ${updatedSession.start_time}`;
                  const endFull = new Date().toISOString();
                  const res = calculateBilling(startFull, endFull, updatedSession.game_type, business.pricing_rules, updatedSession.num_players || 1, undefined, updatedSession.paused_duration_seconds, updatedSession.locked_rate, updatedSession.locked_rate_name);
                  billText = `₹${Math.round(res.cost)}`;
                } catch(e){}
                await sendTelegramMessage(chatId, `▶️ <b>Session Resumed</b>\nPlayer: ${updatedSession.customer_name}\nTable: ${updatedSession.table_id}\nCurrent Bill: ${billText}`);
              } else {
                await sendTelegramMessage(chatId, `✅ Session resumed.`);
              }
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
