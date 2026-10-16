/**
 * In-Memory High-Speed State Manager for Telegram Bot Users
 * Provides 0ms latency cart state, table selection, and 1-tap undo actions.
 */

export interface CartItem {
  id?: string;
  name: string;
  price: number;
  qty: number;
  category?: string;
}

export interface UndoAction {
  token: string;
  type: 'order_placed' | 'order_cancelled' | 'status_changed' | 'stock_toggled';
  orderId?: string;
  sessionId?: string;
  businessId: string;
  tableId?: string;
  amount?: number;
  description: string;
  expiresAt: number;
  previousData?: any;
}

export interface UserTelegramState {
  chatId: string;
  businessId?: string;
  selectedTableId?: string;
  selectedCategory?: string;
  cart: Map<string, CartItem>;
  lastUndoAction?: UndoAction;
  lastActiveAt: number;
}

import fs from 'fs';
import path from 'path';

const userStates = new Map<string, UserTelegramState>();

// Session cleanup every 15 minutes
const CART_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const UNDO_TTL_MS = 90 * 1000; // 90 seconds for undo action

// Snapshot persistence path (uses /tmp in serverless / container, or local directory)
const SNAPSHOT_FILE = process.env.NODE_ENV === 'production' && !fs.existsSync('.env.local')
  ? path.join('/tmp', '.qcontrol_tg_state.json')
  : path.join(process.cwd(), '.telegram_state.json');

// Rehydrate state on startup
try {
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const now = Date.now();
    for (const [key, state] of Object.entries<any>(parsed)) {
      if (now - (state.lastActiveAt || 0) < CART_TTL_MS) {
        userStates.set(key, {
          chatId: state.chatId,
          businessId: state.businessId,
          selectedTableId: state.selectedTableId,
          selectedCategory: state.selectedCategory,
          cart: new Map(Array.isArray(state.cart) ? state.cart : []),
          lastUndoAction: state.lastUndoAction && state.lastUndoAction.expiresAt > now ? state.lastUndoAction : undefined,
          lastActiveAt: state.lastActiveAt || now,
        });
      }
    }
  }
} catch (e) {
  // Silent fallback to clean in-memory state
}

let saveTimeout: NodeJS.Timeout | null = null;
function writeSnapshotToDisk() {
  try {
    const serializable: Record<string, any> = {};
    for (const [key, state] of userStates.entries()) {
      if (state.cart.size > 0 || state.selectedTableId || state.selectedCategory) {
        serializable[key] = {
          chatId: state.chatId,
          businessId: state.businessId,
          selectedTableId: state.selectedTableId,
          selectedCategory: state.selectedCategory,
          cart: Array.from(state.cart.entries()),
          lastUndoAction: state.lastUndoAction,
          lastActiveAt: state.lastActiveAt,
        };
      }
    }
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(serializable), 'utf8');
  } catch {}
}

export function persistStateSnapshot(immediate: boolean = false): void {
  if (immediate) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    writeSnapshotToDisk();
    return;
  }
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    writeSnapshotToDisk();
  }, 1000);
}

function cleanExpiredStates() {
  const now = Date.now();
  let modified = false;
  for (const [chatId, state] of userStates.entries()) {
    if (now - state.lastActiveAt > CART_TTL_MS) {
      userStates.delete(chatId);
      modified = true;
    }
  }
  if (modified) persistStateSnapshot();
}

setInterval(cleanExpiredStates, 15 * 60 * 1000).unref();

export function getOrCreateUserState(chatId: string | number, businessId?: string): UserTelegramState {
  const key = String(chatId).trim();
  let state = userStates.get(key);
  if (!state) {
    state = {
      chatId: key,
      businessId,
      cart: new Map(),
      lastActiveAt: Date.now(),
    };
    userStates.set(key, state);
  } else {
    state.lastActiveAt = Date.now();
    if (businessId && state.businessId !== businessId) {
      // Switched business: reset cart, table context, and category
      state.businessId = businessId;
      state.cart.clear();
      state.selectedTableId = undefined;
      state.selectedCategory = undefined;
      state.lastUndoAction = undefined;
    }
  }
  return state;
}

export function setSelectedTable(chatId: string | number, tableId: string, businessId?: string) {
  const state = getOrCreateUserState(chatId, businessId);
  state.selectedTableId = tableId;
  state.lastActiveAt = Date.now();
  persistStateSnapshot();
}

export function getSelectedTable(chatId: string | number): string | undefined {
  const state = userStates.get(String(chatId).trim());
  return state?.selectedTableId;
}

export function setSelectedCategory(chatId: string | number, category?: string) {
  const state = getOrCreateUserState(chatId);
  state.selectedCategory = category;
  state.lastActiveAt = Date.now();
  persistStateSnapshot();
}

export function getSelectedCategory(chatId: string | number): string | undefined {
  const state = userStates.get(String(chatId).trim());
  return state?.selectedCategory;
}

export function addItemToCart(
  chatId: string | number,
  item: { name: string; price: number; id?: string; category?: string },
  qtyDelta: number = 1
): CartItem {
  const state = getOrCreateUserState(chatId);
  const key = item.name.trim();
  const existing = state.cart.get(key);

  const newQty = (existing?.qty || 0) + qtyDelta;
  if (newQty <= 0) {
    state.cart.delete(key);
    persistStateSnapshot();
    return { name: item.name, price: item.price, qty: 0 };
  }

  const updated: CartItem = {
    id: item.id || existing?.id,
    name: item.name,
    price: item.price,
    qty: newQty,
    category: item.category || existing?.category,
  };
  state.cart.set(key, updated);
  state.lastActiveAt = Date.now();
  persistStateSnapshot();
  return updated;
}

export function removeItemFromCart(chatId: string | number, itemName: string): boolean {
  const state = userStates.get(String(chatId).trim());
  if (!state) return false;
  const deleted = state.cart.delete(itemName.trim());
  if (deleted) persistStateSnapshot();
  return deleted;
}

export function clearCart(chatId: string | number) {
  const state = userStates.get(String(chatId).trim());
  if (state) {
    state.cart.clear();
    persistStateSnapshot();
  }
}

export function getCartItems(chatId: string | number): CartItem[] {
  const state = userStates.get(String(chatId).trim());
  if (!state) return [];
  return Array.from(state.cart.values());
}

export function getCartTotal(chatId: string | number): { totalAmount: number; itemCount: number } {
  const items = getCartItems(chatId);
  let totalAmount = 0;
  let itemCount = 0;
  for (const item of items) {
    totalAmount += item.price * item.qty;
    itemCount += item.qty;
  }
  return { totalAmount, itemCount };
}

export function setUndoAction(
  chatId: string | number,
  action: Omit<UndoAction, 'token' | 'expiresAt'>
): string {
  const token = Math.random().toString(36).substring(2, 8).toUpperCase();
  const state = getOrCreateUserState(chatId, action.businessId);
  state.lastUndoAction = {
    ...action,
    token,
    expiresAt: Date.now() + UNDO_TTL_MS,
  };
  persistStateSnapshot();
  return token;
}

export function getValidUndoAction(chatId: string | number, token?: string): UndoAction | null {
  const state = userStates.get(String(chatId).trim());
  if (!state || !state.lastUndoAction) return null;

  const action = state.lastUndoAction;
  if (Date.now() > action.expiresAt) {
    state.lastUndoAction = undefined;
    persistStateSnapshot();
    return null;
  }

  if (token && action.token !== token) {
    return null;
  }

  return action;
}

export function consumeUndoAction(chatId: string | number, token?: string): UndoAction | null {
  const action = getValidUndoAction(chatId, token);
  if (action) {
    const state = userStates.get(String(chatId).trim());
    if (state) {
      state.lastUndoAction = undefined;
      persistStateSnapshot();
    }
  }
  return action;
}
