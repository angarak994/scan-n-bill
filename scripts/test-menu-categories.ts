import { supabase } from '../src/lib/supabaseClient';
import {
  renderCategoryScreen,
  renderTableScreen,
  getActiveMenuItems,
  getUniqueMenuCategories,
  getBusinessWithMenu,
  placeTelegramOrder,
} from '../src/lib/telegram/fbOrderingService';
import {
  addItemToCart,
  clearCart,
  setSelectedTable,
  getSelectedCategory,
} from '../src/lib/telegram/stateManager';
import { BusinessData } from '../src/lib/businessManager';

function hasButtonWithText(buttons: any[][], text: string): boolean {
  return buttons.some(row => row.some(b => b.text && b.text.includes(text)));
}

async function runTests() {
  console.log('🧪 Starting Telegram F&B Category & Menu Diagnostics & Verification...\n');

  // 1. Fetch real businesses directly from Supabase
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, business_name, menu_items, tables, pricing_rules');

  if (error || !businesses) {
    console.error('❌ Failed to fetch businesses:', error);
    process.exit(1);
  }

  console.log(`✅ Fetched ${businesses.length} businesses from Supabase.`);

  // Test 1: Verify TestClub menu rendering
  const testClub: any = businesses.find(b => b.business_name.trim() === 'TestClub');
  if (testClub) {
    console.log(`\n--- [TEST 1: TestClub (${testClub.id})] ---`);
    console.log(`Raw menu items count: ${testClub.menu_items?.length || 0}`);
    const activeItems = getActiveMenuItems(testClub);
    console.log(`Active items:`, activeItems.map((i: any) => `${i.name} (${i.category})`));

    const testChatId = 'test_chat_testclub_1';
    setSelectedTable(testChatId, 'P1', testClub.id);

    // Render Table Screen
    const tableScreen = await renderTableScreen(testClub, testChatId, 'P1');
    console.log('Table screen buttons:\n', JSON.stringify(tableScreen.replyMarkup.inline_keyboard, null, 2));

    // Verify dynamic categories contains Beverages
    const cats = getUniqueMenuCategories(activeItems);
    console.log('Unique categories:', cats);
    if (!cats.includes('Beverages')) {
      throw new Error('TestClub should have Beverages category');
    }

    // Render Category Screen for Beverages
    const catScreen = await renderCategoryScreen(testClub, testChatId, 'Beverages');
    console.log('Category screen text:\n', catScreen.text);
    console.log('Category screen buttons:\n', JSON.stringify(catScreen.replyMarkup.inline_keyboard, null, 2));

    if (catScreen.text.includes('No items found in this category')) {
      throw new Error('FAILED: TestClub Beverages showed "No items found in this category"!');
    }
    const hasCoffeeBtn = hasButtonWithText(catScreen.replyMarkup.inline_keyboard, 'Coffee');
    if (!hasCoffeeBtn) {
      throw new Error('FAILED: TestClub Beverages should include Coffee button!');
    }
    console.log('✅ Test 1 Passed: TestClub Beverages correctly displays Coffee!');
  }

  // Test 2: Verify TestClub101 menu rendering
  const testClub101: any = businesses.find(b => b.business_name.trim() === 'TestClub101');
  if (testClub101) {
    console.log(`\n--- [TEST 2: TestClub101 (${testClub101.id})] ---`);
    const activeItems = getActiveMenuItems(testClub101);
    console.log(`Active items:`, activeItems.map((i: any) => `${i.name} (${i.category})`));

    const testChatId = 'test_chat_testclub101_1';
    setSelectedTable(testChatId, 'T1', testClub101.id);

    // Render Table Screen
    const tableScreen = await renderTableScreen(testClub101, testChatId, 'T1');
    console.log('Table screen category buttons:', tableScreen.replyMarkup.inline_keyboard.filter((row: any) => row.some((b: any) => b.callback_data.startsWith('fb:cat:'))));

    // Render Category Screen for Snacks
    const catScreen = await renderCategoryScreen(testClub101, testChatId, 'Snacks');
    console.log('Category screen text:\n', catScreen.text);
    if (catScreen.text.includes('No items found in this category')) {
      throw new Error('FAILED: TestClub101 Snacks showed "No items found in this category"!');
    }
    const hasPizzaBtn = hasButtonWithText(catScreen.replyMarkup.inline_keyboard, 'Pizza');
    const hasFriesBtn = hasButtonWithText(catScreen.replyMarkup.inline_keyboard, 'French Fries');
    if (!hasPizzaBtn || !hasFriesBtn) {
      throw new Error('FAILED: TestClub101 Snacks should include Pizza and French Fries buttons!');
    }
    console.log('✅ Test 2 Passed: TestClub101 Snacks correctly displays items!');
  }

  // Test 3: Aliasing test (e.g. Level UP has category 'drink' / 'drinks', user opens 'Beverages')
  const levelUp: any = businesses.find(b => b.business_name.trim() === 'Level UP');
  if (levelUp) {
    console.log(`\n--- [TEST 3: Level UP Aliasing (${levelUp.id})] ---`);
    const activeItems = getActiveMenuItems(levelUp);
    console.log(`Unique categories in Level UP:`, getUniqueMenuCategories(activeItems));

    const testChatId = 'test_chat_levelup_1';
    setSelectedTable(testChatId, 'Table 1', levelUp.id);

    // Opening Beverages should alias-match 'drink' and 'drinks'
    const catScreen = await renderCategoryScreen(levelUp, testChatId, 'Beverages');
    console.log('Category screen text:\n', catScreen.text);
    if (catScreen.text.includes('No items found in this category')) {
      throw new Error('FAILED: Level UP Beverages aliasing failed to find drink/drinks items!');
    }
    const hasWaterBtn = hasButtonWithText(catScreen.replyMarkup.inline_keyboard, 'water');
    if (!hasWaterBtn) {
      throw new Error('FAILED: Level UP Beverages should include water button via aliasing!');
    }
    console.log('✅ Test 3 Passed: Level UP Beverages alias matching succeeded!');
  }

  // Test 4: Business Isolation
  console.log(`\n--- [TEST 4: Business Isolation] ---`);
  if (testClub && testClub101) {
    const itemsClub = getActiveMenuItems(testClub as any).map((i: any) => i.name.trim());
    const items101 = getActiveMenuItems(testClub101 as any).map((i: any) => i.name.trim());
    
    // Coffee in TestClub must not be in TestClub101
    if (items101.includes('Coffee')) {
      throw new Error('FAILED: Business isolation breach! TestClub101 has Coffee!');
    }
    // Pizza in TestClub101 must not be in TestClub
    if (itemsClub.includes('Pizza')) {
      throw new Error('FAILED: Business isolation breach! TestClub has Pizza!');
    }
    console.log('✅ Test 4 Passed: Strict business isolation verified!');
  }

  // Test 5: Pinned and Unpinned items
  console.log(`\n--- [TEST 5: Pinned & Unpinned Items] ---`);
  const mockBizWithPinned: BusinessData = {
    id: 'mock_biz_pinned_test',
    business_name: 'Mock Club',
    owner_name: 'Tester',
    contact_number: '1234567890',
    google_sheet_id: '',
    created_at: new Date().toISOString(),
    menu_items: [
      { id: '1', name: 'Special Burger', price: 150, category: 'Food', available: true, is_pinned: true },
      { id: '2', name: 'Regular Fries', price: 80, category: 'Food', available: true, is_pinned: false },
      { id: '3', name: 'Classic Cola', price: 40, category: 'Beverages', available: true, is_pinned: false },
    ],
  };

  const mockChatId = 'test_chat_mock_pinned';
  setSelectedTable(mockChatId, 'T1', mockBizWithPinned.id);

  const mockCatScreen = await renderCategoryScreen(mockBizWithPinned, mockChatId, 'Food');
  const hasSpecialBurger = hasButtonWithText(mockCatScreen.replyMarkup.inline_keyboard, 'Special Burger');
  const hasRegularFries = hasButtonWithText(mockCatScreen.replyMarkup.inline_keyboard, 'Regular Fries');
  if (!hasSpecialBurger || !hasRegularFries) {
    throw new Error('FAILED: Regular menu must include both pinned and unpinned items!');
  }
  console.log('✅ Test 5 Passed: Both pinned and unpinned items appear in category menu!');

  // Test 6: Sold Out / Unavailable item handling
  console.log(`\n--- [TEST 6: Sold Out / Unavailable items] ---`);
  const mockBizWithSoldOut: BusinessData = {
    ...mockBizWithPinned,
    menu_items: [
      { id: '1', name: 'Available Shake', price: 100, category: 'Beverages', available: true },
      { id: '2', name: 'Sold Out Juice', price: 60, category: 'Beverages', available: false },
    ],
  };

  const soldOutCatScreen = await renderCategoryScreen(mockBizWithSoldOut, mockChatId, 'Beverages');
  const hasAvailShake = hasButtonWithText(soldOutCatScreen.replyMarkup.inline_keyboard, 'Available Shake — ₹100');
  const hasSoldOutJuice = hasButtonWithText(soldOutCatScreen.replyMarkup.inline_keyboard, '🚫 Sold Out Juice [SOLD OUT]');
  if (!hasAvailShake) {
    throw new Error('FAILED: Available Shake should be displayed as available!');
  }
  if (!hasSoldOutJuice) {
    throw new Error('FAILED: Sold Out Juice should be displayed as [SOLD OUT]!');
  }

  // Verify Sold Out Juice button has callback_data: 'ignore'
  const juiceBtnRow = soldOutCatScreen.replyMarkup.inline_keyboard.find((row: any) =>
    row.some((b: any) => b.text.includes('Sold Out Juice'))
  );
  const juiceBtn = juiceBtnRow?.find((b: any) => b.text.includes('Sold Out Juice'));
  if (!juiceBtn || juiceBtn.callback_data !== 'ignore') {
    throw new Error('FAILED: Sold out item must have callback_data: "ignore"!');
  }
  console.log('✅ Test 6 Passed: Sold out item properly flagged and non-clickable!');

  // Test 7: Attempting to order a sold-out item via placeTelegramOrder must be rejected
  console.log(`\n--- [TEST 7: Ordering Sold-Out Item Rejection] ---`);
  clearCart(mockChatId);
  const orderRes = await placeTelegramOrder(mockBizWithSoldOut, mockChatId, {
    'Sold Out Juice': 1,
  });
  if (orderRes.success) {
    throw new Error('FAILED: Ordering a sold-out item succeeded when it should have failed!');
  }
  if (!orderRes.message.includes('sold out')) {
    throw new Error(`FAILED: Expected sold out error message, got: ${orderRes.message}`);
  }
  console.log('✅ Test 7 Passed: Ordering sold-out item correctly rejected!');

  // Test 8: Deleted / Archived items exclusion
  console.log(`\n--- [TEST 8: Deleted & Archived items exclusion] ---`);
  const mockBizWithDeleted: BusinessData = {
    ...mockBizWithPinned,
    menu_items: [
      { id: '1', name: 'Active Nachos', price: 120, category: 'Snacks', available: true },
      { id: '2', name: 'Deleted Wings', price: 180, category: 'Snacks', available: true, status: 'deleted' } as any,
      { id: '3', name: 'Archived Tacos', price: 160, category: 'Snacks', available: true, archived: true } as any,
    ],
  };

  const deletedActive = getActiveMenuItems(mockBizWithDeleted);
  if (deletedActive.length !== 1 || deletedActive[0].name !== 'Active Nachos') {
    throw new Error('FAILED: Deleted or archived items were not excluded!');
  }
  const deletedCatScreen = await renderCategoryScreen(mockBizWithDeleted, mockChatId, 'Snacks');
  if (
    hasButtonWithText(deletedCatScreen.replyMarkup.inline_keyboard, 'Deleted Wings') ||
    hasButtonWithText(deletedCatScreen.replyMarkup.inline_keyboard, 'Archived Tacos')
  ) {
    throw new Error('FAILED: Deleted or archived items appeared in rendered menu!');
  }
  console.log('✅ Test 8 Passed: Deleted and archived items successfully excluded!');

  // Test 9: Truly empty category empty-state
  console.log(`\n--- [TEST 9: Genuinely empty category] ---`);
  const emptyCatScreen = await renderCategoryScreen(mockBizWithPinned, mockChatId, 'NonExistentCategory');
  if (!emptyCatScreen.text.includes('No items found in category "NonExistentCategory"')) {
    throw new Error(`FAILED: Genuinely empty category did not show correct message. Got: ${emptyCatScreen.text}`);
  }
  console.log('✅ Test 9 Passed: Genuinely empty category displays accurate empty-state message!');

  console.log('\n🎉 ALL 9 TEST SUITES PASSED FLAWLESSLY!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
