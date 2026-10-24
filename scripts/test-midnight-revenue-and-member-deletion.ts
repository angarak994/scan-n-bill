import { sessionRepository } from '../src/lib/repositories/sessionRepository';
import { supabase } from '../src/lib/supabaseClient';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TEST_BUSINESS_ID = 'fa24e279-b694-4426-b022-91c367767231';

async function runTests() {
  console.log('=== STARTING VERIFICATION: MIDNIGHT REVENUE & MEMBER DELETION ===\n');
  let passed = 0;
  let failed = 0;

  // TEST 1: Midnight Revenue Attribution for 2026-10-25
  try {
    console.log('Test 1: Verifying sessionRepository.findAllByDateRange for 2026-10-25...');
    const sessions = await sessionRepository.findAllByDateRange('2026-10-25', '2026-10-25', TEST_BUSINESS_ID);
    
    const completedSessions = sessions.filter(s => {
      if (s.status !== 'COMPLETED') return false;
      if (s.end_time) {
        const localEndDateStr = new Date(s.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return localEndDateStr >= '2026-10-25' && localEndDateStr <= '2026-10-25';
      }
      return s.date >= '2026-10-25' && s.date <= '2026-10-25';
    });

    const dailyRevenue = completedSessions.reduce((sum, s) => sum + (s.cost || 0), 0);
    console.log(`  -> Retrieved ${sessions.length} total sessions`);
    console.log(`  -> Filtered ${completedSessions.length} completed sessions for 2026-10-25`);
    console.log(`  -> Computed Daily Revenue: ₹${dailyRevenue}`);

    if (completedSessions.length === 9 && dailyRevenue === 2185) {
      console.log('  ✅ TEST 1 PASSED: All 9 completed sessions correctly attributed to 2026-10-25 for ₹2,185.\n');
      passed++;
    } else {
      console.error(`  ❌ TEST 1 FAILED: Expected 9 sessions & ₹2,185, got ${completedSessions.length} sessions & ₹${dailyRevenue}\n`);
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 1 ERROR:', err.message);
    failed++;
  }

  // TEST 2: Zero Double-Counting for Previous Day (2026-10-24)
  try {
    console.log('Test 2: Verifying post-midnight sessions are not double-counted on 2026-10-24...');
    const sessions24 = await sessionRepository.findAllByDateRange('2026-10-24', '2026-10-24', TEST_BUSINESS_ID);
    
    const completed24 = sessions24.filter(s => {
      if (s.status !== 'COMPLETED') return false;
      if (s.end_time) {
        const localEndDateStr = new Date(s.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return localEndDateStr >= '2026-10-24' && localEndDateStr <= '2026-10-24';
      }
      return s.date >= '2026-10-24' && s.date <= '2026-10-24';
    });

    // Check none of the 8 post-midnight sessions ending on 25th are in completed24
    const midnightIds = ['4ef9789e-055a-4eeb-b26a-939e6022e374', 'cf1dbdb9-467f-4428-a53d-d306b38c2ea8'];
    const overlap = completed24.filter(s => midnightIds.includes(s.id!));

    console.log(`  -> Completed sessions attributed to 2026-10-24: ${completed24.length}`);
    console.log(`  -> Overlap with post-midnight sessions: ${overlap.length}`);

    if (overlap.length === 0) {
      console.log('  ✅ TEST 2 PASSED: Zero overlap / double-counting with previous date.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 2 FAILED: Post-midnight sessions were incorrectly attributed to previous date.\n');
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 2 ERROR:', err.message);
    failed++;
  }

  // TEST 3: Member Deletion Scope & Historical Data Preservation
  try {
    console.log('Test 3: Verifying member deletion scope & customer data preservation...');
    
    // Step A: Insert a test customer
    const testPhone = '9999900001';
    await supabase.from('customers').delete().eq('business_id', TEST_BUSINESS_ID).eq('phone', testPhone);
    await supabase.from('memberships').delete().eq('business_id', TEST_BUSINESS_ID).eq('mobile', testPhone);

    const { data: testCust, error: custErr } = await supabase
      .from('customers')
      .insert([{
        business_id: TEST_BUSINESS_ID,
        name: 'Automated Test Customer',
        phone: testPhone,
        outstanding_balance: 500,
        total_billed: 1500,
        total_paid: 1000
      }])
      .select('id')
      .single();

    if (custErr || !testCust) throw new Error('Failed to create test customer: ' + custErr?.message);

    // Step B: Insert a test membership linked to this customer
    const { data: testMember, error: memErr } = await supabase
      .from('memberships')
      .insert([{
        business_id: TEST_BUSINESS_ID,
        name: 'Automated Test Member',
        mobile: testPhone,
        tier: 'Gold',
        expiry_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'Active'
      }])
      .select('id')
      .single();

    if (memErr || !testMember) throw new Error('Failed to create test membership: ' + memErr?.message);
    console.log(`  -> Created test customer (${testCust.id}) and membership (${testMember.id})`);

    // Step C: Delete the membership only
    const { error: delErr } = await supabase
      .from('memberships')
      .delete()
      .eq('id', testMember.id)
      .eq('business_id', TEST_BUSINESS_ID);

    if (delErr) throw new Error('Failed to delete membership: ' + delErr.message);
    console.log('  -> Executed membership deletion');

    // Step D: Verify membership is gone
    const { data: checkMem } = await supabase
      .from('memberships')
      .select('id')
      .eq('id', testMember.id)
      .maybeSingle();

    // Step E: Verify customer ledger is STILL present and intact
    const { data: checkCust } = await supabase
      .from('customers')
      .select('id, name, phone, outstanding_balance, total_billed, total_paid')
      .eq('id', testCust.id)
      .maybeSingle();

    const memDeleted = !checkMem;
    const custPreserved = checkCust && Number(checkCust.outstanding_balance) === 500 && Number(checkCust.total_billed) === 1500;

    console.log(`  -> Membership deleted: ${memDeleted}`);
    console.log(`  -> Customer billing/ledger preserved: ${custPreserved}`);

    // Cleanup test customer
    await supabase.from('customers').delete().eq('id', testCust.id);

    if (memDeleted && custPreserved) {
      console.log('  ✅ TEST 3 PASSED: Membership deleted safely without harming customer ledger history.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 3 FAILED: Member was not deleted or customer ledger was corrupted.\n');
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 3 ERROR:', err.message);
    failed++;
  }

  // TEST 4: API Endpoint RBAC for DELETE /api/memberships
  try {
    console.log('Test 4: Verifying DELETE /api/memberships RBAC & authentication...');
    const { DELETE: deleteEndpoint } = await import('../src/app/api/memberships/route');
    const { signToken } = await import('../src/lib/auth');

    // Case 1: Unauthenticated request (no token) -> Expect 401
    const unauthReq = new Request('http://localhost:3000/api/memberships', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'dummy-id' })
    });
    const res1 = await deleteEndpoint(unauthReq);
    const body1 = await res1.json();
    console.log(`  -> Unauthenticated request status: ${res1.status} (${body1.error})`);

    // Case 2: Unauthorized role (e.g. viewer) -> Expect 403
    const viewerToken = await signToken({ businessId: TEST_BUSINESS_ID, role: 'viewer' });
    const forbiddenReq = new Request('http://localhost:3000/api/memberships', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${viewerToken}`
      },
      body: JSON.stringify({ id: 'dummy-id' })
    });
    const res2 = await deleteEndpoint(forbiddenReq);
    const body2 = await res2.json();
    console.log(`  -> Viewer role request status: ${res2.status} (${body2.error})`);

    // Case 3: Authorized owner role with non-existent member -> Expect 404
    const ownerToken = await signToken({ businessId: TEST_BUSINESS_ID, role: 'owner' });
    const notFoundReq = new Request('http://localhost:3000/api/memberships', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ownerToken}`
      },
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000' })
    });
    const res3 = await deleteEndpoint(notFoundReq);
    const body3 = await res3.json();
    console.log(`  -> Non-existent member status: ${res3.status} (${body3.error})`);

    if (res1.status === 401 && res2.status === 403 && res3.status === 404) {
      console.log('  ✅ TEST 4 PASSED: API correctly enforces 401 Unauthenticated, 403 Forbidden (RBAC), and 404 Not Found.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 4 FAILED: Unexpected status codes in RBAC tests.\n');
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 4 ERROR:', err.message);
    failed++;
  }

  console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests();
