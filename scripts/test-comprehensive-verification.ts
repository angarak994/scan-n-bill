/**
 * Automated Verification & Regression Suite for QControl
 * Executes Flow, Security, Billing, F&B, Idempotency, and Performance tests.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { supabase } from '../src/lib/supabaseClient';
import { businessManager, invalidateBusinessCache } from '../src/lib/businessManager';
import { sessionRepository } from '../src/lib/repositories/sessionRepository';
import { startSession, getTableStatus, calculateServerBillingForSession, endSession } from '../src/lib/sessionManager';
import { createAuthoritativeOrder, resolveAuthoritativeLineItems } from '../src/lib/services/foodOrderService';
import {
  generateSecureQrToken,
  resolveQrToken,
  createQrSessionToken,
  verifyQrSessionToken,
  regenerateTableQrToken,
  getOrCreateTableQrToken
} from '../src/lib/security/qrTokenService';
import { checkRateLimitShared, getTrustedClientIp } from '../src/lib/utils/rateLimit';
import { getActiveMenuItems } from '../src/lib/telegram/fbOrderingService';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('QCONTROL AUTHORITATIVE VERIFICATION & REGRESSION SUITE');
  console.log('======================================================\n');

  // Find a test business in the database
  const { data: businesses, error: bizErr } = await supabase.from('businesses').select('*').limit(2);
  if (bizErr || !businesses || businesses.length === 0) {
    console.error('Cannot run suite: no business records found in database');
    process.exit(1);
  }

  const primaryBiz = businesses[0];
  const secondaryBiz = businesses.length > 1 ? businesses[1] : businesses[0];
  const testTableId = primaryBiz.tables?.[0]?.id || 'T1';

  console.log(`Primary Test Business: ${primaryBiz.business_name} (${primaryBiz.id})`);
  console.log(`Test Table: ${testTableId}\n`);

  // ---------------------------------------------------------
  // TEST GROUP 1: Idempotency & Duplicate Session Prevention
  // ---------------------------------------------------------
  console.log('--- TEST GROUP 1: Idempotency & Duplicate Prevention ---');

  // Clean up any lingering active sessions on test table
  await supabase
    .from('sessions')
    .update({ status: 'COMPLETED', end_time: new Date().toISOString() })
    .eq('business_id', primaryBiz.id)
    .ilike('table_id', testTableId)
    .eq('status', 'ACTIVE');

  // 1.1 Start first session
  const sess1 = await startSession(testTableId, 'pool', 'TestCustomer_Alice', primaryBiz.id);
  assert(!!sess1 && !!sess1.id, 'Session 1 started successfully');
  const sessId = sess1.id!;

  // 1.2 Rescan / Double-tap start with same table (Idempotent call)
  const sess2 = await startSession(testTableId, 'pool', 'TestCustomer_Alice', primaryBiz.id);
  assert(sess2.id === sessId, 'Rescan/Double-start returns SAME active session (idempotent)', `sess1: ${sessId}, sess2: ${sess2.id}`);
  assert((sess2 as any).isExisting === true, 'Rescan flagged with isExisting: true');

  // 1.3 Verify DB constraint: exactly ONE active session exists in DB
  const { count: activeCount } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', primaryBiz.id)
    .ilike('table_id', testTableId)
    .eq('status', 'ACTIVE');
  assert(activeCount === 1, 'Database guarantee: Exactly 1 active session row exists');

  // 1.4 Concurrent double-scan race test (simultaneous Promise.all startSession)
  const concurrentStarts = await Promise.all([
    startSession(testTableId, 'pool', 'Concurrent_1', primaryBiz.id),
    startSession(testTableId, 'pool', 'Concurrent_2', primaryBiz.id)
  ]);
  assert(
    concurrentStarts[0].id === sessId && concurrentStarts[1].id === sessId,
    'Concurrent double-scan resolves to existing active session without error or duplicate'
  );

  // ---------------------------------------------------------
  // TEST GROUP 2: Secure QR Token Model & Authorization
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Secure QR Token Model & Authorization ---');

  // 2.1 Generate and resolve secure token
  const qrToken = await getOrCreateTableQrToken(primaryBiz.id, testTableId);
  assert(typeof qrToken === 'string' && qrToken.length >= 16, 'Secure opaque QR token generated with sufficient entropy');

  const resolved = await resolveQrToken(qrToken);
  assert(resolved.valid === true, 'Public QR token resolves correctly');
  assert(resolved.businessId === primaryBiz.id, 'Token resolves to correct business ID');
  assert(resolved.tableId?.toLowerCase() === testTableId.toLowerCase(), 'Token resolves to correct table ID');

  // 2.2 Rejection of invalid/tampered token
  const tamperedResolution = await resolveQrToken('invalid_tampered_token_xyz_9999');
  assert(tamperedResolution.valid === false, 'Tampered/unknown QR token safely rejected with valid: false');

  // 2.3 Session-scoped credential issuance and verification
  const sessionToken = await createQrSessionToken({
    businessId: primaryBiz.id,
    tableId: testTableId,
    sessionId: sessId
  });
  assert(typeof sessionToken === 'string' && sessionToken.length > 50, 'Session-scoped JWT credential created');

  const validReq = new Request('http://localhost/api/place-order', {
    headers: { 'x-qr-session-token': sessionToken }
  });
  const authCheck = await verifyQrSessionToken(validReq, sessId, testTableId);
  assert(authCheck.authorized === true, 'Session-scoped credential authorizes request against correct session');

  // 2.4 IDOR Protection: attempt cross-session authorization
  const crossSessionCheck = await verifyQrSessionToken(validReq, 'different_session_uuid_123', testTableId);
  assert(crossSessionCheck.authorized === false, 'IDOR Denied: Credential cannot be used on a different session');

  // 2.5 IDOR Protection: attempt cross-table authorization
  const crossTableCheck = await verifyQrSessionToken(validReq, sess1.id, 'DIFFERENT_TABLE_99');
  assert(crossTableCheck.authorized === false, 'IDOR Denied: Credential cannot be used on a different table');

  // 2.6 Token revocation and regeneration
  const { newToken, correlationId } = await regenerateTableQrToken(primaryBiz.id, testTableId);
  assert(newToken !== qrToken, 'Regenerated token is distinct from old token');
  assert(!!correlationId, 'Audit correlation ID generated for token regeneration');

  // Old token must immediately fail
  const oldTokenCheck = await resolveQrToken(qrToken);
  assert(oldTokenCheck.valid === false, 'Revoked old QR token immediately stops working');

  // ---------------------------------------------------------
  // TEST GROUP 3: Authoritative Pricing & F&B Ordering
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Authoritative Pricing & F&B Ordering ---');

  // Add a controlled test menu item if not present
  const freshBiz = await businessManager.getBusiness(primaryBiz.id, true);
  const currentMenu = [...(freshBiz?.menu_items || [])];
  
  // Ensure test items exist: 1 pinned, 1 standard
  const testItemName1 = 'Test Energy Drink';
  const testItemName2 = 'Test Club Sandwich';
  let item1 = currentMenu.find(i => i.name === testItemName1);
  let item2 = currentMenu.find(i => i.name === testItemName2);

  if (!item1) {
    item1 = { id: 'test_drink_1', name: testItemName1, price: 120, category: 'Beverages', is_pinned: true, available: true };
    currentMenu.push(item1);
  }
  if (!item2) {
    item2 = { id: 'test_food_2', name: testItemName2, price: 180, category: 'Snacks', is_pinned: false, available: true };
    currentMenu.push(item2);
  }

  await supabase.from('businesses').update({ menu_items: currentMenu }).eq('id', primaryBiz.id);
  invalidateBusinessCache(primaryBiz.id);

  // 3.1 Verify client price tampering is ignored
  const cartWithTamperedPrice = {
    [testItemName1]: 2 // Authoritative price is 120, total should be 240
  };
  const customTamperedPrices = {
    [testItemName1]: 1 // Client claims price is ₹1
  };

  const lineItemsRes = resolveAuthoritativeLineItems(currentMenu, cartWithTamperedPrice, customTamperedPrices, false);
  assert(lineItemsRes.lineItems[0].price === 120, 'Authoritative price check: client price override strictly IGNORED');
  assert(lineItemsRes.orderTotal === 240, 'Order total matches authoritative DB price (2 * 120 = 240)');

  // 3.2 Place authoritative order on session
  const initialFoodCost = sess1.food_cost || 0;
  const orderResult = await createAuthoritativeOrder({
    businessId: primaryBiz.id,
    sessionId: sess1.id,
    cart: { [testItemName1]: 1, [testItemName2]: 1 }, // 120 + 180 = 300
    source: 'QR',
    idempotencyKey: `test_order_${Date.now()}`
  });

  assert(orderResult.success === true, 'Order created successfully');
  assert(orderResult.orderTotal === 300, 'Order total computed correctly from menu items (₹300)');
  assert(orderResult.newFoodCost === initialFoodCost + 300, 'Session food_cost updated atomically in DB');

  // Verify DB reflects updated food_cost
  const updatedSess = await sessionRepository.findById(sessId, primaryBiz.id);
  assert(updatedSess?.food_cost === initialFoodCost + 300, 'Database session record food_cost matches order result');

  // 3.3 Repeat order capability: order again with a fresh cart
  const repeatOrderResult = await createAuthoritativeOrder({
    businessId: primaryBiz.id,
    sessionId: sessId,
    cart: { [testItemName1]: 1 }, // +120
    source: 'QR',
    idempotencyKey: `test_repeat_order_${Date.now()}`
  });
  assert(repeatOrderResult.newFoodCost === initialFoodCost + 420, 'Repeat order succeeds with fresh cart and accumulates food_cost (300 + 120 = 420)');

  // ---------------------------------------------------------
  // TEST GROUP 4: Member & Non-Member Billing Consistency
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Member & Non-Member Billing Consistency ---');

  // Calculate live billing
  const latestSess = await sessionRepository.findById(sessId, primaryBiz.id);
  const billingRes = await calculateServerBillingForSession(latestSess, primaryBiz.id);
  assert(billingRes.cost > 0, `Live billing cost is greater than zero: ₹${billingRes.cost}`);
  assert(billingRes.baseFoodCost === initialFoodCost + 420, `Authoritative food cost in billing engine is ₹${billingRes.baseFoodCost}`);
  assert(billingRes.baseTableCost >= 0, `Base table cost is non-negative: ₹${billingRes.baseTableCost}`);

  // Consistency assertion: totals everywhere must match
  const totalCost = billingRes.cost;
  const tablePart = billingRes.tableCost;
  const foodPart = billingRes.foodCost;
  const discountPart = billingRes.totalDiscountAmount;
  assert(
    Math.round(totalCost) === Math.round(tablePart + foodPart),
    `Total cost equals tableCost + foodCost: ₹${totalCost} == ₹${tablePart} + ₹${foodPart}`
  );

  // ---------------------------------------------------------
  // TEST GROUP 5: Rate Limiting & Spoofing Defense
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Rate Limiting & Spoofing Defense ---');

  // 5.1 Trusted IP extraction: spoofed x-forwarded-for should not override platform IP
  const reqWithSpoof = new Request('http://localhost', {
    headers: {
      'x-vercel-forwarded-for': '203.0.113.195',
      'x-forwarded-for': '10.0.0.1, 192.168.1.1'
    }
  });
  const trustedIp = getTrustedClientIp(reqWithSpoof);
  assert(trustedIp === '203.0.113.195', 'Trusted IP extraction: x-vercel-forwarded-for prioritized over spoofable x-forwarded-for');

  // 5.2 Rate limit enforcement: burst calls trigger 429
  const testIp = '198.51.100.77';
  let blocked = false;
  for (let i = 0; i < 7; i++) {
    const res = await checkRateLimitShared(`test_probe_${testIp}`, 5, 5000);
    if (!res.allowed) {
      blocked = true;
      assert(res.retryAfter > 0, 'Rate limit response includes positive retryAfter seconds');
      assert(!!res.correlationId, 'Rate limit response includes correlation ID');
      break;
    }
  }
  assert(blocked === true, 'Rate limiter blocks burst attempts exceeding limit');

  // ---------------------------------------------------------
  // TEST GROUP 6: Emoji Removal Verification
  // ---------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Emoji Removal Verification ---');

  const activeMenu = getActiveMenuItems(primaryBiz);
  const itemsWithFire = activeMenu.filter(i => String(i.name).includes('🔥'));
  assert(itemsWithFire.length === 0, 'Active menu items have ZERO 🔥 emoji');

  // Clean up test session
  await endSession(testTableId, primaryBiz.id, 'System');

  // Summary
  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Test suite failed with unhandled error:', e);
  process.exit(1);
});
