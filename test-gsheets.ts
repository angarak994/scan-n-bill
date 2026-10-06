import { syncSessionToSheet, initializeGoogleSheet } from './src/lib/googleSheets';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    // Just run initialize to see if it crashes
    console.log("Initializing sheets...");
    await initializeGoogleSheet(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '');
    console.log("Done initializing");
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
