/**
 * End-to-End Simulation Test for Telegram F&B Callbacks
 * Tests handleFbCallback dispatcher with realistic payloads, message editing, and in-place state.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { handleFbCallback } from '../src/lib/telegram/fbOrderingService';
import { getOrCreateUserState, getCartTotal, getSelectedTable } from '../src/lib/telegram/stateManager';
import { BusinessData } from '../src/lib/businessManager';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    testsFailed++;
  }
}

async function runE2ESimulation() {
  console.log('\n📱 STARTING TELEGRAM F&B E2E CALLBACK SIMULATION\n');

  const testBizId = `sim_biz_${Date.now()}`;
  const testChatId = `sim_chat_${Date.now()}`;

  const mockBusiness: BusinessData = {
    id: testBizId,
    business_name: 'Downtown Snooker Club',
    owner_name: 'Simulated Owner',
    contact_number: '9876500000',
    google_sheet_id: '',
    menu_items: [
      { id: 'm1', name: 'Ginger Tea', price: 20, category: 'Beverages', available: true, is_pinned: true },
      { id: 'm2', name: 'Cold Drink', price: 40, category: 'Beverages', available: true, is_pinned: false },
      { id: 'm3', name: 'Veg Sandwich', price: 80, category: 'Snacks', available: true, is_pinned: false },
    ],
    tables: [
      { id: 'T1', name: 'Table 1', type: 'Pool' },
      { id: 'T2', name: 'Table 2', type: 'Snooker' },
    ],
    pricing_rules: {
      globalSettings: {
        authorized_telegram_owners: [
          { chatId: testChatId, name: 'Sim Owner', role: 'PRIMARY_OWNER', status: 'active', is_active_context: true }
        ] as any,
      } as any,
    } as any,
    created_at: new Date().toISOString(),
  };

  let lastSentText = '';
  let lastReplyMarkup: any = null;
  let lastEditedMessageId: number | null = null;

  const mockSendMessage = async (chatId: string | number, text: string, replyMarkup?: any) => {
    lastSentText = text;
    lastReplyMarkup = replyMarkup;
    return { ok: true, message_id: 1001 };
  };

  const mockEditMessageText = async (chatId: string | number, messageId: number, text: string, replyMarkup?: any) => {
    lastEditedMessageId = messageId;
    lastSentText = text;
    lastReplyMarkup = replyMarkup;
    return { ok: true };
  };

  // Step 1: Open F&B Hub via callback fb:hub
  console.log('[Step 1] Open F&B Hub:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:hub', mockSendMessage, mockEditMessageText);
  assert(lastSentText.includes('F&B Ordering Hub'), 'Renders F&B Ordering Hub');
  assert(lastSentText.includes('Downtown Snooker Club'), 'Shows business name in header');
  assert(lastReplyMarkup.inline_keyboard.length > 0, 'Displays table selection keyboard');

  // Step 2: Select Table 1 via callback fb:t:T1
  console.log('[Step 2] Select Table 1:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:t:T1', mockSendMessage, mockEditMessageText);
  assert(lastSentText.includes('Table T1'), 'Renders Table T1 screen');
  assert(getSelectedTable(testChatId) === 'T1', 'State remembers T1 as selected table');
  assert(lastSentText.includes('Game Charges') && lastSentText.includes('F&B Orders'), 'Table Tab at a glance is displayed');
  assert(lastSentText.includes('Top Items'), 'Displays Most Selling / Quick Add items');

  // Step 3: Quick Add Most Selling item (Index 0 -> Ginger Tea) via fb:qa:0
  console.log('[Step 3] Quick-Add Top Item:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:qa:0', mockSendMessage, mockEditMessageText);
  const cartInfo = getCartTotal(testChatId);
  assert(cartInfo.itemCount === 1 && cartInfo.totalAmount === 20, '1x Ginger Tea (₹20) added to cart in 1 tap');
  assert(lastSentText.includes('Added 1x Ginger Tea') || lastSentText.includes('Current Cart'), 'Instant feedback displayed');

  // Step 4: Open Category Screen via fb:cat:Beverages
  console.log('[Step 4] Open Category Screen:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:cat:Beverages', mockSendMessage, mockEditMessageText);
  assert(lastSentText.includes('Menu: Beverages'), 'Renders Beverages category screen');

  // Step 5: Add Cold Drink (index 1) via fb:add:1
  console.log('[Step 5] Add Cold Drink:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:add:1', mockSendMessage, mockEditMessageText);
  const updatedCart = getCartTotal(testChatId);
  assert(updatedCart.itemCount === 2 && updatedCart.totalAmount === 60, 'Cart now has 2 items totalling ₹60');

  // Step 6: View Cart via fb:cart
  console.log('[Step 6] View Cart:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:cart', mockSendMessage, mockEditMessageText);
  assert(lastSentText.includes('Review Order for Table T1'), 'Renders Cart Confirmation Screen');
  assert(lastSentText.includes('<b>Order Total:</b> <b>₹60</b>'), 'Order total displayed accurately');

  // Step 7: Clear Cart via fb:clr
  console.log('[Step 7] Clear Cart:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:clr', mockSendMessage, mockEditMessageText);
  assert(getCartTotal(testChatId).itemCount === 0, 'Cart cleared cleanly');

  // Step 8: Open Stock Control via fb:stk
  console.log('[Step 8] Stock Control:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:stk', mockSendMessage, mockEditMessageText);
  assert(lastSentText.includes('Low-Friction Stock Control'), 'Renders Stock Control screen');

  // Step 9: Open Daily Digest via fb:dgt
  console.log('[Step 9] End-of-Day Digest:');
  await handleFbCallback(mockBusiness, testChatId, 1001, 'fb:dgt', mockSendMessage, mockEditMessageText);
  assert(lastSentText.includes('End-of-Day F&B Digest'), 'Renders End-of-Day Digest');

  console.log('\n==========================================');
  console.log(`🏁 E2E SIMULATION FINISHED: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('==========================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runE2ESimulation().catch(err => {
  console.error('Fatal E2E simulation error:', err);
  process.exit(1);
});
