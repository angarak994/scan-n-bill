import { startSession } from './src/lib/sessionManager';
import { supabase } from './src/lib/supabaseClient';

async function run() {
  const bid = "3d7560e6-cd9e-4fde-a7c2-ea137283da72";
  const tableId = "P1";

  // End active session if any
  await supabase.from('sessions').update({ status: 'COMPLETED' }).eq('table_id', tableId).eq('business_id', bid).eq('status', 'ACTIVE');
  
  try {
    console.log("Starting session for business:", bid, "table:", tableId);
    await startSession(tableId, 'pool', 'Test User', bid, 1, undefined, undefined, 'Test Notes');
    console.log("Session created successfully");
  } catch (e) {
    console.error("Error starting session:", e);
  }
}
run();
