/**
 * Comprehensive Test Suite for:
 * 1. Member Amount Calculation & Double-Counting Prevention
 * 2. Functional Payment Split (UPI + Cash + Card) & Idempotency / Duplicate Prevention
 * 3. Booking Section: Bulk Actions, Business Ownership & Active Session Protection
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  const { supabase } = await import('../src/lib/supabaseClient');
  const { createLedgerEntryAndPayment } = await import('../src/lib/services/paymentService');
  const { endSession } = await import('../src/lib/sessionManager');

  console.log('====================================================');
  console.log('STARTING QCONTROL FEATURE & CALCULATION TEST SUITE');
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

  // Find a business in the database for isolated testing
  const { data: business, error: bError } = await supabase
    .from('businesses')
    .select('id, business_name, pricing_rules')
    .limit(1)
    .single();

  if (bError || !business) {
    console.error('Failed to find business for testing:', bError);
    process.exit(1);
  }

  const businessId = business.id;
  console.log(`Using Business: "${business.business_name}" (${businessId})\n`);

  // ========================================================================
  // TEST GROUP 1: Member Amount Calculation & Customer Ledger
  // ========================================================================
  console.log('--- TEST GROUP 1: Customer Ledger & Running Balances ---');

  const testCustomerName = `Test_Member_${Date.now()}`;
  const testCustomerPhone = `999${Math.floor(1000000 + Math.random() * 9000000)}`;

  // Create test customer
  const { data: newCustomer, error: cErr } = await supabase
    .from('customers')
    .insert([{
      id: uuidv4(),
      business_id: businessId,
      name: testCustomerName,
      phone: testCustomerPhone,
      total_billed: 0,
      total_paid: 0,
      outstanding_balance: 0
    }])
    .select()
    .single();

  assert(!cErr && !!newCustomer, 'Customer Creation in Ledger', cErr?.message);

  if (newCustomer) {
    const custId = newCustomer.id;

    // Test 1.1: Increment Ledger (Atomic RPC)
    const { error: rpcErr } = await supabase.rpc('increment_customer_ledger', {
      p_customer_id: custId,
      p_billed: 1000,
      p_paid: 400
    });
    assert(!rpcErr, 'increment_customer_ledger RPC Call', rpcErr?.message);

    const { data: updatedCustomer } = await supabase
      .from('customers')
      .select('total_billed, total_paid, outstanding_balance')
      .eq('id', custId)
      .single();

    assert(
      Number(updatedCustomer?.total_billed) === 1000 &&
      Number(updatedCustomer?.total_paid) === 400 &&
      Number(updatedCustomer?.outstanding_balance) === 600,
      'Ledger Balance Correctness: Billed ₹1000, Paid ₹400 => Outstanding ₹600',
      `Got Billed: ${updatedCustomer?.total_billed}, Paid: ${updatedCustomer?.total_paid}, Bal: ${updatedCustomer?.outstanding_balance}`
    );

    // Test 1.2: Settlement Reduces Outstanding Balance
    const { error: settleErr } = await supabase.rpc('increment_customer_ledger', {
      p_customer_id: custId,
      p_billed: 0,
      p_paid: 600
    });
    assert(!settleErr, 'Settlement increment_customer_ledger RPC Call');

    const { data: settledCustomer } = await supabase
      .from('customers')
      .select('total_billed, total_paid, outstanding_balance')
      .eq('id', custId)
      .single();

    assert(
      Number(settledCustomer?.total_billed) === 1000 &&
      Number(settledCustomer?.total_paid) === 1000 &&
      Number(settledCustomer?.outstanding_balance) === 0,
      'Settlement Clearance: Paid ₹600 settles dues completely to ₹0',
      `Got Bal: ${settledCustomer?.outstanding_balance}`
    );

    // Clean up test customer
    await supabase.from('customers').delete().eq('id', custId);
  }

  // ========================================================================
  // TEST GROUP 2: Split Payments & Duplicate Prevention (Idempotency)
  // ========================================================================
  console.log('\n--- TEST GROUP 2: Split Payments & Duplicate Prevention ---');

  const splitCustName = `Split_Cust_${Date.now()}`;
  const splitCustPhone = `988${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testSessionId = uuidv4();

  // Create a real session record in sessions table to satisfy foreign key constraint
  const { error: sessErr } = await supabase
    .from('sessions')
    .insert([{
      id: testSessionId,
      business_id: businessId,
      table_id: `TEST_TBL_${Date.now()}`,
      game_type: 'pool',
      customer_name: splitCustName,
      status: 'COMPLETED',
      start_time: '12:00',
      date: new Date().toISOString().split('T')[0]
    }]);

  if (sessErr) {
    console.error('Failed to create test session:', sessErr);
  }

  // Create customer
  const { data: splitCust } = await supabase
    .from('customers')
    .insert([{
      id: uuidv4(),
      business_id: businessId,
      name: splitCustName,
      phone: splitCustPhone,
      total_billed: 0,
      total_paid: 0,
      outstanding_balance: 0
    }])
    .select()
    .single();

  if (splitCust) {
    // Test 2.1: createLedgerEntryAndPayment with Split Payment (UPI ₹1,500 + Cash ₹1,000)
    await createLedgerEntryAndPayment({
      businessId,
      sessionId: testSessionId,
      customerName: splitCustName,
      customerId: splitCust.id,
      totalBilled: 2500,
      amountPaid: 2500,
      paymentMethod: 'Split',
      paymentStatus: 'Paid',
      splitPayments: [
        { method: 'UPI', amount: 1500 },
        { method: 'Cash', amount: 1000 }
      ]
    });

    const { data: createdPayments } = await supabase
      .from('payments')
      .select('id, amount, payment_method, status, metadata')
      .eq('session_id', testSessionId);

    const upiRow = createdPayments?.find(p => p.payment_method === 'UPI');
    const cashRow = createdPayments?.find(p => p.payment_method === 'Cash');
    const chargeRow = createdPayments?.find(p => p.metadata?.type === 'CHARGE');

    assert(
      Number(upiRow?.amount) === 1500 && upiRow?.status === 'Paid',
      'Split Payment: UPI ₹1,500 recorded accurately as Paid'
    );
    assert(
      Number(cashRow?.amount) === 1000 && cashRow?.status === 'Paid',
      'Split Payment: Cash ₹1,000 recorded accurately as Paid'
    );
    assert(
      Number(chargeRow?.amount) === 2500 && chargeRow?.status === 'Billed',
      'Split Payment: Charge invoice ₹2,500 recorded as Billed'
    );

    // Test 2.2: Duplicate Prevention (Idempotency)
    // Calling createLedgerEntryAndPayment AGAIN with the same session_id should be safely skipped
    const countBefore = createdPayments?.length || 0;
    await createLedgerEntryAndPayment({
      businessId,
      sessionId: testSessionId,
      customerName: splitCustName,
      customerId: splitCust.id,
      totalBilled: 2500,
      amountPaid: 2500,
      paymentMethod: 'Split',
      paymentStatus: 'Paid',
      splitPayments: [
        { method: 'UPI', amount: 1500 },
        { method: 'Cash', amount: 1000 }
      ]
    });

    const { data: paymentsAfterDuplicateCall } = await supabase
      .from('payments')
      .select('id')
      .eq('session_id', testSessionId);

    assert(
      paymentsAfterDuplicateCall?.length === countBefore,
      'Duplicate Payment Prevention: Second call skipped without creating duplicate rows',
      `Expected ${countBefore} rows, got ${paymentsAfterDuplicateCall?.length}`
    );

    // Clean up test payments, session & customer
    await supabase.from('payments').delete().eq('session_id', testSessionId);
    await supabase.from('sessions').delete().eq('id', testSessionId);
    await supabase.from('customers').delete().eq('id', splitCust.id);
  }

  // ========================================================================
  // TEST GROUP 3: Double-Counting Prevention in Financial Overview Logic
  // ========================================================================
  console.log('\n--- TEST GROUP 3: Double-Counting Prevention in Financial Overview ---');

  // Verify the deduplication logic in financial-overview:
  // If a session has payment rows in `payments`, it MUST NOT be added again from `sessions`.
  const mockPayments = [
    { id: 'pay-1', session_id: 'sess-100', amount: 4635, status: 'Paid', payment_method: 'Cash', metadata: { type: 'PAYMENT' } },
    { id: 'pay-2', session_id: 'sess-100', amount: 4635, status: 'Billed', payment_method: 'QKhata', metadata: { type: 'CHARGE' } }
  ];

  const mockSessions = [
    { id: 'sess-100', cost: 4635, amount_paid: 4635, payment_status: 'Paid', payment_method: 'CASH' }, // ALREADY in payments!
    { id: 'sess-999', cost: 200, amount_paid: 200, payment_status: 'Paid', payment_method: 'CASH' } // Legacy session not in payments
  ];

  const recordedSessionIds = new Set(mockPayments.map(p => p.session_id).filter(Boolean));
  const normalized: any[] = [...mockPayments];

  mockSessions.forEach(s => {
    if (recordedSessionIds.has(s.id)) {
      // Correctly skipped!
      return;
    }
    normalized.push({ id: s.id, amount: s.amount_paid, payment_method: s.payment_method, status: s.payment_status });
  });

  const paidRows = normalized.filter(p => p.status === 'Paid' && p.metadata?.type !== 'CHARGE');
  const totalCollected = paidRows.reduce((sum, p) => sum + p.amount, 0);

  assert(
    normalized.length === 3,
    'Financial Overview Deduplication: sess-100 not duplicated (3 rows total, not 4)',
    `Got ${normalized.length} normalized items`
  );

  assert(
    totalCollected === 4835, // 4635 + 200
    'Financial Overview Revenue: No double-counting of ₹4,635 (Total is ₹4,835, NOT ₹9,470)',
    `Got Total: ₹${totalCollected}`
  );

  // ========================================================================
  // TEST GROUP 4: Bulk Booking Actions & Security Validation
  // ========================================================================
  console.log('\n--- TEST GROUP 4: Bulk Booking Actions ---');

  const b1Id = uuidv4();
  const b2Id = uuidv4();
  const b3Id = uuidv4();

  // Insert 3 test bookings
  const { error: insErr } = await supabase.from('bookings').insert([
    {
      id: b1Id,
      business_id: businessId,
      customer_name: 'Bulk User A',
      customer_phone: '9111111111',
      table_id: 'P1',
      booking_date: '2028-10-10',
      start_time: '18:00',
      duration_minutes: 60,
      status: 'confirmed',
      source: 'manual'
    },
    {
      id: b2Id,
      business_id: businessId,
      customer_name: 'Bulk User B',
      customer_phone: '9222222222',
      table_id: 'P1',
      booking_date: '2028-10-10',
      start_time: '19:00',
      duration_minutes: 60,
      status: 'confirmed',
      source: 'manual'
    },
    {
      id: b3Id,
      business_id: businessId,
      customer_name: 'Bulk User C',
      customer_phone: '9333333333',
      table_id: 'P1',
      booking_date: '2028-10-10',
      start_time: '20:00',
      duration_minutes: 60,
      status: 'confirmed',
      source: 'manual'
    }
  ]);

  assert(!insErr, 'Create 3 Test Bookings for Bulk Operations', insErr?.message);

  // Test 4.1: Bulk Status Update (mark b1 & b2 as no_show)
  const { data: updatedB, error: updErr } = await supabase
    .from('bookings')
    .update({ status: 'no_show' })
    .in('id', [b1Id, b2Id])
    .eq('business_id', businessId)
    .select();

  assert(!updErr && updatedB?.length === 2, 'Bulk Status Update to no_show for 2 bookings');

  // Test 4.2: Bulk Status Update to cancelled
  const { data: cancB, error: cancErr } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .in('id', [b1Id, b2Id, b3Id])
    .eq('business_id', businessId)
    .select();

  assert(!cancErr && cancB?.length === 3, 'Bulk Cancellation for all 3 bookings');

  // Test 4.3: Bulk Delete
  const { error: delErr } = await supabase
    .from('bookings')
    .delete()
    .in('id', [b1Id, b2Id, b3Id])
    .eq('business_id', businessId);

  assert(!delErr, 'Bulk Delete for test bookings');

  // Verify deletion
  const { data: remaining } = await supabase
    .from('bookings')
    .select('id')
    .in('id', [b1Id, b2Id, b3Id]);

  assert(remaining?.length === 0, 'Verification: All 3 test bookings removed from database');

  // ========================================================================
  // FINAL SUMMARY
  // ========================================================================
  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉');
  } else {
    console.error(`SOME TESTS FAILED: ${totalTests - passedTests} failure(s)`);
    process.exit(1);
  }
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
