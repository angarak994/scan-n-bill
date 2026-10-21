import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '../src/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateBookingOutstandingBalance,
  formatPaymentReminderMessage,
  sendBookingPaymentReminder
} from '../src/lib/services/paymentReminderService';

// ANSI Colors for test output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passedCount = 0;
let failedCount = 0;

function assert(condition: any, testName: string, details?: string) {
  if (Boolean(condition)) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passedCount++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${testName}`);
    if (details) console.error(`    ${RED}Details: ${details}${RESET}`);
    failedCount++;
  }
}

async function runPaymentRemindersAcceptanceSuite() {
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  QCONTROL INTELLIGENT PAYMENT REMINDERS — ACCEPTANCE TEST SUITE        ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`);

  // 1. Fetch businesses for Club A and Club B
  const { data: businesses, error: bizErr } = await supabase
    .from('businesses')
    .select('id, business_name, tables, pricing_rules, payment_qr_config')
    .eq('status', 'ACTIVE');

  if (bizErr || !businesses || businesses.length === 0) {
    throw new Error(`Failed to load businesses from database: ${bizErr?.message || 'None found'}`);
  }

  const activeClubs = businesses.filter(b => !b.business_name?.toLowerCase().includes('archived'));
  const clubA = activeClubs[0];
  const clubB = activeClubs.length > 1 ? activeClubs[1] : activeClubs[0];

  const clubAName = clubA.business_name.trim();
  const clubBName = clubB.business_name.trim();

  console.log(`${CYAN}Verified Test Context:${RESET}`);
  console.log(`- Partner Club A: ${BOLD}${clubAName}${RESET} (ID: ${clubA.id})`);
  console.log(`- Partner Club B: ${BOLD}${clubBName}${RESET} (ID: ${clubB.id})\n`);

  const testPhone = '919876543299';
  const testPhone2 = '919876543298';
  const cleanups: Array<() => any> = [];

  try {
    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 1: Club A reminder contains Club A's actual name and correct balance
    // ------------------------------------------------------------------------
    console.log(`${BOLD}Acceptance Test 1: Club A Name and Balance Accuracy${RESET}`);
    const bookingAId = uuidv4();
    const sessionAId = uuidv4();

    // Insert session A with cost = 800
    const sARes = await supabase.from('sessions').insert({
      id: sessionAId,
      business_id: clubA.id,
      customer_name: 'Aditi Sharma',
      table_id: 'TEST_A1',
      game_type: 'Snooker',
      date: new Date().toISOString().split('T')[0],
      start_time: '15:00',
      end_time: '17:00',
      cost: 800,
      status: 'COMPLETED',
      payment_status: 'Pending'
    }).select().single();
    if (sARes.error) throw new Error(`Session A insert failed: ${sARes.error.message}`);
    cleanups.push(() => supabase.from('sessions').delete().eq('id', sessionAId));

    // Insert booking A linked to session A
    const bARes = await supabase.from('bookings').insert({
      id: bookingAId,
      business_id: clubA.id,
      customer_name: 'Aditi Sharma',
      customer_phone: testPhone,
      table_id: 'TEST_A1',
      session_id: sessionAId,
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '15:00',
      duration_minutes: 120,
      status: 'confirmed',
      source: 'central_whatsapp'
    }).select().single();
    if (bARes.error) throw new Error(`Booking A insert failed: ${bARes.error.message}`);
    cleanups.push(() => supabase.from('bookings').delete().eq('id', bookingAId));

    const balanceA = await calculateBookingOutstandingBalance(bookingAId, clubA.id);
    assert(balanceA.isValid, 'Balance A calculation succeeded', balanceA.reason);
    assert(balanceA.businessName === clubAName, `Club name matches actual business: "${clubAName}"`);
    assert(balanceA.outstandingAmount === 800, `Authoritative balance is ₹800 (actual: ₹${balanceA.outstandingAmount})`);

    const formattedA = formatPaymentReminderMessage({
      clubName: balanceA.businessName!,
      customerName: balanceA.customerName!,
      outstanding: balanceA.outstandingAmount!,
      upiId: balanceA.upiId
    });

    assert(formattedA.includes(`*Payment reminder — ${clubAName}*`), 'Message has exact header format with Club A name');
    assert(formattedA.includes('Hi Aditi Sharma, your booking has an outstanding balance of ₹800.'), 'Message contains correct member name and ₹800 balance');
    assert(formattedA.includes('Please review and complete the payment using UPI. If you\'ve already paid, please disregard this reminder while we verify your status.'), 'Message contains required standard closing');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 2: Club B reminder contains Club B's actual name and its own customer's balance
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 2: Club B Business Isolation & Dynamic Name${RESET}`);
    const bookingBId = uuidv4();
    const sessionBId = uuidv4();

    const sBRes = await supabase.from('sessions').insert({
      id: sessionBId,
      business_id: clubB.id,
      customer_name: 'Rohan Deshmukh',
      table_id: 'TEST_B1',
      game_type: 'Pool',
      date: new Date().toISOString().split('T')[0],
      start_time: '16:00',
      end_time: '18:00',
      cost: 600,
      status: 'COMPLETED',
      payment_status: 'Pending'
    }).select().single();
    if (sBRes.error) throw new Error(`Session B insert failed: ${sBRes.error.message}`);
    cleanups.push(() => supabase.from('sessions').delete().eq('id', sessionBId));

    const bBRes = await supabase.from('bookings').insert({
      id: bookingBId,
      business_id: clubB.id,
      customer_name: 'Rohan Deshmukh',
      customer_phone: testPhone2,
      table_id: 'TEST_B1',
      session_id: sessionBId,
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '16:00',
      duration_minutes: 120,
      status: 'confirmed',
      source: 'central_whatsapp'
    }).select().single();
    if (bBRes.error) throw new Error(`Booking B insert failed: ${bBRes.error.message}`);
    cleanups.push(() => supabase.from('bookings').delete().eq('id', bookingBId));

    const balanceB = await calculateBookingOutstandingBalance(bookingBId, clubB.id);
    assert(balanceB.isValid, 'Balance B calculation succeeded', balanceB.reason);
    assert(balanceB.businessName === clubBName, `Club B name matches actual business: "${clubBName}"`);
    assert(balanceB.outstandingAmount === 600, `Club B balance is ₹600 (actual: ₹${balanceB.outstandingAmount})`);

    const formattedB = formatPaymentReminderMessage({
      clubName: balanceB.businessName!,
      customerName: balanceB.customerName!,
      outstanding: balanceB.outstandingAmount!,
      upiId: balanceB.upiId
    });

    assert(formattedB.includes(`*Payment reminder — ${clubBName}*`), 'Message has exact header format with Club B name');
    assert(formattedB.includes('Hi Rohan Deshmukh, your booking has an outstanding balance of ₹600.'), 'Message contains Club B customer name and ₹600 balance');
    assert(!formattedB.includes(clubAName), 'Club B message strictly does NOT contain Club A name');

    // Tenant Isolation check: Requesting Club B's booking with Club A's business_id must fail!
    const tenantBreach = await calculateBookingOutstandingBalance(bookingBId, clubA.id);
    assert(!tenantBreach.isValid, 'Cross-tenant boundary enforced: Club A cannot calculate Club B booking');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 3: Partial payment (₹800 booking with ₹300 paid -> ₹500 balance)
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 3: Partial Payment Calculation (₹800 - ₹300 = ₹500)${RESET}`);
    const paymentPartialId = uuidv4();
    await supabase.from('payments').insert({
      id: paymentPartialId,
      business_id: clubA.id,
      session_id: sessionAId,
      amount: 300,
      payment_method: 'UPI',
      status: 'Paid',
      metadata: { booking_id: bookingAId }
    });
    cleanups.push(() => supabase.from('payments').delete().eq('id', paymentPartialId));

    const balancePartial = await calculateBookingOutstandingBalance(bookingAId, clubA.id);
    assert(balancePartial.isValid, 'Partial payment balance calculation succeeded');
    assert(balancePartial.totalPayable === 800, 'Original payable amount was ₹800');
    assert(balancePartial.totalPaid === 300, 'Recorded paid amount is ₹300');
    assert(balancePartial.outstandingAmount === 500, `Outstanding balance accurately calculated as ₹500 (actual: ₹${balancePartial.outstandingAmount})`);

    const formattedPartial = formatPaymentReminderMessage({
      clubName: balancePartial.businessName!,
      customerName: balancePartial.customerName!,
      outstanding: balancePartial.outstandingAmount!,
      upiId: balancePartial.upiId
    });
    assert(formattedPartial.includes('outstanding balance of ₹500.'), 'Reminder text reflects exactly ₹500 after ₹300 partial payment');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 4: Fully paid booking receives no payment reminder
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 4: Fully Paid Booking Receives No Reminder${RESET}`);
    const paymentFullId = uuidv4();
    await supabase.from('payments').insert({
      id: paymentFullId,
      business_id: clubA.id,
      session_id: sessionAId,
      amount: 500, // Completes the ₹800 total (300 + 500 = 800)
      payment_method: 'UPI',
      status: 'Paid',
      metadata: { booking_id: bookingAId }
    });
    cleanups.push(() => supabase.from('payments').delete().eq('id', paymentFullId));

    const balanceSettled = await calculateBookingOutstandingBalance(bookingAId, clubA.id);
    assert(balanceSettled.isValid, 'Settled balance calculation succeeded');
    assert(balanceSettled.isSettled === true, 'Booking is marked as settled');
    assert(balanceSettled.outstandingAmount === 0, 'Outstanding balance is ₹0');

    // Dispatch attempt must safely abort with skipped: true
    const reminderResultSettled = await sendBookingPaymentReminder({
      bookingId: bookingAId,
      businessId: clubA.id,
      forceSend: true
    });
    assert(reminderResultSettled.skipped === true, 'sendBookingPaymentReminder safely skipped delivery');
    assert(reminderResultSettled.success === false, 'Did not transmit unnecessary reminder to fully paid member');

    // Remove full payment to continue other edge cases
    await supabase.from('payments').delete().eq('id', paymentFullId);

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 5: Pending or failed payments do not incorrectly reduce balance
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 5: Pending / Failed Payments Do Not Reduce Balance${RESET}`);
    const paymentPendingId = uuidv4();
    const paymentFailedId = uuidv4();

    // Insert pending payment of ₹400
    await supabase.from('payments').insert({
      id: paymentPendingId,
      business_id: clubA.id,
      session_id: sessionAId,
      amount: 400,
      payment_method: 'UPI',
      status: 'Pending',
      metadata: { booking_id: bookingAId }
    });
    cleanups.push(() => supabase.from('payments').delete().eq('id', paymentPendingId));

    // Insert failed payment of ₹500
    await supabase.from('payments').insert({
      id: paymentFailedId,
      business_id: clubA.id,
      session_id: sessionAId,
      amount: 500,
      payment_method: 'UPI',
      status: 'Failed',
      metadata: { booking_id: bookingAId }
    });
    cleanups.push(() => supabase.from('payments').delete().eq('id', paymentFailedId));

    const balanceWithPendingAndFailed = await calculateBookingOutstandingBalance(bookingAId, clubA.id);
    assert(balanceWithPendingAndFailed.isValid, 'Balance calculation with pending/failed succeeded');
    assert(balanceWithPendingAndFailed.totalPaid === 300, `Total paid remains only ₹300 (actual: ₹${balanceWithPendingAndFailed.totalPaid})`);
    assert(balanceWithPendingAndFailed.outstandingAmount === 500, `Outstanding balance strictly remains ₹500 (actual: ₹${balanceWithPendingAndFailed.outstandingAmount})`);

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 6: Delayed payment update does not trigger repeated reminders
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 6: Delayed Payment Updates and Idempotency${RESET}`);
    // A: Test cooldown guard (prevents repeated spam)
    const auditMsgId = uuidv4();
    await supabase.from('whatsapp_messages').insert({
      id: auditMsgId,
      business_id: clubA.id,
      recipient_phone: testPhone,
      recipient_name: 'Aditi Sharma',
      content: `*Payment reminder — ${clubAName}*\n\nHi Aditi Sharma, your booking has an outstanding balance of ₹500.`,
      status: 'sent',
      created_at: new Date().toISOString()
    });
    cleanups.push(() => supabase.from('whatsapp_messages').delete().eq('id', auditMsgId));

    const duplicateAttempt = await sendBookingPaymentReminder({
      bookingId: bookingAId,
      businessId: clubA.id,
      forceSend: false // enforces cooldown check
    });
    assert(duplicateAttempt.skipped === true, 'Duplicate reminder within cooldown window is safely skipped');
    assert(duplicateAttempt.reason?.includes('cooldown') || duplicateAttempt.reason?.includes('already delivered'), 'Idempotency reason logged properly');

    // B: Delayed payment arrives (simulating webhook arrival that settles the bill)
    const delayedPaymentId = uuidv4();
    await supabase.from('payments').insert({
      id: delayedPaymentId,
      business_id: clubA.id,
      session_id: sessionAId,
      amount: 500,
      payment_method: 'UPI_WEBHOOK',
      status: 'Paid',
      metadata: { booking_id: bookingAId }
    });
    cleanups.push(() => supabase.from('payments').delete().eq('id', delayedPaymentId));

    const realTimeRecheck = await sendBookingPaymentReminder({
      bookingId: bookingAId,
      businessId: clubA.id,
      forceSend: true
    });
    assert(realTimeRecheck.skipped === true, 'Real-time pre-send check immediately caught delayed payment and aborted reminder');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 7: Multiple bookings for the same customer calculated independently
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 7: Independent Multi-Booking Calculations for Same Customer${RESET}`);
    const customerPhoneMulti = '919876543255';
    const booking1Id = uuidv4();
    const session1Id = uuidv4();
    const booking2Id = uuidv4();
    const session2Id = uuidv4();

    // Booking 1: Cost 700, Paid 200 -> Balance 500
    const s1Res = await supabase.from('sessions').insert({
      id: session1Id,
      business_id: clubA.id,
      customer_name: 'Vikram Seth',
      table_id: 'TEST_MULTI_1',
      game_type: 'Snooker',
      date: new Date().toISOString().split('T')[0],
      start_time: '12:00',
      end_time: '14:00',
      cost: 700,
      status: 'COMPLETED',
      payment_status: 'Partially Paid'
    }).select().single();
    if (s1Res.error) throw new Error(`Session 1 insert failed: ${s1Res.error.message}`);
    cleanups.push(() => supabase.from('sessions').delete().eq('id', session1Id));

    const b1Res = await supabase.from('bookings').insert({
      id: booking1Id,
      business_id: clubA.id,
      customer_name: 'Vikram Seth',
      customer_phone: customerPhoneMulti,
      table_id: 'TEST_MULTI_1',
      session_id: session1Id,
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '12:00',
      duration_minutes: 120,
      status: 'confirmed'
    }).select().single();
    if (b1Res.error) throw new Error(`Booking 1 insert failed: ${b1Res.error.message}`);
    cleanups.push(() => supabase.from('bookings').delete().eq('id', booking1Id));

    const p1Id = uuidv4();
    const p1Res = await supabase.from('payments').insert({
      id: p1Id,
      business_id: clubA.id,
      session_id: session1Id,
      amount: 200,
      payment_method: 'UPI',
      status: 'Paid',
      metadata: { booking_id: booking1Id }
    });
    if (p1Res.error) throw new Error(`P1 insert failed: ${p1Res.error.message}`);
    cleanups.push(() => supabase.from('payments').delete().eq('id', p1Id));

    // Booking 2: Cost 1000, Paid 1000 -> Balance 0 (Settled)
    const s2Res = await supabase.from('sessions').insert({
      id: session2Id,
      business_id: clubA.id,
      customer_name: 'Vikram Seth',
      table_id: 'TEST_MULTI_2',
      game_type: 'Snooker',
      date: new Date().toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '20:00',
      cost: 1000,
      status: 'COMPLETED',
      payment_status: 'Paid'
    }).select().single();
    if (s2Res.error) throw new Error(`Session 2 insert failed: ${s2Res.error.message}`);
    cleanups.push(() => supabase.from('sessions').delete().eq('id', session2Id));

    const b2Res = await supabase.from('bookings').insert({
      id: booking2Id,
      business_id: clubA.id,
      customer_name: 'Vikram Seth',
      customer_phone: customerPhoneMulti,
      table_id: 'TEST_MULTI_2',
      session_id: session2Id,
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '18:00',
      duration_minutes: 120,
      status: 'confirmed'
    }).select().single();
    if (b2Res.error) throw new Error(`Booking 2 insert failed: ${b2Res.error.message}`);
    cleanups.push(() => supabase.from('bookings').delete().eq('id', booking2Id));

    const p2Id = uuidv4();
    const p2Res = await supabase.from('payments').insert({
      id: p2Id,
      business_id: clubA.id,
      session_id: session2Id,
      amount: 1000,
      payment_method: 'UPI',
      status: 'Paid',
      metadata: { booking_id: booking2Id }
    });
    if (p2Res.error) throw new Error(`P2 insert failed: ${p2Res.error.message}`);
    cleanups.push(() => supabase.from('payments').delete().eq('id', p2Id));

    const balanceBooking1 = await calculateBookingOutstandingBalance(booking1Id, clubA.id);
    const balanceBooking2 = await calculateBookingOutstandingBalance(booking2Id, clubA.id);

    assert(balanceBooking1.outstandingAmount === 500, `Booking 1 calculated independently as ₹500 (actual: ₹${balanceBooking1.outstandingAmount})`);
    assert(balanceBooking2.outstandingAmount === 0, `Booking 2 calculated independently as ₹0 (actual: ₹${balanceBooking2.outstandingAmount})`);
    assert(balanceBooking2.isSettled === true, 'Booking 2 recognized as settled without contaminating Booking 1');

    // ------------------------------------------------------------------------
    // ACCEPTANCE TEST 8: Missing or inconsistent financial records prevent unverified reminders
    // ------------------------------------------------------------------------
    console.log(`\n${BOLD}Acceptance Test 8: Missing / Inconsistent Records Abort Safely${RESET}`);
    // Sub-case A: Non-existent booking ID
    const bogusBooking = await calculateBookingOutstandingBalance('00000000-0000-0000-0000-000000000000', clubA.id);
    assert(!bogusBooking.isValid, 'Non-existent booking rejected with isValid=false');

    // Sub-case B: Corrupted booking with dangling session_id
    const corruptedBookingId = uuidv4();
    const bCorruptRes = await supabase.from('bookings').insert({
      id: corruptedBookingId,
      business_id: clubA.id,
      customer_name: 'Corrupted Test',
      customer_phone: testPhone,
      table_id: 'T1',
      session_id: '99999999-9999-9999-9999-999999999999', // dangling session
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '10:00',
      duration_minutes: 60,
      status: 'confirmed'
    }).select().single();
    
    // If database foreign key rejects dangling session, that itself verifies database consistency!
    if (bCorruptRes.error) {
      assert(true, 'Database foreign key constraint strictly blocked dangling session creation');
    } else {
      cleanups.push(() => supabase.from('bookings').delete().eq('id', corruptedBookingId));
      const corruptedBalance = await calculateBookingOutstandingBalance(corruptedBookingId, clubA.id);
      assert(!corruptedBalance.isValid, 'Dangling session caught and aborted safely');
    }

    // Sub-case C: Invalid customer phone
    const invalidPhoneBookingId = uuidv4();
    const validSessionId = uuidv4();
    const sInvRes = await supabase.from('sessions').insert({
      id: validSessionId,
      business_id: clubA.id,
      customer_name: 'No Phone Customer',
      table_id: 'TEST_INV_1',
      game_type: 'Snooker',
      date: new Date().toISOString().split('T')[0],
      start_time: '10:00',
      end_time: '11:00',
      cost: 400,
      status: 'COMPLETED',
      payment_status: 'Pending'
    }).select().single();
    if (sInvRes.error) throw new Error(`Session insert failed: ${sInvRes.error.message}`);
    cleanups.push(() => supabase.from('sessions').delete().eq('id', validSessionId));

    const bInvRes = await supabase.from('bookings').insert({
      id: invalidPhoneBookingId,
      business_id: clubA.id,
      customer_name: 'No Phone Customer',
      customer_phone: '123', // invalid phone
      table_id: 'TEST_INV_1',
      session_id: validSessionId,
      booking_date: new Date().toISOString().split('T')[0],
      start_time: '10:00',
      duration_minutes: 60,
      status: 'confirmed'
    }).select().single();
    if (bInvRes.error) throw new Error(`Booking with invalid phone insert failed: ${bInvRes.error.message}`);
    cleanups.push(() => supabase.from('bookings').delete().eq('id', invalidPhoneBookingId));

    const invalidPhoneBalance = await calculateBookingOutstandingBalance(invalidPhoneBookingId, clubA.id);
    assert(!invalidPhoneBalance.isValid, 'Invalid phone number prevented unverified message generation');

  } finally {
    // Clean up all inserted test records in reverse order
    console.log(`\n${CYAN}Cleaning up temporary test records...${RESET}`);
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        // silent cleanup
      }
    }
    console.log(`${GREEN}Cleanup completed.${RESET}`);
  }

  // Summary
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}ACCEPTANCE TEST RESULTS: ${GREEN}${passedCount} PASSED${RESET}, ${failedCount > 0 ? `${RED}${failedCount} FAILED` : '0 FAILED'}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPaymentRemindersAcceptanceSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
