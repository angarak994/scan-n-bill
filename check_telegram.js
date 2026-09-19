require('dotenv').config({ path: '.env.local' });

async function check() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
     console.error("NO TOKEN!");
     return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = await res.json();
  console.log("Webhook Info:", JSON.stringify(data, null, 2));
}
check();
