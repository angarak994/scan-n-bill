import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { DeliveryManager } from '../src/lib/telegram/deliveryManager';

async function main() {
  console.log('='.repeat(65));
  console.log('🔄 Restoring Production Telegram Webhook');
  console.log('='.repeat(65));

  const result = await DeliveryManager.ensureWebhookRegistered({ force: true, dropPending: false });
  console.log(`Action Taken: ${result.actionTaken}`);
  console.log(`Webhook URL:  ${result.newUrl}`);
  console.log(`Success:      ${result.success ? '✅ YES' : '❌ FAILED'}`);
  console.log(`Message:      ${result.message}`);
  console.log('='.repeat(65));
}

main().catch(console.error);
