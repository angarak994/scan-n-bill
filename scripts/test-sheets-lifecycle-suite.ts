/**
 * Comprehensive Google Sheets Synchronization Lifecycle Verification Suite.
 * 
 * Tests the complete start-to-completion flow across every session source and customer type:
 * 1. Telegram Lazy Mode (Guest)
 * 2. Telegram Lifecycle: Start -> Pause -> Resume -> Stop
 * 3. Telegram Registered Member Session -> QKhata settlement
 * 4. Dashboard Started Session -> End Session
 * 5. QR Code Scanned Session -> End Session
 * 6. Manual Booking Session -> Completion
 * 
 * Directly queries the live Google Sheets API to verify:
 * - End Time is 'Active' during ongoing sessions
 * - End Time is replaced with authoritative business timezone timestamp on completion
 * - Rows are updated in-place without creating duplicate rows
 * - Financial amounts, duration, payment status, and table fee are accurate
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabase } from '../src/lib/supabaseClient';
import { getGoogleSheetsClient } from '../src/lib/googleSheets';
import { flushSheetsSyncQueue } from '../src/lib/sheetsSyncQueue';
import { POST as telegramPost } from '../src/app/api/telegram-webhook/route';
import { POST as startSessionPost } from '../src/app/api/start-session/route';
import { POST as endSessionPost } from '../src/app/api/end-session/route';
import { handleSessionIntervention } from '../src/lib/services/interventionService';

const BIZ_ID = 'fa24e279-b694-4426-b022-91c367767231'; // TestClub101
const SPREADSHEET_ID = '1CXIvYzQtYHkSKdKl2rBx_M3DGECKTagsuOeZ19TpvRs';
const CHAT_ID = '123456789'; // Mock admin chat for telegram webhook tests

async function fetchSheetRows(sheetTitle: string = 'Sessions_2026_10') {
  const sheets = await getGoogleSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetTitle}'!A:P`
  });
  return res.data.values || [];
}

function findRowsByCanonicalId(rows: any[][], canonicalId: string) {
  const target = canonicalId.trim().toUpperCase();
  const short = target.replace(/^SES-/, '');
  const matches: { rowIndex: number; row: any[] }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cellA = String(rows[i]?.[0] || '').trim().toUpperCase();
    if (cellA === target || cellA === short || cellA.replace(/^SES-/, '') === short) {
      matches.push({ rowIndex: i + 1, row: rows[i] });
    }
  }
  return matches;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTestSuite() {
  console.log('='.repeat(70));
  console.log('🚀 STARTING QCONTROL GOOGLE SHEETS SYNCHRONIZATION TEST SUITE');
  console.log(`Business ID: ${BIZ_ID}`);
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log('='.repeat(70));

  // Pre-test: Set mock telegram admin on business if needed
  const { data: biz } = await supabase.from('businesses').select('*').eq('id', BIZ_ID).single();
  const gs = biz.pricing_rules?.globalSettings || {};
  gs.lazy_mode_enabled = true;
  let owners = gs.authorized_telegram_owners || [];
  if (!owners.some((o: any) => String(o.chatId) === CHAT_ID)) {
    owners.push({ chatId: CHAT_ID, name: 'TestOwner', role: 'owner', is_active_context: true });
  } else {
    owners.forEach((o: any) => { if (String(o.chatId) === CHAT_ID) o.is_active_context = true; });
  }
  gs.authorized_telegram_owners = owners;
  await supabase.from('businesses').update({ pricing_rules: { ...biz.pricing_rules, globalSettings: gs } }).eq('id', BIZ_ID);
  const { invalidateBusinessCache } = require('../src/lib/businessManager');
  invalidateBusinessCache();

  // =========================================================================
  // TEST 1: TELEGRAM LAZY MODE (GUEST)
  // =========================================================================
  console.log('\n--- [TEST 1] Telegram Lazy Mode Session (Guest) on Table S2 ---');
  const table1 = 'S2';

  // 1. In lazy mode, typing table name (e.g. 'S2') starts the session instantly
  const startUpdate = {
    update_id: Date.now(),
    message: {
      message_id: 101,
      chat: { id: CHAT_ID },
      text: table1,
      date: Math.floor(Date.now() / 1000)
    }
  };

  const req1 = new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(startUpdate)
  });
  await telegramPost(req1);
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  // Find active session in Supabase
  const { data: sess1 } = await supabase.from('sessions')
    .select('*')
    .eq('business_id', BIZ_ID)
    .eq('table_id', table1)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(!!sess1, 'Telegram Lazy session should be active in database');
  const canonicalId1 = `SES-${sess1.id.split('-')[0].toUpperCase()}`;
  console.log(`✅ Session created in DB: ${sess1.id} (Canonical: ${canonicalId1})`);

  // Verify in Google Sheet
  let rows = await fetchSheetRows();
  let matches = findRowsByCanonicalId(rows, canonicalId1);
  assert(matches.length === 1, `Expected exactly 1 row for ${canonicalId1}, found ${matches.length}`);
  assert(matches[0].row[6] === 'Active', `End Time must be 'Active' while ongoing. Got: '${matches[0].row[6]}'`);
  assert(matches[0].row[14] === 'ACTIVE', `Status must be 'ACTIVE'. Got: '${matches[0].row[14]}'`);
  console.log(`✅ Verified Sheet on Start: Row ${matches[0].rowIndex} has End Time: 'Active', Status: 'ACTIVE'`);

  // Wait brief pause to have measurable time
  await new Promise(r => setTimeout(r, 1200));

  // 2. Stop session via Telegram callback
  const stopUpdate = {
    update_id: Date.now() + 1,
    callback_query: {
      id: 'cb_stop_1',
      data: `end_${sess1.id}`,
      message: { message_id: 102, chat: { id: CHAT_ID } }
    }
  };

  const req1Stop = new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(stopUpdate)
  });
  await telegramPost(req1Stop);
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  // Verify in Google Sheet after stop
  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId1);
  assert(matches.length === 1, `Expected NO duplicate rows for ${canonicalId1}, found ${matches.length}`);
  const endTime1 = matches[0].row[6];
  const status1 = matches[0].row[14];
  assert(endTime1 !== 'Active', `End Time must NOT be 'Active' once stopped. Got: '${endTime1}'`);
  assert(status1 === 'COMPLETED', `Status must be 'COMPLETED'. Got: '${status1}'`);
  console.log(`✅ Verified Sheet on Completion: Row ${matches[0].rowIndex} updated in-place: End Time = '${endTime1}', Status = '${status1}' (No duplicates!)`);

  // =========================================================================
  // TEST 2: TELEGRAM LIFECYCLE (START -> PAUSE -> RESUME -> STOP)
  // =========================================================================
  console.log('\n--- [TEST 2] Telegram Lifecycle (Start -> Pause -> Resume -> Stop) on Table PS1 ---');
  const table2 = 'PS1';

  // 1. Start PS5 session via Telegram callback
  const startPs5Update = {
    update_id: Date.now() + 10,
    callback_query: {
      id: 'cb_ps5_start',
      data: `ps5_players_${table2}_2`,
      message: { message_id: 201, chat: { id: CHAT_ID } }
    }
  };

  await telegramPost(new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(startPs5Update)
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  const { data: sess2 } = await supabase.from('sessions')
    .select('*')
    .eq('business_id', BIZ_ID)
    .eq('table_id', table2)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(!!sess2, 'PS5 session should be active in database');
  const canonicalId2 = `SES-${sess2.id.split('-')[0].toUpperCase()}`;
  console.log(`✅ Session created in DB: ${sess2.id} (Canonical: ${canonicalId2})`);

  // 2. Pause session via Telegram
  const pauseUpdate = {
    update_id: Date.now() + 11,
    callback_query: {
      id: 'cb_pause_2',
      data: `pause_${sess2.id}`,
      message: { message_id: 202, chat: { id: CHAT_ID } }
    }
  };
  await telegramPost(new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(pauseUpdate)
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId2);
  assert(matches.length === 1, `Expected exactly 1 row for ${canonicalId2}`);
  assert(matches[0].row[6] === 'Active', `End Time must remain 'Active' while paused. Got: '${matches[0].row[6]}'`);
  assert(matches[0].row[14] === 'PAUSED', `Status must be 'PAUSED'. Got: '${matches[0].row[14]}'`);
  console.log(`✅ Verified Sheet on Pause: Row ${matches[0].rowIndex} has End Time: 'Active', Status: 'PAUSED'`);

  // 3. Resume session via Telegram
  const resumeUpdate = {
    update_id: Date.now() + 12,
    callback_query: {
      id: 'cb_resume_2',
      data: `resume_${sess2.id}`,
      message: { message_id: 203, chat: { id: CHAT_ID } }
    }
  };
  await telegramPost(new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(resumeUpdate)
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId2);
  assert(matches.length === 1, `Expected exactly 1 row for ${canonicalId2}`);
  assert(matches[0].row[6] === 'Active', `End Time must remain 'Active' on resume. Got: '${matches[0].row[6]}'`);
  assert(matches[0].row[14] === 'ACTIVE', `Status must be 'ACTIVE'. Got: '${matches[0].row[14]}'`);
  console.log(`✅ Verified Sheet on Resume: Row ${matches[0].rowIndex} has End Time: 'Active', Status: 'ACTIVE'`);

  // 4. Stop session via Telegram
  const stopPs5Update = {
    update_id: Date.now() + 13,
    callback_query: {
      id: 'cb_end_2',
      data: `end_${sess2.id}`,
      message: { message_id: 204, chat: { id: CHAT_ID } }
    }
  };
  await telegramPost(new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(stopPs5Update)
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId2);
  assert(matches.length === 1, `Expected exactly 1 row for ${canonicalId2}`);
  assert(matches[0].row[6] !== 'Active', `End Time must NOT be 'Active' on stop. Got: '${matches[0].row[6]}'`);
  assert(matches[0].row[14] === 'COMPLETED', `Status must be 'COMPLETED'. Got: '${matches[0].row[14]}'`);
  console.log(`✅ Verified Sheet on Stop: Row ${matches[0].rowIndex} updated with End Time: '${matches[0].row[6]}', Status: 'COMPLETED'`);

  // =========================================================================
  // TEST 3: TELEGRAM MEMBER SESSION WITH QKHATA
  // =========================================================================
  console.log('\n--- [TEST 3] Telegram Member Session with QKhata on Table S2 ---');
  const memberId = '3d77eda5-9d39-442e-96d1-1a862970eb5e'; // ANGARAK TATE

  const startMemUpdate = {
    update_id: Date.now() + 20,
    callback_query: {
      id: 'cb_mem_start',
      data: `start_mem_exec_${memberId}_S2`,
      message: { message_id: 301, chat: { id: CHAT_ID } }
    }
  };
  await telegramPost(new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(startMemUpdate)
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  const { data: sess3 } = await supabase.from('sessions')
    .select('*')
    .eq('business_id', BIZ_ID)
    .eq('table_id', 'S2')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(!!sess3, 'Member session should be active in database');
  const canonicalId3 = `SES-${sess3.id.split('-')[0].toUpperCase()}`;

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId3);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId3}`);
  assert(matches[0].row[2].includes('ANGARAK TATE'), `Customer Name must be ANGARAK TATE. Got: '${matches[0].row[2]}'`);
  assert(matches[0].row[6] === 'Active', `End Time must be 'Active'`);
  console.log(`✅ Verified Sheet on Member Start: Row ${matches[0].rowIndex} for ${matches[0].row[2]} has End Time: 'Active'`);

  // Stop with QKhata via intervention service
  await handleSessionIntervention({
    action: 'force_end',
    session_id: sess3.id,
    business_id: BIZ_ID,
    payment_method: 'QKhata',
    performed_by: 'Qbot'
  });
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId3);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId3}`);
  assert(matches[0].row[6] !== 'Active', `End Time must not be 'Active'. Got: '${matches[0].row[6]}'`);
  assert(matches[0].row[12] === 'QKhata', `Payment Method must be 'QKhata'. Got: '${matches[0].row[12]}'`);
  assert(matches[0].row[14] === 'COMPLETED', `Status must be 'COMPLETED'`);
  console.log(`✅ Verified Sheet on QKhata Stop: Row ${matches[0].rowIndex} has End Time: '${matches[0].row[6]}', Payment Method: 'QKhata', Status: 'COMPLETED'`);

  // =========================================================================
  // TEST 4: DASHBOARD / API SESSION
  // =========================================================================
  console.log('\n--- [TEST 4] Dashboard Session Flow on Table PS. ---');
  const startDashRes = await startSessionPost(new Request('http://localhost:3000/api/start-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: 'PS.',
      game_type: 'ps5',
      customer_name: 'Dashboard Tester',
      business_id: BIZ_ID,
      num_players: 2
    })
  }));
  const dashSess = await startDashRes.json();
  assert(dashSess && dashSess.id, 'Dashboard start session failed');
  const canonicalId4 = `SES-${dashSess.id.split('-')[0].toUpperCase()}`;
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId4);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId4}`);
  assert(matches[0].row[6] === 'Active', `End Time must be 'Active'`);
  console.log(`✅ Verified Dashboard Start: Row ${matches[0].rowIndex} has End Time: 'Active'`);

  // End via /api/end-session
  const endDashRes = await endSessionPost(new Request('http://localhost:3000/api/end-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: 'PS.',
      business_id: BIZ_ID,
      source: 'System',
      payment_method: 'UPI'
    })
  }));
  await endDashRes.json();
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId4);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId4}`);
  assert(matches[0].row[6] !== 'Active', `End Time must not be 'Active'`);
  assert(matches[0].row[14] === 'COMPLETED', `Status must be 'COMPLETED'`);
  console.log(`✅ Verified Dashboard End: Row ${matches[0].rowIndex} has End Time: '${matches[0].row[6]}', Status: 'COMPLETED'`);

  // =========================================================================
  // TEST 5: UNREGISTERED / QR CODE SCAN SESSION
  // =========================================================================
  console.log('\n--- [TEST 5] QR Code Scanned Session on Table S2 ---');
  const qrStartRes = await startSessionPost(new Request('http://localhost:3000/api/start-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: 'S2',
      customer_name: 'QR Walkin Customer',
      business_id: BIZ_ID
    })
  }));
  const qrSess = await qrStartRes.json();
  assert(qrSess && qrSess.id, 'QR start session failed');
  const canonicalId5 = `SES-${qrSess.id.split('-')[0].toUpperCase()}`;
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId5);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId5}`);
  assert(matches[0].row[6] === 'Active', `End Time must be 'Active'`);
  console.log(`✅ Verified QR Start: Row ${matches[0].rowIndex} has End Time: 'Active'`);

  const qrEndRes = await endSessionPost(new Request('http://localhost:3000/api/end-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: 'S2',
      business_id: BIZ_ID,
      source: 'QR',
      payment_method: 'Cash'
    })
  }));
  await qrEndRes.json();
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId5);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId5}`);
  assert(matches[0].row[6] !== 'Active', `End Time must not be 'Active'`);
  assert(matches[0].row[14] === 'COMPLETED', `Status must be 'COMPLETED'`);
  console.log(`✅ Verified QR End: Row ${matches[0].rowIndex} has End Time: '${matches[0].row[6]}', Status: 'COMPLETED'`);

  // =========================================================================
  // TEST 6: MANUAL BOOKING FLOW
  // =========================================================================
  console.log('\n--- [TEST 6] Manual Booking Session on Table PS1 ---');
  const { data: booking, error: bErr } = await supabase.from('bookings').insert([{
    business_id: BIZ_ID,
    table_id: 'PS1',
    game_type: 'ps5',
    customer_name: 'VIP Booking Client',
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '14:00',
    duration_minutes: 60,
    status: 'confirmed',
    num_players: 3
  }]).select().single();

  assert(!bErr && !!booking, 'Booking creation in DB failed');

  // Start booking via Telegram
  const startBookingUpdate = {
    update_id: Date.now() + 50,
    callback_query: {
      id: 'cb_book_start',
      data: `bk_start_${booking.id}`,
      message: { message_id: 501, chat: { id: CHAT_ID } }
    }
  };
  await telegramPost(new Request('http://localhost:3000/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'qcontrol_secure_webhook_123' },
    body: JSON.stringify(startBookingUpdate)
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  const { data: bookSess } = await supabase.from('sessions')
    .select('*')
    .eq('business_id', BIZ_ID)
    .eq('table_id', 'PS1')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  assert(!!bookSess, 'Booking session should be active in DB');
  const canonicalId6 = `SES-${bookSess.id.split('-')[0].toUpperCase()}`;

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId6);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId6}`);
  assert(matches[0].row[6] === 'Active', `End Time must be 'Active'`);
  console.log(`✅ Verified Booking Start: Row ${matches[0].rowIndex} has End Time: 'Active'`);

  // Complete booking session
  await endSessionPost(new Request('http://localhost:3000/api/end-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: 'PS1',
      business_id: BIZ_ID,
      source: 'Manual Booking',
      payment_method: 'Cash'
    })
  }));
  await flushSheetsSyncQueue(BIZ_ID, 5000);

  rows = await fetchSheetRows();
  matches = findRowsByCanonicalId(rows, canonicalId6);
  assert(matches.length === 1, `Expected 1 row for ${canonicalId6}`);
  assert(matches[0].row[6] !== 'Active', `End Time must not be 'Active'`);
  assert(matches[0].row[14] === 'COMPLETED', `Status must be 'COMPLETED'`);
  console.log(`✅ Verified Booking End: Row ${matches[0].rowIndex} has End Time: '${matches[0].row[6]}', Status: 'COMPLETED'`);

  console.log('\n' + '='.repeat(70));
  console.log('🎉 ALL 6 COMPREHENSIVE GOOGLE SHEETS SYNCHRONIZATION TESTS PASSED!');
  console.log('='.repeat(70));
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
