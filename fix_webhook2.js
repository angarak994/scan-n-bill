require('dotenv').config({ path: '.env.local' });

async function fix() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetUrl = 'https://scan-n-bill.vercel.app/api/telegram-webhook';
  
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || 'qcontrol_secure_webhook_123';
  
  console.log(`Setting webhook to: ${targetUrl}`);
  
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: targetUrl,
      drop_pending_updates: true,
      secret_token: secretToken
    })
  });
  
  const data = await res.json();
  console.log("Result:", data);

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log("Current Webhook Info:", JSON.stringify(infoData, null, 2));
}
fix();
