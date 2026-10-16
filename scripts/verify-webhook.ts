import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { DeliveryManager } from '../src/lib/telegram/deliveryManager';
import { TelegramClient } from '../src/lib/telegram/telegramClient';

async function main() {
  console.log('='.repeat(65));
  console.log('🔍 QControl Telegram Webhook Verification & Health Audit');
  console.log('='.repeat(65));

  const meRes = await TelegramClient.getMe();
  if (meRes.ok && meRes.result) {
    console.log(`🤖 Bot Username: @${meRes.result.username} (ID: ${meRes.result.id})`);
  } else {
    console.error(`❌ Bot API Error:`, meRes);
  }

  const status = await DeliveryManager.getWebhookStatus();
  console.log('\n--- Webhook Status ---');
  console.log(`Configured:        ${status.isConfigured ? '✅ YES' : '❌ NO'}`);
  console.log(`Current URL:       ${status.currentUrl || '(none - polling or disconnected)'}`);
  console.log(`Expected URL:      ${status.expectedUrl}`);
  console.log(`Correct Target:    ${status.isCorrectUrl ? '✅ MATCH' : '⚠️ MISMATCH / UNLINKED'}`);
  console.log(`Pending Updates:   ${status.pendingUpdateCount}`);
  if (status.lastErrorMessage) {
    console.log(`Last Error Msg:    ❌ ${status.lastErrorMessage}`);
    console.log(`Last Error Date:   ${status.lastErrorDate}`);
  } else {
    console.log(`Last Error Msg:    None (Healthy)`);
  }
  console.log('='.repeat(65));
}

main().catch(console.error);
