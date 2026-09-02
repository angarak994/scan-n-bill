export const dynamic = 'force-dynamic';
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

function getMainMenuKeyboard(allActiveMembershipsCount: number = 0) {
  const keyboard = [
    [{ text: '▶️ Start Session' }, { text: '📋 Active Sessions' }],
    [{ text: '🛑 Stop Session' }, { text: '📅 Book Table' }],
    [{ text: '⏸ Paused Sessions' }, { text: '💰 Today\'s Summary' }]
  ];
  if (allActiveMembershipsCount > 1) {
    keyboard.push([{ text: '🏢 Switch Business' }]);
  }
  return { keyboard, resize_keyboard: true };
}

async function getBusinessContext(chatId: string | number) {
  const { data: businesses } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name');
  if (!businesses) return { activeMembership: null, allActiveMemberships: [], revokedContext: null };
  
  const searchId = String(chatId).trim();
  let revokedContext = null;
  let allActiveMemberships: any[] = [];
  let activeMembership = null;

  for (const b of businesses) {
    const gs = b.pricing_rules?.globalSettings;
    if (!gs) continue;
    
    if (Array.isArray(gs.authorized_telegram_owners)) {
      const owner = gs.authorized_telegram_owners.find((owner: any) => String(owner.chatId).trim() === searchId);
      if (owner) {
         const isPrimary = owner.role === 'PRIMARY_OWNER';
         if (owner.status === 'revoked') {
            const mem = { business: b, isRevoked: true, isPrimary, isActiveContext: owner.is_active_context === true };
            if (mem.isActiveContext) revokedContext = mem;
         } else {
            const mem = { business: b, isRevoked: false, isPrimary, isActiveContext: owner.is_active_context === true };
            allActiveMemberships.push(mem);
            if (mem.isActiveContext) activeMembership = mem;
         }
      }
    }
  }

  return { activeMembership, allActiveMemberships, revokedContext };
}

async function switchBusinessContext(chatId: string | number, targetBusinessId: string) {
  const searchId = String(chatId).trim();
  const { data: businesses } = await supabase.from('businesses').select('*');
  if (!businesses) return;
  
  for (const b of businesses) {
    const gs = b.pricing_rules?.globalSettings;
    if (!gs) continue;
    
    let isChanged = false;
    const shouldBeActive = String(b.id) === String(targetBusinessId);
    
    if (Array.isArray(gs.authorized_telegram_owners)) {
      const ownerIndex = gs.authorized_telegram_owners.findIndex((owner: any) => String(owner.chatId).trim() === searchId);
      if (ownerIndex > -1) {
         if (gs.authorized_telegram_owners[ownerIndex].is_active_context !== shouldBeActive) {
             gs.authorized_telegram_owners[ownerIndex].is_active_context = shouldBeActive;
             isChanged = true;
         }
      }
    }
    
    if (isChanged) {
       await supabase.from('businesses').update({ pricing_rules: b.pricing_rules }).eq('id', b.id);
    }
  }
}

const getOwnerName = (business: any, chatId: string | number, fallbackName: string) => {
  const searchId = String(chatId).trim();
  const gs = business?.pricing_rules?.globalSettings;

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

      if (text.startsWith('/start ') && text.includes('_auth_')) {
        const token = text.replace('/start ', '').trim();
        const { data: businesses, error } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name');
        
        if (error || !businesses) {
          await sendTelegramMessage(chatId, `⚠️ <b>Connection temporarily unavailable.</b>\nPlease try again.`);
          return NextResponse.json({ ok: true });
        }
        
        const businessWithToken = businesses.find(b => {
             const t = b.pricing_rules?.globalSettings?.telegram_invite_token;
             return typeof t === 'string' && (t === token || t.includes(token));
        });
        
        if (businessWithToken) {
            const gs = businessWithToken.pricing_rules.globalSettings;
            const storedToken = gs.telegram_invite_token;
            let role = 'Secondary Owner';
            let roleEnum = 'SECONDARY_OWNER';
            if (storedToken && storedToken.startsWith('PRIMARY_OWNER_')) {
                role = 'Primary Owner';
                roleEnum = 'PRIMARY_OWNER';
            }
            
            let owners = Array.isArray(gs.authorized_telegram_owners) ? [...gs.authorized_telegram_owners] : [];
            const alreadyConnected = owners.some(o => String(o.chatId) === String(chatId) && o.status !== 'revoked');
            
            if (alreadyConnected) {
               await sendTelegramMessage(chatId, `✅ <b>Already Connected</b>\n\nYour Telegram account is already connected to <b>${escapeHtml(businessWithToken.business_name)}</b>.`);
               return NextResponse.json({ ok: true });
            }
            
            const newOwner = {
              chatId: String(chatId),
              name: update.message.from?.first_name || update.message.from?.username || String(chatId),
              role: roleEnum,
              addedAt: new Date().toISOString(),
              status: 'granted',
              is_active_context: true
            };
            
            // Remove any previously revoked instance for this chatId
            owners = owners.filter(o => String(o.chatId) !== String(chatId));
            owners.push(newOwner);
            
            const updatedPricingRules = {
              ...businessWithToken.pricing_rules,
              globalSettings: {
                ...gs,
                authorized_telegram_owners: owners,
                telegram_invite_token: null // invalidate token
              }
            };
            
            await supabase.from('businesses').update({ pricing_rules: updatedPricingRules }).eq('id', businessWithToken.id);
            await switchBusinessContext(chatId, businessWithToken.id);
            
            const newCtx = await getBusinessContext(chatId);
            const newMainMenu = getMainMenuKeyboard(newCtx.allActiveMemberships.length);
            
            const msg = `✅ <b>Telegram Connected Successfully</b>\n\n🏢 Business: ${escapeHtml(businessWithToken.business_name || "")}\n👤 Role: ${role}\n\nYou can now manage this business directly from Telegram.`;
            await sendTelegramMessage(chatId, msg, newMainMenu);
            
            return NextResponse.json({ ok: true });
        }
        
        await sendTelegramMessage(chatId, `❌ <b>Connection Failed</b>\nThis Telegram connection link is invalid or expired.`);
        return NextResponse.json({ ok: true });
      }

      const ctx = await getBusinessContext(chatId);
      const mainMenu = getMainMenuKeyboard(ctx.allActiveMemberships.length);

      if (ctx.revokedContext && !ctx.activeMembership) {
        if (text !== '🏢 Switch Business' && !text.startsWith('switch_biz_') && !(text.startsWith('/start ') && text.includes('_auth_'))) {
          await sendTelegramMessage(chatId, `🔒 <b>Access Revoked</b>\n\nYour Telegram access to <b>${escapeHtml(ctx.revokedContext.business.business_name)}</b> has been revoked.\n\nYou no longer have access to this business.`, {
             reply_markup: {
                keyboard: ctx.allActiveMemberships.length > 0 ? [[{ text: '🏢 Switch Business' }]] : [],
                resize_keyboard: true
             }
          });
          return NextResponse.json({ ok: true });
        }
      }

      let business = ctx.activeMembership?.business;

      if (!business && ctx.allActiveMemberships.length === 1) {
          business = ctx.allActiveMemberships[0].business;
          if (business) switchBusinessContext(chatId, business.id).catch(console.error);
      }

      if (text === '🏢 Switch Business' || (text === '/menu' && ctx.allActiveMemberships.length > 1)) {
         if (ctx.allActiveMemberships.length > 1) {
            const bizButtons = ctx.allActiveMemberships.map(m => [{ text: `🏢 ${m.business.business_name}`, callback_data: `switch_biz_${m.business.id}` }]);
            await sendTelegramMessage(chatId, `🏢 <b>Select Business</b>\n\nWhich business would you like to manage?`, { inline_keyboard: bizButtons });
            return NextResponse.json({ ok: true });
         } else if (ctx.allActiveMemberships.length === 1) {
            business = ctx.allActiveMemberships[0].business;
            if (business) await switchBusinessContext(chatId, business.id);
            // continue to normal menu
         }
      }
      if (text === '/delete') {
         const primaryMemberships = ctx.allActiveMemberships.filter((m: any) => m.isPrimary);
         if (primaryMemberships.length === 0) {
            await sendTelegramMessage(chatId, `❌ You must be a primary business owner to use this command.`);
            return NextResponse.json({ ok: true });
         }
         
         if (primaryMemberships.length === 1) {
            // Directly show owners for this business
            const b = primaryMemberships[0].business;
            const owners = b.pricing_rules?.globalSettings?.authorized_telegram_owners || [];
            const secondaryOwners = owners.filter((o: any) => o.status !== 'revoked' && String(o.chatId) !== String(chatId));
            
            if (secondaryOwners.length === 0) {
               await sendTelegramMessage(chatId, `No other active owners found in <b>${escapeHtml(b.business_name)}</b>.`);
               return NextResponse.json({ ok: true });
            }
            
            const ownerButtons = secondaryOwners.map((o: any) => [{ text: `👤 ${o.name}`, callback_data: `delusr_${b.id}_${o.chatId}` }]);
            await sendTelegramMessage(chatId, `👤 Select an owner to permanently remove from <b>${escapeHtml(b.business_name)}</b>:`, { inline_keyboard: ownerButtons });
            return NextResponse.json({ ok: true });
         }
         
         // Multiple primary businesses
         const bizButtons = primaryMemberships.map((m: any) => [{ text: `🏢 ${m.business.business_name}`, callback_data: `delbiz_${m.business.id}` }]);
         await sendTelegramMessage(chatId, `🗑️ <b>Delete Telegram Access</b>

Select the business you want to manage:`, { inline_keyboard: bizButtons });
         return NextResponse.json({ ok: true });
      }


      if (text === '/start' || text === '/menu') {
        if (!business) {
          if (ctx.allActiveMemberships.length > 0) {
            const bizButtons = ctx.allActiveMemberships.map(m => [{ text: `🏢 ${m.business.business_name}`, callback_data: `switch_biz_${m.business.id}` }]);
            await sendTelegramMessage(chatId, `🏢 <b>Select Business</b>\n\nWhich business would you like to manage?`, { inline_keyboard: bizButtons });
          } else {
            await sendTelegramMessage(chatId, `👋 <b>Welcome to Qcontrol.</b>\n\nPlease use a valid business connection link to connect your Telegram account.`);
          }
        } else {
          await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${escapeHtml(business.business_name || "")}\n\nPlease choose an action:`, mainMenu);
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
            await sendTelegramMessage(chatId, `✅ <b>Session Started</b>\n\nPlayer: ${playerName}\nTable: ${tableId}\nGame: ${gameType}\nStarted At: ${formatTimeReadable(session.start_time)}`, mainMenu);
          } catch (error: any) {
            await sendTelegramMessage(chatId, `❌ Failed to start session: ${error.message}`, mainMenu);
          }
          return NextResponse.json({ ok: true });
        }
      }

      // Handle Main Menu Commands
      if (text === '▶️ Start Session') {
        const tables = business.tables || [];
        if (tables.length === 0) {
          await sendTelegramMessage(chatId, 'No tables configured for this business.', mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        const { data: activeSessions } = await supabase.from('sessions').select('table_id').eq('business_id', business.id).eq('status', 'ACTIVE');
        const activeTableIds = (activeSessions || []).map(s => s.table_id);
        
        const availableTables = tables.filter((t: any) => !activeTableIds.includes(t.id));
        
        if (availableTables.length === 0) {
          await sendTelegramMessage(chatId, 'All tables are currently active.', mainMenu);
          return NextResponse.json({ ok: true });
        }

        const tableButtons = availableTables.map((t: any) => ({ text: `🟢 ${t.id}`, callback_data: `start_table_${t.id}` }));
        const buttons = chunkArray(tableButtons, 2);
        await sendTelegramMessage(chatId, '▶️ Select an available table:', { inline_keyboard: buttons });
      } 
      else if (text === '📋 Active Sessions') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions running right now.', mainMenu);
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
          await sendTelegramMessage(chatId, 'No active sessions to stop.', mainMenu);
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
          await sendTelegramMessage(chatId, 'No active sessions right now.', mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        const pausedSessions = activeSessions.filter(s => typeof s.paused_at === 'string' && s.paused_at.trim() !== '');
        
        if (pausedSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No paused sessions right now.', mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        let msg = '⏸ <b>Paused Sessions</b>\n\n';
        pausedSessions.forEach(session => {
          const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          msg += `<b>${session.table_id}</b>\nPlayer: ${session.customer_name}\nGame: ${session.game_type}\nStarted: ${formatTimeReadable(startFull)}\nPaused At: ${formatTimeReadable(session.paused_at)}\n\n`;
        });
        await sendTelegramMessage(chatId, msg, mainMenu);
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
          await sendTelegramMessage(chatId, `No completed sessions today (${dateStr}).`, mainMenu);
        } else {
          let totalRevenue = 0;
          let totalDurationMins = 0;
          
          completedSessions.forEach(s => {
            totalRevenue += Number(s.cost) || 0;
            // duration is like "1 hr 30 min" or "45 min", we can just count sessions or try parsing.
            // Let's just do total revenue and session count.
          });
          
          const msg = `💰 <b>Today's Revenue</b> (${dateStr})\n\nTotal Sessions: ${completedSessions.length}\nTotal Revenue: ₹${Math.round(totalRevenue)}`;
          await sendTelegramMessage(chatId, msg, mainMenu);
        }
        return NextResponse.json({ ok: true });
      }
      else if (text === '📅 Book Table') {
        const dateStr = getCurrentISTDateStr();
        
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('business_id', business.id)
          .gte('booking_date', dateStr)
          .eq('status', 'confirmed')
          .order('start_time', { ascending: true });

        if (!bookings || bookings.length === 0) {
          await sendTelegramMessage(chatId, `No upcoming bookings for today (${dateStr}).`, mainMenu);
        } else {
          let msg = `📅 <b>Today's Bookings</b> (${dateStr})\n\n`;
          bookings.forEach((b, index) => {
            msg += `${index + 1}. <b>${b.table_id}</b> @ ${b.start_time}\n   Name: ${b.customer_name}\n   Duration: ${b.duration_minutes}m\n   Game: ${b.game_type || 'pool'}\n   Players: ${b.num_players || 1}\n\n`;
          });
          await sendTelegramMessage(chatId, msg, mainMenu);
        }
        return NextResponse.json({ ok: true });
      }
      else {
        // Main Menu
        await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${business.business_name}\n\nPlease choose an action:`, mainMenu);
      }
    }

const processedCallbacks = new Set<string>();

    // 2. Handle Callback Queries (Button Clicks)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const callbackQueryId = update.callback_query.id;

      if (processedCallbacks.has(callbackQueryId)) {
        return NextResponse.json({ ok: true });
      }
      processedCallbacks.add(callbackQueryId);
      setTimeout(() => processedCallbacks.delete(callbackQueryId), 5000);

      // Immediately acknowledge the callback to remove the loading state in Telegram
      answerCallbackQuery(callbackQueryId).catch(console.error);
      
      // Optimistically update the button to Processing... to prevent duplicate clicks and provide instant feedback
      const slowActions = ['start_table_', 'start_game_', 'ps5_players_', 'ps5_start_', 'stop_select_', 'switch_biz_', 'delbiz_', 'delusr_'];
      if (slowActions.some(prefix => callbackData.startsWith(prefix))) {
         if (messageId) {
             editTelegramMessageReplyMarkup(chatId, messageId, {
                inline_keyboard: [[{ text: '⏳ Processing...', callback_data: 'ignore' }]]
             }).catch(console.error);
         }
      }

      if (callbackData === 'cancel_auth') {
        if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
        await sendTelegramMessage(chatId, `❌ Link cancelled.`);
        return NextResponse.json({ ok: true });
      }

      const ctx = await getBusinessContext(chatId);
      const mainMenu = getMainMenuKeyboard(ctx.allActiveMemberships.length);
      if (callbackData.startsWith('delbiz_')) {
          const targetBizId = callbackData.replace('delbiz_', '');
          const b = ctx.allActiveMemberships.find((m: any) => m.isPrimary && m.business.id === targetBizId)?.business;
          
          if (!b) {
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, '❌ Unauthorized.');
             return NextResponse.json({ ok: true });
          }
          
          const owners = b.pricing_rules?.globalSettings?.authorized_telegram_owners || [];
          const secondaryOwners = owners.filter((o: any) => o.status !== 'revoked' && String(o.chatId) !== String(chatId));
          
          if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
          if (secondaryOwners.length === 0) {
             await sendTelegramMessage(chatId, `No other active owners found in <b>${escapeHtml(b.business_name)}</b>.`);
             return NextResponse.json({ ok: true });
          }
          
          const ownerButtons = secondaryOwners.map((o: any) => [{ text: `👤 ${o.name}`, callback_data: `delusr_${b.id}_${o.chatId}` }]);
          await sendTelegramMessage(chatId, `👤 Select an owner to permanently remove from <b>${escapeHtml(b.business_name)}</b>:`, { inline_keyboard: ownerButtons });
          return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('delusr_')) {
          const parts = callbackData.replace('delusr_', '').split('_');
          const targetBizId = parts[0];
          const targetChatId = parts[1];
          const b = ctx.allActiveMemberships.find((m: any) => m.isPrimary && m.business.id === targetBizId)?.business;
          
          if (!b) {
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, '❌ Unauthorized.');
             return NextResponse.json({ ok: true });
          }
          
          const owners = b.pricing_rules?.globalSettings?.authorized_telegram_owners || [];
          const targetOwner = owners.find((o: any) => String(o.chatId) === targetChatId);
          
          if (!targetOwner) {
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, '❌ Owner not found.');
             return NextResponse.json({ ok: true });
          }
          
          if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
          
          const confirmKeyboard = {
             inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'cancel_auth' }],
                [{ text: '🗑️ Permanently Delete', callback_data: `confirmdel_${targetBizId}_${targetChatId}` }]
             ]
          };
          
          await sendTelegramMessage(chatId, `⚠️ <b>Permanently Remove Access?</b>

Business: ${escapeHtml(b.business_name)}
Owner: ${escapeHtml(targetOwner.name)}
Telegram: <code>${targetChatId}</code>

This will permanently remove this user's Telegram access to this business.

This action cannot be undone automatically.`, confirmKeyboard);
          return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('confirmdel_')) {
          const parts = callbackData.replace('confirmdel_', '').split('_');
          const targetBizId = parts[0];
          const targetChatId = parts[1];
          const b = ctx.allActiveMemberships.find((m: any) => m.isPrimary && m.business.id === targetBizId)?.business;
          
          if (!b) {
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, '❌ Unauthorized.');
             return NextResponse.json({ ok: true });
          }
          
          const owners = b.pricing_rules?.globalSettings?.authorized_telegram_owners || [];
          const targetOwnerIndex = owners.findIndex((o: any) => String(o.chatId) === targetChatId);
          
          if (targetOwnerIndex > -1) {
             const deletedOwner = owners[targetOwnerIndex];
             owners.splice(targetOwnerIndex, 1);
             
             const updatedPricingRules = {
               ...b.pricing_rules,
               globalSettings: {
                 ...b.pricing_rules.globalSettings,
                 authorized_telegram_owners: owners
               }
             };
             
             await supabase.from('businesses').update({ pricing_rules: updatedPricingRules }).eq('id', b.id);
             
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, `✅ <b>Access permanently removed.</b>`);
             
             // Notify the deleted user
             // Calculate their remaining active memberships to decide whether to show Switch Business button
             const delCtx = await getBusinessContext(targetChatId);
             let kb = [];
             if (delCtx.allActiveMemberships.length > 0) {
                 kb.push([{ text: '🏢 Switch Business' }]);
             }
             await sendTelegramMessage(targetChatId, `❌ <b>Access Permanently Removed</b>

Your Telegram access to <b>${escapeHtml(b.business_name)}</b> has been permanently removed by the primary owner.

You can still access other businesses associated with your Telegram account.`, { reply_markup: { keyboard: kb, resize_keyboard: true } });
          } else {
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, '❌ Owner not found or already deleted.');
          }
          return NextResponse.json({ ok: true });
      }


      if (callbackData.startsWith('switch_biz_')) {
          const targetBiz = callbackData.replace('switch_biz_', '');
          await switchBusinessContext(chatId, targetBiz);
          const newCtx = await getBusinessContext(chatId);
          if (newCtx.activeMembership) {
             const newMainMenu = getMainMenuKeyboard(newCtx.allActiveMemberships.length);
             if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
             await sendTelegramMessage(chatId, `✅ <b>Business Selected</b>\n\nYou are now managing:\n🏢 ${escapeHtml(newCtx.activeMembership.business.business_name)}`, newMainMenu);
          }
          return NextResponse.json({ ok: true });
      }

      if (ctx.revokedContext && !ctx.activeMembership) {
        if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
        await sendTelegramMessage(chatId, `🔒 <b>Access Revoked</b>\n\nYour Telegram access to <b>${escapeHtml(ctx.revokedContext.business.business_name)}</b> has been revoked.\n\nYou no longer have access to this business.`);
        return NextResponse.json({ ok: true });
      }

      let business = ctx.activeMembership?.business;
      if (!business && ctx.allActiveMemberships.length === 1) {
          business = ctx.allActiveMemberships[0].business;
          if (business) switchBusinessContext(chatId, business.id).catch(console.error);
      }

      if (!business) {
        await sendTelegramMessage(chatId, '⚠️ Unauthorized or no active business selected.');
        return NextResponse.json({ ok: true });
      }
      
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
            await sendTelegramMessage(chatId, `❌ No game types configured for this business.`, mainMenu);
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
          await sendTelegramMessage(chatId, '❌ Action cancelled.', mainMenu);
        }
      }
      else if (callbackData === 'stop_menu_back') {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          if (messageId) {
             await editTelegramMessageText(chatId, messageId, 'No active sessions to stop.', { inline_keyboard: [] });
          } else {
             await sendTelegramMessage(chatId, 'No active sessions to stop.', mainMenu);
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
          await sendTelegramMessage(chatId, 'Session is not active or not found.', mainMenu);
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
            const { dbUpdates } = await handleSessionIntervention({
              action,
              session_id: sessionId,
              business_id: business.id,
              amount_recovered: 0,
              performed_by: 'Qbot'
            });
            
            answerCallbackQuery(callbackQueryId, `Success: ${actionPrefix}`).catch(console.error);
            
            if (action === 'confirm_playing') {
              if (messageId) {
                 editTelegramMessageText(chatId, messageId, `✅ Marked ${session.customer_name} on ${session.table_id} as still playing.`);
              } else {
                 await sendTelegramMessage(chatId, `✅ Marked ${session.customer_name} on ${session.table_id} as still playing.`, mainMenu);
              }
            } else if (action === 'force_end') {
              const updatedSession = { ...session, ...dbUpdates };
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
                  await sendTelegramMessage(chatId, msg, mainMenu);
                }
              } else {
                if (messageId) {
                  await editTelegramMessageText(chatId, messageId, `🛑 Session Ended successfully.`);
                } else {
                  await sendTelegramMessage(chatId, `🛑 Session Ended successfully.`, mainMenu);
                }
              }
            } else if (actionPrefix === 'resume' || actionPrefix === 'pause') {
              const updatedSession = { ...session, ...dbUpdates };
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
                   await sendTelegramMessage(chatId, `✅ Session ${actionPrefix}d.`, mainMenu);
                }
              }
            } else {
              if (messageId) {
                 await editTelegramMessageText(chatId, messageId, `✅ Session ${actionPrefix}d.`);
              } else {
                 await sendTelegramMessage(chatId, `✅ Session ${actionPrefix}d.`, mainMenu);
              }
            }
          } catch(e: any) {
             console.error('Intervention Error:', e);
             await sendTelegramMessage(chatId, `❌ Failed: ${e.message || 'Error executing action'}`, mainMenu);
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
