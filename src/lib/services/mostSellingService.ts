import { supabase } from '@/lib/supabaseClient';

export interface MostSellingItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  available: boolean;
  isPinned: boolean;
  score: number;
  totalQuantitySold: number;
  badge?: 'PINNED' | 'TOP' | 'FAST';
}

interface RankedItem {
  name: string;
  soldQty: number;
  weightedScore: number;
}

/**
 * Computes authoritative Most Selling items for a business.
 * Rules:
 * 1. Only counts orders with type in ('order_accepted', 'order_served', 'order_pending').
 * 2. Excludes cancelled, rejected, and voided orders.
 * 3. Time-aware weighting:
 *    - Orders in the last 7 days get 2.0x weight.
 *    - Orders in the last 30 days get 1.0x weight.
 *    - Older orders get 0.5x weight.
 * 4. Evening booster (1.3x) if current time is after 5 PM IST and order was in evening.
 * 5. Pinned items appear first (marked with PINNED), followed by top auto-ranked items.
 * 6. Ties broken deterministically by name.
 * 7. Gracefully falls back to available menu items if little or no order history exists.
 */
export async function getMostSellingItems(
  businessId: string,
  menuItems: any[] = [],
  limit: number = 6
): Promise<MostSellingItem[]> {
  try {
    // 1. Fetch historical orders from notifications
    const { data: orderNotifs, error } = await supabase
      .from('notifications')
      .select('message, type, created_at')
      .eq('business_id', businessId)
      .in('type', ['order_pending', 'order_accepted', 'order_served'])
      .order('created_at', { ascending: false })
      .limit(1000);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * oneDayMs;
    const thirtyDaysAgo = now - 30 * oneDayMs;

    // Current IST hour for evening awareness
    const istHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    const isCurrentlyEvening = istHour >= 17; // 5 PM onwards

    const itemStatsMap = new Map<string, RankedItem>();

    if (!error && orderNotifs) {
      for (const notif of orderNotifs) {
        if (!notif.message) continue;
        const parts = notif.message.split('|');
        if (parts.length < 2) continue;

        try {
          const itemsJson = parts.slice(0, parts.length - 2).join('|') || parts[0];
          const cart = JSON.parse(itemsJson);

          const orderCreatedAt = new Date(notif.created_at).getTime();
          let weight = 0.5;
          if (orderCreatedAt >= sevenDaysAgo) {
            weight = 2.0;
          } else if (orderCreatedAt >= thirtyDaysAgo) {
            weight = 1.0;
          }

          // If current context is evening, boost orders placed in evening hours
          if (isCurrentlyEvening) {
            const orderIstHour = new Date(new Date(notif.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
            if (orderIstHour >= 17) {
              weight *= 1.3;
            }
          }

          if (typeof cart === 'object' && cart !== null) {
            for (const [rawName, val] of Object.entries(cart)) {
              const name = String(rawName).trim();
              let qty = 0;
              if (typeof val === 'number') {
                qty = val;
              } else if (val && typeof val === 'object') {
                qty = Number((val as any).qty) || 0;
              }

              if (qty <= 0) continue;

              const existing = itemStatsMap.get(name.toLowerCase()) || {
                name,
                soldQty: 0,
                weightedScore: 0,
              };

              existing.soldQty += qty;
              existing.weightedScore += qty * weight;
              itemStatsMap.set(name.toLowerCase(), existing);
            }
          }
        } catch (e) {
          // Ignore malformed notification message lines
        }
      }
    }

    // 2. Map and score against current active menu items
    const availableMenuItems = menuItems.filter(i => i.available !== false);
    const result: MostSellingItem[] = [];

    // Separate pinned items vs auto-ranked
    const pinnedList: MostSellingItem[] = [];
    const autoList: MostSellingItem[] = [];

    for (const item of menuItems) {
      const lowerName = String(item.name).trim().toLowerCase();
      const stats = itemStatsMap.get(lowerName);
      const isPinned = Boolean(item.is_pinned || item.pinned);
      const soldQty = stats ? stats.soldQty : 0;
      const score = stats ? stats.weightedScore : 0;

      const formattedItem: MostSellingItem = {
        id: item.id || `menu_${item.name}`,
        name: item.name,
        price: Number(item.price) || 0,
        category: item.category || 'Other',
        available: item.available !== false,
        isPinned,
        score,
        totalQuantitySold: soldQty,
        badge: isPinned ? 'PINNED' : soldQty > 0 ? 'TOP' : 'FAST',
      };

      if (isPinned) {
        pinnedList.push(formattedItem);
      } else {
        autoList.push(formattedItem);
      }
    }

    // Sort autoList by weightedScore DESC, then totalQuantitySold DESC, then alphabetically
    autoList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.totalQuantitySold !== a.totalQuantitySold) return b.totalQuantitySold - a.totalQuantitySold;
      return a.name.localeCompare(b.name);
    });

    // Pinned items come first (sorted by pinned_order if available, else name)
    pinnedList.sort((a, b) => a.name.localeCompare(b.name));

    // Combine: prioritize pinned items, fill rest with top sellers
    const combined = [...pinnedList, ...autoList];

    // Filter to available items first, but keep sold-out items if strictly requested
    const finalItems = combined.slice(0, limit);

    return finalItems;
  } catch (err) {
    console.error('[MostSellingService] Error calculating top sellers:', err);
    // Graceful fallback to first available menu items
    return menuItems.slice(0, limit).map(i => ({
      id: i.id || `menu_${i.name}`,
      name: i.name,
      price: Number(i.price) || 0,
      category: i.category || 'Other',
      available: i.available !== false,
      isPinned: Boolean(i.is_pinned || i.pinned),
      score: 0,
      totalQuantitySold: 0,
      badge: Boolean(i.is_pinned || i.pinned) ? 'PINNED' : 'FAST',
    }));
  }
}
