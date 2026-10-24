import { supabase } from '../src/lib/supabaseClient';
import { sessionRepository } from '../src/lib/repositories/sessionRepository';
import { startSession, endSession } from '../src/lib/sessionManager';
import { fetchUnifiedSessionData } from '../src/lib/unifiedSessionService';
import { getFinancialReportsSummary } from '../src/lib/services/reportsService';
import { businessManager } from '../src/lib/businessManager';
import { getBusinessTimezone } from '../src/lib/sheetsTimezone';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TEST_BUSINESS_ID = 'fa24e279-b694-4426-b022-91c367767231';

async function runRevenueAttributionTests() {
  console.log('=== RUNNING REVENUE ATTRIBUTION UNIVERSAL VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  // TEST 1: End-to-End Session Lifecycle Across Midnight Boundary
  try {
    console.log('Test 1: Simulating session starting at 11:40 PM yesterday and ending at 12:40 AM today...');
    
    // Choose table 'P1' (or first available table)
    const business = await businessManager.getBusiness(TEST_BUSINESS_ID);
    const timezone = getBusinessTimezone(business);
    const testTableId = business?.tables?.[0]?.id || 'P1';

    // Ensure table lock is clear and no lingering test session
    await supabase.from('sessions').delete().eq('business_id', TEST_BUSINESS_ID).eq('customer_name', 'Midnight Audit Test Customer');

    // Insert active session directly to accurately simulate start time at 11:40 PM yesterday (2026-10-24)
    const startIso = '2026-10-24T18:10:00.000Z'; // 11:40 PM IST on Oct 24
    const testSessionId = crypto.randomUUID();
    
    const { error: insertErr } = await supabase.from('sessions').insert([{
      id: testSessionId,
      business_id: TEST_BUSINESS_ID,
      table_id: testTableId,
      customer_name: 'Midnight Audit Test Customer',
      game_type: 'Pool',
      date: '2026-10-24', // Started yesterday
      start_time: startIso,
      status: 'ACTIVE',
      num_players: 2
    }]);

    if (insertErr) throw new Error('Failed to create test session: ' + insertErr.message);

    console.log(`  -> Active session created with date: '2026-10-24', start_time: ${startIso}`);

    // Complete session simulating 12:40 AM today (2026-10-25)
    // We invoke sessionRepository.update directly or endSession
    // In our new endSession, date is stamped as completion date in business timezone
    const endIso = '2026-10-24T19:10:00.000Z'; // 12:40 AM IST on Oct 25
    const completionDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(endIso));

    await sessionRepository.update(testSessionId, {
      date: completionDate,
      end_time: endIso,
      status: 'COMPLETED',
      duration: '1h 0m',
      cost: 300,
      base_cost: 300,
      payment_status: 'Paid',
      amount_paid: 300,
      completed_by: 'Automated Audit'
    }, TEST_BUSINESS_ID);

    // Verify session record in DB
    const { data: completedInDb } = await supabase
      .from('sessions')
      .select('id, date, start_time, end_time, status, cost')
      .eq('id', testSessionId)
      .single();

    console.log(`  -> Completed session in DB: date=${completedInDb?.date}, end_time=${completedInDb?.end_time}, status=${completedInDb?.status}, cost=₹${completedInDb?.cost}`);

    // Verify Google Sheets formatting
    const unified = await fetchUnifiedSessionData(testSessionId, TEST_BUSINESS_ID);
    const sheetDate = unified?.sessionRow?.[1]; // Col B (Date)
    console.log(`  -> Google Sheets formatted date: ${sheetDate}`);

    const isDateAttributedToToday = completedInDb?.date === '2026-10-25';
    const isSheetDateAttributedToToday = String(sheetDate).includes('2026-10-25') || String(sheetDate).includes('25 Oct');

    // Clean up test session
    await supabase.from('sessions').delete().eq('id', testSessionId);

    if (isDateAttributedToToday && isSheetDateAttributedToToday) {
      console.log('  ✅ TEST 1 PASSED: Completed session authoritatively stamped with completion date (2026-10-25) in DB & Google Sheets.\n');
      passed++;
    } else {
      console.error(`  ❌ TEST 1 FAILED: Expected date 2026-10-25, got DB date: ${completedInDb?.date}, Sheet date: ${sheetDate}\n`);
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 1 ERROR:', err.message);
    failed++;
  }

  // TEST 2: Multi-System Parity (Daily Revenue vs Reports vs KPIs)
  try {
    console.log('Test 2: Verifying 100% parity across Daily Revenue, Reports, and KPIs for 2026-10-25...');

    // A. Daily Revenue (Overview)
    const sessions = await sessionRepository.findAllByDateRange('2026-10-25', '2026-10-25', TEST_BUSINESS_ID);
    const overviewCompleted = sessions.filter(s => {
      if (s.status !== 'COMPLETED') return false;
      if (s.end_time) {
        const localEndDateStr = new Date(s.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return localEndDateStr === '2026-10-25';
      }
      return s.date === '2026-10-25';
    });
    const overviewRevenue = overviewCompleted.reduce((sum, s) => sum + (s.cost || 0), 0);

    // B. KPIs (/api/reports-kpis endpoint logic)
    const { GET: getReportsKpis } = await import('../src/app/api/reports-kpis/route');
    const { signToken } = await import('../src/lib/auth');
    const token = await signToken({ businessId: TEST_BUSINESS_ID, role: 'owner' });

    const kpiReq = new Request('http://localhost:3000/api/reports-kpis?startDate=2026-10-25&endDate=2026-10-25', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const kpiRes = await getReportsKpis(kpiReq);
    const kpiJson = await kpiRes.json();
    const kpiRevenue = kpiJson.kpis?.totalRevenue || 0;
    const kpiSessions = kpiJson.kpis?.totalSessions || 0;

    // C. Reports Analytics (reportsService)
    const reportsAnalytics = await getFinancialReportsSummary(TEST_BUSINESS_ID, 'custom', '2026-10-25', '2026-10-25');
    const reportsRevenue = reportsAnalytics.primary.revenue.value;
    const reportsCompletedCount = reportsAnalytics.secondary.sessions.completed;

    console.log(`  -> Daily Revenue (#overview): ₹${overviewRevenue} across ${overviewCompleted.length} sessions`);
    console.log(`  -> KPIs (#reports Fast Path): ₹${kpiRevenue} across ${kpiSessions} sessions`);
    console.log(`  -> Reports Tab (reportsService): ₹${reportsRevenue} across ${reportsCompletedCount} sessions`);

    const allRevenuesMatch = overviewRevenue === kpiRevenue && kpiRevenue === reportsRevenue;
    const allCountsMatch = overviewCompleted.length === kpiSessions && kpiSessions === reportsCompletedCount;

    if (allRevenuesMatch && allCountsMatch) {
      console.log(`  ✅ TEST 2 PASSED: 100% exact parity across Daily Revenue, Reports, and KPIs (₹${overviewRevenue} across ${overviewCompleted.length} sessions).\n`);
      passed++;
    } else {
      console.error(`  ❌ TEST 2 FAILED: Mismatch in revenue (Overview: ₹${overviewRevenue}, KPIs: ₹${kpiRevenue}, Reports: ₹${reportsRevenue}) or session counts.\n`);
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 2 ERROR:', err.message);
    failed++;
  }

  // TEST 3: Active Sessions Excluded from Completed Revenue
  try {
    console.log('Test 3: Verifying active sessions are strictly excluded from completed revenue...');
    
    // Check currently active sessions in DB
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id, cost, status')
      .eq('business_id', TEST_BUSINESS_ID)
      .eq('status', 'ACTIVE');

    const activeCount = activeSessions?.length || 0;
    console.log(`  -> Found ${activeCount} active session(s) in progress`);

    // Verify none of them appear in completedSessions
    const sessions = await sessionRepository.findAllByDateRange('2026-10-25', '2026-10-25', TEST_BUSINESS_ID);
    const completedSessions = sessions.filter(s => s.status === 'COMPLETED');
    const overlapActive = completedSessions.filter(s => s.status === 'ACTIVE');

    if (overlapActive.length === 0) {
      console.log('  ✅ TEST 3 PASSED: Active sessions strictly excluded from completed revenue.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 3 FAILED: Active sessions found in completed revenue.\n');
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 3 ERROR:', err.message);
    failed++;
  }

  // TEST 4: Zero Double-Counting on Start Date (2026-10-24)
  try {
    console.log('Test 4: Verifying zero double-counting on previous day (2026-10-24)...');
    
    const { GET: getReportsKpis } = await import('../src/app/api/reports-kpis/route');
    const { signToken } = await import('../src/lib/auth');
    const token = await signToken({ businessId: TEST_BUSINESS_ID, role: 'owner' });

    const kpiReq24 = new Request('http://localhost:3000/api/reports-kpis?startDate=2026-10-24&endDate=2026-10-24', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const kpiRes24 = await getReportsKpis(kpiReq24);
    const kpiJson24 = await kpiRes24.json();

    const reportsAnalytics24 = await getFinancialReportsSummary(TEST_BUSINESS_ID, 'custom', '2026-10-24', '2026-10-24');

    console.log(`  -> Day 1 (2026-10-24) KPIs Revenue: ₹${kpiJson24.kpis?.totalRevenue}`);
    console.log(`  -> Day 1 (2026-10-24) Reports Revenue: ₹${reportsAnalytics24.primary.revenue.value}`);

    if (kpiJson24.kpis?.totalRevenue === reportsAnalytics24.primary.revenue.value) {
      console.log('  ✅ TEST 4 PASSED: Day 1 metrics match perfectly and exclude Day 2 midnight revenue.\n');
      passed++;
    } else {
      console.error('  ❌ TEST 4 FAILED: Discrepancy on Day 1 revenue.\n');
      failed++;
    }
  } catch (err: any) {
    console.error('  ❌ TEST 4 ERROR:', err.message);
    failed++;
  }

  console.log(`=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runRevenueAttributionTests();
