import { startSession } from './src/lib/sessionManager';

async function run() {
  try {
    // We need to fetch a valid business ID and table ID
    const { supabase } = require('./src/lib/supabaseClient');
    const { data: b } = await supabase.from('businesses').select('id, tables').limit(1);
    const bid = b[0].id;
    const tableId = b[0].tables[0].id;

    console.log("Starting session for business:", bid, "table:", tableId);
    await startSession(tableId, 'pool', 'Test User', bid, 1, undefined, undefined, 'Test Notes');
    console.log("Session created successfully");
  } catch (e) {
    console.error("Error starting session:", e);
  }
}
run();
