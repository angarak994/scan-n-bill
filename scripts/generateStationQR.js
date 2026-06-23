/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../generated-qr-codes');

async function generateQrForTable(table_id, game_type) {
  const sessionUrl = `${BASE_URL}/session?table=${table_id}&type=${game_type}`;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, `${table_id}_${game_type}.png`);

  await QRCode.toFile(outputPath, sessionUrl, {
    errorCorrectionLevel: 'H', // High error correction
    type: 'png',
    width: 600,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  console.log(`Generated QR for ${table_id} (${game_type}) → ${outputPath}\nURL Encoded: ${sessionUrl}\n`);
}

async function generateAll() {
  console.log('Generating QR codes for 5 tables...\n');
  
  // 2 Snooker tables
  await generateQrForTable('SNOOKER_1', 'snooker');
  await generateQrForTable('SNOOKER_2', 'snooker');
  
  // 3 Pool tables
  await generateQrForTable('POOL_1', 'pool');
  await generateQrForTable('POOL_2', 'pool');
  await generateQrForTable('POOL_3', 'pool');
  
  console.log('All QR codes generated successfully!');
}

generateAll();
