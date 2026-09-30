import { startSession } from './src/lib/sessionManager';

async function run() {
  try {
    const bid = "3d7560e6-cd9e-4fde-a7c2-ea137283da72";
    const tableId = "P1";

    console.log("Starting session for business:", bid, "table:", tableId);
    await startSession(tableId, 'pool', 'Test User', bid, 1, undefined, undefined, 'Test Notes');
    console.log("Session created successfully");
  } catch (e) {
    console.error("Error starting session:", e);
  }
}
run();
