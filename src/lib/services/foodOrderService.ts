import { supabase } from '@/lib/supabaseClient';
import { businessManager, BusinessData } from '@/lib/businessManager';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { enqueueSheetsSync } from '@/lib/sheetsSyncQueue';
import { invalidateMostSellingCache } from './mostSellingService';

export interface OrderLineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface AuthoritativeOrderResult {
  success: boolean;
  orderId: string;
  orderRef: string;
  orderTotal: number;
  newFoodCost: number;
  lineItems: OrderLineItem[];
  tableId: string;
}

// In-memory short-window idempotency cache for rapid retries / double-taps
const idempotencyCache = new Map<string, { result: AuthoritativeOrderResult; expiresAt: number }>();

function cleanItemName(name: string): string {
  return String(name || '').replace(/🔥/g, '').trim();
}

/**
 * Authoritatively resolves line items and prices against business menu_items.
 * Client-supplied prices are strictly ignored unless explicitly allowed for custom charges by an owner.
 */
export function resolveAuthoritativeLineItems(
  menuItems: any[] = [],
  rawCart: any,
  customPrices: Record<string, number> = {},
  isOwner: boolean = false
): { lineItems: OrderLineItem[]; orderTotal: number; unavailableItems: string[] } {
  const lineItems: OrderLineItem[] = [];
  const unavailableItems: string[] = [];

  const activeMenuItems = (menuItems || []).filter(item => {
    if (!item) return false;
    const raw = item as any;
    if (raw.status === 'deleted' || raw.status === 'archived' || raw.deleted === true || raw.is_deleted === true) {
      return false;
    }
    return true;
  });

  // Normalization helper
  const findMenuItem = (identifier: string) => {
    const cleanId = String(identifier || '').trim().toLowerCase();
    // 1. Match by exact ID
    const byId = activeMenuItems.find(i => i.id && String(i.id).trim().toLowerCase() === cleanId);
    if (byId) return byId;

    // 2. Match by trimmed, normalized, fire-emoji-stripped name
    const byName = activeMenuItems.find(i => {
      const dbNameClean = cleanItemName(i.name).toLowerCase();
      return dbNameClean === cleanItemName(identifier).toLowerCase();
    });
    return byName || null;
  };

  // Support both cart formats: { [key]: quantity | { qty, price } } or Array of { id?, name, quantity }
  const entries: Array<{ key: string; qty: number; requestedPrice?: number }> = [];

  if (Array.isArray(rawCart)) {
    for (const entry of rawCart) {
      if (!entry) continue;
      const key = entry.id || entry.name;
      const qty = Number(entry.quantity ?? entry.qty) || 0;
      if (key && qty > 0) {
        entries.push({ key, qty, requestedPrice: entry.price });
      }
    }
  } else if (rawCart && typeof rawCart === 'object') {
    for (const [key, val] of Object.entries(rawCart)) {
      if (typeof val === 'number') {
        if (val > 0) entries.push({ key, qty: val });
      } else if (val && typeof val === 'object') {
        const qty = Number((val as any).qty ?? (val as any).quantity) || 0;
        if (qty > 0) {
          entries.push({ key, qty, requestedPrice: Number((val as any).price) || undefined });
        }
      }
    }
  }

  for (const entry of entries) {
    const { key, qty } = entry;
    const matched = findMenuItem(key);

    if (matched) {
      if (matched.available === false) {
        unavailableItems.push(cleanItemName(matched.name));
        continue;
      }

      const authoritativePrice = Math.max(0, Number(matched.price) || 0);
      const subtotal = authoritativePrice * qty;

      lineItems.push({
        id: matched.id || `menu_${matched.name}`,
        name: cleanItemName(matched.name),
        price: authoritativePrice,
        quantity: qty,
        subtotal
      });
    } else if (isOwner && customPrices && typeof customPrices[key] === 'number' && customPrices[key] > 0) {
      // Authenticated owners can add custom charges
      const customPrice = Math.max(0, Number(customPrices[key]));
      const subtotal = customPrice * qty;
      lineItems.push({
        id: `custom_${key}`,
        name: cleanItemName(key),
        price: customPrice,
        quantity: qty,
        subtotal
      });
    } else {
      // Item not found in authoritative business menu
      unavailableItems.push(key);
    }
  }

  const orderTotal = lineItems.reduce((acc, item) => acc + item.subtotal, 0);
  return { lineItems, orderTotal, unavailableItems };
}

/**
 * Creates an authoritative order for a session.
 * Used identically by QR customer ordering, Telegram bot handlers, and Dashboard ordering.
 */
export async function createAuthoritativeOrder(params: {
  businessId: string;
  sessionId?: string;
  tableId?: string;
  cart: any;
  customPrices?: Record<string, number>;
  source?: 'QR' | 'Telegram' | 'Dashboard';
  idempotencyKey?: string;
  isOwner?: boolean;
}): Promise<AuthoritativeOrderResult> {
  const { businessId, sessionId, tableId, cart, customPrices = {}, source = 'QR', idempotencyKey, isOwner = false } = params;

  if (!businessId || (!sessionId && !tableId) || !cart) {
    throw new Error('businessId, tableId or sessionId, and cart are required to place an order.');
  }

  // 1. Idempotency Check
  const now = Date.now();
  if (idempotencyKey) {
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }
  }

  // 2. Fetch authoritative business & active session if sessionId given
  const business = await businessManager.getBusiness(businessId);
  if (!business) {
    throw new Error('Business not found');
  }

  let session: any = null;
  let effectiveTableId = tableId || '';

  if (sessionId) {
    session = await sessionRepository.findById(sessionId, businessId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'ACTIVE') {
      throw new Error('Cannot order food: Session is closed or not active.');
    }
    effectiveTableId = session.table_id || effectiveTableId;
  }

  // 3. Resolve line items & prices authoritatively from business menu
  const { lineItems, orderTotal, unavailableItems } = resolveAuthoritativeLineItems(
    business.menu_items || [],
    cart,
    customPrices,
    isOwner
  );

  if (unavailableItems.length > 0 && lineItems.length === 0) {
    throw new Error(`The requested items are sold out or no longer on the menu: ${unavailableItems.join(', ')}`);
  }

  if (lineItems.length === 0 || orderTotal <= 0) {
    throw new Error('Order cart is empty or contains no valid available items.');
  }

  // 4. Update session food_cost atomically in database (if session is active)
  let newFoodCost: number = session ? ((session.food_cost || 0) + orderTotal) : orderTotal;
  if (sessionId && session) {
    try {
      const { data: rpcNewCost, error: rpcErr } = await supabase.rpc('increment_food_cost', {
        p_session_id: sessionId,
        p_amount: orderTotal
      });
      if (!rpcErr && typeof rpcNewCost === 'number') {
        newFoodCost = rpcNewCost;
      } else {
        // Fallback direct atomic update
        const { data: updatedSess, error: updateErr } = await supabase
          .from('sessions')
          .update({ food_cost: (session.food_cost || 0) + orderTotal })
          .eq('id', sessionId)
          .eq('business_id', businessId)
          .select('food_cost')
          .single();
        if (!updateErr && updatedSess) {
          newFoodCost = updatedSess.food_cost;
        }
      }
    } catch (err) {
      console.error('[createAuthoritativeOrder] Atomic food_cost increment error:', err);
    }
  }

  // 5. Store authoritative order record in notifications table
  const orderRef = Math.random().toString(36).substring(2, 8).toUpperCase();
  // Standard backward-compatible pipe format: itemsJson|orderTotal|sessionPlaceholder
  const sessionPlaceholder = sessionId || `standalone_${effectiveTableId}`;
  const itemsJson = JSON.stringify(lineItems);

  let orderId = '';
  try {
    const { data: notif, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        business_id: businessId,
        title: `Order: ${effectiveTableId} (${orderRef})`,
        message: `${itemsJson}|${orderTotal}|${sessionPlaceholder}`,
        type: 'order_pending'
      })
      .select('id')
      .single();

    if (!notifErr && notif) {
      orderId = notif.id;
    }
  } catch (notifEx) {
    console.error('[createAuthoritativeOrder] Notification creation error:', notifEx);
  }

  // 6. Enqueue Google Sheets synchronization non-blocking
  if (sessionId) {
    try {
      enqueueSheetsSync('SESSION', sessionId, businessId);
    } catch (sheetErr) {
      console.warn('[createAuthoritativeOrder] Sheets sync enqueue warning:', sheetErr);
    }
  }

  // 7. Dispatch Telegram notification to authorized owners/staff (NO 🔥 EMOJI)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    Promise.resolve().then(async () => {
      try {
        const gs = business.pricing_rules?.globalSettings as any;
        if (gs && Array.isArray(gs.authorized_telegram_owners)) {
          const itemsSummary = lineItems.map(i => `• ${i.quantity}x ${i.name} (₹${i.price}) = ₹${i.subtotal}`).join('\n');
          const msg = `🔔 <b>New Order Placed (${source})</b>\n\n<b>Table:</b> ${session?.table_id || effectiveTableId}\n<b>Customer:</b> ${session?.customer_name || 'Walk-in'}\n<b>Order ID:</b> #${orderRef}\n\n<b>Items:</b>\n${itemsSummary}\n\n<b>Total:</b> ₹${orderTotal}`;

          const buttons = [
            [
              { text: '✅ Accept Order', callback_data: `order_accept_${orderId}` },
              { text: '🍽️ Mark Served', callback_data: `order_serve_${orderId}` }
            ],
            [
              { text: '❌ Cancel Order', callback_data: `order_cancel_${orderId}` }
            ]
          ];

          for (const owner of gs.authorized_telegram_owners) {
            if (owner.status !== 'revoked' && owner.chatId) {
              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: owner.chatId,
                  text: msg,
                  parse_mode: 'HTML',
                  reply_markup: { inline_keyboard: buttons }
                })
              }).catch(() => {});
            }
          }
        }
      } catch (tgEx) {
        console.error('[createAuthoritativeOrder] Telegram alert error:', tgEx);
      }
    }).catch(() => {});
  }

  // 8. Invalidate Most Selling items cache
  try {
    invalidateMostSellingCache(businessId);
  } catch {}

  const result: AuthoritativeOrderResult = {
    success: true,
    orderId,
    orderRef,
    orderTotal,
    newFoodCost,
    lineItems,
    tableId: session.table_id
  };

  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, { result, expiresAt: now + 60000 });
  }

  return result;
}

export interface ParsedNotificationOrder {
  rawCart: any;
  items: Array<{ name: string; qty: number; price?: number; subtotal?: number }>;
  orderTotal: number;
  sessionId: string | null;
  tableId?: string;
}

/**
 * Robust parser for order notification message strings: itemsJson|orderTotal|sessionPlaceholder
 * Safely handles pipes in item names, array carts, object carts, and standalone tables.
 */
export function parseOrderNotification(message: string): ParsedNotificationOrder | null {
  if (!message || typeof message !== 'string') return null;
  const parts = message.split('|');
  if (parts.length < 2) return null;

  try {
    const sessionPlaceholder = parts.length >= 3 ? parts[parts.length - 1] : null;
    const orderTotal = parts.length >= 2 ? (parseFloat(parts[parts.length - 2]) || 0) : 0;
    const itemsJson = parts.slice(0, parts.length - 2).join('|') || parts[0];
    const rawCart = JSON.parse(itemsJson);

    const items: Array<{ name: string; qty: number; price?: number; subtotal?: number }> = [];
    if (Array.isArray(rawCart)) {
      for (const item of rawCart) {
        if (!item) continue;
        const qty = Number(item.quantity ?? item.qty) || 1;
        const price = typeof item.price === 'number' && !isNaN(item.price) ? item.price : Number(item.price) || 0;
        const subtotal = typeof item.subtotal === 'number' && !isNaN(item.subtotal) ? item.subtotal : (price * qty);
        items.push({
          name: item.name || 'Item',
          qty,
          price,
          subtotal
        });
      }
    } else if (rawCart && typeof rawCart === 'object') {
      for (const [name, qtyOrObj] of Object.entries(rawCart)) {
        if (typeof qtyOrObj === 'number') {
          items.push({ name, qty: qtyOrObj });
        } else if (qtyOrObj && typeof qtyOrObj === 'object') {
          const qty = Number((qtyOrObj as any).qty ?? (qtyOrObj as any).quantity) || 1;
          const price = typeof (qtyOrObj as any).price === 'number' ? (qtyOrObj as any).price : (Number((qtyOrObj as any).price) || undefined);
          items.push({
            name,
            qty,
            price,
            subtotal: typeof price === 'number' ? price * qty : undefined
          });
        }
      }
    }

    const sessionId = sessionPlaceholder && !sessionPlaceholder.startsWith('standalone_') ? sessionPlaceholder : null;
    const tableId = sessionPlaceholder && sessionPlaceholder.startsWith('standalone_') ? sessionPlaceholder.replace('standalone_', '') : undefined;

    return {
      rawCart,
      items,
      orderTotal,
      sessionId,
      tableId
    };
  } catch {
    return null;
  }
}
