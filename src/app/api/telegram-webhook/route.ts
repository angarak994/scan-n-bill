export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { getCurrentRate, formatTimeReadable, getCurrentISTDateStr } from '@/lib/billing';
import { calculateServerBillingForSession } from '@/lib/sessionManager';
import { handleSessionIntervention } from '@/lib/services/interventionService';
import { startSession } from '@/lib/sessionManager';
import { generateQpulseInsight } from '@/lib/services/qpulseService';
import { bookingService } from '@/lib/services/bookingService';
import { checkRateLimit, getIpAddress } from '@/lib/utils/rateLimit';
import { SupportedLanguage, translations } from '@/lib/i18n';
import { PerformanceTracker, getBotMetrics } from '@/lib/telegram/metrics';
import { invalidateBusinessCache as invalidateGlobalBusinessCache, registerCacheInvalidationListener } from '@/lib/businessManager';
import { renderFbHub, generateEndOfDayDigest, handleFbCallback, getTodayFbStats } from '@/lib/telegram/fbOrderingService';

import { TelegramClient } from '@/lib/telegram/telegramClient';
import { DeliveryManager } from '@/lib/telegram/deliveryManager';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

function escapeHtml(text: string) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  if (!process.env.TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN) return;
  try {
    return await TelegramClient.sendMessage(chatId, text, replyMarkup);
  } catch (e: any) {
    console.error('Failed to send telegram message', e?.message || e);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN) return;
  try {
    return await TelegramClient.answerCallbackQuery(callbackQueryId, text);
  } catch (e) {}
}

async function editTelegramMessageText(chatId: string | number, messageId: number, text: string, replyMarkup?: any) {
  if (!process.env.TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN) return;
  try {
    return await TelegramClient.editMessageText(chatId, messageId, text, replyMarkup);
  } catch (e: any) {
    console.error('Failed to edit telegram message text', e?.message || e);
  }
}

async function editTelegramMessageReplyMarkup(chatId: string | number, messageId: number, replyMarkup: any) {
  if (!process.env.TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN) return;
  try {
    return await TelegramClient.editMessageReplyMarkup(chatId, messageId, replyMarkup);
  } catch (e: any) {
    console.error('Failed to edit telegram message markup', e?.message || e);
  }
}


function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function getMainMenuKeyboard(allActiveMembershipsCount: number = 0, lang: SupportedLanguage = 'en') {
  const dict = translations[lang] || translations.en;
  const keyboard = [
    [{ text: dict.tg_start_session }, { text: dict.tg_active_sessions }],
    [{ text: dict.tg_fb_orders }, { text: dict.tg_member_qkhata }],
    [{ text: dict.tg_stop_session }, { text: dict.tg_book_table }],
    [{ text: dict.tg_paused_sessions }, { text: dict.tg_today_summary }],
    [{ text: dict.tg_change_language }]
  ];
  if (allActiveMembershipsCount > 1) {
    keyboard.push([{ text: dict.tg_switch_business }]);
  }
  return { keyboard, resize_keyboard: true };
}

interface AggregatedMemberCustomer {
  primaryId: string;
  name: string;
  phone?: string;
  totalOutstanding: number;
  customerIds: string[];
}

function aggregateMemberCustomers(rawCustomers: any[], memberships: any[], includeZeroBalance = false): AggregatedMemberCustomer[] {
  if (!memberships || memberships.length === 0) return [];

  const memberMap = new Map<string, AggregatedMemberCustomer>();

  // Seed with registered memberships so each registered member is represented accurately
  for (const m of memberships) {
    const key = (m.mobile && m.mobile.trim()) || m.id || (m.name && m.name.trim().toLowerCase());
    if (!key) continue;

    memberMap.set(key, {
      primaryId: m.id,
      name: m.name ? m.name.trim() : 'Member',
      phone: m.mobile ? m.mobile.trim() : undefined,
      totalOutstanding: 0,
      customerIds: []
    });
  }

  // Aggregate all matching customer records
  if (rawCustomers && rawCustomers.length > 0) {
    for (const c of rawCustomers) {
      const cPhone = c.phone?.trim();
      const cName = c.name?.trim().toLowerCase();

      const matchedMembership = memberships.find((m: any) => 
        (m.mobile && cPhone && m.mobile.trim() === cPhone) ||
        (m.name && cName && m.name.trim().toLowerCase() === cName) ||
        m.id === c.id
      );

      if (!matchedMembership) continue;

      const key = (matchedMembership.mobile && matchedMembership.mobile.trim()) || 
                  matchedMembership.id || 
                  (matchedMembership.name && matchedMembership.name.trim().toLowerCase());

      const entry = memberMap.get(key);
      if (entry) {
        entry.totalOutstanding += (Number(c.outstanding_balance) || 0);
        entry.customerIds.push(c.id);
        // Prioritize a customer record that matches membership id or has a valid phone
        if (c.id === matchedMembership.id || !entry.primaryId || (c.phone && !entry.phone)) {
          entry.primaryId = c.id;
        }
      }
    }
  }

  const results = Array.from(memberMap.values());
  if (includeZeroBalance) {
    return results;
  }
  return results.filter(m => m.totalOutstanding > 0).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
}

async function getMemberSiblingCustomerRows(businessId: string, customerRefOrId: string): Promise<{ customer: any; siblingRows: any[]; membership?: any }> {
  const [customersRes, membershipsRes] = await Promise.all([
    supabase.from('customers').select('*').eq('business_id', businessId),
    supabase.from('memberships').select('*').eq('business_id', businessId)
  ]);

  const allCustomers = customersRes.data || [];
  const allMemberships = membershipsRes.data || [];

  const searchId = (customerRefOrId || '').trim().toLowerCase();

  // Find target customer row by full ID or prefix (Ref: #...)
  const targetCust = allCustomers.find(c => 
    c.id.toLowerCase() === searchId || 
    c.id.toLowerCase().startsWith(searchId)
  );

  // Find linked membership
  const targetMem = allMemberships.find(m => 
    m.id.toLowerCase() === searchId || 
    m.id.toLowerCase().startsWith(searchId) ||
    (targetCust && (
      (m.mobile && targetCust.phone && m.mobile.trim() === targetCust.phone.trim()) ||
      (m.name && targetCust.name && m.name.trim().toLowerCase() === targetCust.name.trim().toLowerCase()) ||
      m.id === targetCust.id
    ))
  );

  // Match all customer rows for this member/person across phone, name, and ID
  const siblingRows = allCustomers.filter(c => {
    if (targetCust && c.id === targetCust.id) return true;
    if (targetMem) {
      if (c.id === targetMem.id) return true;
      if (targetMem.mobile && c.phone && targetMem.mobile.trim() === c.phone.trim()) return true;
      if (targetMem.name && c.name && targetMem.name.trim().toLowerCase() === c.name.trim().toLowerCase()) return true;
    }
    if (targetCust) {
      if (targetCust.phone && c.phone && targetCust.phone.trim() === c.phone.trim()) return true;
      if (targetCust.name && c.name && targetCust.name.trim().toLowerCase() === c.name.trim().toLowerCase()) return true;
    }
    return false;
  });

  const primaryCustomer = (targetMem && siblingRows.find(c => c.id === targetMem.id)) || 
                          siblingRows.find(c => c.phone) || 
                          targetCust || 
                          siblingRows[0] || 
                          null;

  return { customer: primaryCustomer, siblingRows, membership: targetMem };
}

const businessContextCache = new Map<string, { data: any, expiresAt: number }>();
let globalBusinessesCache: { data: any[]; expiresAt: number } | null = null;
const TELEGRAM_CACHE_TTL_MS = 3000; // 3 seconds TTL ensures near real-time state synchronization

function invalidateTelegramCache(): void {
  globalBusinessesCache = null;
  businessContextCache.clear();
}

function invalidateBusinessCache(): void {
  invalidateTelegramCache();
}

// Invalidate Telegram cache whenever business settings change across the application
registerCacheInvalidationListener(() => {
  invalidateTelegramCache();
});

async function getAllBusinesses(forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (!forceRefresh && globalBusinessesCache && globalBusinessesCache.expiresAt > now) {
    return globalBusinessesCache.data;
  }
  const { data, error } = await supabase
    .from('businesses')
    .select('id, pricing_rules, tables, business_name, menu_items');

  if (error || !data) {
    return globalBusinessesCache?.data || [];
  }
  globalBusinessesCache = { data, expiresAt: now + TELEGRAM_CACHE_TTL_MS };
  return data;
}

async function getBusinessContext(chatId: string | number, forceRefresh = false) {
  const searchId = String(chatId).trim();
  const now = Date.now();
  
  if (!forceRefresh) {
    const cached = businessContextCache.get(searchId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  const businesses = await getAllBusinesses(forceRefresh);

  if (!businesses || businesses.length === 0) {
    const emptyResult = { activeMembership: null, allActiveMemberships: [], revokedContext: null };
    businessContextCache.set(searchId, { data: emptyResult, expiresAt: now + TELEGRAM_CACHE_TTL_MS });
    return emptyResult;
  }
  
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
         const userLanguage = (owner.language || 'en') as SupportedLanguage;
         if (owner.status === 'revoked') {
            const mem = { business: b, isRevoked: true, isPrimary, isActiveContext: owner.is_active_context === true, userLanguage };
            if (mem.isActiveContext) revokedContext = mem;
         } else {
            const mem = { business: b, isRevoked: false, isPrimary, isActiveContext: owner.is_active_context === true, userLanguage };
            allActiveMemberships.push(mem);
            if (mem.isActiveContext) activeMembership = mem;
         }
      }
    }
  }
  const result = { activeMembership, allActiveMemberships, revokedContext };
  businessContextCache.set(searchId, { data: result, expiresAt: now + TELEGRAM_CACHE_TTL_MS });
  return result;
}

async function setUserLanguage(chatId: string | number, businessId: string, lang: SupportedLanguage) {
  const searchId = String(chatId).trim();
  const { data: b } = await supabase.from('businesses').select('id, pricing_rules').eq('id', businessId).single();
  if (!b) return;
  const gs = b.pricing_rules?.globalSettings;
  if (!gs || !Array.isArray(gs.authorized_telegram_owners)) return;
  
  const ownerIndex = gs.authorized_telegram_owners.findIndex((owner: any) => String(owner.chatId).trim() === searchId);
  if (ownerIndex > -1) {
    gs.authorized_telegram_owners[ownerIndex].language = lang;
    await supabase.from('businesses').update({ pricing_rules: b.pricing_rules }).eq('id', b.id);
  }
  invalidateBusinessCache();
}

async function switchBusinessContext(chatId: string | number, targetBusinessId: string) {
  const searchId = String(chatId).trim();
  const businesses = await getAllBusinesses(false);
  
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
  invalidateBusinessCache();
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
    if (url.searchParams.get('metrics') === 'true') {
      return NextResponse.json(getBotMetrics());
    }
    if (url.searchParams.get('ping') === 'true') {
      return NextResponse.json({ ok: true, status: 'warm', timestamp: Date.now() });
    }
    if (url.searchParams.get('status') === 'true') {
      const status = await DeliveryManager.getWebhookStatus();
      return NextResponse.json(status);
    }
    if (url.searchParams.get('restore') === 'true' || url.searchParams.get('selfheal') === 'true') {
      const dropPending = url.searchParams.get('drop') === 'true';
      const result = await DeliveryManager.ensureWebhookRegistered({ force: true, dropPending });
      return NextResponse.json(result);
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    // Default: Check and ensure webhook is correctly registered
    const result = await DeliveryManager.ensureWebhookRegistered();
    return NextResponse.json({
      success: result.success,
      action: result.actionTaken,
      webhookUrl: result.newUrl || result.previousUrl,
      message: result.message
    });
  } catch (error: any) {
    console.error('Failed to inspect/set webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const qpulseCache = new Map<string, { data: any; expiresAt: number }>();
async function getCachedQpulseInsight(bizId: string) {
  const now = Date.now();
  const cached = qpulseCache.get(bizId);
  if (cached && cached.expiresAt > now) return cached.data;
  try {
    const data = await generateQpulseInsight(bizId);
    qpulseCache.set(bizId, { data, expiresAt: now + 30 * 60 * 1000 });
    return data;
  } catch {
    return null;
  }
}

async function processWebhook(update: any, tracker?: PerformanceTracker) {
  if (!TELEGRAM_BOT_TOKEN) {
    return;
  }

  try {
    // 1. Handle regular messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith('/start ') && text.includes('_auth_')) {
        const token = text.replace('/start ', '').trim();
        const { data: businesses, error } = await supabase.from('businesses').select('id, pricing_rules, tables, business_name, menu_items');
        
        if (error || !businesses) {
          await sendTelegramMessage(chatId, `⚠️ <b>Connection temporarily unavailable.</b>\nPlease try again.`);
          return NextResponse.json({ ok: true });
        }
        
        const businessWithToken = businesses.find(b => {
             const t = b.pricing_rules?.globalSettings?.telegram_invite_token;
             return typeof t === 'string' && (t === token || token.includes(t));
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
            const userLang = (newCtx.activeMembership?.userLanguage || 'en') as SupportedLanguage;
            const newMainMenu = getMainMenuKeyboard(newCtx.allActiveMemberships.length, userLang);
            
            const msg = `✅ <b>Telegram Connected Successfully</b>\n\n🏢 Business: ${escapeHtml(businessWithToken.business_name || "")}\n👤 Role: ${role}\n\nYou can now manage this business directly from Telegram.`;
            await sendTelegramMessage(chatId, msg, newMainMenu);
            
            return NextResponse.json({ ok: true });
        }
        
        await sendTelegramMessage(chatId, `❌ <b>Connection Failed</b>\nThis Telegram connection link is invalid or expired.`);
        return NextResponse.json({ ok: true });
      }

      const ctx = await getBusinessContext(chatId);
      const userLang = (ctx.activeMembership?.userLanguage || 'en') as SupportedLanguage;
      const mainMenu = getMainMenuKeyboard(ctx.allActiveMemberships.length, userLang);

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
            const bizButtons = ctx.allActiveMemberships.map((m: any) => [{ text: `🏢 ${m.business.business_name}`, callback_data: `switch_biz_${m.business.id}` }]);
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
            const bizButtons = ctx.allActiveMemberships.map((m: any) => [{ text: `🏢 ${m.business.business_name}`, callback_data: `switch_biz_${m.business.id}` }]);
            await sendTelegramMessage(chatId, `🏢 <b>Select Business</b>\n\nWhich business would you like to manage?`, { inline_keyboard: bizButtons });
          } else {
            await sendTelegramMessage(chatId, `👋 <b>Welcome to Qcontrol.</b>\n\nPlease use a valid business connection link to connect your Telegram account.`);
          }
        } else {
          await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${escapeHtml(business.business_name || "")}\n\nPlease choose an action:`, mainMenu);
        }
        return NextResponse.json({ ok: true });
      }

      const normalizedCmd = (text || '').trim().toLowerCase().split('@')[0];
      if (normalizedCmd === '/lazy' || normalizedCmd === '/notlazy' || normalizedCmd === '/lazymode') {
        if (!business) {
          await sendTelegramMessage(chatId, `⚠️ Unauthorized.\n\nYour Chat ID is <code>${chatId}</code>. Please link it in your QControl Dashboard Settings.`);
          return NextResponse.json({ ok: true });
        }

        if (normalizedCmd === '/lazymode') {
          const { data: freshBiz } = await supabase.from('businesses').select('pricing_rules').eq('id', business.id).single();
          const currentRules = freshBiz?.pricing_rules || business.pricing_rules;
          const isCurrentlyLazy = !!currentRules?.globalSettings?.lazy_mode_enabled;
          if (isCurrentlyLazy) {
            await sendTelegramMessage(chatId, `⚡ <b>Lazy Mode is currently ON.</b>\n\nSessions start instantly for "Guest" without prompting for names.\nTo disable it, send /notlazy.`, mainMenu);
          } else {
            await sendTelegramMessage(chatId, `🛑 <b>Lazy Mode is currently OFF.</b>\n\nStandard flow is active (prompts for customer/member details).\nTo enable it, send /lazy.`, mainMenu);
          }
          return NextResponse.json({ ok: true });
        }

        const isLazy = normalizedCmd === '/lazy';

        try {
          const { data: freshBiz, error: fetchErr } = await supabase
            .from('businesses')
            .select('pricing_rules')
            .eq('id', business.id)
            .single();

          if (fetchErr) throw fetchErr;

          const currentPricingRules = freshBiz?.pricing_rules || business.pricing_rules || {};
          const updatedPricingRules = {
            ...currentPricingRules,
            globalSettings: {
              ...(currentPricingRules.globalSettings || {}),
              lazy_mode_enabled: isLazy
            }
          };

          const { error: updateErr } = await supabase
            .from('businesses')
            .update({ pricing_rules: updatedPricingRules })
            .eq('id', business.id);

          if (updateErr) throw updateErr;

          business.pricing_rules = updatedPricingRules;
          invalidateTelegramCache();
          invalidateGlobalBusinessCache(business.id);

          if (isLazy) {
            await sendTelegramMessage(chatId, `⚡ <b>Lazy Mode is ON!</b>\n\nYou can now start sessions instantly without entering customer names.\nJust select a table and the session will start for "Guest". You can also type a table name (e.g. "T1") to start it immediately.`, mainMenu);
          } else {
            await sendTelegramMessage(chatId, `🛑 <b>Lazy Mode is OFF.</b>\n\nThe standard flow is restored. You will be prompted for customer details when starting a session.`, mainMenu);
          }
        } catch (e: any) {
          console.error('Error updating Lazy Mode via Telegram:', e);
          await sendTelegramMessage(chatId, `❌ Error updating Lazy Mode: ${e.message}`, mainMenu);
        }
        return NextResponse.json({ ok: true });
      }

      if (!business) {
        await sendTelegramMessage(chatId, `⚠️ Unauthorized.\n\nYour Chat ID is <code>${chatId}</code>. Please link it in your QControl Dashboard Settings.`);
        return NextResponse.json({ ok: true });
      }

      if (update.message.reply_to_message) {
        const replyText = update.message.reply_to_message.text;

        if (replyText.includes('Enter Customer Name for Booking')) {
          const lines = replyText.split('\n');
          const gameLine = lines.find((l: string) => l.startsWith('Game:'));
          const playersLine = lines.find((l: string) => l.startsWith('Players:'));
          const dateLine = lines.find((l: string) => l.startsWith('Date:'));
          const timeLine = lines.find((l: string) => l.startsWith('Time:'));
          const tableLine = lines.find((l: string) => l.startsWith('Table:'));
          
          if (!gameLine || !dateLine || !timeLine || !tableLine) return NextResponse.json({ ok: true });
          
          const gameType = gameLine.replace('Game:', '').trim();
          const numPlayers = playersLine ? parseInt(playersLine.replace('Players:', '').trim()) : 1;
          const dateStr = dateLine.replace('Date:', '').trim();
          const timeStr = timeLine.replace('Time:', '').trim();
          const tableId = tableLine.replace('Table:', '').trim();
          
          const playerName = text;
          
          try {
             // Create booking via authoritative booking service
             const bookingResult = await bookingService.createAtomicBooking({
                 business_id: business.id,
                 customer_name: playerName,
                 customer_phone: '',
                 table_id: tableId,
                 booking_date: dateStr,
                 start_time: timeStr,
                 duration_minutes: 60,
                 game_type: gameType,
                 num_players: numPlayers,
                 source: 'telegram'
             });
             
             if (!bookingResult.success) {
                 await sendTelegramMessage(chatId, `❌ Cannot complete booking: ${bookingResult.reason || 'Slot is unavailable.'}`, mainMenu);
                 return NextResponse.json({ ok: true });
             }
             
             await sendTelegramMessage(chatId, `✅ <b>Booking Confirmed</b>

Name: ${playerName}
Table: ${tableId}
Date: ${dateStr}
Time: ${timeStr}`, mainMenu);
          } catch(e: any) {
             await sendTelegramMessage(chatId, `❌ Failed to create booking: ${e.message}`, mainMenu);
          }
          return NextResponse.json({ ok: true });
        }

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

        if (replyText.includes('Enter payment amount for')) {
          const amountStr = text.replace(/[^0-9.]/g, '');
          const amount = parseFloat(amountStr);
          if (isNaN(amount) || amount <= 0) {
             await sendTelegramMessage(chatId, `❌ Invalid amount. Transaction cancelled.`, mainMenu);
             return NextResponse.json({ ok: true });
          }
          
          const lines = replyText.split('\n');
          let customerRefOrId = '';
          const refLine = lines.find((l: string) => l.startsWith('Ref: #'));
          if (refLine) {
             customerRefOrId = refLine.replace('Ref: #', '').trim().toLowerCase();
          } else {
             const idLine = lines.find((l: string) => l.startsWith('ID:'));
             if (idLine) {
                 customerRefOrId = idLine.replace('ID:', '').trim();
             }
          }
          
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerRefOrId);
          
          if (!customer && siblingRows.length === 0) {
             await sendTelegramMessage(chatId, `❌ Member not found.`, mainMenu);
             return NextResponse.json({ ok: true });
          }
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const previousTotalBalance = siblingRows.reduce((sum, c) => sum + (Number(c.outstanding_balance) || 0), 0);
          const newRemainingBalance = previousTotalBalance - amount;

          try {
             const { createLedgerEntryAndPayment } = require('@/lib/services/paymentService');
             await createLedgerEntryAndPayment({
                 businessId: business.id,
                 customerName: primaryCustomer.name.trim(),
                 customerId: primaryCustomer.id,
                 totalBilled: 0,
                 amountPaid: amount,
                 paymentMethod: 'Cash',
                 paymentStatus: 'Paid',
                 source: 'Telegram Bot'
             });
             
             // Consolidate balances across all sibling records:
             // Primary customer row holds the true newRemainingBalance, other sibling rows set to 0
             const otherSiblingIds = siblingRows.filter(c => c.id !== primaryCustomer.id).map(c => c.id);
             if (otherSiblingIds.length > 0) {
                await supabase.from('customers').update({ outstanding_balance: 0 }).in('id', otherSiblingIds);
             }
             await supabase.from('customers').update({ outstanding_balance: newRemainingBalance }).eq('id', primaryCustomer.id);

             const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
             const remainingDisplay = Math.max(0, Math.round(newRemainingBalance));
             const overpaidStr = newRemainingBalance < 0 ? ` (Overpaid: ₹${Math.abs(Math.round(newRemainingBalance))})` : '';

             await sendTelegramMessage(chatId, `✅ <b>Payment Recorded</b>\n\nCollected: ₹${amount}\nFrom: ${displayName}\nRemaining Balance: ₹${remainingDisplay}${overpaidStr}`, mainMenu);
          } catch(e: any) {
             await sendTelegramMessage(chatId, `❌ Failed to record payment: ${e.message}`, mainMenu);
          }
          return NextResponse.json({ ok: true });
        }
        
        if (replyText.includes('Enter charge amount for')) {
            const parts = text.trim().split(' ');
            const amountStr = parts[0].replace(/[^0-9.]/g, '');
            const amount = parseFloat(amountStr);
            
            if (isNaN(amount) || amount <= 0) {
                await sendTelegramMessage(chatId, `❌ Invalid amount. Transaction cancelled.`, mainMenu);
                return NextResponse.json({ ok: true });
            }
            
            const reason = parts.slice(1).join(' ').trim() || 'Manual Charge';
            const reasonB64 = Buffer.from(reason).toString('base64');
            
            const lines = replyText.split('\n');
            const idLine = lines.find((l: string) => l.startsWith('ID:'));
            if (!idLine) return NextResponse.json({ ok: true });
            
            const customerId = idLine.replace('ID: addcharge_', '').trim();
            const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
            
            if (!customer && siblingRows.length === 0) {
                await sendTelegramMessage(chatId, `❌ Member not found.`, mainMenu);
                return NextResponse.json({ ok: true });
            }
            
            const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
            const currentTotalBalance = siblingRows.reduce((sum, c) => sum + (Number(c.outstanding_balance) || 0), 0);
            const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
            
            const msg = `Please confirm:\n\nMember: <b>${displayName}</b>\nAmount to Add: <b>₹${amount}</b>\nReason: <b>${reason}</b>\nCurrent Outstanding: <b>₹${Math.round(currentTotalBalance)}</b>\nNew Outstanding: <b>₹${Math.round(currentTotalBalance + amount)}</b>`;
            
            const buttons = [
                [{ text: `✅ Confirm Charge`, callback_data: `qkhata_addcharge_confirm_${primaryCustomer.id}_${amount}_${reasonB64}` }],
                [{ text: `❌ Cancel`, callback_data: `qkhata_back` }]
            ];
            
            await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
            return NextResponse.json({ ok: true });
        }
      }

      const isLazyModeEnabled = business.pricing_rules?.globalSettings?.lazy_mode_enabled;
      if (isLazyModeEnabled) {
         const matchingTable = (business.tables || []).find((t: any) => 
            t.id.toUpperCase() === text.toUpperCase() || 
            (t.name && t.name.toUpperCase() === text.toUpperCase())
         );
         if (matchingTable) {
            const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
            const isActive = activeSessions?.some(s => s.table_id === matchingTable.id);
            if (isActive) {
               await sendTelegramMessage(chatId, `❌ Table ${matchingTable.id} is already occupied.`, mainMenu);
               return NextResponse.json({ ok: true });
            }
            
            let gameType = matchingTable.type || 'pool';
            if (!gameType && business.pricing_rules?.rules) {
               gameType = Object.keys(business.pricing_rules.rules)[0];
            }
            
            if (gameType === 'ps5') {
               const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `ps5_players_${matchingTable.id}_${num}` }));
               await sendTelegramMessage(chatId, `🎮 <b>How many players for ${matchingTable.id}?</b>`, { inline_keyboard: [buttons] });
               return NextResponse.json({ ok: true });
            }
            
            try {
                const session = await startSession(matchingTable.id, gameType as any, 'Guest', business.id, 1);
                const msg = `⚡ <b>Lazy Session Started</b>\n\nTable: ${matchingTable.id}\nCustomer: Guest\nTime: ${formatTimeReadable(session.start_time)}`;
                await sendTelegramMessage(chatId, msg, mainMenu);
            } catch(e: any) {
                await sendTelegramMessage(chatId, `❌ Failed to start lazy session: ${e.message}`, mainMenu);
            }
            return NextResponse.json({ ok: true });
         }
      }

      if (
        text === '▶️ Start Session' || 
        text === '▶️ सत्र शुरू करें' || 
        text === '▶️ सत्र सुरू करा' || 
        text === '/startsession'
      ) {
        // Authoritative pricing_rules check to guarantee real-time synchronization with dashboard toggles
        const { data: freshBiz } = await supabase
          .from('businesses')
          .select('pricing_rules')
          .eq('id', business.id)
          .single();
        if (freshBiz?.pricing_rules) {
          business.pricing_rules = freshBiz.pricing_rules;
        }

        const isLazyModeEnabled = !!business.pricing_rules?.globalSettings?.lazy_mode_enabled;
        
        if (isLazyModeEnabled) {
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
          
          const tableButtons = availableTables.map((t: any) => ({ text: `🟢 ${t.id} — ${t.type || 'Pool'}`, callback_data: `start_table_${t.id}` }));
          const buttons = chunkArray(tableButtons, 2);
          buttons.push([{ text: `❌ Cancel`, callback_data: `cancel_action` }]);
          await sendTelegramMessage(chatId, '⚡ <b>Lazy Mode:</b> Select table for Guest:', { inline_keyboard: buttons });
          return NextResponse.json({ ok: true });
        }

        const buttons = [
          [{ text: '👤 Guest Session', callback_data: 'start_guest_init' }],
          [{ text: '👤 Member Session', callback_data: 'start_member_init' }]
        ];
        await sendTelegramMessage(chatId, 'Who is playing?', { inline_keyboard: buttons });
        return NextResponse.json({ ok: true });
      }
      else if (
        text === '📋 Active Sessions' || 
        text === '📋 सक्रिय सत्र' || 
        text === '📋 चालू सत्रे' || 
        text === '/activesessions'
      ) {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          const noSessMsg = userLang === 'mr' ? 'कोणतेही चालू सत्र नाही.' : userLang === 'hi' ? 'कोई सक्रिय सत्र नहीं चल रहा है।' : 'No active sessions running right now.';
          await sendTelegramMessage(chatId, noSessMsg, mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        const titleText = userLang === 'mr' ? `📋 <b>चालू सत्रे (${activeSessions.length})</b>\n\n` : userLang === 'hi' ? `📋 <b>सक्रिय सत्र (${activeSessions.length})</b>\n\n` : `📋 <b>Active Sessions (${activeSessions.length})</b>\n\n`;
        let masterMsg = titleText;
        const masterButtons: any[] = [];
        
        const sessionDetails = await Promise.all(activeSessions.map(async (session) => {
          const isPaused = typeof session.paused_at === 'string' && session.paused_at.trim() !== '';
          const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          const endFull = isPaused ? (session.paused_at as never || session.paused_at) : new Date().toISOString();
          
          let isMember = !!session.member_id;
          
          let billText = '₹0';
          try {
            const res = await calculateServerBillingForSession(session, business.id, endFull);
            billText = `₹${Math.round(res.cost)}`;
          } catch(e){}

          const customerLabel = isMember ? (userLang === 'mr' ? 'सभासद' : userLang === 'hi' ? 'सदस्य' : 'Member') : 'Cust';
          const msgFragment = `• <b>${session.table_id}</b> (${session.game_type})\n  ${customerLabel}: ${escapeHtml(session.customer_name || "Guest")}\n  Amt: ${billText} ${isPaused ? '(⏸)' : ''}\n\n`;
          
          const row = [
            isPaused 
              ? { text: `▶️ ${session.table_id}`, callback_data: `resume_${session.id}` }
              : { text: `⏸ ${session.table_id}`, callback_data: `pause_${session.id}` }
          ];
          
          if (isMember) {
             row.push({ text: `📒 QK`, callback_data: `qkhatainit_${session.id}` });
          }
          
          row.push({ text: `🛑 Stop`, callback_data: `end_${session.id}` });
          return { msgFragment, row };
        }));

        for (const detail of sessionDetails) {
          masterMsg += detail.msgFragment;
          masterButtons.push(detail.row);
        }
        if (activeSessions.length > 1) {
          masterButtons.push([{ text: `⏸ Pause All`, callback_data: `pause_all` }]);
          masterButtons.push([{ text: `🔴 End All (${activeSessions.length})`, callback_data: `end_all` }]);
        }
        
        await sendTelegramMessage(chatId, masterMsg, { inline_keyboard: masterButtons });
      }
      else if (
        text === '🛑 Stop Session' || 
        text === '🛑 सत्र समाप्त करें' || 
        text === '🛑 सत्र थांबवा' || 
        text === '/stopsession'
      ) {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          const noStopMsg = userLang === 'mr' ? 'थांबवण्यासाठी कोणतेही सत्र नाही.' : userLang === 'hi' ? 'समाप्त करने के लिए कोई सक्रिय सत्र नहीं है।' : 'No active sessions to stop.';
          await sendTelegramMessage(chatId, noStopMsg, mainMenu);
          return NextResponse.json({ ok: true });
        }
        const sessionButtons = activeSessions.map(s => {
          let icon = '🎱';
          if (s.game_type === 'ps5') icon = '🎮';
          return { text: `${icon} ${s.table_id}`, callback_data: `stop_select_${s.id}` };
        });
        const buttons = chunkArray(sessionButtons, 2);
        const promptText = userLang === 'mr' ? `🛑 <b>सत्र थांबवण्यासाठी टेबल निवडा</b>\n\nकोणते सत्र थांबवायचे आहे?` : userLang === 'hi' ? `🛑 <b>सत्र समाप्त करने के लिए टेबल चुनें</b>\n\nआप कौन सा सत्र समाप्त करना चाहते हैं?` : `🛑 <b>Select the table to stop</b>\n\nWhich active session would you like to stop?`;
        await sendTelegramMessage(chatId, promptText, { inline_keyboard: buttons });
      }
      
      else if (
        text === '⏸ Paused Sessions' || 
        text === '⏸ रुके हुए सत्र' || 
        text === '⏸ थांबवलेले सत्रे' || 
        text === '/paused'
      ) {
        const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
        if (!activeSessions || activeSessions.length === 0) {
          await sendTelegramMessage(chatId, 'No active sessions right now.', mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        const pausedSessions = activeSessions.filter(s => typeof s.paused_at === 'string' && s.paused_at.trim() !== '');
        
        if (pausedSessions.length === 0) {
          const noPausedMsg = userLang === 'mr' ? 'सध्या कोणतेही सत्र थांबवलेले नाही.' : userLang === 'hi' ? 'वर्तमान में कोई रुका हुआ सत्र नहीं है।' : 'No paused sessions right now.';
          await sendTelegramMessage(chatId, noPausedMsg, mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        let msg = userLang === 'mr' ? '⏸ <b>थांबवलेले सत्रे</b>\n\n' : userLang === 'hi' ? '⏸ <b>रुके हुए सत्र</b>\n\n' : '⏸ <b>Paused Sessions</b>\n\n';
        pausedSessions.forEach(session => {
          const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          msg += `<b>${session.table_id}</b>\nPlayer: ${session.customer_name}\nGame: ${session.game_type}\nStarted: ${formatTimeReadable(startFull)}\nPaused At: ${formatTimeReadable(session.paused_at)}\n\n`;
        });
        await sendTelegramMessage(chatId, msg, mainMenu);
      }
      else if (
        text === '💰 Today\'s Summary' || 
        text === '💰 आज का सारांश' || 
        text === '💰 आजचा हिशोब' || 
        text === '/summary'
      ) {
        const dateStr = getCurrentISTDateStr();
        
        const [sessionsResponse, qpulseInsight, todayFbStats] = await Promise.all([
          supabase
            .from('sessions')
            .select('cost, duration, food_cost')
            .eq('business_id', business.id)
            .eq('status', 'COMPLETED')
            .eq('date', dateStr),
          getCachedQpulseInsight(business.id),
          getTodayFbStats(business.id)
        ]);
        
        const completedSessions = sessionsResponse.data;
          
        if (!completedSessions || completedSessions.length === 0) {
          let noRevMsg = userLang === 'mr' ? `आज (${dateStr}) कोणतेही सत्र पूर्ण झालेले नाही.` : userLang === 'hi' ? `आज (${dateStr}) कोई सत्र पूरा नहीं हुआ है।` : `No completed sessions today (${dateStr}).`;
          if (todayFbStats.orderCount > 0) {
            noRevMsg += `\n\n🍔 <b>F&B Orders Today:</b> ${todayFbStats.orderCount} orders · ₹${todayFbStats.fbRevenue}`;
          }
          const buttons = [
            [{ text: '🍔 F&B Ordering', callback_data: 'fb:hub' }],
            [{ text: '📊 Daily Digest', callback_data: 'fb:dgt' }]
          ];
          await sendTelegramMessage(chatId, noRevMsg, { inline_keyboard: buttons });
        } else {
          let totalRevenue = 0;
          let totalFb = 0;
          
          completedSessions.forEach(s => {
            totalRevenue += Number(s.cost) || 0;
            totalFb += Number(s.food_cost) || 0;
          });
          
          const effectiveFb = Math.max(totalFb, todayFbStats.fbRevenue);
          
          let msg = userLang === 'mr' 
            ? `💰 <b>आजचा हिशोब</b> (${dateStr})\n\nएकूण सत्रे: ${completedSessions.length}\nएकूण कमाई: ₹${Math.round(totalRevenue)}\n🍔 F&B कमाई: ₹${Math.round(effectiveFb)} (${todayFbStats.orderCount} ऑर्डर्स)`
            : userLang === 'hi'
            ? `💰 <b>आज का सारांश</b> (${dateStr})\n\nकुल सत्र: ${completedSessions.length}\nकुल राजस्व: ₹${Math.round(totalRevenue)}\n🍔 F&B कमाई: ₹${Math.round(effectiveFb)} (${todayFbStats.orderCount} ऑर्डर्स)`
            : `💰 <b>Today's Revenue</b> (${dateStr})\n\nTotal Sessions: ${completedSessions.length}\nTotal Revenue: ₹${Math.round(totalRevenue)}\n🍔 F&B Revenue: ₹${Math.round(effectiveFb)} (${todayFbStats.orderCount} orders)`;
          
          if (qpulseInsight && qpulseInsight.telegram) {
            msg += `\n\n<b>Qpulse Insight</b>\n${qpulseInsight.telegram}`;
          }
          
          const summaryButtons = [
            [{ text: '🍔 Open F&B Orders', callback_data: 'fb:hub' }],
            [{ text: '📊 End-of-Day Digest', callback_data: 'fb:dgt' }]
          ];
          await sendTelegramMessage(chatId, msg, { inline_keyboard: summaryButtons });
        }
        return NextResponse.json({ ok: true });
      }
        const dict = translations[userLang] || translations.en;
        if (
          text === dict.tg_fb_orders ||
          text === '🍔 F&B Orders' ||
          text === '🍔 खाद्य व पेय' ||
          text === '🍔 खाद्य व पेये' ||
          text === '/food' ||
          text === '/fb' ||
          text === '/orders'
        ) {
        const hub = await renderFbHub(business, chatId);
        await sendTelegramMessage(chatId, hub.text, hub.replyMarkup);
        return NextResponse.json({ ok: true });
      }
      else if (text === '/digest') {
        const digest = await generateEndOfDayDigest(business.id);
        const digestButtons = [
          [{ text: '🔄 Refresh Digest', callback_data: 'fb:dgt' }],
          [{ text: '🍔 F&B Hub', callback_data: 'fb:hub' }]
        ];
        await sendTelegramMessage(chatId, digest, { inline_keyboard: digestButtons });
        return NextResponse.json({ ok: true });
      }
      else if (
        text === '📅 Book Table' || 
        text === '📅 टेबल बुक करें' || 
        text === '📅 टेबल बुक करा' || 
        text === '/book'
      ) {
        const buttons = [
          [{ text: '📋 View Today\'s Bookings', callback_data: 'bk_view_today' }],
          [{ text: '➕ Create Booking', callback_data: 'bk_create_new' }]
        ];
        await sendTelegramMessage(chatId, `📅 <b>Booking Management</b>\n\nChoose an action:`, { inline_keyboard: buttons });
        return NextResponse.json({ ok: true });
      }
      else if (
        text === '📒 Member QKhata' || 
        text === '📒 सदस्य खाता' || 
        text === '📒 सदस्य खाते' || 
        text === '/qkhata'
      ) {
        const [customersResponse, membershipsResponse] = await Promise.all([
          supabase.from('customers').select('id, name, outstanding_balance, phone').eq('business_id', business.id).order('created_at', { ascending: false }),
          supabase.from('memberships').select('id, name, mobile').eq('business_id', business.id)
        ]);
        
        const rawCustomers = customersResponse.data;
        const memberships = membershipsResponse.data;
        
        // Deduplicate and aggregate members so each person appears exactly once with combined balance
        const aggregated = aggregateMemberCustomers(rawCustomers || [], memberships || []);
        
        if (!aggregated || aggregated.length === 0) {
           const emptyMsg = userLang === 'mr' 
             ? `🎉 नोंदणीकृत सभासदांची कोणतीही बाकी रक्कम नाही!` 
             : userLang === 'hi' 
             ? `🎉 पंजीकृत सदस्यों का कोई बकाया नहीं है!` 
             : `🎉 No outstanding QKhata balances found for registered members!`;
           await sendTelegramMessage(chatId, emptyMsg, mainMenu);
           return NextResponse.json({ ok: true });
        }
        
        const totalOutstanding = aggregated.reduce((sum, c) => sum + c.totalOutstanding, 0);
        let msg = userLang === 'mr'
          ? `📒 <b>सभासद खाते वसुली</b>\n\nएकूण बाकी: <b>₹${Math.round(totalOutstanding)}</b>\nबाकी असलेले सभासद: <b>${aggregated.length}</b>\n\nसभासद निवडा:`
          : userLang === 'hi'
          ? `📒 <b>सदस्य खाता संग्रह</b>\n\nकुल बकाया: <b>₹${Math.round(totalOutstanding)}</b>\nलंबित सदस्य: <b>${aggregated.length}</b>\n\nसदस्य चुनें:`
          : `📒 <b>Member QKhata Collections</b>\n\nTotal Outstanding: <b>₹${Math.round(totalOutstanding)}</b>\nMembers Pending: <b>${aggregated.length}</b>\n\nSelect a member to view details or collect payment:`;
        
        const topMembers = aggregated.slice(0, 15);
        const memberButtons = topMembers.map(c => [{
            text: `👤 ${c.name} — ₹${Math.round(c.totalOutstanding)}`,
            callback_data: `qkhatamem_${c.primaryId}`
        }]);
        
        await sendTelegramMessage(chatId, msg, { inline_keyboard: memberButtons });
        return NextResponse.json({ ok: true });
      }
      else if (
        text === '🌐 Language' || 
        text === '🌐 Language / भाषा' || 
        text === '🌐 भाषा बदलें' || 
        text === '🌐 भाषा बदला' || 
        text === '/language'
      ) {
        const langButtons = [
          [{ text: '🇬🇧 English', callback_data: 'set_lang_en' }],
          [{ text: '🇮🇳 हिंदी (Hindi)', callback_data: 'set_lang_hi' }],
          [{ text: '🚩 मराठी (Marathi)', callback_data: 'set_lang_mr' }]
        ];
        await sendTelegramMessage(chatId, `🌐 <b>Select Bot Language / भाषा निवडा / भाषा चुनें</b>\n\nChoose your preferred language for menus and notifications:`, { inline_keyboard: langButtons });
        return NextResponse.json({ ok: true });
      }
      else {
        // Main Menu
        await sendTelegramMessage(chatId, `<b>QControl Dashboard</b>\n${business.business_name}\n\nPlease choose an action:`, mainMenu);
      }
    }


    // 2. Handle Callback Queries (Button Clicks)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message?.chat?.id || update.callback_query.from?.id;
      const messageId = update.callback_query.message?.message_id;
      const callbackQueryId = update.callback_query.id;

      // Always answer the callback query promptly to dismiss Telegram's loading spinner
      if (callbackQueryId) {
        answerCallbackQuery(callbackQueryId).catch(console.error);
      }

      if (callbackData === 'ignore') {
        return NextResponse.json({ ok: true });
      }

      if (callbackData === 'cancel_auth') {
        if (messageId) editTelegramMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
        await sendTelegramMessage(chatId, `❌ Link cancelled.`);
        return NextResponse.json({ ok: true });
      }

      const ctx = await getBusinessContext(chatId);
      const userLang = (ctx.activeMembership?.userLanguage || 'en') as SupportedLanguage;
      const mainMenu = getMainMenuKeyboard(ctx.allActiveMemberships.length, userLang);

      if (callbackData.startsWith('fb:')) {
        let b = ctx.activeMembership?.business;
        if (!b && ctx.allActiveMemberships.length === 1) {
          b = ctx.allActiveMemberships[0].business;
        }
        if (!b) {
          if (messageId) await editTelegramMessageText(chatId, messageId, '⚠️ Unauthorized or no active business selected.');
          else await sendTelegramMessage(chatId, '⚠️ Unauthorized or no active business selected.');
          return NextResponse.json({ ok: true });
        }
        if (callbackData === 'fb:back_main') {
          if (messageId) {
            await editTelegramMessageText(chatId, messageId, `<b>QControl Dashboard</b>\n${escapeHtml(b.business_name)}\n\nPlease choose an action:`);
          }
          await sendTelegramMessage(chatId, `<b>QControl</b>`, mainMenu);
          return NextResponse.json({ ok: true });
        }
        await handleFbCallback(b, chatId, messageId, callbackData, sendTelegramMessage, editTelegramMessageText);
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('set_lang_')) {
        const selectedLang = callbackData.replace('set_lang_', '') as SupportedLanguage;
        const targetBiz = ctx.activeMembership?.business;
        if (targetBiz) {
          await setUserLanguage(chatId, targetBiz.id, selectedLang);
        }
        const newMainMenu = getMainMenuKeyboard(ctx.allActiveMemberships.length, selectedLang);
        const confirmationMsg = selectedLang === 'mr' 
          ? `✅ <b>भाषा मराठी म्हणून निवडली गेली आहे!</b>\nसर्व मेन्यू आणि संदेश आता मराठीत दिसतील.`
          : selectedLang === 'hi'
          ? `✅ <b>भाषा हिंदी चुनी गई है!</b>\nसभी मेन्यू और संदेश अब हिंदी में दिखाई देंगे।`
          : `✅ <b>Language set to English!</b>\nAll menus and notifications will be in English.`;
        if (messageId) {
          await editTelegramMessageText(chatId, messageId, confirmationMsg);
        }
        const actionPrompt = translations[selectedLang]?.tg_choose_action || 'Please choose an action:';
        await sendTelegramMessage(chatId, `<b>QControl</b>\n\n${actionPrompt}`, newMainMenu);
        return NextResponse.json({ ok: true });
      }
      
      if (callbackData.startsWith('order_accept_')) {
        const notifId = callbackData.replace('order_accept_', '');
        await supabase.from('notifications').update({ type: 'order_accepted' }).eq('id', notifId);
        
        if (messageId && update.callback_query.message.text) {
           const newMsg = `✅ <b>Order Accepted</b>\n\n` + update.callback_query.message.text.replace('🔔 New Order Placed', '').trim();
           const buttons = [[{ text: '🍽️ Mark Served', callback_data: `order_serve_${notifId}` }]];
           await editTelegramMessageText(chatId, messageId, newMsg, { inline_keyboard: buttons });
        }
        return NextResponse.json({ ok: true });
      }
      
      if (callbackData.startsWith('order_serve_')) {
        const notifId = callbackData.replace('order_serve_', '');
        await supabase.from('notifications').update({ type: 'order_served', is_read: true }).eq('id', notifId);
        
        if (messageId && update.callback_query.message.text) {
           let newMsg = `✅ <b>Order Served</b>\n\n` + update.callback_query.message.text.replace('✅ Order Accepted', '').replace('🔔 New Order Placed', '').trim();
           await editTelegramMessageText(chatId, messageId, newMsg, { inline_keyboard: [] });
        }
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('order_cancel_')) {
        const notifId = callbackData.replace('order_cancel_', '');
        const { data: order } = await supabase.from('notifications').select('*').eq('id', notifId).single();
        if (order && !['order_cancelled', 'order_voided'].includes(order.type)) {
          const parts = order.message ? order.message.split('|') : [];
          const sessionId = parts.length >= 3 ? parts[parts.length - 1] : null;
          const orderTotal = parts.length >= 2 ? (parseFloat(parts[parts.length - 2]) || 0) : 0;
          if (sessionId) {
            const { data: sess } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
            if (sess && sess.status === 'ACTIVE') {
              const newFood = Math.max(0, (sess.food_cost || 0) - orderTotal);
              await supabase.from('sessions').update({ food_cost: newFood }).eq('id', sessionId);
              try {
                const { enqueueSheetsSync } = require('@/lib/sheetsSyncQueue');
                enqueueSheetsSync('SESSION', sessionId, order.business_id);
              } catch(e) {}
            }
          }
          await supabase.from('notifications').update({ type: 'order_cancelled', is_read: true }).eq('id', notifId);
        }
        
        if (messageId && update.callback_query.message.text) {
           let newMsg = `❌ <b>Order Cancelled</b>\n\n` + update.callback_query.message.text.replace('✅ Order Accepted', '').replace('🔔 New Order Placed', '').trim();
           await editTelegramMessageText(chatId, messageId, newMsg, { inline_keyboard: [] });
        }
        return NextResponse.json({ ok: true });
      }

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
             const userLang = (newCtx.activeMembership.userLanguage || 'en') as SupportedLanguage;
             const newMainMenu = getMainMenuKeyboard(newCtx.allActiveMemberships.length, userLang);
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


      if (callbackData.startsWith('qkhatamem_')) {
          const customerId = callbackData.replace('qkhatamem_', '');
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
          
          if (!customer && siblingRows.length === 0) {
             if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Member not found.`);
             else await sendTelegramMessage(chatId, `❌ Member not found.`);
             return NextResponse.json({ ok: true });
          }
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const consolidatedBalance = siblingRows.reduce((sum, c) => sum + (Number(c.outstanding_balance) || 0), 0);
          const customerIds = siblingRows.map(c => c.id);
          
          // Get recent transactions across all sibling customer records
          const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .in('customer_id', customerIds)
            .order('created_at', { ascending: false })
            .limit(3);
          
          const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
          let msg = `👤 <b>QKhata: ${displayName}</b>\n\n`;
          msg += `Outstanding Balance: <b>₹${Math.round(consolidatedBalance)}</b>\n\n`;
          
          if (payments && payments.length > 0) {
             msg += `<b>Recent Transactions:</b>\n`;
             payments.forEach((p: any) => {
                 msg += `• ${formatTimeReadable(p.created_at)}: ₹${p.amount} (${p.payment_method || 'Cash'})\n`;
             });
             msg += `\n`;
          }
          
          const buttons = [
             [
                 { text: `💸 Settle Full (₹${Math.round(consolidatedBalance)})`, callback_data: `qkhatasettlefull_${primaryCustomer.id}` }
             ],
             [
                 { text: `💰 Partial Payment`, callback_data: `qkhatacollect_${primaryCustomer.id}` },
                 { text: `➕ Add Charge`, callback_data: `qkhata_addcharge_init_${primaryCustomer.id}` }
             ],
             [{ text: `↩️ Back`, callback_data: `qkhata_back` }]
          ];
          
          if (messageId) {
             await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
          } else {
             await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
          }
          return NextResponse.json({ ok: true });
      }

      if (callbackData === 'qkhata_back') {
        const [customersResponse, membershipsResponse] = await Promise.all([
          supabase.from('customers').select('id, name, outstanding_balance, phone').eq('business_id', business.id).order('created_at', { ascending: false }),
          supabase.from('memberships').select('id, name, mobile').eq('business_id', business.id)
        ]);

        const aggregated = aggregateMemberCustomers(customersResponse.data || [], membershipsResponse.data || []);

        let msg = userLang === 'mr'
          ? `📒 <b>सभासद खाते वसुली</b>\n\n`
          : userLang === 'hi'
          ? `📒 <b>सदस्य खाता संग्रह</b>\n\n`
          : `📒 <b>Member QKhata Collections</b>\n\n`;
        let memberButtons: any[] = [];
        
        if (!aggregated || aggregated.length === 0) {
           msg += userLang === 'mr'
             ? `🎉 नोंदणीकृत सभासदांची कोणतीही बाकी रक्कम नाही!\n\n`
             : userLang === 'hi'
             ? `🎉 पंजीकृत सदस्यों का कोई बकाया नहीं है!\n\n`
             : `🎉 No outstanding QKhata balances found for registered members!\n\n`;
        } else {
           const totalOutstanding = aggregated.reduce((sum, c) => sum + c.totalOutstanding, 0);
           msg += userLang === 'mr'
             ? `एकूण बाकी: <b>₹${Math.round(totalOutstanding)}</b>\nबाकी असलेले सभासद: <b>${aggregated.length}</b>\n\nसभासद निवडा:\n`
             : userLang === 'hi'
             ? `कुल बकाया: <b>₹${Math.round(totalOutstanding)}</b>\nलंबित सदस्य: <b>${aggregated.length}</b>\n\nसदस्य चुनें:\n`
             : `Total Outstanding: <b>₹${Math.round(totalOutstanding)}</b>\nMembers Pending: <b>${aggregated.length}</b>\n\nSelect a member to view details or collect payment:\n`;
           
           const topMembers = aggregated.slice(0, 15);
           memberButtons = topMembers.map(c => [{
               text: `👤 ${c.name} — ₹${Math.round(c.totalOutstanding)}`,
               callback_data: `qkhatamem_${c.primaryId}`
           }]);
        }
        
        const addChargeText = userLang === 'mr' ? `➕ हिशोब जोडा` : userLang === 'hi' ? `➕ शुल्क जोड़ें` : `➕ Add Manual Charge`;
        memberButtons.push([{ text: addChargeText, callback_data: `qkhata_addcharge_menu` }]);
        
        if (messageId) {
           await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: memberButtons });
        } else {
           await sendTelegramMessage(chatId, msg, { inline_keyboard: memberButtons });
        }
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('qkhatacollect_')) {
          const customerId = callbackData.replace('qkhatacollect_', '');
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
          
          if (!customer && siblingRows.length === 0) return NextResponse.json({ ok: true });
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const totalBalance = siblingRows.reduce((s, c) => s + (Number(c.outstanding_balance) || 0), 0);
          const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();

          const msg = `💰 <b>Enter payment amount for ${displayName}</b>\n\nOutstanding: ₹${Math.round(totalBalance)}\nRef: #${primaryCustomer.id.split('-')[0].toUpperCase()}\n\n(Reply to this message with the amount received, e.g. "500")`;
          await sendTelegramMessage(chatId, msg, { force_reply: true });
          return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('qkhatasettlefull_')) {
          const customerId = callbackData.replace('qkhatasettlefull_', '');
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
          
          if (!customer && siblingRows.length === 0) return NextResponse.json({ ok: true });
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const totalBalance = siblingRows.reduce((s, c) => s + (Number(c.outstanding_balance) || 0), 0);
          const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
          const amount = Math.round(totalBalance);
          
          const msg = `⚠️ <b>Confirm Full Settlement</b>\n\nAre you sure you want to settle the full amount of <b>₹${amount}</b> for ${displayName}?`;
          
          const buttons = [
              [{ text: `✅ Yes, Settle ₹${amount}`, callback_data: `qkhataconfirm_${primaryCustomer.id}` }],
              [{ text: `❌ Cancel`, callback_data: `qkhatamem_${primaryCustomer.id}` }]
          ];
          
          if (messageId) {
              await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
          } else {
              await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
          }
          return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('qkhataconfirm_')) {
          const customerId = callbackData.replace('qkhataconfirm_', '');
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
          
          if (!customer && siblingRows.length === 0) return NextResponse.json({ ok: true });
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const totalToSettle = siblingRows.reduce((s, c) => s + (Number(c.outstanding_balance) || 0), 0);
          const customerIds = siblingRows.map(c => c.id);
          const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
          
          try {
             const { createLedgerEntryAndPayment } = require('@/lib/services/paymentService');
             await createLedgerEntryAndPayment({
                 businessId: business.id,
                 customerName: displayName,
                 customerId: primaryCustomer.id,
                 totalBilled: 0,
                 amountPaid: totalToSettle,
                 paymentMethod: 'Cash',
                 paymentStatus: 'Paid',
                 source: 'Telegram Settle Full'
             });

             // Ensure all matching sibling customer records have balance set to 0
             await supabase
               .from('customers')
               .update({ outstanding_balance: 0 })
               .in('id', customerIds);
             
             const successMsg = `🎉 <b>Payment Successfully Settled!</b>\n\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>Member:</b> ${displayName}\n💰 <b>Amount Paid:</b> ₹${Math.round(totalToSettle)}\n💳 <b>Method:</b> Cash\n🧾 <b>Balance:</b> ₹0\n━━━━━━━━━━━━━━━━━━━━\n\n<i>Payment recorded successfully. The member's QKhata has been cleared!</i>`;
             
             if (messageId) {
                await editTelegramMessageText(chatId, messageId, successMsg, mainMenu);
             } else {
                await sendTelegramMessage(chatId, successMsg, mainMenu);
             }
          } catch(e: any) {
             const errMsg = `❌ Failed to settle payment: ${e.message}`;
             if (messageId) await editTelegramMessageText(chatId, messageId, errMsg, mainMenu);
             else await sendTelegramMessage(chatId, errMsg, mainMenu);
          }
          return NextResponse.json({ ok: true });
      }

      if (callbackData === 'qkhata_addcharge_menu') {
          const [customersResponse, membershipsResponse] = await Promise.all([
            supabase.from('customers').select('id, name, outstanding_balance, phone').eq('business_id', business.id).order('created_at', { ascending: false }),
            supabase.from('memberships').select('id, name, mobile').eq('business_id', business.id)
          ]);
          
          const aggregated = aggregateMemberCustomers(customersResponse.data || [], membershipsResponse.data || [], true).slice(0, 20);

          if (!aggregated || aggregated.length === 0) {
             if (messageId) await editTelegramMessageText(chatId, messageId, `❌ No registered members found.`);
             else await sendTelegramMessage(chatId, `❌ No registered members found.`);
             return NextResponse.json({ ok: true });
          }
          
          let msg = `➕ <b>Add Manual Charge</b>\n\nSelect a member to add a charge to:\n`;
          
          const memberButtons = aggregated.map(c => [{
              text: `👤 ${c.name} — Bal: ₹${Math.round(c.totalOutstanding)}`,
              callback_data: `qkhata_addcharge_init_${c.primaryId}`
          }]);
          
          memberButtons.push([{ text: `↩️ Back`, callback_data: `qkhata_back` }]);
          
          if (messageId) {
             await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: memberButtons });
          } else {
             await sendTelegramMessage(chatId, msg, { inline_keyboard: memberButtons });
          }
          return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('qkhata_addcharge_init_')) {
          const customerId = callbackData.replace('qkhata_addcharge_init_', '');
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
          
          if (!customer && siblingRows.length === 0) return NextResponse.json({ ok: true });
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
          
          const msg = `💰 <b>Enter charge amount for ${displayName}</b>\n\nID: addcharge_${primaryCustomer.id}\n\n(Reply with Amount and Reason, e.g. "500 Food" or just "500")`;
          await sendTelegramMessage(chatId, msg, { force_reply: true });
          return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('qkhata_addcharge_confirm_')) {
          const parts = callbackData.replace('qkhata_addcharge_confirm_', '').split('_');
          const customerId = parts[0];
          const amount = parseFloat(parts[1]);
          const reasonB64 = parts[2];
          
          const reason = reasonB64 && reasonB64 !== 'none' ? Buffer.from(reasonB64, 'base64').toString('utf-8') : 'Manual Charge';
          
          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, customerId);
          if (!customer && siblingRows.length === 0) return NextResponse.json({ ok: true });
          
          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const displayName = (membership?.name || primaryCustomer.name || 'Member').trim();
          const currentTotalBalance = siblingRows.reduce((sum, c) => sum + (Number(c.outstanding_balance) || 0), 0);
          const newTotalBalance = currentTotalBalance + amount;
          
          try {
             const { createLedgerEntryAndPayment } = require('@/lib/services/paymentService');
             
             await createLedgerEntryAndPayment({
                businessId: business.id,
                customerName: displayName,
                customerId: primaryCustomer.id,
                totalBilled: amount,
                amountPaid: 0,
                paymentMethod: 'QKhata',
                paymentStatus: 'Pending',
                source: `Telegram Bot - ${reason}`
             });
             
             // Consolidate sibling rows: set other sibling rows to 0, primary customer to newTotalBalance
             const otherSiblingIds = siblingRows.filter(c => c.id !== primaryCustomer.id).map(c => c.id);
             if (otherSiblingIds.length > 0) {
                await supabase.from('customers').update({ outstanding_balance: 0 }).in('id', otherSiblingIds);
             }
             await supabase.from('customers').update({ outstanding_balance: newTotalBalance }).eq('id', primaryCustomer.id);
             
             const msg = `✅ <b>QKhata Added Successfully</b>\n\nMember: ${displayName}\nAdded: ₹${amount}\nReason: ${reason}\nPrevious Outstanding: ₹${Math.round(currentTotalBalance)}\nNew Outstanding: ₹${Math.round(newTotalBalance)}`;
             
             if (messageId) await editTelegramMessageText(chatId, messageId, msg);
             else await sendTelegramMessage(chatId, msg, mainMenu);
          } catch(e: any) {
             if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Failed to add charge: ${e.message}`);
             else await sendTelegramMessage(chatId, `❌ Failed to add charge: ${e.message}`, mainMenu);
          }
          return NextResponse.json({ ok: true });
      }

      if (callbackData === 'start_guest_init') {
        const tables = business.tables || [];
        if (tables.length === 0) {
          if (messageId) await editTelegramMessageText(chatId, messageId, 'No tables configured for this business.', { inline_keyboard: [] });
          else await sendTelegramMessage(chatId, 'No tables configured for this business.', mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        const { data: activeSessions } = await supabase.from('sessions').select('table_id').eq('business_id', business.id).eq('status', 'ACTIVE');
        const activeTableIds = (activeSessions || []).map(s => s.table_id);
        
        const availableTables = tables.filter((t: any) => !activeTableIds.includes(t.id));
        
        if (availableTables.length === 0) {
          if (messageId) await editTelegramMessageText(chatId, messageId, 'All tables are currently active.', { inline_keyboard: [] });
          else await sendTelegramMessage(chatId, 'All tables are currently active.', mainMenu);
          return NextResponse.json({ ok: true });
        }

        const tableButtons = availableTables.map((t: any) => ({ text: `🟢 ${t.id} — ${t.type || 'Pool'}`, callback_data: `start_table_${t.id}` }));
        const buttons = chunkArray(tableButtons, 2);
        buttons.push([{ text: `❌ Cancel`, callback_data: `cancel_action` }]);
        if (messageId) await editTelegramMessageText(chatId, messageId, '▶️ Select an available table for Guest:', { inline_keyboard: buttons });
        else await sendTelegramMessage(chatId, '▶️ Select an available table for Guest:', { inline_keyboard: buttons });
        return NextResponse.json({ ok: true });
      }

      if (callbackData === 'start_member_init' || callbackData.startsWith('start_mem_page_')) {
        let page = 0;
        if (callbackData.startsWith('start_mem_page_')) {
            page = parseInt(callbackData.replace('start_mem_page_', ''), 10) || 0;
        }
        
        const limit = 10;
        const from = page * limit;
        const to = from + limit - 1;

        // Note: we fetch limit + 1 to know if there is a next page
        // Fetch from memberships table to sync perfectly with Dashboard's Member profiles
        const { data: members } = await supabase
            .from('memberships')
            .select('id, name')
            .eq('business_id', business.id)
            .order('created_at', { ascending: false })
            .range(from, to + 1);

        if (!members || members.length === 0) {
           if (messageId) await editTelegramMessageText(chatId, messageId, `❌ No registered members found for this business.`);
           else await sendTelegramMessage(chatId, `❌ No registered members found for this business.`);
           return NextResponse.json({ ok: true });
        }

        const hasNext = members.length > limit;
        const displayMembers = members.slice(0, limit);
        
        let msg = `👤 <b>Select Member for Session</b>\n\n(Page ${page + 1})`;
        const memberButtons = displayMembers.map(c => [{
            text: `👤 ${c.name}`,
            callback_data: `start_mem_game_${c.id}`
        }]);
        
        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: `⬅️ Prev`, callback_data: `start_mem_page_${page - 1}` });
        }
        if (hasNext) {
            navButtons.push({ text: `Next ➡️`, callback_data: `start_mem_page_${page + 1}` });
        }
        
        if (navButtons.length > 0) {
            memberButtons.push(navButtons);
        }
        
        memberButtons.push([{ text: `❌ Cancel`, callback_data: `cancel_action` }]);
        
        if (messageId) await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: memberButtons });
        else await sendTelegramMessage(chatId, msg, { inline_keyboard: memberButtons });
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('start_mem_game_')) {
        const memberId = callbackData.replace('start_mem_game_', '');
        
        const tables = business.tables || [];
        const { data: activeSessions } = await supabase.from('sessions').select('table_id').eq('business_id', business.id).eq('status', 'ACTIVE');
        const activeTableIds = (activeSessions || []).map(s => s.table_id);
        
        const availableTables = tables.filter((t: any) => !activeTableIds.includes(t.id));
        
        if (availableTables.length === 0) {
          if (messageId) await editTelegramMessageText(chatId, messageId, '❌ All tables are currently occupied.', { inline_keyboard: [] });
          else await sendTelegramMessage(chatId, '❌ All tables are currently occupied.');
          return NextResponse.json({ ok: true });
        }

        const tableButtons = availableTables.map((t: any) => ({ text: `🟢 ${t.id} — ${t.type || 'Pool'}`, callback_data: `start_mem_exec_${memberId}_${t.id}` }));
        const buttons = chunkArray(tableButtons, 2);
        buttons.push([{ text: `❌ Cancel`, callback_data: `cancel_action` }]);

        if (messageId) {
          await editTelegramMessageText(chatId, messageId, `▶️ Select an available table:`, { inline_keyboard: buttons });
        } else {
          await sendTelegramMessage(chatId, `▶️ Select an available table:`, { inline_keyboard: buttons });
        }
        return NextResponse.json({ ok: true });
      }

      if (callbackData.startsWith('start_mem_exec_')) {
        const parts = callbackData.replace('start_mem_exec_', '').split('_');
        const memberId = parts[0];
        const tableId = parts[1];
        
        const table = (business.tables || []).find((t: any) => t.id === tableId);
        const gameType = table?.type || 'pool';

        const { data: member } = await supabase.from('memberships').select('name').eq('id', memberId).single();
        if (!member) {
            if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Member not found.`);
            return NextResponse.json({ ok: true });
        }

        try {
            const session = await startSession(tableId, gameType as any, member.name, business.id, 1, memberId);
            const msg = `✅ <b>Member Session Started</b>\n\nPlayer: ${member.name}\nTable: ${tableId}\nGame: ${gameType.charAt(0).toUpperCase() + gameType.slice(1)}\nStarted At: ${formatTimeReadable(session.start_time)}`;
            if (messageId) await editTelegramMessageText(chatId, messageId, msg);
            else await sendTelegramMessage(chatId, msg, mainMenu);
        } catch (error: any) {
            const msg = `❌ Failed to start session: ${error.message}`;
            if (messageId) await editTelegramMessageText(chatId, messageId, msg);
            else await sendTelegramMessage(chatId, msg, mainMenu);
        }
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
            const isConsole = gameType.toLowerCase() === 'ps5' || gameType.toLowerCase() === 'ps' || gameType.toLowerCase() === 'playstation';
            if (isConsole) {
              const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `ps5_players_${tableId}_${num}` }));
              if (messageId) {
                await editTelegramMessageText(chatId, messageId, `🎮 <b>How many players for ${tableId}?</b>`, { inline_keyboard: [buttons] });
              } else {
                await sendTelegramMessage(chatId, `🎮 <b>How many players for ${tableId}?</b>`, { inline_keyboard: [buttons] });
              }
            } else {
              const preferences = business.pricing_rules?.globalSettings?.preferences || {};
              const isLazyModeEnabled = business.pricing_rules?.globalSettings?.lazy_mode_enabled;
              if (preferences.require_customer_name === false || isLazyModeEnabled) {
                 
                try {
                    const session = await startSession(tableId, gameType as any, 'Guest', business.id, 1);
                    const msg = `✅ <b>Session Started (Guest)</b>\n\nTable: ${tableId}\nGame: ${gameType}\nStart Time: ${formatTimeReadable(session.start_time)}`;
                    if (messageId) {
                      await editTelegramMessageText(chatId, messageId, msg);
                      await sendTelegramMessage(chatId, `🎱 Session for Table <b>${tableId}</b> is active.`, mainMenu);
                    } else {
                      await sendTelegramMessage(chatId, msg, mainMenu);
                    }
                } catch (error: any) {
                    if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Error starting session: ${error.message}`);
                    else await sendTelegramMessage(chatId, `❌ Error starting session: ${error.message}`, mainMenu);
                }
              } else {
                if (messageId) {
                  await editTelegramMessageText(chatId, messageId, `✅ Table ${tableId} selected. Please reply to the prompt below.`, { inline_keyboard: [] });
                }
                await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
                    force_reply: true
                });
              }
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
        
        const isConsole = gameType.toLowerCase() === 'ps5' || gameType.toLowerCase() === 'ps' || gameType.toLowerCase() === 'playstation';
        if (isConsole) {
          const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `ps5_players_${tableId}_${num}` }));
          if (messageId) {
            await editTelegramMessageText(chatId, messageId, `🎮 <b>How many players for ${tableId}?</b>`, { inline_keyboard: [buttons] });
          } else {
            await sendTelegramMessage(chatId, `🎮 <b>How many players for ${tableId}?</b>`, { inline_keyboard: [buttons] });
          }
        } else {
          const preferences = business.pricing_rules?.globalSettings?.preferences || {};
          const isLazyModeEnabled = business.pricing_rules?.globalSettings?.lazy_mode_enabled;
          if (preferences.require_customer_name === false || isLazyModeEnabled) {
             
                try {
                    const session = await startSession(tableId, gameType as any, 'Guest', business.id, 1);
                    const msg = `✅ <b>Session Started (Guest)</b>\n\nTable: ${tableId}\nGame: ${gameType}\nStart Time: ${formatTimeReadable(session.start_time)}`;
                    if (messageId) {
                      await editTelegramMessageText(chatId, messageId, msg);
                      await sendTelegramMessage(chatId, `🎱 Session for Table <b>${tableId}</b> is active.`, mainMenu);
                    } else {
                      await sendTelegramMessage(chatId, msg, mainMenu);
                    }
                } catch (error: any) {
                    if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Error starting session: ${error.message}`);
                    else await sendTelegramMessage(chatId, `❌ Error starting session: ${error.message}`, mainMenu);
                }
          } else {
            if (messageId) {
              await editTelegramMessageText(chatId, messageId, `✅ Game ${gameType} selected for Table ${tableId}. Please reply to the prompt below.`, { inline_keyboard: [] });
            }
            await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ${gameType}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
              force_reply: true
            });
          }
        }
      }
      else if (callbackData.startsWith('ps5_players_')) {
        const parts = callbackData.replace('ps5_players_', '').split('_');
        const tableId = parts[0];
        const numPlayers = parseInt(parts[1], 10) || 1;
        
        const preferences = business.pricing_rules?.globalSettings?.preferences || {};
        const isLazyModeEnabled = business.pricing_rules?.globalSettings?.lazy_mode_enabled;

        // In Lazy Mode (or when customer name is not required), immediately start the session for Guest!
        if (preferences.require_customer_name === false || isLazyModeEnabled) {
          try {
            const table = (business.tables || []).find((t: any) => t.id === tableId);
            const gameType = table?.type || 'ps5';
            const session = await startSession(tableId, gameType as any, 'Guest', business.id, numPlayers);
            const msg = `✅ <b>Session Started (Guest)</b>\n\nTable: ${tableId}\nGame: ${gameType.toUpperCase()}\nPlayers: ${numPlayers}\nStart Time: ${formatTimeReadable(session.start_time)}`;
            if (messageId) {
              await editTelegramMessageText(chatId, messageId, msg);
              await sendTelegramMessage(chatId, `🎱 Session for Table <b>${tableId}</b> is active.`, mainMenu);
            } else {
              await sendTelegramMessage(chatId, msg, mainMenu);
            }
          } catch (error: any) {
            if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Error starting session: ${error.message}`);
            else await sendTelegramMessage(chatId, `❌ Error starting session: ${error.message}`, mainMenu);
          }
          return NextResponse.json({ ok: true });
        }

        const hasRule = business.pricing_rules?.rules && (business.pricing_rules.rules['ps5'] || business.pricing_rules.rules['ps']);
        if (!hasRule) {
          await sendTelegramMessage(chatId, `❌ No pricing configured for PS5. Please configure it in the dashboard first.`);
          return NextResponse.json({ ok: true });
        }
        
        const ruleKey = business.pricing_rules.rules['ps5'] ? 'ps5' : 'ps';
        const currentRate = getCurrentRate(ruleKey, Date.now(), business.pricing_rules, numPlayers);
        
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
        return NextResponse.json({ ok: true });
      }
      else if (callbackData.startsWith('ps5_start_')) {
        const parts = callbackData.replace('ps5_start_', '').split('_');
        const tableId = parts[0];
        const numPlayers = parts[1];
        
        const preferences = business.pricing_rules?.globalSettings?.preferences || {};
        const isLazyModeEnabled = business.pricing_rules?.globalSettings?.lazy_mode_enabled;
        if (preferences.require_customer_name === false || isLazyModeEnabled) {
          // Immediately start session
          
                try {
                    const session = await startSession(tableId, 'ps5', 'Guest', business.id, parseInt(numPlayers, 10));
                    const msg = `✅ <b>Session Started (Guest)</b>\n\nTable: ${tableId}\nGame: PS5\nPlayers: ${numPlayers}\nStart Time: ${formatTimeReadable(session.start_time)}`;
                    if (messageId) {
                      await editTelegramMessageText(chatId, messageId, msg);
                      await sendTelegramMessage(chatId, `🎱 Session for Table <b>${tableId}</b> is active.`, mainMenu);
                    } else {
                      await sendTelegramMessage(chatId, msg, mainMenu);
                    }
                } catch (error: any) {
                    if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Error starting session: ${error.message}`);
                    else await sendTelegramMessage(chatId, `❌ Error starting session: ${error.message}`, mainMenu);
                }
        } else {
          if (messageId) {
            await editTelegramMessageText(chatId, messageId, `✅ PS5 selected for Table ${tableId} (${numPlayers} Players). Please reply to the prompt below.`, { inline_keyboard: [] });
          }
          await sendTelegramMessage(chatId, `👤 Enter Customer Name\n\nTable: ${tableId}\nGame: ps5\nPlayers: ${numPlayers}\n\n(Reply to this message with the customer's name, e.g., "John")`, {
            force_reply: true
          });
        }
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
          if (messageId) await editTelegramMessageText(chatId, messageId, '❌ Session is not active or not found.');
          else await sendTelegramMessage(chatId, '❌ Session is not active or not found.', mainMenu);
          return NextResponse.json({ ok: true });
        }
        
        const isPaused = typeof session.paused_at === 'string' && session.paused_at.trim() !== '';
        const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        const endFull = isPaused && typeof session.paused_at === 'string' ? session.paused_at : new Date().toISOString();
        
        let billText = '₹0';
        let billableDuration = '0m';
        let serverBillingRes: any = null;
        try {
          const res = await calculateServerBillingForSession(session, business.id, endFull);
          serverBillingRes = res;
          billText = `₹${Math.round(res.cost)}`;
          billableDuration = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
        } catch (e) {
          console.error('[stop_select_] Error calculating billing for session:', sessionId, e);
        }

        let customerBalanceText = '';
        if (session.member_id || session.customer_id) {
          try {
            const custId = session.customer_id || session.member_id;
            const { data: cust } = await supabase
              .from('customers')
              .select('outstanding_balance, name')
              .eq('business_id', business.id)
              .or(`id.eq.${custId},name.ilike.${session.customer_name}`)
              .limit(1)
              .maybeSingle();
            if (cust && typeof cust.outstanding_balance === 'number') {
              customerBalanceText = `\n📒 <b>QKhata Outstanding:</b> ₹${Math.round(cust.outstanding_balance)}`;
            }
          } catch (custErr) {}
        }

        const pausedDurationMins = Math.floor((session.paused_duration_seconds || 0) / 60);
        const totalDurationMins = Math.max(0, Math.floor((new Date(endFull).getTime() - new Date(startFull).getTime()) / 60000));
        
        const pausedText = pausedDurationMins > 0 ? `${pausedDurationMins}m` : '0m';
        const totalText = totalDurationMins > 0 ? `${Math.floor(totalDurationMins/60)}h ${totalDurationMins%60}m` : '0m';
        
        let msg = `🎱 <b>Session Details</b>\n\n<b>Table:</b> ${session.table_id}\n<b>Player:</b> ${session.customer_name}\n<b>Game:</b> ${session.game_type}\n<b>Started:</b> ${formatTimeReadable(startFull)}\n<b>Current Time:</b> ${formatTimeReadable(endFull)}\n<b>Duration:</b> ${totalText}\n`;
        if (pausedDurationMins > 0) msg += `<b>Paused Time:</b> ${pausedText}\n`;
        msg += `<b>Billable Time:</b> ${billableDuration}\n`;
        if (serverBillingRes) {
          msg += `🎮 <b>Game Charges:</b> ₹${Math.round(serverBillingRes.baseTableCost)}\n`;
          msg += `🍔 <b>F&B Orders:</b> ₹${Math.round(serverBillingRes.baseFoodCost || session.food_cost || 0)}\n`;
          if (serverBillingRes.totalDiscountAmount > 0) {
            msg += `🏷️ <b>Discount:</b> -₹${serverBillingRes.totalDiscountAmount} (${serverBillingRes.discountAppliedLabel})\n`;
          }
        }
        msg += `💰 <b>Current Bill:</b> ${billText}`;
        if (customerBalanceText) {
          msg += customerBalanceText;
        }
        
        let buttons: any[] = [];
        buttons.push([
            { text: `🛑 Stop This Session`, callback_data: `end_${session.id}` }
        ]);
        buttons.push([{ text: `↩️ Back`, callback_data: `stop_menu_back` }]);
        
        if (messageId) {
          await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
        } else {
          await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
        }
      }
      else if (callbackData === 'pause_all' || callbackData === 'end_all') {
         if (messageId) {
            editTelegramMessageReplyMarkup(chatId, messageId, {
               inline_keyboard: [[{ text: '⏳ Processing...', callback_data: 'ignore' }]]
            }).catch(console.error);
         }
         
         const { data: activeSessions } = await supabase.from('sessions').select('*').eq('business_id', business.id).eq('status', 'ACTIVE');
         if (!activeSessions || activeSessions.length === 0) {
            answerCallbackQuery(callbackQueryId, 'No active sessions to process.').catch(console.error);
            return NextResponse.json({ ok: true });
         }
         
         let successCount = 0;
         let summaryDetails = '';
         const action = callbackData === 'pause_all' ? 'pause' : 'force_end';
         
         for (const session of activeSessions) {
            // For pause_all, skip already paused sessions
            if (action === 'pause' && session.paused_at) continue;
            
            try {
               const { dbUpdates } = await handleSessionIntervention({
                 action,
                 session_id: session.id,
                 business_id: business.id,
                 performed_by: 'Qbot'
               });
               successCount++;

               if (action === 'force_end') {
                  const updatedSession = { ...session, ...(dbUpdates || {}) };
                  const isPaused = typeof updatedSession.paused_at === 'string' && updatedSession.paused_at.trim() !== '';
                  const startFull = typeof updatedSession.start_time === 'string' && updatedSession.start_time.includes('T') ? updatedSession.start_time : `${updatedSession.date}, ${updatedSession.start_time}`;
                  const endFull = isPaused ? updatedSession.paused_at : new Date().toISOString();
                  
                  let billText = '₹0';
                  try {
                     const res = await calculateServerBillingForSession(updatedSession, business.id, endFull);
                     billText = `₹${Math.round(res.cost)}`;
                  } catch(e){}
                  
                  summaryDetails += `• <b>${session.table_id}</b>: ${escapeHtml(session.customer_name || 'Guest')} - ${billText}\n`;
               }
            } catch(e) {
               console.error(`Failed to ${action} session ${session.id}:`, e);
            }
         }
         
         const verb = action === 'pause' ? 'paused' : 'ended';
         let msg = `✅ <b>Action Complete</b>\n\nSuccessfully ${verb} ${successCount} active session(s).`;
         
         if (action === 'force_end' && successCount > 0) {
            msg += `\n\n<b>Stopped Sessions Summary:</b>\n${summaryDetails}`;
         }

         answerCallbackQuery(callbackQueryId, `Successfully ${verb} ${successCount} session(s)`).catch(console.error);
         
         if (messageId) {
            await editTelegramMessageText(chatId, messageId, msg);
         } else {
            await sendTelegramMessage(chatId, msg, mainMenu);
         }
         return NextResponse.json({ ok: true });
      }
      else if (callbackData.startsWith('pause_') || callbackData.startsWith('resume_') || callbackData.startsWith('end_') || callbackData.startsWith('confirm_')) {
        const actionPrefix = callbackData.split('_')[0];
        const sessionId = callbackData.substring(actionPrefix.length + 1);
        
        const actionMap: Record<string, string> = {
          'pause': 'pause',
          'resume': 'resume',
          'end': 'force_end',
          'confirm': 'confirm_playing'
        };
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
                let stoppedBillingRes: any = null;
                try {
                  const res = await calculateServerBillingForSession(updatedSession, business.id, endFull);
                  stoppedBillingRes = res;
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
                
                if (stoppedBillingRes && stoppedBillingRes.totalDiscountAmount > 0) {
                  msg += `<b>Subtotal:</b> ₹${stoppedBillingRes.totalBaseCost}\n<b>Discount:</b> -₹${stoppedBillingRes.totalDiscountAmount} (${stoppedBillingRes.discountAppliedLabel})\n`;
                }

                if (breakdownStr) {
                  msg += `<b>Final Bill:</b> ${billText}${breakdownStr}\n\n`;
                } else {
                  msg += `<b>Rate:</b> ${rateText}\n💰 <b>Final Bill:</b> ${billText}\n\n`;
                }
                const upiId = business.pricing_rules?.globalSettings?.preferences?.business_upi_id;
                if (upiId && finalCost > 0) {
                  const upiUri = `upi://pay?pa=${upiId}&pn=Business&am=${finalCost}&cu=INR`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;
                  msg += `📱 <a href="${qrUrl}">Show QR Code</a>\n🔗 <code>${upiUri}</code>\n\n`;
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
                  const res = await calculateServerBillingForSession(updatedSession, business.id, endFull);
                  billText = `₹${Math.round(res.cost)}`;
                  durationText = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
                } catch(e){}
                
                const isPaused = !!updatedSession.paused_at;
                const status = isPaused ? '⏸ Paused' : '▶️ Active';
                const msg = `<b>${updatedSession.table_id}</b>\nPlayer: ${updatedSession.customer_name}\nGame: ${updatedSession.game_type}\nStatus: ${status}\nDuration: ${durationText}\nCurrent Bill: ${billText}`;
                
                const buttons: any[] = [
                  [
                    isPaused 
                      ? { text: `▶️ Resume`, callback_data: `resume_${updatedSession.id}` }
                      : { text: `⏸ Pause`, callback_data: `pause_${updatedSession.id}` },
                    { text: `🛑 Stop`, callback_data: `end_${updatedSession.id}` }
                  ]
                ];
                
                // Add QKhata back if it was a member
                const preferences = business.pricing_rules?.globalSettings?.preferences || {};
                if (updatedSession.member_id && preferences.enable_qkhata !== false) {
                    buttons[0].splice(1, 0, { text: `📒 QKhata`, callback_data: `qkhatainit_${updatedSession.id}` });
                }
                
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

      else if (callbackData.startsWith('qkhatainit_')) {
          const sessionId = callbackData.replace('qkhatainit_', '');
          
          const session = await sessionRepository.findById(sessionId, business.id);
          if (!session || session.status !== 'ACTIVE') {
              if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Session not found or already completed.`);
              else await sendTelegramMessage(chatId, `❌ Session not found or already completed.`);
              return NextResponse.json({ ok: true });
          }
          
          if (!session.member_id) {
              if (messageId) await editTelegramMessageText(chatId, messageId, `❌ QKhata is unavailable because this customer is not a registered member.`);
              else await sendTelegramMessage(chatId, `❌ QKhata is unavailable because this customer is not a registered member.`);
              return NextResponse.json({ ok: true });
          }

          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, session.member_id);
          if (!membership && !customer && siblingRows.length === 0) {
              if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Member not found.`);
              else await sendTelegramMessage(chatId, `❌ Member not found.`);
              return NextResponse.json({ ok: true });
          }

          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const memberName = (membership?.name || primaryCustomer?.name || session.customer_name || 'Member').trim();
          
          const isPaused = typeof session.paused_at === 'string' && session.paused_at.trim() !== '';
          const startFull = typeof session.start_time === 'string' && session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
          const endFull = isPaused ? (session.paused_at as never || session.paused_at) : new Date().toISOString();
          
          let billText = '0';
          try {
             const res = await calculateServerBillingForSession(session, business.id, endFull);
             billText = `${Math.round(res.cost)}`;
          } catch(e){}
          
          const buttons = [
              [
                  { text: `✅ Confirm QKhata`, callback_data: `qkhata_conf_${session.id}` },
                  { text: `❌ Cancel`, callback_data: `qkhata_back` }
              ]
          ];
          
          const msg = `Are you sure you want to close this session and add ₹${billText} to QKhata for ${memberName}?`;
          
          if (messageId) {
             await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
          } else {
             await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
          }
      }

      else if (callbackData.startsWith('qkhata_conf_')) {
          const sessionId = callbackData.replace('qkhata_conf_', '');
          
          const session = await sessionRepository.findById(sessionId, business.id);
          if (!session || session.status !== 'ACTIVE') {
              if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Session not found or already completed.`);
              return NextResponse.json({ ok: true });
          }
          
          if (!session.member_id) return NextResponse.json({ ok: true });

          const { customer, siblingRows, membership } = await getMemberSiblingCustomerRows(business.id, session.member_id);
          if (!membership && !customer && siblingRows.length === 0) return NextResponse.json({ ok: true });

          const primaryCustomer = siblingRows.find(c => c.phone) || customer || siblingRows[0];
          const memberName = (membership?.name || primaryCustomer?.name || session.customer_name || 'Member').trim();

          try {
             // Use handleSessionIntervention with payment_method = 'QKhata' which calculates correctly and updates balance
             const { dbUpdates } = await handleSessionIntervention({
                action: 'force_end',
                session_id: sessionId,
                business_id: business.id,
                amount_recovered: 0,
                payment_method: 'QKhata',
                performed_by: 'Qbot'
             });
             
             // Refresh sibling rows to get the accurate new consolidated balance
             const { siblingRows: updatedSiblings } = await getMemberSiblingCustomerRows(business.id, session.member_id);
             const newTotal = updatedSiblings.reduce((sum, c) => sum + (Number(c.outstanding_balance) || 0), 0);
             
             const addedAmount = dbUpdates && (dbUpdates as any).cost ? Math.round((dbUpdates as any).cost) : 'Unknown';
             
             const msg = `✅ <b>QKhata Added</b>\n\nMember: ${memberName}\nSession: #${(session.id || sessionId).split('-')[0].toUpperCase()}\nOutstanding Added: ₹${addedAmount}\nTotal Outstanding: ₹${Math.round(newTotal)}`;
             
             if (messageId) {
                await editTelegramMessageText(chatId, messageId, msg);
             } else {
                await sendTelegramMessage(chatId, msg, mainMenu);
             }
          } catch(e: any) {
             if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Failed to confirm QKhata: ${e.message}`);
             else await sendTelegramMessage(chatId, `❌ Failed to confirm QKhata: ${e.message}`, mainMenu);
          }
      }

      else if (callbackData === 'bk_view_today') {
        const dateStr = getCurrentISTDateStr();
        const { data: bookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('business_id', business.id)
          .gte('booking_date', dateStr)
          .in('status', ['confirmed', 'active'])
          .order('start_time', { ascending: true });

        if (!bookings || bookings.length === 0) {
          if (messageId) {
             await editTelegramMessageText(chatId, messageId, `No upcoming bookings for today (${dateStr}).`, { inline_keyboard: [[{ text: '➕ Create Booking', callback_data: 'bk_create_new' }]] });
          } else {
             await sendTelegramMessage(chatId, `No upcoming bookings for today (${dateStr}).`, mainMenu);
          }
        } else {
          for (const b of bookings) {
            let msg = `📅 <b>Booking</b>

`;
            msg += `<b>Table:</b> ${b.table_id}
`;
            msg += `<b>Time:</b> ${formatTimeReadable(b.start_time)}
`;
            msg += `<b>Name:</b> ${b.customer_name}
`;
            msg += `<b>Game:</b> ${b.game_type || 'pool'}
`;
            msg += `<b>Players:</b> ${b.num_players || 1}
`;
            
            const buttons = [
              [
                { text: '▶️ Start', callback_data: `bk_start_${b.id}` },
                { text: '❌ Cancel', callback_data: `bk_cancel_${b.id}` }
              ],
              [
                { text: '🚫 No Show', callback_data: `bk_noshow_${b.id}` }
              ]
            ];
            
            await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
          }
          await answerCallbackQuery(callbackQueryId);
        }
      }
      else if (callbackData.startsWith('bk_start_') || callbackData.startsWith('bk_cancel_') || callbackData.startsWith('bk_noshow_')) {
        const parts = callbackData.split('_');
        const action = parts[1]; // start, cancel, noshow
        const bookingId = parts[2];
        
        const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
        if (!booking) {
          await sendTelegramMessage(chatId, '❌ Booking not found.');
          return NextResponse.json({ ok: true });
        }
        
          if (action === 'start') {
          try {
            const session = await startSession(booking.table_id, booking.game_type as any, booking.customer_name, business.id, booking.num_players || 1, (booking as any).member_id);
            await supabase.from('bookings').update({ status: 'active', session_id: session.id }).eq('id', bookingId);
            const { syncSessionLifecycle, scheduleBackgroundTask, flushSheetsSyncQueue } = require('@/lib/sheetsSyncQueue');
            syncSessionLifecycle(session.id, business.id);
            scheduleBackgroundTask(() => flushSheetsSyncQueue(business.id));
            const msg = `✅ <b>Booking Started</b>

Player: ${booking.customer_name}
Table: ${booking.table_id}
Started At: ${formatTimeReadable(session.start_time)}`;
            if (messageId) await editTelegramMessageText(chatId, messageId, msg);
            else await sendTelegramMessage(chatId, msg, mainMenu);
          } catch (error: any) {
            if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Failed to start booking: ${error.message}`);
            else await sendTelegramMessage(chatId, `❌ Failed to start booking: ${error.message}`, mainMenu);
          }
        } else if (action === 'cancel') {
          await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
          if (messageId) await editTelegramMessageText(chatId, messageId, `❌ Booking for ${booking.customer_name} cancelled.`);
        } else if (action === 'noshow') {
          await supabase.from('bookings').update({ status: 'no_show' }).eq('id', bookingId);
          if (messageId) await editTelegramMessageText(chatId, messageId, `🚫 Booking for ${booking.customer_name} marked as No Show.`);
        }
      }
      else if (callbackData === 'bk_create_new') {
        let gameTypes: string[] = [];
        if (business.pricing_rules?.rules) {
            gameTypes = Object.keys(business.pricing_rules.rules);
        }
        
        if (gameTypes.length === 0) {
           if (messageId) await editTelegramMessageText(chatId, messageId, `❌ No pricing configured.`);
           return NextResponse.json({ ok: true });
        }
        
        const gameButtons = gameTypes.map((g) => ({ text: g.charAt(0).toUpperCase() + g.slice(1), callback_data: `bk_game_${g}` }));
        const buttons = chunkArray(gameButtons, 2);
        
        const msg = `🎱 <b>Create Booking</b>

Select Game Type:`;
        if (messageId) await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
        else await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });
      }
      else if (callbackData.startsWith('bk_game_')) {
        const gameType = callbackData.replace('bk_game_', '');
        if (gameType.toLowerCase() === 'ps5') {
            const buttons = [1, 2, 3, 4].map(num => ({ text: `${num} Player${num > 1 ? 's' : ''}`, callback_data: `bk_ps5_${num}` }));
            const msg = `🎮 <b>Select Players</b>`;
            if (messageId) await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: [buttons] });
        } else {
            const todayStr = getCurrentISTDateStr();
            const tomorrowStr = getCurrentISTDateStr(Date.now() + 24 * 60 * 60 * 1000);
            
            const buttons = [
               [{ text: 'Today', callback_data: `bk_date_${gameType}_1_${todayStr}` }],
               [{ text: 'Tomorrow', callback_data: `bk_date_${gameType}_1_${tomorrowStr}` }]
            ];
            const msg = `📅 <b>Select Date</b>`;
            if (messageId) await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
        }
      }
      else if (callbackData.startsWith('bk_ps5_')) {
        const numPlayers = parseInt(callbackData.replace('bk_ps5_', ''), 10);
        const todayStr = getCurrentISTDateStr();
        const tomorrowStr = getCurrentISTDateStr(Date.now() + 24 * 60 * 60 * 1000);
        
        const buttons = [
           [{ text: 'Today', callback_data: `bk_date_ps5_${numPlayers}_${todayStr}` }],
           [{ text: 'Tomorrow', callback_data: `bk_date_ps5_${numPlayers}_${tomorrowStr}` }]
        ];
        const msg = `📅 <b>Select Date</b>`;
        if (messageId) await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
      }
      else if (callbackData.startsWith('bk_date_')) {
        const parts = callbackData.replace('bk_date_', '').split('_');
        const gameType = parts[0];
        const numPlayers = parseInt(parts[1], 10);
        const dateStr = parts[2];
        
        // Find available tables for this game
        const tables = (business.tables || []).filter((t: any) => {
           if (t.type) return t.type.toLowerCase() === gameType.toLowerCase();
           return true; // if table has no explicit type, assume it can host any
        });
        
        if (tables.length === 0) {
           if (messageId) await editTelegramMessageText(chatId, messageId, `❌ No tables available for ${gameType}.`);
           return NextResponse.json({ ok: true });
        }
        
        // Authoritative slot generation supporting all tables and overnight hours
        const slots = await bookingService.getAvailableSlots(business.id, gameType, dateStr, 60);

        if (slots.length === 0) {
           if (messageId) await editTelegramMessageText(chatId, messageId, `❌ No slots available on ${dateStr}.`);
           return NextResponse.json({ ok: true });
        }

        const slotButtons = slots.map(s => {
            const parts = s.time.split(':').map(Number);
            const mins = (parts[0] || 0) * 60 + (parts[1] || 0);
            return {
                text: `${s.displayTime || s.time} (${s.tableName})`,
                callback_data: `bk_time_${s.tableId}_${mins}_${gameType}_${numPlayers}_${dateStr}`
            };
        });

        // Show first 8 available slots for clean mobile Telegram presentation
        const buttons = chunkArray(slotButtons.slice(0, 8), 2);

        const msg = `🕒 <b>Select Time</b>

Game: ${gameType}
Date: ${dateStr}`;
        if (messageId) await editTelegramMessageText(chatId, messageId, msg, { inline_keyboard: buttons });
      }
      else if (callbackData.startsWith('bk_time_')) {
        const parts = callbackData.replace('bk_time_', '').split('_');
        const tableId = parts[0];
        const mins = parseInt(parts[1], 10);
        const gameType = parts[2];
        const numPlayers = parseInt(parts[3], 10);
        const dateStr = parts.slice(4).join('_');
        
        const hh = Math.floor(mins / 60).toString().padStart(2, '0');
        const mm = (mins % 60).toString().padStart(2, '0');
        const timeStr = `${hh}:${mm}`;
        
        const msg = `👤 <b>Enter Customer Name for Booking</b>

Game: ${gameType}
Players: ${numPlayers}
Date: ${dateStr}
Time: ${timeStr}
Table: ${tableId}

(Reply to this message with the customer's name, e.g., "John")`;
        
        await sendTelegramMessage(chatId, msg, { force_reply: true });
      }


    }

    return;
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
  }
}

const recentUpdateTimes = new Map<string, number>();

function isDuplicateUpdate(updateId?: number, callbackQueryId?: string): boolean {
  const now = Date.now();
  if (recentUpdateTimes.size > 2000) {
    for (const [key, timestamp] of recentUpdateTimes.entries()) {
      if (now - timestamp > 300000) recentUpdateTimes.delete(key);
    }
  }

  const key = callbackQueryId ? `cb_${callbackQueryId}` : updateId ? `up_${updateId}` : null;
  if (!key) return false;

  if (recentUpdateTimes.has(key)) {
    return true;
  }
  recentUpdateTimes.set(key, now);
  return false;
}

import { getBusinessEntitlement } from '@/lib/entitlements';
export async function POST(request: Request) {
  try {
    const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'qcontrol_secure_webhook_123';
    const clientSecret = request.headers.get('x-telegram-bot-api-secret-token');

    // Strict secret verification: require valid x-telegram-bot-api-secret-token
    if (!clientSecret) {
      console.warn('Unauthorized Telegram Webhook attempt: missing secret token header.');
      return NextResponse.json({ error: 'Unauthorized: Missing secret token' }, { status: 401 });
    }

    const secretBuf = Buffer.from(WEBHOOK_SECRET);
    const clientBuf = Buffer.from(clientSecret);
    const isValid = secretBuf.length === clientBuf.length && crypto.timingSafeEqual(secretBuf, clientBuf);

    if (!isValid) {
      console.warn('Unauthorized Telegram Webhook attempt: invalid secret token.');
      return NextResponse.json({ error: 'Unauthorized: Invalid secret token' }, { status: 401 });
    }

    const update = await request.json();
    const updateId = update.update_id;
    const callbackQuery = update.callback_query;
    const callbackQueryId = callbackQuery?.id;
    const callbackData = callbackQuery?.data;
    const chatId = update.message?.chat?.id || callbackQuery?.message?.chat?.id || callbackQuery?.from?.id;

    const tracker = new PerformanceTracker(
      updateId || 0,
      callbackQueryId ? 'callback_query' : update.message ? 'message' : 'other',
      callbackData || update.message?.text?.split(' ')[0]
    );

    // Layer 1: Instant in-memory idempotency & button debouncing (0.01ms)
    const isDuplicateMem = isDuplicateUpdate(updateId, callbackQueryId);
    if (isDuplicateMem) {
      tracker.markAcknowledged();
      tracker.finish('SUCCESS', 'In-memory duplicate ignored');
      if (callbackQueryId) {
        return NextResponse.json({
          method: 'answerCallbackQuery',
          callback_query_id: callbackQueryId,
          cache_time: 0,
          duplicate: true
        });
      }
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Layer 2: Atomic Database Deduplication Lock
    // Ensures zero duplicate side-effects across restarts, serverless lambdas, and concurrent workers.
    if (updateId && updateId > 0) {
      const { error: insertError } = await supabase.from('telegram_updates').insert({
        update_id: updateId,
        chat_id: String(chatId || '')
      });

      if (insertError && (
        insertError.code === '23505' || 
        insertError.message?.includes('duplicate key') || 
        insertError.message?.includes('violates unique constraint')
      )) {
        tracker.markAcknowledged();
        tracker.finish('SUCCESS', 'Atomic DB duplicate ignored');
        if (callbackQueryId) {
          return NextResponse.json({
            method: 'answerCallbackQuery',
            callback_query_id: callbackQueryId,
            cache_time: 0,
            duplicate: true
          });
        }
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    // Mark callback acknowledged
    if (callbackQueryId) {
      tracker.markAcknowledged();
    }

    // Execute webhook processing directly and await to ensure container doesn't freeze prematurely
    try {
      await processWebhook(update, tracker);
      tracker.finish('SUCCESS');
    } catch (err: any) {
      console.error(`[Webhook Processing Error] update_id: ${updateId}, msg: ${err?.message || err}`);
      tracker.finish('ERROR', err?.message || 'Error');
    }

    // Background Google Sheets flush to guarantee all session starts, stops, pauses, and edits sync reliably
    try {
      const { scheduleBackgroundTask, flushSheetsSyncQueue } = require('@/lib/sheetsSyncQueue');
      scheduleBackgroundTask(async () => {
        try {
          await flushSheetsSyncQueue(undefined, 4000);
        } catch (flushErr) {
          console.warn('[TelegramWebhook] Sheets sync background flush warning:', flushErr);
        }
      });
    } catch {}

    // Return instant Telegram Webhook Response Method for callback queries if applicable
    if (callbackQueryId) {
      return NextResponse.json({
        method: 'answerCallbackQuery',
        callback_query_id: callbackQueryId,
        cache_time: 0
      });
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram Webhook Parse Error:', error);
    return NextResponse.json({ ok: true, error_logged: true });
  }
}
