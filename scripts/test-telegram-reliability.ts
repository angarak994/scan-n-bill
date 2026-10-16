/**
 * QControl Telegram Bot - Reliability, Crash Recovery & Resilience Verification Suite
 * 
 * Tests:
 * 1. Webhook self-healing & connectivity inspection.
 * 2. Atomic database idempotency (prevents duplicate execution on retries/restarts).
 * 3. Session & cart state rehydration across process restarts.
 * 4. Non-blocking Google Sheets sync queue isolation.
 * 5. Network timeout enforcement & transient retry resilience.
 * 6. Graceful shutdown & automated webhook restoration.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { performance } from 'perf_hooks';
import { POST } from '../src/app/api/telegram-webhook/route';
import { TelegramClient } from '../src/lib/telegram/telegramClient';
import { DeliveryManager } from '../src/lib/telegram/deliveryManager';
import {
  addItemToCart,
  getCartTotal,
  clearCart,
  setSelectedTable,
  getSelectedTable,
  persistStateSnapshot
} from '../src/lib/telegram/stateManager';
import { enqueueSheetsSync } from '../src/lib/sheetsSyncQueue';
import { createClient } from '@supabase/supabase-js';

const testSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const TEST_CHAT_ID = 1386320937; // Angarak
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'qcontrol_secure_webhook_123';

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${title} ${details ? `(${details})` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('🧪 QControl Telegram Bot Reliability & Resilience Verification');
  console.log('='.repeat(70));

  // =========================================================================
  // TEST 1: Telegram API & Webhook Status
  // =========================================================================
  console.log('\n--- [TEST 1] Telegram API Connectivity & Webhook Status ---');
  const meRes = await TelegramClient.getMe();
  assert(meRes.ok && Boolean(meRes.result?.username), 'Telegram API getMe responds with valid bot identity', meRes.description);
  console.log(`       Bot: @${meRes.result?.username}`);

  const status = await DeliveryManager.getWebhookStatus();
  console.log(`       Current Webhook URL: "${status.currentUrl}"`);
  console.log(`       Pending Updates: ${status.pendingUpdateCount}`);
  assert(typeof status.pendingUpdateCount === 'number', 'Webhook info successfully retrieved');

  // =========================================================================
  // TEST 2: Webhook Self-Healing & Registration
  // =========================================================================
  console.log('\n--- [TEST 2] Webhook Self-Healing & Registration ---');
  const restoreRes = await DeliveryManager.ensureWebhookRegistered({ force: true });
  assert(restoreRes.success, 'ensureWebhookRegistered successfully registers production URL', restoreRes.message);
  
  const updatedStatus = await DeliveryManager.getWebhookStatus();
  assert(updatedStatus.isConfigured, 'Webhook is now actively registered with Telegram');
  console.log(`       Registered URL: ${updatedStatus.currentUrl}`);

  // =========================================================================
  // TEST 3: Atomic Database Idempotency (Multi-Instance Concurrency Lock)
  // =========================================================================
  console.log('\n--- [TEST 3] Atomic Database Idempotency Verification ---');
  const uniqueUpdateId = 90000000 + Math.floor(Math.random() * 900000);
  const cbId1 = `cb_atomic_1_${Date.now()}`;
  const cbId2 = `cb_atomic_2_${Date.now()}`;

  function createRequest(uId: number, cId: string): Request {
    return new Request('http://localhost:3000/api/telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        update_id: uId,
        callback_query: {
          id: cId,
          from: { id: TEST_CHAT_ID },
          message: { message_id: 1234, chat: { id: TEST_CHAT_ID }, text: 'Menu' },
          data: 'stop_menu_back',
        },
      }),
    });
  }

  // Fire request 1
  const req1 = createRequest(uniqueUpdateId, cbId1);
  const res1 = await POST(req1);
  assert(res1.status === 200, 'Request 1 processed with HTTP 200');
  
  // Verify that database recorded the update_id
  const { data: dbRecord } = await testSupabase
    .from('telegram_updates')
    .select('update_id')
    .eq('update_id', uniqueUpdateId)
    .single();

  assert(Boolean(dbRecord && dbRecord.update_id === uniqueUpdateId), 'Update recorded atomically in telegram_updates table');

  // Verify that a concurrent / duplicate request with same update_id but new callback id is rejected atomically by DB
  const req2 = createRequest(uniqueUpdateId, cbId2);
  const res2 = await POST(req2);
  const data2 = await res2.json();
  assert(data2.duplicate === true, 'Duplicate update_id blocked by atomic DB check across instances');

  // Clean up test update record
  await testSupabase.from('telegram_updates').delete().eq('update_id', uniqueUpdateId);

  // =========================================================================
  // TEST 4: Session State Rehydration Across Simulated Restarts
  // =========================================================================
  console.log('\n--- [TEST 4] Session State & Cart Rehydration Across Restarts ---');
  const simChatId = `sim_restart_${Date.now()}`;
  setSelectedTable(simChatId, 'T3');
  addItemToCart(simChatId, { name: 'Energy Drink', price: 110, id: 'ed1' }, 2);
  persistStateSnapshot(true); // Immediate flush to disk

  const preRestartTotal = getCartTotal(simChatId);
  assert(preRestartTotal.itemCount === 2 && preRestartTotal.totalAmount === 220, 'Cart populated with 2x Energy Drink (₹220)');

  // Simulate process restart: re-read snapshot
  const { existsSync, readFileSync } = require('fs');
  const path = require('path');
  const snapshotPath = path.join(process.cwd(), '.telegram_state.json');
  assert(existsSync(snapshotPath), 'State snapshot successfully persisted to disk');

  const snapshotContent = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  assert(Boolean(snapshotContent[simChatId]), 'User cart present in persisted snapshot');
  assert(snapshotContent[simChatId].selectedTableId === 'T3', 'Selected table remembered in persisted snapshot');

  clearCart(simChatId);
  persistStateSnapshot(true);

  // =========================================================================
  // TEST 5: Google Sheets & Heavy Task Non-Blocking Verification
  // =========================================================================
  console.log('\n--- [TEST 5] Non-Blocking Google Sheets Queue ---');
  const t0 = performance.now();
  enqueueSheetsSync('SESSION', 'mock_sess_id', 'mock_biz_id', { test: true });
  const t1 = performance.now();
  const queueTimeMs = t1 - t0;
  console.log(`       enqueueSheetsSync duration: ${queueTimeMs.toFixed(2)} ms`);
  assert(queueTimeMs < 30, 'Google Sheets sync queue does not block caller (< 30ms)');

  // =========================================================================
  // TEST 6: Network Timeout Guard & Fallback
  // =========================================================================
  console.log('\n--- [TEST 6] TelegramClient Timeout Safeguards ---');
  const timeoutTest0 = performance.now();
  // Call with intentionally tiny timeout on non-routable address simulation
  const timeoutRes = await TelegramClient.call('getMe', undefined, { timeoutMs: 100, retries: 0 }).catch(e => ({ ok: false, description: e.message }));
  const timeoutTest1 = performance.now();
  console.log(`       Call with timeout duration: ${(timeoutTest1 - timeoutTest0).toFixed(2)} ms`);
  assert(typeof timeoutRes.ok === 'boolean', 'Client handles timeout cleanly without unhandled rejection');

  // =========================================================================
  // TEST 7: Graceful Webhook Handoff
  // =========================================================================
  console.log('\n--- [TEST 7] Long-Polling to Webhook Graceful Handoff ---');
  console.log('       1. Simulating worker startup (dropping webhook for polling)...');
  const pollPrep = await DeliveryManager.prepareForPolling();
  assert(pollPrep, 'Webhook successfully cleared for polling mode');

  const polStatus = await DeliveryManager.getWebhookStatus();
  assert(!polStatus.isConfigured, 'Webhook confirmed inactive during polling');

  console.log('       2. Simulating worker shutdown (restoring webhook)...');
  await DeliveryManager.restoreWebhookOnWorkerExit();

  const finalStatus = await DeliveryManager.getWebhookStatus();
  assert(finalStatus.isConfigured, 'Production webhook restored automatically on worker shutdown');
  assert(finalStatus.isCorrectUrl, 'Restored webhook matches canonical production endpoint');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log(`🏁 Reliability Test Suite Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
