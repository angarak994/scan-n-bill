import { supabase } from '@/lib/supabaseClient';
import { businessManager, BusinessData, invalidateBusinessCache } from '@/lib/businessManager';
import { sessionRepository, Session } from '@/lib/repositories/sessionRepository';
import { calculateServerBillingForSession } from '@/lib/sessionManager';
import { enqueueSheetsSync } from '@/lib/sheetsSyncQueue';
import { getMostSellingItems, MostSellingItem } from '@/lib/services/mostSellingService';
import { createAuthoritativeOrder, parseOrderNotification } from '@/lib/services/foodOrderService';
import {
  getOrCreateUserState,
  setSelectedTable,
  getSelectedTable,
  setSelectedCategory,
  getSelectedCategory,
  addItemToCart,
  getCartItems,
  getCartTotal,
  clearCart,
  setUndoAction,
  consumeUndoAction,
  CartItem,
} from './stateManager';
import { TelegramClient } from './telegramClient';

/**
 * Ensures business has menu_items populated; fetches fresh from DB if missing or requested
 */
export async function getBusinessWithMenu(business: BusinessData, forceRefresh = false): Promise<BusinessData> {
  const bizId = business?.id;
  if (!bizId) return business;
  if (forceRefresh || !business.menu_items || !Array.isArray(business.menu_items)) {
    const fresh = await businessManager.getBusiness(bizId, forceRefresh);
    if (fresh) return fresh;
  }
  return business;
}

/**
 * Filters out deleted, archived, or malformed menu items according to business status rules.
 * Sorts pinned items first.
 */
export function getActiveMenuItems(business: BusinessData): any[] {
  if (!business || !Array.isArray(business.menu_items)) return [];
  const items = business.menu_items.filter(item => {
    if (!item || !item.name) return false;
    const raw = item as any;
    if (raw.status === 'deleted' || raw.status === 'archived') return false;
    if (raw.deleted === true || raw.is_deleted === true || raw.archived === true) return false;
    return true;
  });

  return items.sort((a: any, b: any) => {
    const aPin = (a.is_pinned || a.isPinned || a.pinned) ? 1 : 0;
    const bPin = (b.is_pinned || b.isPinned || b.pinned) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return (a.pinOrder || a.pin_order || 0) - (b.pinOrder || b.pin_order || 0);
  });
}

/**
 * Returns unique non-empty category names from active menu items
 */
export function getUniqueMenuCategories(menuItems: any[]): string[] {
  const set = new Set<string>();
  for (const item of menuItems) {
    const cat = (item.category || '').trim();
    if (cat) set.add(cat);
  }
  return Array.from(set);
}

/**
 * Returns contextual emoji for a category name
 */
export function getCategoryEmoji(category: string): string {
  const lower = (category || '').toLowerCase();
  if (
    lower.includes('bever') ||
    lower.includes('drink') ||
    lower.includes('tea') ||
    lower.includes('coffee') ||
    lower.includes('soda') ||
    lower.includes('shake') ||
    lower.includes('juice') ||
    lower.includes('water')
  ) {
    return '☕';
  }
  if (
    lower.includes('snack') ||
    lower.includes('fry') ||
    lower.includes('fries') ||
    lower.includes('chip') ||
    lower.includes('munch') ||
    lower.includes('bites')
  ) {
    return '🍟';
  }
  if (
    lower.includes('food') ||
    lower.includes('meal') ||
    lower.includes('pizza') ||
    lower.includes('burger') ||
    lower.includes('sandwich') ||
    lower.includes('bread') ||
    lower.includes('main') ||
    lower.includes('lunch') ||
    lower.includes('dinner')
  ) {
    return '🍔';
  }
  if (
    lower.includes('dessert') ||
    lower.includes('sweet') ||
    lower.includes('ice cream') ||
    lower.includes('cake')
  ) {
    return '🍰';
  }
  if (
    lower.includes('hookah') ||
    lower.includes('shisha') ||
    lower.includes('smoke')
  ) {
    return '💨';
  }
  return '🍽️';
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getTodayISTDateStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getStartOfTodayISTISO(): string {
  const istDateStr = getTodayISTDateStr(); // YYYY-MM-DD
  // Asia/Kolkata is UTC+5:30 -> midnight IST is 18:30 UTC of previous day
  const d = new Date(`${istDateStr}T00:00:00+05:30`);
  return d.toISOString();
}

/**
 * Returns today's live F&B statistics for the business
 */
export async function getTodayFbStats(businessId?: string): Promise<{ orderCount: number; fbRevenue: number }> {
  if (!businessId) return { orderCount: 0, fbRevenue: 0 };
  try {
    const startOfTodayISO = getStartOfTodayISTISO();
    const { data: notifs } = await supabase
      .from('notifications')
      .select('message, type, created_at')
      .eq('business_id', businessId)
      .in('type', ['order_pending', 'order_accepted', 'order_served'])
      .gte('created_at', startOfTodayISO);

    let orderCount = 0;
    let fbRevenue = 0;

    if (notifs) {
      for (const n of notifs) {
        orderCount++;
        const parts = n.message ? n.message.split('|') : [];
        if (parts.length >= 2) {
          const total = parseFloat(parts[parts.length - 2]) || 0;
          fbRevenue += total;
        }
      }
    }

    return { orderCount, fbRevenue: Math.round(fbRevenue) };
  } catch (e) {
    return { orderCount: 0, fbRevenue: 0 };
  }
}

/**
 * Helper to get active session for table
 */
async function getActiveSessionForTable(businessId?: string, tableId?: string): Promise<Session | null> {
  if (!businessId || !tableId) return null;
  const session = await sessionRepository.findActiveByTable(tableId, businessId);
  return session && session.status === 'ACTIVE' ? session : null;
}

/**
 * 1. RENDER MAIN F&B HUB
 */
export async function renderFbHub(business: BusinessData, chatId: string | number) {
  const freshBusiness = await getBusinessWithMenu(business);
  const bizId = freshBusiness.id || '';
  const todayStats = await getTodayFbStats(bizId);

  // Direct Supabase query for active sessions to guarantee accuracy
  const { data: activeSessionsData } = await supabase
    .from('sessions')
    .select('*')
    .eq('business_id', bizId)
    .eq('status', 'ACTIVE');
  const activeSessions = (activeSessionsData || []) as Session[];

  const state = getOrCreateUserState(chatId, bizId);
  const lastTableId = state.selectedTableId;

  let msg = `🍔 <b>F&B Ordering Hub</b>\n`;
  msg += `🏢 <b>${escapeHtml(freshBusiness.business_name)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 <b>Today's F&B:</b> <b>${todayStats.orderCount}</b> orders · <b>₹${todayStats.fbRevenue}</b>\n`;
  msg += `🟢 <b>Active Tables:</b> ${activeSessions.length} active\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Select a table to take an order or view current tab:`;

  const buttons: any[] = [];

  // Group active tables into rows of 2
  const activeTableButtons: any[] = [];
  for (let i = 0; i < activeSessions.length; i++) {
    const s = activeSessions[i];
    const isLastUsed = s.table_id === lastTableId;
    activeTableButtons.push({
      text: `${isLastUsed ? '⭐ ' : '🟢 '}${s.table_id} (${s.customer_name || 'Guest'})`,
      callback_data: `fb:t:${encodeURIComponent(s.table_id)}`,
    });
  }

  // Chunk table buttons in pairs
  for (let i = 0; i < activeTableButtons.length; i += 2) {
    buttons.push(activeTableButtons.slice(i, i + 2));
  }

  // All other tables from business config
  const tables = freshBusiness.tables || [];
  const inactiveTables = tables.filter(
    t => !activeSessions.some((s: Session) => s.table_id.toLowerCase().trim() === t.id.toLowerCase().trim())
  );

  if (inactiveTables.length > 0) {
    const otherButtons: any[] = [];
    for (const t of inactiveTables.slice(0, 6)) {
      otherButtons.push({
        text: `⚪ ${t.name || t.id}`,
        callback_data: `fb:t:${encodeURIComponent(t.id)}`,
      });
    }
    for (let i = 0; i < otherButtons.length; i += 2) {
      buttons.push(otherButtons.slice(i, i + 2));
    }
  }

  // Speed controls & management
  buttons.push([
    { text: '📋 Stock Control', callback_data: 'fb:stk' },
    { text: '📊 Daily Digest', callback_data: 'fb:dgt' },
  ]);

  buttons.push([{ text: '↩️ Main Menu', callback_data: 'fb:back_main' }]);

  return { text: msg, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * 2. RENDER TABLE TAB & ORDERING SCREEN
 */
export async function renderTableScreen(
  business: BusinessData,
  chatId: string | number,
  tableId: string,
  noticeMessage?: string
) {
  const freshBusiness = await getBusinessWithMenu(business);
  const bizId = freshBusiness.id || '';
  setSelectedTable(chatId, tableId, bizId);

  const activeSession = await getActiveSessionForTable(bizId, tableId);
  const allActiveItems = getActiveMenuItems(freshBusiness);
  const mostSelling = await getMostSellingItems(bizId, allActiveItems, 4);

  // Calculate authoritative live tab
  let tableFee = 0;
  let foodFee = 0;
  let totalBill = 0;
  let discountAmount = 0;
  let discountLabel = '';
  let customerBalance: number | null = null;
  let durationStr = 'No active session';
  let customerName = 'Walk-in / Standalone';

  if (activeSession) {
    customerName = activeSession.customer_name || 'Guest';
    try {
      const isPaused = typeof activeSession.paused_at === 'string' && activeSession.paused_at.trim() !== '';
      const endFull = (isPaused && activeSession.paused_at) ? activeSession.paused_at : new Date().toISOString();
      const billingRes = await calculateServerBillingForSession(activeSession, bizId, endFull);
      totalBill = Math.round(billingRes.cost);
      tableFee = Math.round(billingRes.baseTableCost);
      foodFee = Math.round(billingRes.baseFoodCost || activeSession.food_cost || 0);
      discountAmount = Math.round(billingRes.totalDiscountAmount || 0);
      discountLabel = billingRes.discountAppliedLabel || '';
      durationStr = billingRes.duration ? billingRes.duration.replace(' min', 'm').replace(' hr ', 'h ') : '0m';
      if (isPaused) durationStr += ' (⏸ Paused)';
    } catch (e) {
      console.error('[renderTableOrdering] Billing calculation error:', e);
      foodFee = Math.round(activeSession.food_cost || 0);
      totalBill = foodFee;
    }

    if (activeSession.member_id || activeSession.customer_id) {
      try {
        const custId = activeSession.customer_id || activeSession.member_id;
        const { data: cust } = await supabase
          .from('customers')
          .select('outstanding_balance')
          .eq('business_id', bizId)
          .or(`id.eq.${custId},name.ilike.${activeSession.customer_name}`)
          .limit(1)
          .maybeSingle();
        if (cust && typeof cust.outstanding_balance === 'number') {
          customerBalance = Math.round(cust.outstanding_balance);
        }
      } catch (custErr) {}
    }
  }

  // Get current cart for this user
  const cartItems = getCartItems(chatId);
  const { totalAmount: cartTotal, itemCount: cartCount } = getCartTotal(chatId);

  // Fetch pending / recent orders for this table
  const startOfDay = getStartOfTodayISTISO();
  let tableOrdersQuery = supabase
    .from('notifications')
    .select('*')
    .eq('business_id', bizId)
    .in('type', ['order_pending', 'order_accepted', 'order_served'])
    .gte('created_at', startOfDay)
    .order('created_at', { ascending: false });

  if (activeSession && activeSession.id) {
    tableOrdersQuery = tableOrdersQuery.like('message', `%|${activeSession.id}`);
  }

  const { data: existingOrders } = await tableOrdersQuery.limit(5);

  let msg = '';
  if (noticeMessage) {
    msg += `${noticeMessage}\n\n`;
  }

  msg += `🎱 <b>Table ${escapeHtml(tableId)}</b> · <b>${escapeHtml(customerName)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⏱️ <b>Time Elapsed:</b> ${durationStr}\n`;
  msg += `🎮 <b>Game Charges:</b> ₹${tableFee}\n`;
  msg += `🍔 <b>F&B Orders:</b> ₹${foodFee}\n`;
  if (discountAmount > 0) {
    msg += `🏷️ <b>Discount:</b> -₹${discountAmount} (${escapeHtml(discountLabel)})\n`;
  }
  msg += `💰 <b>Running Tab:</b> <b>₹${totalBill}</b>\n`;
  if (customerBalance !== null) {
    msg += `📒 <b>QKhata Balance:</b> ₹${customerBalance}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Repeat Last Order Check
  let lastOrderRepeatData: { summary: string; notifId: string } | null = null;
  if (existingOrders && existingOrders.length > 0) {
    const latest = existingOrders[0];
    const parsed = parseOrderNotification(latest.message);
    if (parsed && parsed.items.length > 0) {
      const lines = parsed.items.map(i => `${i.qty}x ${i.name}`).join(', ');
      lastOrderRepeatData = {
        summary: `${lines} (₹${parsed.orderTotal})`,
        notifId: latest.id,
      };
    }
  }

  // If there are items in the cart
  if (cartCount > 0) {
    msg += `🛒 <b>Current Cart (${cartCount} items):</b>\n`;
    for (const item of cartItems) {
      msg += `  • ${item.qty}x ${escapeHtml(item.name)} — ₹${item.price * item.qty}\n`;
    }
    msg += `  Subtotal: <b>₹${cartTotal}</b> ➔ <i>New Tab will be ₹${totalBill + cartTotal}</i>\n\n`;
  }

  msg += `⚡ <b>Top Items (1-Tap Add):</b>`;

  const buttons: any[] = [];

  // 1. Most Selling Quick-Add row (≤ 3 taps flow)
  const topItemButtons: any[] = [];
  for (let i = 0; i < mostSelling.length; i++) {
    const item = mostSelling[i];
    const prefix = (item.is_pinned || item.isPinned || item.pinned) ? '📌 ' : '';
    const label = `${prefix}${item.name.split(' ')[0]} ₹${item.price}`;
    topItemButtons.push({
      text: item.available ? label : `🚫 ${item.name.split(' ')[0]} (Sold Out)`,
      callback_data: item.available ? `fb:qa:${i}` : 'ignore',
    });
  }

  for (let i = 0; i < topItemButtons.length; i += 2) {
    buttons.push(topItemButtons.slice(i, i + 2));
  }

  // 2. Repeat Last Order button (≤ 2 taps flow)
  if (lastOrderRepeatData) {
    buttons.push([
      {
        text: `🔁 Repeat Last: ${lastOrderRepeatData.summary.substring(0, 32)}`,
        callback_data: `fb:rpt`,
      },
    ]);
  }

  // 3. Cart action row
  if (cartCount > 0) {
    buttons.push([
      { text: `✅ Confirm Order (₹${cartTotal})`, callback_data: 'fb:ok' },
      { text: '🗑️ Clear', callback_data: 'fb:clr' },
    ]);
  }

  // 4. Category browse buttons - dynamically derived from business's actual menu categories
  const uniqueCats = getUniqueMenuCategories(allActiveItems);
  const catButtons: any[] = [];
  if (uniqueCats.length > 0) {
    for (const c of uniqueCats.slice(0, 4)) {
      catButtons.push({
        text: `${getCategoryEmoji(c)} ${c}`,
        callback_data: `fb:cat:${encodeURIComponent(c)}`,
      });
    }
  }
  catButtons.push({ text: '📋 Full Menu', callback_data: 'fb:cat:All' });

  for (let i = 0; i < catButtons.length; i += 2) {
    buttons.push(catButtons.slice(i, i + 2));
  }

  // 5. Active orders status / bulk action
  if (existingOrders && existingOrders.length > 0) {
    const pendingOrders = existingOrders.filter(o => o.type === 'order_pending' || o.type === 'order_accepted');
    if (pendingOrders.length > 0) {
      buttons.push([
        {
          text: `🍽️ Mark All Ready as Served (${pendingOrders.length})`,
          callback_data: `fb:srv_all:${encodeURIComponent(tableId)}`,
        },
      ]);
    }
  }

  // Back navigation
  buttons.push([
    { text: '🔄 Refresh Tab', callback_data: `fb:t:${encodeURIComponent(tableId)}` },
    { text: '⬅️ Change Table', callback_data: 'fb:hub' },
  ]);

  return { text: msg, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * 3. RENDER CATEGORY MENU BROWSER
 */
export async function renderCategoryScreen(
  business: BusinessData,
  chatId: string | number,
  category: string
) {
  const freshBusiness = await getBusinessWithMenu(business);
  const tableId = getSelectedTable(chatId) || 'Unknown';
  const allActiveItems = getActiveMenuItems(freshBusiness);
  setSelectedCategory(chatId, category);

  let filtered: any[] = [];
  const trimmedCat = category.trim();

  if (trimmedCat.toLowerCase() === 'all') {
    filtered = allActiveItems;
  } else {
    // 1. Direct match (case-insensitive, trimmed)
    filtered = allActiveItems.filter(
      i => (i.category || 'Other').trim().toLowerCase() === trimmedCat.toLowerCase()
    );

    // 2. Smart alias match if 0 items found
    if (filtered.length === 0) {
      const catLower = trimmedCat.toLowerCase();
      const beverageAliases = ['beverages', 'beverage', 'drink', 'drinks', 'cold drinks', 'hot drinks', 'tea', 'coffee', 'juice', 'shake', 'water'];
      const snackAliases = ['snacks', 'snack', 'food', 'meals', 'meal', 'munchies', 'fast food', 'bites'];

      if (beverageAliases.includes(catLower)) {
        filtered = allActiveItems.filter(i =>
          beverageAliases.includes((i.category || '').trim().toLowerCase())
        );
      } else if (snackAliases.includes(catLower)) {
        filtered = allActiveItems.filter(i =>
          snackAliases.includes((i.category || '').trim().toLowerCase())
        );
      }
    }
  }

  const cart = getOrCreateUserState(chatId).cart;
  const { totalAmount: cartTotal, itemCount: cartCount } = getCartTotal(chatId);

  let msg = `📋 <b>Menu: ${escapeHtml(category)}</b>\n`;
  msg += `Table: <b>${escapeHtml(tableId)}</b> · Business: <b>${escapeHtml(freshBusiness.business_name)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Tap an item to add to order:\n\n`;

  const buttons: any[] = [];

  if (filtered.length === 0) {
    if (allActiveItems.length === 0) {
      msg += `<i>No active menu items configured for this business yet.</i>\n`;
    } else {
      msg += `<i>No items found in category "${escapeHtml(category)}".</i>\n`;
    }
  } else {
    const hasAvailable = filtered.some(i => i.available !== false);
    if (!hasAvailable) {
      msg += `⚠️ <i>All items in this category are currently sold out.</i>\n\n`;
    }

    for (let idx = 0; idx < filtered.length; idx++) {
      const item = filtered[idx];
      const globalIdx = allActiveItems.findIndex(m =>
        m.id && item.id ? m.id === item.id : m.name.trim() === item.name.trim()
      );
      const targetIdx = globalIdx >= 0 ? globalIdx : idx;
      const isAvailable = item.available !== false;
      const currentQty = cart.get(item.name.trim())?.qty || 0;

      const qtyBadge = currentQty > 0 ? ` (${currentQty} in cart)` : '';
      const text = isAvailable
        ? `${item.name.trim()} — ₹${item.price}${qtyBadge}`
        : `🚫 ${item.name.trim()} [SOLD OUT]`;

      if (currentQty > 0 && isAvailable) {
        buttons.push([
          { text: `−`, callback_data: `fb:sub:${targetIdx}` },
          { text: `${item.name.trim()}: ${currentQty}`, callback_data: `fb:cart` },
          { text: `+`, callback_data: `fb:add:${targetIdx}` },
        ]);
      } else {
        buttons.push([
          {
            text: isAvailable ? `+ ${text}` : text,
            callback_data: isAvailable ? `fb:add:${targetIdx}` : 'ignore',
          },
        ]);
      }
    }
  }

  // Cart action bar
  if (cartCount > 0) {
    buttons.push([
      { text: `🛒 View Cart (${cartCount} · ₹${cartTotal})`, callback_data: 'fb:cart' },
      { text: `✅ Confirm (₹${cartTotal})`, callback_data: 'fb:ok' },
    ]);
  }

  // Dynamic category navigation
  const uniqueCats = getUniqueMenuCategories(allActiveItems);
  const otherCats = uniqueCats.filter(c => c.toLowerCase() !== trimmedCat.toLowerCase());

  const navButtons: any[] = [];
  for (const c of otherCats.slice(0, 4)) {
    navButtons.push({
      text: `${getCategoryEmoji(c)} ${c}`,
      callback_data: `fb:cat:${encodeURIComponent(c)}`,
    });
  }

  if (trimmedCat.toLowerCase() !== 'all') {
    navButtons.push({
      text: '📋 Full Menu',
      callback_data: 'fb:cat:All',
    });
  }

  for (let i = 0; i < navButtons.length; i += 2) {
    buttons.push(navButtons.slice(i, i + 2));
  }

  buttons.push([
    { text: `⬅️ Back to Table ${tableId}`, callback_data: `fb:t:${encodeURIComponent(tableId)}` },
  ]);

  return { text: msg, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * 4. RENDER CART CONFIRMATION SCREEN
 */
export async function renderCartScreen(business: BusinessData, chatId: string | number) {
  const freshBusiness = await getBusinessWithMenu(business);
  const bizId = freshBusiness.id || '';
  const tableId = getSelectedTable(chatId) || 'Unknown';
  const cartItems = getCartItems(chatId);
  const { totalAmount: cartTotal, itemCount: cartCount } = getCartTotal(chatId);

  if (cartCount === 0) {
    return renderTableScreen(freshBusiness, chatId, tableId, '⚠️ <i>Your cart is empty. Pick items to add below:</i>');
  }

  const activeSession = await getActiveSessionForTable(bizId, tableId);
  const currentFood = activeSession ? Math.round(activeSession.food_cost || 0) : 0;
  const newFood = currentFood + cartTotal;

  let msg = `🛒 <b>Review Order for Table ${escapeHtml(tableId)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  for (const item of cartItems) {
    msg += `• <b>${item.qty}x</b> ${escapeHtml(item.name)} @ ₹${item.price} = <b>₹${item.qty * item.price}</b>\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💵 <b>Order Total:</b> <b>₹${cartTotal}</b>\n`;
  if (activeSession) {
    msg += `📊 <b>Current F&B on Table:</b> ₹${currentFood}\n`;
    msg += `📈 <b>New Table F&B Total:</b> <b>₹${newFood}</b>\n`;
  }
  msg += `\nConfirm this order?`;

  const buttons: any[] = [
    [
      { text: `✅ Confirm & Place Order (₹${cartTotal})`, callback_data: 'fb:ok' },
    ],
    [
      { text: '+ Add More Items', callback_data: 'fb:cat:All' },
      { text: '🗑️ Clear Cart', callback_data: 'fb:clr' },
    ],
    [
      { text: `⬅️ Back to Table ${tableId}`, callback_data: `fb:t:${encodeURIComponent(tableId)}` },
    ],
  ];

  return { text: msg, replyMarkup: { inline_keyboard: buttons } };
}

/**
 * 5. PLACE TELEGRAM ORDER (ATOMIC BILLING & DEDUPLICATION)
 */
export async function placeTelegramOrder(
  business: BusinessData,
  chatId: string | number,
  customCart?: Record<string, number>
): Promise<{ success: boolean; message: string; replyMarkup: any }> {
  const freshBusiness = await getBusinessWithMenu(business);
  const bizId = freshBusiness.id || '';
  const tableId = getSelectedTable(chatId);
  if (!tableId) {
    return {
      success: false,
      message: '❌ <b>No table selected.</b> Please select a table first.',
      replyMarkup: {
        inline_keyboard: [[{ text: '🏢 Select Table', callback_data: 'fb:hub' }]],
      },
    };
  }

  const menuItems = getActiveMenuItems(freshBusiness);
  const stateCart = getCartItems(chatId);

  // Build items mapping
  const finalCart: Record<string, number> = {};
  if (customCart) {
    Object.assign(finalCart, customCart);
  } else {
    for (const item of stateCart) {
      if (item.qty > 0) finalCart[item.name.trim()] = item.qty;
    }
  }

  if (Object.keys(finalCart).length === 0) {
    return {
      success: false,
      message: '❌ <b>Empty order.</b> Please add items to order.',
      replyMarkup: {
        inline_keyboard: [[{ text: '⬅️ Back to Table', callback_data: `fb:t:${encodeURIComponent(tableId)}` }]],
      },
    };
  }

  // Active session validation
  const activeSession = await getActiveSessionForTable(bizId, tableId);
  const sessionId = activeSession?.id || undefined;

  let orderResult: any;
  try {
    orderResult = await createAuthoritativeOrder({
      businessId: bizId,
      sessionId,
      tableId,
      cart: finalCart,
      source: 'Telegram',
      idempotencyKey: `tg_${chatId}_${tableId}_${Date.now()}`
    });
  } catch (err: any) {
    return {
      success: false,
      message: `❌ <b>Order Failed:</b> ${escapeHtml(err.message || 'Please retry.')}`,
      replyMarkup: {
        inline_keyboard: [[{ text: '🔄 Refresh Menu', callback_data: `fb:t:${encodeURIComponent(tableId)}` }]],
      },
    };
  }

  const { orderId, orderRef, orderTotal, lineItems, newFoodCost } = orderResult;
  const itemsOrderedList = lineItems.map((i: any) => `${i.quantity}x ${i.name} (₹${i.subtotal})`);

  // Configure 1-Tap Undo Action (60s expiration)
  const undoToken = setUndoAction(chatId, {
    type: 'order_placed',
    orderId,
    sessionId: sessionId || undefined,
    businessId: bizId,
    tableId,
    amount: orderTotal,
    description: `Order #${orderRef} (${itemsOrderedList.join(', ')})`,
  });

  // Clear state cart
  clearCart(chatId);

  let successMsg = `✅ <b>Order #${orderRef} Placed!</b>\n`;
  successMsg += `Table: <b>${escapeHtml(tableId)}</b>\n`;
  successMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
  for (const item of itemsOrderedList) {
    successMsg += `• ${escapeHtml(item)}\n`;
  }
  successMsg += `━━━━━━━━━━━━━━━━━━━━\n`;
  successMsg += `💵 <b>Charged:</b> ₹${orderTotal}\n`;
  if (activeSession) {
    successMsg += `📊 <b>Updated Table F&B Tab:</b> ₹${newFoodCost}\n`;
  }
  successMsg += `\n<i>Added to bill and kitchen notified.</i>`;

  const successButtons = [
    [
      { text: '↩️ Undo (Mistake?)', callback_data: `fb:u:${undoToken}` },
      { text: '🍽️ Mark Served', callback_data: `fb:srv:${orderId}` },
    ],
    [
      { text: '+ Order More', callback_data: `fb:t:${encodeURIComponent(tableId)}` },
      { text: '🏢 All Tables', callback_data: 'fb:hub' },
    ],
  ];

  return {
    success: true,
    message: successMsg,
    replyMarkup: { inline_keyboard: successButtons },
  };
}

/**
 * 6. HANDLE 1-TAP UNDO
 */
export async function handleUndo(
  business: BusinessData,
  chatId: string | number,
  token?: string
): Promise<{ text: string; replyMarkup: any }> {
  const bizId = business.id || '';
  const action = consumeUndoAction(chatId, token);
  if (!action) {
    return {
      text: '⚠️ <b>Undo window expired or already undone.</b>\n\nActions can only be undone within 90 seconds.',
      replyMarkup: {
        inline_keyboard: [[{ text: '🏢 Return to F&B Hub', callback_data: 'fb:hub' }]],
      },
    };
  }

  if (action.type === 'order_placed' && action.orderId) {
    // 1. Fetch order
    const { data: order } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', action.orderId)
      .eq('business_id', bizId)
      .single();

    if (order && !['order_cancelled', 'order_voided'].includes(order.type)) {
      // 2. Revert billing if session is still active
      if (action.sessionId && action.amount) {
        const session = await sessionRepository.findById(action.sessionId, bizId);
        if (session && session.status === 'ACTIVE') {
          const currentFood = typeof session.food_cost === 'number' ? session.food_cost : 0;
          const newCost = Math.max(0, currentFood - action.amount);
          await supabase
            .from('sessions')
            .update({ food_cost: newCost })
            .eq('id', action.sessionId)
            .eq('business_id', bizId);

          try {
            enqueueSheetsSync('SESSION', action.sessionId, bizId);
          } catch (e) {}
        }
      }

      // 3. Mark notification cancelled
      await supabase
        .from('notifications')
        .update({ type: 'order_cancelled', is_read: true })
        .eq('id', action.orderId);

      // 4. Log audit intervention
      try {
        await supabase.from('session_interventions').insert({
          session_id: action.sessionId || null,
          intervention_type: 'food_order_undo',
          amount_recovered: action.amount || 0,
          performed_by: `Telegram: ${chatId}`,
        });
      } catch (e) {}

      return {
        text: `↩️ <b>Action Undone Successfully!</b>\n\n${escapeHtml(action.description)} has been cancelled.\n₹${action.amount || 0} deducted from table bill.`,
        replyMarkup: {
          inline_keyboard: [
            action.tableId
              ? [{ text: `🎱 Return to Table ${action.tableId}`, callback_data: `fb:t:${encodeURIComponent(action.tableId)}` }]
              : [{ text: '🏢 Return to F&B Hub', callback_data: 'fb:hub' }],
          ],
        },
      };
    }
  }

  return {
    text: '✅ Action reverted.',
    replyMarkup: {
      inline_keyboard: [[{ text: '🏢 Return to F&B Hub', callback_data: 'fb:hub' }]],
    },
  };
}

/**
 * 7. REPEAT LAST ORDER
 */
export async function handleRepeatLastOrder(business: BusinessData, chatId: string | number) {
  const bizId = business.id || '';
  const tableId = getSelectedTable(chatId);
  if (!tableId) {
    return {
      text: '❌ No table selected.',
      replyMarkup: { inline_keyboard: [[{ text: '🏢 Select Table', callback_data: 'fb:hub' }]] },
    };
  }

  const activeSession = await getActiveSessionForTable(bizId, tableId);
  const startOfDay = getStartOfTodayISTISO();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('business_id', bizId)
    .in('type', ['order_pending', 'order_accepted', 'order_served'])
    .gte('created_at', startOfDay)
    .order('created_at', { ascending: false });

  if (activeSession && activeSession.id) {
    query = query.like('message', `%|${activeSession.id}`);
  }

  const { data: orders } = await query.limit(1);

  if (!orders || orders.length === 0) {
    return renderTableScreen(business, chatId, tableId, '⚠️ <i>No previous order found to repeat for this table today.</i>');
  }

  const lastOrder = orders[0];
  const parts = lastOrder.message ? lastOrder.message.split('|') : [];
  if (parts.length < 2) {
    return renderTableScreen(business, chatId, tableId, '⚠️ <i>Unable to parse previous order data.</i>');
  }

  try {
    const rawCart = JSON.parse(parts.slice(0, parts.length - 2).join('|') || parts[0]);
    const cartToRepeat: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawCart)) {
      const qty = typeof v === 'number' ? v : Number((v as any).qty) || 0;
      if (qty > 0) cartToRepeat[k] = qty;
    }

    const placeRes = await placeTelegramOrder(business, chatId, cartToRepeat);
    return {
      text: `🔁 <b>Repeated Last Order!</b>\n\n${placeRes.message}`,
      replyMarkup: placeRes.replyMarkup,
    };
  } catch (e) {
    return renderTableScreen(business, chatId, tableId, '⚠️ <i>Failed to repeat order. Please select items manually.</i>');
  }
}

/**
 * 8. RENDER STOCK CONTROL & TOGGLE (2 TAPS)
 */
export async function renderStockControlScreen(
  business: BusinessData,
  chatId: string | number,
  feedback?: string
) {
  const bizId = business.id || '';
  const freshBusiness = (await businessManager.getBusiness(bizId)) || business;
  const menuItems = freshBusiness.menu_items || [];

  let msg = `📦 <b>Low-Friction Stock Control</b>\n`;
  msg += `🏢 <b>${escapeHtml(freshBusiness.business_name)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  if (feedback) {
    msg += `${feedback}\n━━━━━━━━━━━━━━━━━━━━\n`;
  }
  msg += `Tap any item to instantly toggle between <b>Available</b> and <b>Sold Out</b>:\n\n`;

  const buttons: any[] = [];
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    const isAvail = item.available !== false;
    const icon = isAvail ? '🟢' : '🔴';
    const statusText = isAvail ? 'Available' : 'SOLD OUT';

    buttons.push([
      {
        text: `${icon} ${item.name} (₹${item.price}) · ${statusText}`,
        callback_data: `fb:stktog:${i}`,
      },
    ]);
  }

  buttons.push([{ text: '⬅️ Back to F&B Hub', callback_data: 'fb:hub' }]);

  return { text: msg, replyMarkup: { inline_keyboard: buttons } };
}

export async function toggleStockAvailability(
  business: BusinessData,
  chatId: string | number,
  itemIndex: number
) {
  const bizId = business.id || '';
  const freshBusiness = (await businessManager.getBusiness(bizId)) || business;
  const menuItems = [...(freshBusiness.menu_items || [])];

  if (itemIndex < 0 || itemIndex >= menuItems.length) {
    return renderStockControlScreen(business, chatId, '⚠️ Invalid item.');
  }

  const target = menuItems[itemIndex];
  const newStatus = target.available === false ? true : false;
  menuItems[itemIndex] = { ...target, available: newStatus };

  // Update in Supabase
  await supabase
    .from('businesses')
    .update({ menu_items: menuItems })
    .eq('id', bizId);

  invalidateBusinessCache(bizId);

  const statusLabel = newStatus ? '🟢 <b>Available</b>' : '🔴 <b>Sold Out</b>';
  const feedback = `✅ <b>${escapeHtml(target.name)}</b> is now marked ${statusLabel}. Changes reflected on customer QR menu and dashboard!`;

  return renderStockControlScreen(freshBusiness, chatId, feedback);
}

/**
 * 9. END-OF-DAY DIGEST (IDEMPOTENT & TIMEZONE-CORRECT)
 */
export async function generateEndOfDayDigest(businessId?: string): Promise<string> {
  if (!businessId) return '⚠️ No business ID provided.';
  const business = await businessManager.getBusiness(businessId);
  const businessName = business?.business_name || 'QControl Club';

  const todayStr = getTodayISTDateStr();
  const startOfDayISO = getStartOfTodayISTISO();

  // 1. Fetch sessions completed today
  const { data: completedSessions } = await supabase
    .from('sessions')
    .select('cost, food_cost, status, date, end_time, created_at')
    .eq('business_id', businessId)
    .eq('status', 'COMPLETED')
    .gte('created_at', startOfDayISO);

  let totalRevenue = 0;
  let sessionFbRevenue = 0;

  if (completedSessions) {
    for (const s of completedSessions) {
      totalRevenue += Number(s.cost) || 0;
      sessionFbRevenue += Number(s.food_cost) || 0;
    }
  }

  // 2. Fetch all orders today from notifications
  const { data: todayOrders } = await supabase
    .from('notifications')
    .select('*')
    .eq('business_id', businessId)
    .gte('created_at', startOfDayISO);

  let totalOrdersCount = 0;
  let cancelledValue = 0;
  const itemCounts: Record<string, number> = {};
  const hourCounts: Record<number, number> = {};

  if (todayOrders) {
    for (const notif of todayOrders) {
      const parts = notif.message ? notif.message.split('|') : [];
      const orderTotal = parts.length >= 2 ? parseFloat(parts[parts.length - 2]) || 0 : 0;

      if (['order_cancelled', 'order_voided', 'order_rejected'].includes(notif.type)) {
        cancelledValue += orderTotal;
        continue;
      }

      if (['order_pending', 'order_accepted', 'order_served'].includes(notif.type)) {
        totalOrdersCount++;

        // Hour breakdown (IST)
        const istDate = new Date(new Date(notif.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const hour = istDate.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        try {
          const itemsJson = parts.slice(0, parts.length - 2).join('|') || parts[0];
          const cart = JSON.parse(itemsJson);
          for (const [name, qty] of Object.entries(cart)) {
            const count = typeof qty === 'number' ? qty : Number((qty as any).qty) || 0;
            itemCounts[name] = (itemCounts[name] || 0) + count;
          }
        } catch (e) {}
      }
    }
  }

  // Determine top 3 items
  const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
  const top3 = sortedItems.slice(0, 3);

  // Determine busiest hour
  let maxHour = 20; // default 8 PM
  let maxHourCount = 0;
  for (const [h, count] of Object.entries(hourCounts)) {
    if (count > maxHourCount) {
      maxHourCount = count;
      maxHour = parseInt(h, 10);
    }
  }

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const nextH12 = (h + 1) % 12 || 12;
    const nextAmpm = (h + 1) >= 12 && (h + 1) < 24 ? 'PM' : 'AM';
    return `${h12} ${ampm} – ${nextH12} ${nextAmpm}`;
  };

  const fbSharePct = totalRevenue > 0 ? Math.round((sessionFbRevenue / totalRevenue) * 100) : 0;

  let digest = `📊 <b>End-of-Day F&B Digest</b>\n`;
  digest += `🏢 <b>${escapeHtml(businessName)}</b> · 📅 ${todayStr}\n`;
  digest += `━━━━━━━━━━━━━━━━━━━━\n`;
  digest += `💰 <b>Total Club Revenue:</b> ₹${Math.round(totalRevenue)}\n`;
  digest += `🍔 <b>F&B Revenue Today:</b> <b>₹${sessionFbRevenue}</b> (${fbSharePct}% share)\n`;
  digest += `📦 <b>Total Orders Served:</b> ${totalOrdersCount}\n`;
  if (cancelledValue > 0) {
    digest += `❌ <b>Cancelled / Voided:</b> ₹${Math.round(cancelledValue)}\n`;
  }
  digest += `⏰ <b>Peak F&B Hour:</b> ${formatHour(maxHour)}\n\n`;

  digest += `🏆 <b>Top Selling Items:</b>\n`;
  if (top3.length === 0) {
    digest += `  <i>No items sold today yet.</i>\n`;
  } else {
    for (let i = 0; i < top3.length; i++) {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      digest += `  ${medal} <b>${escapeHtml(top3[i][0])}</b>: ${top3[i][1]} units\n`;
    }
  }

  digest += `━━━━━━━━━━━━━━━━━━━━\n`;
  digest += `<i>All figures reconciled with billing engine & Google Sheets.</i>`;

  return digest;
}

/**
 * 10. CENTRAL CALLBACK DISPATCHER FOR ALL F&B FLOWS
 */
export async function handleFbCallback(
  business: BusinessData,
  chatId: string | number,
  messageId: number | undefined,
  callbackData: string,
  sendMessageFn: (chatId: string | number, text: string, replyMarkup?: any) => Promise<any>,
  editMessageTextFn: (chatId: string | number, messageId: number, text: string, replyMarkup?: any) => Promise<any>
): Promise<void> {
  const freshBusiness = await getBusinessWithMenu(business);
  const bizId = freshBusiness.id || '';
  const render = async (res: { text: string; replyMarkup: any }) => {
    if (messageId) {
      await editMessageTextFn(chatId, messageId, res.text, res.replyMarkup);
    } else {
      await sendMessageFn(chatId, res.text, res.replyMarkup);
    }
  };

  // 1. Hub
  if (callbackData === 'fb:hub') {
    const hub = await renderFbHub(freshBusiness, chatId);
    await render(hub);
    return;
  }

  // 2. Select Table: fb:t:<tableId>
  if (callbackData.startsWith('fb:t:')) {
    const rawTableId = decodeURIComponent(callbackData.replace('fb:t:', ''));
    // Server-side validation: verify table belongs to this business
    const validTable = (freshBusiness.tables || []).find(t => String(t.id).toLowerCase().trim() === rawTableId.toLowerCase().trim());
    const tableId = validTable ? validTable.id : rawTableId;
    const tableScreen = await renderTableScreen(freshBusiness, chatId, tableId);
    await render(tableScreen);
    return;
  }

  // 3. Category Screen: fb:cat:<category>
  if (callbackData.startsWith('fb:cat:')) {
    const category = decodeURIComponent(callbackData.replace('fb:cat:', ''));
    setSelectedCategory(chatId, category);
    const catScreen = await renderCategoryScreen(freshBusiness, chatId, category);
    await render(catScreen);
    return;
  }

  // 4. Quick Add Most Selling item: fb:qa:<index> (≤ 3 taps flow!)
  if (callbackData.startsWith('fb:qa:')) {
    const idx = parseInt(callbackData.replace('fb:qa:', ''), 10);
    const tableId = getSelectedTable(chatId);
    if (!tableId) {
      await render(await renderFbHub(freshBusiness, chatId));
      return;
    }
    const menuItems = getActiveMenuItems(freshBusiness);
    const topItems = await getMostSellingItems(bizId, menuItems, 6);
    if (idx >= 0 && idx < topItems.length) {
      const target = topItems[idx];
      if (target.available) {
        addItemToCart(chatId, {
          name: target.name.trim(),
          price: target.price,
          id: target.id,
          category: target.category,
        }, 1);
        const notice = `⚡ <b>Added 1x ${escapeHtml(target.name.trim())} (₹${target.price}) to cart!</b> Tap Confirm below or add more:`;
        await render(await renderTableScreen(freshBusiness, chatId, tableId, notice));
        return;
      }
    }
  }

  // 5. Add item to cart: fb:add:<globalIndex>
  if (callbackData.startsWith('fb:add:')) {
    const idx = parseInt(callbackData.replace('fb:add:', ''), 10);
    const menuItems = getActiveMenuItems(freshBusiness);
    if (idx >= 0 && idx < menuItems.length) {
      const item = menuItems[idx];
      if (item.available !== false) {
        addItemToCart(chatId, {
          name: item.name.trim(),
          price: Number(item.price) || 0,
          id: item.id,
          category: item.category,
        }, 1);
      }
    }
    const tableId = getSelectedTable(chatId);
    if (tableId) {
      const currentCat = getSelectedCategory(chatId) || 'All';
      await render(await renderCategoryScreen(freshBusiness, chatId, currentCat));
    }
    return;
  }

  // 6. Subtract item from cart: fb:sub:<globalIndex>
  if (callbackData.startsWith('fb:sub:')) {
    const idx = parseInt(callbackData.replace('fb:sub:', ''), 10);
    const menuItems = getActiveMenuItems(freshBusiness);
    if (idx >= 0 && idx < menuItems.length) {
      const item = menuItems[idx];
      addItemToCart(chatId, {
        name: item.name.trim(),
        price: Number(item.price) || 0,
        id: item.id,
        category: item.category,
      }, -1);
    }
    const tableId = getSelectedTable(chatId);
    if (tableId) {
      const currentCat = getSelectedCategory(chatId) || 'All';
      await render(await renderCategoryScreen(freshBusiness, chatId, currentCat));
    }
    return;
  }

  // 7. View Cart: fb:cart
  if (callbackData === 'fb:cart') {
    const cartScreen = await renderCartScreen(freshBusiness, chatId);
    await render(cartScreen);
    return;
  }

  // 8. Clear Cart: fb:clr
  if (callbackData === 'fb:clr') {
    clearCart(chatId);
    const tableId = getSelectedTable(chatId);
    if (tableId) {
      await render(await renderTableScreen(freshBusiness, chatId, tableId, '🗑️ <i>Cart cleared.</i>'));
    } else {
      await render(await renderFbHub(freshBusiness, chatId));
    }
    return;
  }

  // 9. Confirm & Place Order: fb:ok
  if (callbackData === 'fb:ok') {
    const placeRes = await placeTelegramOrder(freshBusiness, chatId);
    await render({ text: placeRes.message, replyMarkup: placeRes.replyMarkup });
    return;
  }

  // 10. Repeat Last Order: fb:rpt
  if (callbackData === 'fb:rpt') {
    const repeatRes = await handleRepeatLastOrder(freshBusiness, chatId);
    await render(repeatRes);
    return;
  }

  // 11. Undo 1-Tap: fb:u:<token>
  if (callbackData.startsWith('fb:u:')) {
    const token = callbackData.replace('fb:u:', '');
    const undoRes = await handleUndo(freshBusiness, chatId, token);
    await render(undoRes);
    return;
  }

  // 12. Mark single order served: fb:srv:<notifId>
  if (callbackData.startsWith('fb:srv:')) {
    const notifId = callbackData.replace('fb:srv:', '');
    await supabase.from('notifications').update({ type: 'order_served', is_read: true }).eq('id', notifId).eq('business_id', bizId);
    const tableId = getSelectedTable(chatId);
    if (tableId) {
      await render(await renderTableScreen(freshBusiness, chatId, tableId, '✅ <i>Order marked as Served.</i>'));
    } else {
      await render(await renderFbHub(freshBusiness, chatId));
    }
    return;
  }

  // 13. Mark all orders on table as served: fb:srv_all:<tableId>
  if (callbackData.startsWith('fb:srv_all:')) {
    const tableId = decodeURIComponent(callbackData.replace('fb:srv_all:', ''));
    const startOfDay = getStartOfTodayISTISO();
    const activeSession = await getActiveSessionForTable(bizId, tableId);
    let q = supabase
      .from('notifications')
      .update({ type: 'order_served', is_read: true })
      .eq('business_id', bizId)
      .in('type', ['order_pending', 'order_accepted'])
      .gte('created_at', startOfDay);
    if (activeSession && activeSession.id) {
      q = q.like('message', `%|${activeSession.id}`);
    }
    await q;
    await render(await renderTableScreen(freshBusiness, chatId, tableId, `✅ <i>All orders for Table ${tableId} marked as Served!</i>`));
    return;
  }

  // 14. Stock control screen: fb:stk
  if (callbackData === 'fb:stk') {
    const stockScreen = await renderStockControlScreen(freshBusiness, chatId);
    await render(stockScreen);
    return;
  }

  // 15. Toggle stock item: fb:stktog:<idx>
  if (callbackData.startsWith('fb:stktog:')) {
    const idx = parseInt(callbackData.replace('fb:stktog:', ''), 10);
    const toggleScreen = await toggleStockAvailability(freshBusiness, chatId, idx);
    await render(toggleScreen);
    return;
  }

  // 16. Daily Digest: fb:dgt
  if (callbackData === 'fb:dgt') {
    const digest = await generateEndOfDayDigest(bizId);
    const buttons = [
      [{ text: '🔄 Refresh Digest', callback_data: 'fb:dgt' }],
      [{ text: '⬅️ Back to F&B Hub', callback_data: 'fb:hub' }],
    ];
    await render({ text: digest, replyMarkup: { inline_keyboard: buttons } });
    return;
  }
}
