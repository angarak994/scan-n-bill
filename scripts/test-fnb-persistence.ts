/**
 * QControl F&B (Food & Beverages) Persistence & Refresh Audit Test Suite
 * Validates that menu items, prices, quantities, and saved orders persist across dashboard refreshes.
 */

import { supabase } from '../src/lib/supabaseClient';
import { businessManager, invalidateBusinessCache } from '../src/lib/businessManager';
import { createAuthoritativeOrder } from '../src/lib/services/foodOrderService';
import { sessionRepository } from '../src/lib/repositories/sessionRepository';

const TEST_BUSINESS_ID = 'fa24e279-b694-4426-b022-91c367767231'; // TestClub101
const TEST_TABLE_ID = 'Table 1';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🍔 QCONTROL F&B PERSISTENCE & REFRESH VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    console.log(`\n--- [Test ${totalTests}]: ${name} ---`);
    try {
      await fn();
      console.log(`✅ PASSED: ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`❌ FAILED: ${name}`);
      console.error(err);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Menu Items Persistence in Database & Cache Invalidation
  // -------------------------------------------------------------
  await test('Persist Comprehensive Menu Catalog to Database', async () => {
    const testMenuItems = [
      {
        id: 'fnb_item_coffee',
        name: 'Cold Coffee',
        price: 60,
        category: 'Beverages',
        description: 'Chilled rich espresso blended with creamy milk',
        image: '',
        available: true,
        is_pinned: true,
      },
      {
        id: 'fnb_item_sandwich',
        name: 'Veg Club Sandwich',
        price: 90,
        category: 'Snacks',
        description: 'Toasted triple-decker with crisp veggies & cheese',
        image: '',
        available: true,
        is_pinned: false,
      },
      {
        id: 'fnb_item_fries',
        name: 'Peri Peri Fries',
        price: 80,
        category: 'Snacks',
        description: 'Crispy golden potato fries tossed in spicy peri-peri',
        image: '',
        available: true,
        is_pinned: false,
      },
      {
        id: 'fnb_item_energy',
        name: 'Red Bull Energy Drink',
        price: 125,
        category: 'Beverages',
        description: 'Chilled 250ml can',
        image: '',
        available: false, // Out of stock test
        is_pinned: false,
      }
    ];

    // Persist to database
    const { error: updateErr } = await supabase
      .from('businesses')
      .update({ menu_items: testMenuItems })
      .eq('id', TEST_BUSINESS_ID);

    assert(!updateErr, `Saved menu items to businesses table (error: ${updateErr?.message})`);

    // Invalidate in-memory cache
    invalidateBusinessCache(TEST_BUSINESS_ID);

    // Fetch via businessManager with forceRefresh
    const freshBiz = await businessManager.getBusiness(TEST_BUSINESS_ID, true);
    assert(freshBiz !== null, 'Fetched business from DB');
    assert(Array.isArray(freshBiz?.menu_items), 'menu_items is an array');
    assert(freshBiz?.menu_items?.length === 4, `4 items persisted, got ${freshBiz?.menu_items?.length}`);

    const coffee = freshBiz?.menu_items?.find((i: any) => i.id === 'fnb_item_coffee');
    assert(coffee?.price === 60, `Cold Coffee price is 60, got ${coffee?.price}`);
    assert(coffee?.category === 'Beverages', `Cold Coffee category is Beverages`);
    assert(coffee?.is_pinned === true, `Cold Coffee is pinned`);
  });

  // -------------------------------------------------------------
  // TEST 2: Simulate Full Page Refresh (GET /api/dashboard-data)
  // -------------------------------------------------------------
  await test('Dashboard-Data Endpoint Returns menu_items on Full Refresh', async () => {
    // Direct backend fetch of business data as done by /api/dashboard-data
    const business = await businessManager.getBusiness(TEST_BUSINESS_ID, true);
    assert(business !== null, 'Business found');

    // Simulate response payload constructed by dashboard-data/route.ts
    const simulatedResponse = {
      tables: business?.tables || [],
      menu_items: business?.menu_items || [],
      businessName: business?.business_name,
    };

    assert(simulatedResponse.menu_items !== undefined, 'menu_items is present in response');
    assert(simulatedResponse.menu_items.length === 4, `Contains all 4 menu items`);
    assert(simulatedResponse.menu_items[0].name === 'Cold Coffee', 'First item is Cold Coffee');
  });

  // -------------------------------------------------------------
  // TEST 3: Scoped Refresh (scope === 'menu')
  // -------------------------------------------------------------
  await test('Scoped Fast-Path Refresh (scope === menu) Returns menu_items', async () => {
    const business = await businessManager.getBusiness(TEST_BUSINESS_ID, false);
    const scopedPayload = { menu_items: business?.menu_items || [] };

    assert(Array.isArray(scopedPayload.menu_items), 'Scoped payload returns menu_items array');
    assert(scopedPayload.menu_items.length >= 4, `Returns full menu catalogue`);
  });

  // -------------------------------------------------------------
  // TEST 4: F&B Table Ordering & Atomicity
  // -------------------------------------------------------------
  await test('Place F&B Order for Table Session and Verify Saved Orders', async () => {
    // 1. Create or find an active session on Table 1
    let activeSession = await sessionRepository.findActiveByTable(TEST_TABLE_ID, TEST_BUSINESS_ID);
    if (!activeSession) {
      const nowIso = new Date().toISOString();
      const todayStr = nowIso.slice(0, 10);
      const { data: newSession, error: createErr } = await supabase
        .from('sessions')
        .insert({
          business_id: TEST_BUSINESS_ID,
          table_id: TEST_TABLE_ID,
          customer_name: 'F&B Test Player',
          game_type: 'Pool',
          date: todayStr,
          start_time: nowIso,
          status: 'ACTIVE',
          food_cost: 0,
        })
        .select()
        .single();

      assert(!createErr, `Created active test session on ${TEST_TABLE_ID}`);
      activeSession = newSession as any;
    }

    const initialFoodCost = activeSession?.food_cost || 0;

    // 2. Place an order for 2 x Cold Coffee (@ 60 = 120) and 1 x Veg Club Sandwich (@ 90 = 90) = 210 total
    const cart = [
      { id: 'fnb_item_coffee', quantity: 2 },
      { id: 'fnb_item_sandwich', quantity: 1 }
    ];

    const orderResult = await createAuthoritativeOrder({
      businessId: TEST_BUSINESS_ID,
      sessionId: activeSession?.id,
      tableId: TEST_TABLE_ID,
      cart,
      source: 'Dashboard',
      isOwner: true,
    });

    assert(orderResult.success, 'Order created successfully');
    assert(orderResult.orderTotal === 210, `Order total is 210 (got ${orderResult.orderTotal})`);
    assert(orderResult.lineItems.length === 2, `2 line items resolved in order`);
    assert(orderResult.lineItems[0].name === 'Cold Coffee', 'First line item is Cold Coffee');
    assert(orderResult.lineItems[0].quantity === 2, 'Cold Coffee quantity is 2');
    assert(orderResult.lineItems[0].subtotal === 120, 'Cold Coffee subtotal is 120');

    // 3. Verify session food_cost updated in database
    const updatedSession = await sessionRepository.findById(activeSession?.id as string, TEST_BUSINESS_ID);
    assert(updatedSession !== null, 'Fetched updated session');
    assert(updatedSession?.food_cost === initialFoodCost + 210, `Session food_cost incremented by 210 (was ${initialFoodCost}, now ${updatedSession?.food_cost})`);

    // 4. Verify order notification saved in notifications table
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', orderResult.orderId)
      .single();

    assert(notifs !== null, 'Order notification record exists');
    assert(notifs?.type === 'order_pending', 'Notification type is order_pending');
    assert(notifs?.message.includes('210'), 'Notification message contains order total 210');
    assert(notifs?.message.includes('Cold Coffee'), 'Notification message contains Cold Coffee');

    // 5. Cleanup test session & notification
    await supabase.from('notifications').delete().eq('id', orderResult.orderId);
    if (activeSession?.customer_name === 'F&B Test Player') {
      await supabase.from('sessions').delete().eq('id', activeSession.id);
    }
  });

  // -------------------------------------------------------------
  // TEST 5: Out of Stock Validation
  // -------------------------------------------------------------
  await test('Reject Orders for Out-of-Stock Items Authoritatively', async () => {
    let threw = false;
    try {
      await createAuthoritativeOrder({
        businessId: TEST_BUSINESS_ID,
        tableId: TEST_TABLE_ID,
        cart: [{ id: 'fnb_item_energy', quantity: 1 }], // Red Bull is available: false
        source: 'QR',
        isOwner: false,
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('sold out') || err.message.includes('no longer on the menu'), `Correct out-of-stock error: "${err.message}"`);
    }
    assert(threw, 'Out of stock item was rejected');
  });

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n💥 TEST SUITE CRASHED:', err);
  process.exit(1);
});
