require('dotenv').config({ path: '.env.local' });

async function fix() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetUrl = 'https://billiards-qr-sessions.vercel.app/api/telegram-webhook';
  
  console.log(`Setting webhook to: ${targetUrl}`);
  
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: targetUrl,
      drop_pending_updates: true
    })
  });
  
  const data = await res.json();
  console.log("Result:", data);
}
fix();
