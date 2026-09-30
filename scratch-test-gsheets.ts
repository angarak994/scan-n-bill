import { syncSessionToSheet } from './src/lib/googleSheets';

async function run() {
  const sessionId = "20163351-4034-4a44-8d99-52e8d7dcc93a"; // My manually inserted active session
  await syncSessionToSheet(sessionId, "3d7560e6-cd9e-4fde-a7c2-ea137283da72");
  console.log("Done syncing");
}
run();
