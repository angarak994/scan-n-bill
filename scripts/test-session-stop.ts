import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { v4 as uuidv4 } from 'uuid';

async function runSessionStopTests() {
  const { supabase } = await import('../src/lib/supabaseClient');
  const { endSession, startSession } = await import('../src/lib/sessionManager');
  const { handleSessionIntervention } = await import('../src/lib/services/interventionService');

  console.log('====================================================');
  console.log('STARTING SESSION STOP & BILLING REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details || 'Assertion failed'}`);
    }
  }

  // 1. Get a test business
  const { data: business, error: bError } = await supabase
    .from('businesses')
    .select('id, business_name, tables, pricing_rules')
    .limit(1)
    .single();

  if (bError || !business) {
    console.error('Failed to find business for testing:', bError);
    process.exit(1);
  }

  const businessId = business.id;
  const testTableId = business.tables?.[0]?.id || 'P1';
  console.log(`Using Business: "${business.business_name}" (${businessId}) on Table: ${testTableId}\n`);

  // Helper to ensure table has no active session before each test
  async function cleanTable(tableId: string) {
    await supabase
      .from('sessions')
      .update({ status: 'COMPLETED', end_time: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('table_id', tableId)
      .eq('status', 'ACTIVE');
  }

  // ========================================================================
  // TEST 1: Normal Stop for Walk-in Guest (Authoritative Full Settlement)
  // ========================================================================
  console.log('--- TEST 1: Walk-in Guest Normal Stop (Cash) ---');
  await cleanTable(testTableId);

  // Start a fresh session 15 minutes ago
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const session1 = await startSession(testTableId, 'pool', 'Guest Walk-in', businessId, 1, undefined, fifteenMinsAgo);
  assert(!!session1?.id, 'Session 1 started successfully');

  // Stop session via handleSessionIntervention with full settlement (undefined amount)
  const stop1 = await handleSessionIntervention({
    action: 'force_end',
    session_id: session1.id!,
    business_id: businessId,
    payment_method: 'Cash',
    performed_by: 'dashboard_user'
  });

  assert(stop1.success === true, 'Stop 1 intervention returned success');
  assert(stop1.sessionResult.status === 'COMPLETED', 'Stop 1 status marked COMPLETED');
  assert(stop1.sessionResult.cost > 0, `Stop 1 cost computed authoritatively (${stop1.sessionResult.cost})`);

  // Verify in database
  const { data: dbSession1 } = await supabase.from('sessions').select('*').eq('id', session1.id!).single();
  assert(dbSession1?.status === 'COMPLETED', 'DB Session 1 status is COMPLETED');
  assert(dbSession1?.payment_status === 'Paid', 'DB Session 1 payment_status is Paid');
  assert(dbSession1?.amount_paid === dbSession1?.cost, `DB Session 1 amount_paid matches cost (₹${dbSession1?.amount_paid})`);
  assert(dbSession1?.completed_by === 'Manual Force', 'DB Session 1 completed_by is Manual Force');

  // ========================================================================
  // TEST 2: Walk-in Guest with Slight Timing Skew (Client snapshot slightly lower)
  // ========================================================================
  console.log('\n--- TEST 2: Walk-in Guest with Timing Skew (Client snapshot slightly lower) ---');
  await cleanTable(testTableId);

  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const session2 = await startSession(testTableId, 'pool', 'Guest Timing Skew', businessId, 1, undefined, thirtyMinsAgo);

  // Suppose client calculated cost at 100, but server calculates at 105
  // Client sends 100 as amount_recovered
  const stop2 = await handleSessionIntervention({
    action: 'force_end',
    session_id: session2.id!,
    business_id: businessId,
    amount_recovered: 95, // slight time jitter
    payment_method: 'Cash',
    performed_by: 'dashboard_user'
  });

  assert(stop2.success === true, 'Stop 2 absorbed time skew without failing');
  const { data: dbSession2 } = await supabase.from('sessions').select('*').eq('id', session2.id!).single();
  assert(dbSession2?.status === 'COMPLETED', 'DB Session 2 status is COMPLETED');
  assert(dbSession2?.payment_status === 'Paid', 'DB Session 2 payment_status is Paid');

  // ========================================================================
  // TEST 3: Walk-in Guest Attempting Large Unregistered Underpayment (Must Reject)
  // ========================================================================
  console.log('\n--- TEST 3: Walk-in Guest Major Underpayment (Must Reject with 400) ---');
  await cleanTable(testTableId);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const session3 = await startSession(testTableId, 'pool', 'Guest Underpay', businessId, 1, undefined, oneHourAgo);

  let errorCaught = null;
  try {
    await handleSessionIntervention({
      action: 'force_end',
      session_id: session3.id!,
      business_id: businessId,
      amount_recovered: 10, // Far below authoritative cost
      payment_method: 'Cash',
      performed_by: 'dashboard_user'
    });
  } catch (err: any) {
    errorCaught = err;
  }

  assert(!!errorCaught, 'Major underpayment for unregistered guest was rejected');
  assert(errorCaught?.message?.includes('Walk-in customers must pay full bill amount'), `Rejected with clear error message: "${errorCaught?.message}"`);

  // Clean up session 3
  await cleanTable(testTableId);

  // ========================================================================
  // TEST 4: Member Stop with QKhata Credit
  // ========================================================================
  console.log('\n--- TEST 4: Registered Member with QKhata Credit ---');
  await cleanTable(testTableId);

  // Find or create a registered customer
  let { data: testCustomer } = await supabase
    .from('customers')
    .select('id, name, phone, outstanding_balance')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle();

  if (!testCustomer) {
    const newCustId = uuidv4();
    const { data: created } = await supabase.from('customers').insert([{
      id: newCustId,
      business_id: businessId,
      name: 'Test VIP Customer',
      phone: '9876543210',
      total_billed: 0,
      total_paid: 0,
      outstanding_balance: 0
    }]).select().single();
    testCustomer = created;
  }

  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const session4 = await startSession(testTableId, 'pool', testCustomer!.name, businessId, 1, undefined, twentyMinsAgo);

  const stop4 = await handleSessionIntervention({
    action: 'force_end',
    session_id: session4.id!,
    business_id: businessId,
    amount_recovered: 0,
    payment_method: 'QKhata',
    due_date: '2026-11-01',
    performed_by: 'dashboard_user'
  });

  assert(stop4.success === true, 'Member QKhata session ended successfully');
  const { data: dbSession4 } = await supabase.from('sessions').select('*').eq('id', session4.id!).single();
  assert(dbSession4?.status === 'COMPLETED', 'Member session status is COMPLETED');
  assert(dbSession4?.payment_status === 'Pending', 'Member session payment_status is Pending');

  // ========================================================================
  // TEST 5: Split Payment (Cash + UPI) Full Settlement
  // ========================================================================
  console.log('\n--- TEST 5: Split Payment Full Settlement ---');
  await cleanTable(testTableId);

  const session5 = await startSession(testTableId, 'pool', 'Guest Split', businessId, 1, undefined, twentyMinsAgo);

  const stop5 = await handleSessionIntervention({
    action: 'force_end',
    session_id: session5.id!,
    business_id: businessId,
    payment_method: 'Split',
    split_payments: [
      { method: 'Cash', amount: 50 },
      { method: 'UPI', amount: 50 }
    ],
    performed_by: 'dashboard_user'
  });

  assert(stop5.success === true, 'Split payment session ended successfully');
  const { data: dbSession5 } = await supabase.from('sessions').select('*').eq('id', session5.id!).single();
  assert(dbSession5?.status === 'COMPLETED', 'Split payment session status is COMPLETED');
  assert(dbSession5?.payment_status === 'Paid', 'Split payment session payment_status is Paid');

  // ========================================================================
  // TEST 6: Concurrency / Double-Stop Protection
  // ========================================================================
  console.log('\n--- TEST 6: Concurrency / Double-Stop Protection ---');
  await cleanTable(testTableId);

  const session6 = await startSession(testTableId, 'pool', 'Guest Double Stop', businessId, 1, undefined, twentyMinsAgo);

  // End once
  await handleSessionIntervention({
    action: 'force_end',
    session_id: session6.id!,
    business_id: businessId,
    payment_method: 'Cash',
    performed_by: 'dashboard_user'
  });

  // End twice on already COMPLETED session
  let doubleStopError = null;
  try {
    await handleSessionIntervention({
      action: 'force_end',
      session_id: session6.id!,
      business_id: businessId,
      payment_method: 'Cash',
      performed_by: 'dashboard_user'
    });
  } catch (err: any) {
    doubleStopError = err;
  }

  assert(!!doubleStopError, 'Second stop request on same session was rejected');
  assert(doubleStopError?.message?.includes('not active'), `Double stop rejected with: "${doubleStopError?.message}"`);

  // Clean up
  await cleanTable(testTableId);

  console.log('\n====================================================');
  console.log(`TEST SUITE COMPLETE: ${passedTests}/${totalTests} PASSED`);
  console.log('====================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSessionStopTests().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
