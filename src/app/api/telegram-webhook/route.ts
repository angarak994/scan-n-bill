import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { calculateBilling, getCurrentRate, formatTimeReadable, getCurrentISTDateStr } from '@/lib/billing';
import { handleSessionIntervention } from '@/lib/services/interventionService';
import { startSession } from '@/lib/sessionManager';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

function escapeHtml(text: string) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
    const data = await res.json();
    if (!data.ok) console.error("Telegram API Error:", data);
    return data;
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

async function editTelegramMessageText(chatId: string | number, messageId: number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    });
  } catch (e) {
    console.error('Failed to edit telegram message text', e);
  }
}

async function editTelegramMessageReplyMarkup(chatId: string | number, messageId: number, replyMarkup: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: replyMarkup
      })
    });
  } catch (e) {
    console.error('Failed to edit telegram message markup', e);
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
}

const MAIN_MENU_KEYBOARD = {
  keyboard: [
    [{ text: '▶️ Start Session' }, { text: '📋 Active Sessions' }],
    [{ text: '🛑 Stop Session' }, { text: '📅 Book Table' }],
    [{ text: '⏸ Paused Sessions' }, { text: '💰 Today\'s Summary' }]
  ],
  resize_keyboard: true,
};

async function getBusinessContext(chatId: string | number) {
  const { data: businesses } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name');
  if (!businesses) return null;
  
  const searchId = String(chatId).trim();
  for (const b of businesses) {
    const gs = b.pricing_rules?.globalSettings;
    if (!gs) continue;
    
    if (String(gs.telegram_chat_id || '').trim() === searchId) {
       return { business: b, isRevoked: false };
    }
    
    if (Array.isArray(gs.authorized_telegram_owners)) {
      const owner = gs.authorized_telegram_owners.find((owner: any) => String(owner.chatId).trim() === searchId);
      if (owner) {
         return { business: b, isRevoked: owner.status === 'revoked' };
      }
    }
  }
  return null;
}

const getOwnerName = (business: any, chatId: string | number, fallbackName: string) => {
  const searchId = String(chatId).trim();
  const gs = business?.pricing_rules?.globalSettings;
  if (String(gs?.telegram_chat_id || '').trim() === searchId) return 'Primary_Owner';
  if (Array.isArray(gs?.authorized_telegram_owners)) {
    const owner = gs.authorized_telegram_owners.find((o: any) => String(o.chatId).trim() === searchId);
    if (owner) return `Telegram_${owner.name.replace(/\s+/g, '_')}`;
  }
  return fallbackName;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || url.host;
    const protocol = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true
      })
    });
    
    const data = await res.json();
    return NextResponse.json({ success: true, webhookUrl, telegramResponse: data });
  } catch (error: any) {
    console.error('Failed to set webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

      const context = await getBusinessContext(chatId);

      if (context?.isRevoked) {
        await sendTelegramMessage(chatId, `🔒 <b>Access Revoked</b>\n\nYour Telegram access to <b>${escapeHtml(context.business.business_name)}</b> has been revoked by the primary owner.\n\nPlease contact the primary business owner if you believe this was a mistake.`);
        return NextResponse.json({ ok: true });
      }

      const business = context?.business;

      if (text.startsWith('/start auth_')) {
        const token = text.replace('/start ', '').trim();
        const { data: businesses } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name');
        if (businesses) {
          const businessWithToken = businesses.find(b => b.pricing_rules?.globalSettings?.telegram_invite_token === token);
          
          if (businessWithToken) {
             const businessName = escapeHtml(businessWithToken.business_name || "this business");
             const confirmMarkup = {
               inline_keyboard: [
                 [
                   { text: '✅ Confirm Access', callback_data: `confirm_auth_${token}` },
                   { text: '❌ Cancel', callback_data: `cancel_auth` }
                 ]
               ]
             };
             await sendTelegramMessage(
               chatId,
               `🔗 <b>Connect to ${businessName}?</b>\n\nYou will be able to manage sessions, bookings, billing, and other owner functions.`,
               confirmMarkup
             );
             return NextResponse.json({ ok: true });
          }
        }
        
        await sendTelegramMessage(chatId, `❌ Invalid or expired invite link.`);
        return NextResponse.json({ ok: true });
      }

      if (text === '/start' || text === '/menu') {
        if (!business) {
          await sendTelegramMessage(chatId, `🎱 <b>QControl Bot</b>\n\nYour Telegram Chat ID is: <code>${chatId}</code>\n\nPlease enter this ID in your QControl Dashboard Settings (under <i>Telegram & Smart Reminders</i>) to authorize this device.`);
        } else {
          await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${escapeHtml(business.business_name || "")}\n\nPlease choose an action:`, MAIN_MENU_KEYBOARD);
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
          try {
            const session = await startSession(tableId, gameType as any, playerName, business.id, numPlayers);
            await sendTelegramMessage(chatId, `✅ <b>Session Started</b>\n\nPlayer: ${playerName}\nTable: ${tableId}\nGame: ${gameType}\nStarted At: ${formatTimeReadable(session.start_time)}`, MAIN_MENU_KEYBOARD);
          } catch (error: any) {
            await sendTelegramMessage(chatId, `❌ Failed to start session: ${error.message}`, MAIN_MENU_KEYBOARD);
          }
          return NextResponse.json({ ok: true });
        }
      }

      // Handle Main Menu Commands
      if (text === '▶️ Start Session') {
        const tables = business.tables || [];
        if (tables.length === 0) {
          await sendTelegramMessage(chatId, 'No tables configured for this business.', MAIN_MENU_KEYBOARD);
          return NextResponse.json({ ok: true });
        }
        const tableButtons = tables.map((t: any) => ({ text: t.id, callback_data: `start_table_${t.id}` }));
        const buttons = chunkArray(tableButtons, 3);
        await sendTelegramMessage(chatId, 'Select a table to start a new session:', { inline_keyboard: buttons });
      } 
      else if (text === '📋 Active Sessions') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions running right now.', MAIN_MENU_KEYBOARD);
          return NextResponse.json({ ok: true });
        }
        
        for (const session of activeSessions) {
          const isPaused = typeof session.paused_at === 'string' && session.paused_at.trim() !== '';
          const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          const endFull = isPaused ? (session.paused_at as never || session.paused_at) : new Date().toISOString(); // Wait, let's write it cleaner below
          
          let billText = '₹0';
          let durationText = '0m';
          try {
            const res = calculateBilling(startFull, endFull, session.game_type, business.pricing_rules, session.num_players || 1, undefined, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
            billText = `₹${Math.round(res.cost)}`;
            durationText = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
          } catch(e){}

          const status = isPaused ? '⏸ Paused' : '▶️ Active';
          const msg = `<b>${session.table_id}</b>\nPlayer: ${escapeHtml(session.customer_name || "")}\nGame: ${session.game_type}\nStatus: ${status}\nDuration: ${durationText}\nCurrent Bill: ${billText}`;
          
          const buttons = [
            [
              isPaused 
                ? { text: `▶️ Resume`, callback_data: `resume_${session.id}` }
                : { text: `⏸ Pause`, callback_data: `pause_${session.id}` },
              { text: `🛑 Stop`, callback_data: `end_${session.id}` }
            ]
          ];
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
      }
      else if (text === '🛑 Stop Session') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions to stop.', MAIN_MENU_KEYBOARD);
          return NextResponse.json({ ok: true });
        }
        const sessionButtons = activeSessions.map(s => {
          let icon = '🎱';
          if (s.game_type === 'ps5') icon = '🎮';
          return { text: `${icon} ${s.table_id}`, callback_data: `stop_select_${s.id}` };
        });
        const buttons = chunkArray(sessionButtons, 2);
        await sendTelegramMessage(chatId, `🛑 <b>Select the table to stop</b>\n\nWhich active session would you like to stop?`, { inline_keyboard: buttons });
      }
      
      else if (text === '⏸ Paused Sessions') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions right now.', MAIN_MENU_KEYBOARD);
          return NextResponse.json({ ok: true });
        }
        
        const pausedSessions = activeSessions.filter(s => typeof s.paused_at === 'string' && s.paused_at.trim() !== '');
        
        if (pausedSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No paused sessions right now.', MAIN_MENU_KEYBOARD);
          return NextResponse.json({ ok: true });
        }
        
        let msg = '⏸ <b>Paused Sessions</b>\n\n';
        pausedSessions.forEach(session => {
          const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          msg += `<b>${session.table_id}</b>\nPlayer: ${session.customer_name}\nGame: ${session.game_type}\nStarted: ${formatTimeReadable(startFull)}\nPaused At: ${formatTimeReadable(session.paused_at)}\n\n`;
        });
        await sendTelegramMessage(chatId, msg, MAIN_MENU_KEYBOARD);
      }
      else if (text === '💰 Today\'s Summary') {
        const dateStr = getCurrentISTDateStr();
        
        const { data: completedSessions } = await supabase
          .from('sessions')
          .select('cost, duration')
          .eq('business_id', business.id)
          .eq('status', 'COMPLETED')
          .eq('date', dateStr);
          
        if (!completedSessions || completedSessions.length === 0) {
          await sendTelegramMessage(chatId, `No completed sessions today (${dateStr}).`, MAIN_MENU_KEYBOARD);
        } else {
          let totalRevenue = 0;
          let totalDurationMins = 0;
          
          completedSessions.forEach(s => {
            totalRevenue += Number(s.cost) || 0;
            // duration is like "1 hr 30 min" or "45 min", we can just count sessions or try parsing.
            // Let's just do total revenue and session count.
          });
          
          const msg = `💰 <b>Today's Revenue</b> (${dateStr})\n\nTotal Sessions: ${completedSessions.length}\nTotal Revenue: ₹${Math.round(totalRevenue)}`;
          await sendTelegramMessage(chatId, msg, MAIN_MENU_KEYBOARD);
        }
        return NextResponse.json({ ok: true });
      }
      else if (text === '📅 Book Table') {
        const dateStr = getCurrentISTDateStr();
        
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('business_id', business.id)
          .eq('booking_date', dateStr)
          .eq('status', 'confirmed')
          .order('start_time', { ascending: true });
          
        if (!bookings || bookings.length === 0) {
          await sendTelegramMessage(chatId, `No upcoming bookings for today (${dateStr}).`, MAIN_MENU_KEYBOARD);
        } else {
          let msg = `📅 <b>Today's Bookings</b> (${dateStr})\n\n`;
          bookings.forEach((b, index) => {
            msg += `${index + 1}. <b>${b.table_id}</b> @ ${b.start_time}\n   Name: ${b.customer_name}\n   Duration: ${b.duration_minutes}m\n\n`;
          });
          await sendTelegramMessage(chatId, msg, MAIN_MENU_KEYBOARD);
        }
        return NextResponse.json({ ok: true });
      }
      else {
        // Main Menu
        await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${business.business_name}\n\nPlease choose an action:`, MAIN_MENU_KEYBOARD);
      }
    }

    // 2. Handle Callback Queries (Button Clicks)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const callbackQueryId = update.callback_query.id;

      // Immediately acknowledge the callback to remove the loading state in Telegram
      answerCallbackQuery(callbackQueryId).catch(console.error);

      if (callbackData.startsWith('confirm_auth_')) {
        const token = callbackData.replace('confirm_auth_', '');
        const { data: businesses } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name');
        if (businesses) {
          const businessWithToken = businesses.find(b => b.pricing_rules?.globalSettings?.telegram_invite_token === token);
          if (businessWithToken) {
            const gs = businessWithToken.pricing_rules.globalSettings;
            const newOwner = {
              chatId: String(chatId),
              name: update.callback_query.from?.first_name || update.callback_query.from?.username || String(chatId),
              addedAt: new Date().toISOString(),
              status: 'granted'
            };
            
            let owners = Array.isArray(gs.authorized_telegram_owners) ? [...gs.authorized_telegram_owners] : [];
            if (!owners.some(o => o.chatId === newOwner.chatId)) {
              owners.push(newOwner);
            }
            
            const updatedPricingRules = {
              ...businessWithToken.pricing_rules,
              globalSettings: {
                ...gs,
                authorized_telegram_owners: owners,
                telegram_invite_token: null
              }
            };
            
            await supabase.from('businesses').update({ pricing_rules: updatedPricingRules }).eq('id', businessWithToken.id);
            if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
            await sendTelegramMessage(chatId, `✅ <b>Telegram Account Connected</b>\n\nYour Telegram account is now authorized for this business.\n\n<b>QControl Dashboard</b>\n${escapeHtml(businessWithToken.business_name || "")}\n\nPlease choose an action:`, MAIN_MENU_KEYBOARD);
            return NextResponse.json({ ok: true });
          }
        }
        if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
        await sendTelegramMessage(chatId, `❌ Invalid or expired invite link.`);
        return NextResponse.json({ ok: true });
      }

      if (callbackData === 'cancel_auth') {
        if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
        await sendTelegramMessage(chatId, `❌ Link cancelled.`);
        return NextResponse.json({ ok: true });
      }

      const context = await getBusinessContext(chatId);
      if (!context) {
        await sendTelegramMessage(chatId, '⚠️ Unauthorized.');
        return NextResponse.json({ ok: true });
      }

      if (context.isRevoked) {
        if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
        await sendTelegramMessage(chatId, `🔒 <b>Access Revoked</b>\n\nYour Telegram access to <b>${escapeHtml(context.business.business_name)}</b> has been revoked by the primary owner.\n\nPlease contact the primary business owner if you believe this was a mistake.`);
        return NextResponse.json({ ok: true });
      }

      const business = context.business;
      
      const fallbackName = update.callback_query.from?.first_name || update.callback_query.from?.username || 'telegram_bot';
      const ownerName = getOwnerName(business, chatId, fallbackName);

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
              if (messageId) {
                await editTelegramMessageText(chatId, messageId, `🎮 <b>How many players?</b>`, { inline_keyboard: [buttons] });
              } else {
                await sendTelegramMessage(chatId, `🎮 <b>How many players?</b>`, { inline_keyboard: [buttons] });
              }
            } else {
              await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
                  force_reply: true
              });
            }
        } else if (gameTypes.length > 1) {
            // Show buttons for available game types
            const gameButtons = gameTypes.map((g) => ({ text: g.charAt(0).toUpperCase() + g.slice(1), callback_data: `start_game_${tableId}_${g}` }));
            const buttons = chunkArray(gameButtons, 2);
            if (messageId) {
              await editTelegramMessageText(chatId, messageId, `🎱 Select Game Type for Table: ${tableId}`, { inline_keyboard: buttons });
            } else {
              await sendTelegramMessage(chatId, `🎱 Select Game Type for Table: ${tableId}`, { inline_keyboard: buttons });
            }
        } else {
            await sendTelegramMessage(chatId, `❌ No game types configured for this business.`, MAIN_MENU_KEYBOARD);
        }
      }
      else if (callbackData.startsWith('start_game_')) {
        // start_game_TABLEID_GAMETYPE
        const parts = callbackData.replace('start_game_', '').split('_');
        const tableId = parts[0];
        const gameType = parts[1];
        
        if (gameType.toLowerCase() === 'ps5') {
          const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `ps5_players_${tableId}_${num}` }));
          if (messageId) {
            await editTelegramMessageText(chatId, messageId, `🎮 <b>How many players?</b>`, { inline_keyboard: [buttons] });
          } else {
            await sendTelegramMessage(chatId, `🎮 <b>How many players?</b>`, { inline_keyboard: [buttons] });
          }
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
        
        if (messageId) {
          await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
        } else {
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
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
        if (messageId) {
          await editTelegramMessageText(chatId, messageId, '❌ Action cancelled.');
        } else {
          await sendTelegramMessage(chatId, '❌ Action cancelled.', MAIN_MENU_KEYBOARD);
        }
      }
      else if (callbackData === 'stop_menu_back') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          if (messageId) {
             await editTelegramMessageText(chatId, messageId, 'No active sessions to stop.', { inline_keyboard: [] });
          } else {
             await sendTelegramMessage(chatId, 'No active sessions to stop.', MAIN_MENU_KEYBOARD);
          }
          return NextResponse.json({ ok: true });
        }
        const sessionButtons = activeSessions.map(s => {
          let icon = '🎱';
          if (s.game_type === 'ps5') icon = '🎮';
          return { text: `${icon} ${s.table_id}`, callback_data: `stop_select_${s.id}` };
        });
        const buttons = chunkArray(sessionButtons, 2);
        
        if (messageId) {
           await editTelegramMessageText(chatId, messageId, `🛑 <b>Select the table to stop</b>\n\nWhich active session would you like to stop?`, { inline_keyboard: buttons });
        } else {
           await sendTelegramMessage(chatId, `🛑 <b>Select the table to stop</b>\n\nWhich active session would you like to stop?`, { inline_keyboard: buttons });
        }
      }
      else if (callbackData.startsWith('stop_select_')) {
        const sessionId = callbackData.replace('stop_select_', '');
        const session = await sessionRepository.findById(sessionId, business.id);
        if (!session || session.status !== 'ACTIVE') {
          await sendTelegramMessage(chatId, 'Session is not active or not found.', MAIN_MENU_KEYBOARD);
          return NextResponse.json({ ok: true });
        }
        
        const isPaused = typeof session.paused_at === 'string' && session.paused_at.trim() !== '';
        const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        const endFull = isPaused && typeof session.paused_at === 'string' ? session.paused_at : new Date().toISOString();
        
        let billText = '₹0';
        let billableDuration = '0m';
        try {
          const res = calculateBilling(startFull, endFull, session.game_type, business.pricing_rules, session.num_players || 1, undefined, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
          billText = `₹${Math.round(res.cost)}`;
          billableDuration = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
        } catch(e){}

        const pausedDurationMins = Math.floor((session.paused_duration_seconds || 0) / 60);
        const totalDurationMins = Math.max(0, Math.floor((new Date(endFull).getTime() - new Date(startFull).getTime()) / 60000));
        
        const pausedText = pausedDurationMins > 0 ? `${pausedDurationMins}m` : '0m';
        const totalText = totalDurationMins > 0 ? `${Math.floor(totalDurationMins/60)}h ${totalDurationMins%60}m` : '0m';
        
        let msg = `🎱 <b>Session Details</b>\n\n<b>Table:</b> ${session.table_id}\n<b>Player:</b> ${session.customer_name}\n<b>Game:</b> ${session.game_type}\n<b>Started:</b> ${formatTimeReadable(startFull)}\n<b>Current Time:</b> ${formatTimeReadable(endFull)}\n<b>Duration:</b> ${totalText}\n`;
        if (pausedDurationMins > 0) msg += `<b>Paused Time:</b> ${pausedText}\n`;
        msg += `<b>Billable Time:</b> ${billableDuration}\n<b>Current Bill:</b> ${billText}`;
        
        const buttons = [
          [
            { text: `🛑 Stop This Session`, callback_data: `end_${session.id}` },
            { text: `↩️ Back`, callback_data: `stop_menu_back` }
          ]
        ];
        
        if (messageId) {
          await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
        } else {
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
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
          // Optimistically update the button to Processing... to prevent duplicate clicks
          if (messageId && action !== 'confirm_playing') {
             editTelegramMessageReplyMarkup(chatId, messageId, {
                inline_keyboard: [[{ text: '⏳ Processing...', callback_data: 'ignore' }]]
             }).catch(console.error);
          }

          // Verify session exists
          const session = await sessionRepository.findById(sessionId, business.id);
          if (!session || session.status !== 'ACTIVE') {
            answerCallbackQuery(callbackQueryId, 'Session is not active or not found.').catch(console.error);
            if (messageId) {
              // Remove buttons if session is gone
              editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] }).catch(console.error);
            }
            return NextResponse.json({ ok: true });
          }

          // Use the identical intervene logic as dashboard
          try {
            await handleSessionIntervention({
              action,
              session_id: sessionId,
              business_id: business.id,
              amount_recovered: 0,
              performed_by: ownerName
            });
            
            answerCallbackQuery(callbackQueryId, `Success: ${actionPrefix}`).catch(console.error);
            
            if (action === 'confirm_playing') {
              if (messageId) {
                 editTelegramMessageText(chatId, messageId, `✅ Marked ${session.customer_name} on ${session.table_id} as still playing.`);
              } else {
                 await sendTelegramMessage(chatId, `✅ Marked ${session.customer_name} on ${session.table_id} as still playing.`, MAIN_MENU_KEYBOARD);
              }
            } else if (action === 'force_end') {
              const updatedSession = await sessionRepository.findById(sessionId, business.id);
              if (updatedSession) {
                const startFull = typeof updatedSession.start_time === 'string' && updatedSession.start_time.includes('T') ? updatedSession.start_time : `${updatedSession.date}, ${updatedSession.start_time}`;
                const endFull = typeof updatedSession.end_time === 'string' && updatedSession.end_time.trim() !== '' ? updatedSession.end_time : new Date().toISOString();
                const formattedStart = formatTimeReadable(startFull);
                const formattedEnd = formatTimeReadable(endFull);
                
                let finalCost = 0;
                let breakdownStr = '';
                let rateText = '₹0/hour';
                try {
                  const res = calculateBilling(startFull, endFull, updatedSession.game_type, business.pricing_rules, updatedSession.num_players || 1, undefined, updatedSession.paused_duration_seconds, updatedSession.locked_rate, updatedSession.locked_rate_name);
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
                
                const totalMs = Math.max(0, new Date(endFull).getTime() - new Date(startFull).getTime());
                const totalDurationMins = Math.floor(totalMs / 60000);
                const totalText = totalDurationMins > 0 ? `${Math.floor(totalDurationMins/60)}h ${totalDurationMins%60}m` : '0m';
                
                const pausedDurationMins = Math.floor((updatedSession.paused_duration_seconds || 0) / 60);
                const pausedText = pausedDurationMins > 0 ? `${pausedDurationMins}m` : '0m';

                const billableDurationText = updatedSession.duration?.replace(' min', 'm').replace(' hr ', 'h ') || '0m';
                
                let msg = `✅ <b>Session Stopped</b>\n\n<b>Table:</b> ${updatedSession.table_id}\n<b>Game:</b> ${updatedSession.game_type}\n<b>Player:</b> ${updatedSession.customer_name}\n\n🕐 <b>Start:</b> ${formattedStart}\n🕐 <b>End:</b> ${formattedEnd}\n⏱️ <b>Total Time:</b> ${totalText}\n⏸️ <b>Paused:</b> ${pausedText}\n🎯 <b>Billable Time:</b> ${billableDurationText}\n\n`;
                
                if (breakdownStr) {
                  msg += `<b>Final Bill:</b> ${billText}${breakdownStr}\n\n`;
                } else {
                  msg += `<b>Rate:</b> ${rateText}\n💰 <b>Final Bill:</b> ${billText}\n\n`;
                }
                
                msg += `Table is now <b>Available</b>.`;
                
                if (messageId) {
                  await editTelegramMessageText(chatId, messageId, msg);
                } else {
                  await sendTelegramMessage(chatId, msg, MAIN_MENU_KEYBOARD);
                }
              } else {
                if (messageId) {
                  await editTelegramMessageText(chatId, messageId, `🛑 Session Ended successfully.`);
                } else {
                  await sendTelegramMessage(chatId, `🛑 Session Ended successfully.`, MAIN_MENU_KEYBOARD);
                }
              }
            } else if (actionPrefix === 'resume' || actionPrefix === 'pause') {
              const updatedSession = await sessionRepository.findById(sessionId, business.id);
              if (updatedSession) {
                let billText = '₹0';
                let durationText = '0m';
                try {
                  const isPaused = typeof updatedSession.paused_at === 'string' && updatedSession.paused_at.trim() !== '';
                  const startFull = typeof updatedSession.start_time === 'string' && updatedSession.start_time.includes('T') ? updatedSession.start_time : `${updatedSession.date}, ${updatedSession.start_time}`;
                  const endFull = typeof updatedSession.paused_at === 'string' && updatedSession.paused_at.trim() !== '' ? updatedSession.paused_at : new Date().toISOString();
                  const res = calculateBilling(startFull, endFull, updatedSession.game_type, business.pricing_rules, updatedSession.num_players || 1, undefined, updatedSession.paused_duration_seconds, updatedSession.locked_rate, updatedSession.locked_rate_name);
                  billText = `₹${Math.round(res.cost)}`;
                  durationText = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
                } catch(e){}
                
                const isPaused = !!updatedSession.paused_at;
                const status = isPaused ? '⏸ Paused' : '▶️ Active';
                const msg = `<b>${updatedSession.table_id}</b>\nPlayer: ${updatedSession.customer_name}\nGame: ${updatedSession.game_type}\nStatus: ${status}\nDuration: ${durationText}\nCurrent Bill: ${billText}`;
                
                const buttons = [
                  [
                    isPaused 
                      ? { text: `▶️ Resume`, callback_data: `resume_${updatedSession.id}` }
                      : { text: `⏸ Pause`, callback_data: `pause_${updatedSession.id}` },
                    { text: `🛑 Stop`, callback_data: `end_${updatedSession.id}` }
                  ]
                ];
                
                if (messageId) {
                  await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
                } else {
                  await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
                }
              } else {
                if (messageId) {
                   await editTelegramMessageText(chatId, messageId, `✅ Session ${actionPrefix}d.`);
                } else {
                   await sendTelegramMessage(chatId, `✅ Session ${actionPrefix}d.`, MAIN_MENU_KEYBOARD);
                }
              }
            } else {
              if (messageId) {
                 await editTelegramMessageText(chatId, messageId, `✅ Session ${actionPrefix}d.`);
              } else {
                 await sendTelegramMessage(chatId, `✅ Session ${actionPrefix}d.`, MAIN_MENU_KEYBOARD);
              }
            }
          } catch(e: any) {
             console.error('Intervention Error:', e);
             await sendTelegramMessage(chatId, `❌ Failed: ${e.message || 'Error executing action'}`, MAIN_MENU_KEYBOARD);
          }
        }
      }

    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    // Always return 200 OK to Telegram to prevent it from retrying and suspending the webhook
    return NextResponse.json({ ok: true, error_logged: true });
  }
}
