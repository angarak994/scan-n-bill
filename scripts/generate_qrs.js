const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generate() {
  const dir = '/Users/angaraktate/.gemini/antigravity-ide/brain/7e9d185a-2c49-499b-825c-15630155afda/scratch';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await QRCode.toFile(path.join(dir, 'Playshire_P1_Pool.png'), 'https://billiards-qr-sessions.vercel.app/session?table=PlayShire%20P1&type=pool');
  await QRCode.toFile(path.join(dir, 'Playshire_S1_Snooker.png'), 'https://billiards-qr-sessions.vercel.app/session?table=PlayShire%20S1&type=snooker');
  await QRCode.toFile(path.join(dir, 'Playshire_Owner_Dashboard.png'), 'https://billiards-qr-sessions.vercel.app/dashboard');
  
  console.log('QR codes generated!');
}

generate();
