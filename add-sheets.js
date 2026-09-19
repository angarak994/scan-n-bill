require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const spreadsheetId = '1LV_C2kkfmLaJdLxKha6Wzvu08TFTOMRBH4WoPDOEc8w';
  
  const REQUIRED_SHEETS = [
    'Dashboard', 'Active Sessions', 'Completed Sessions', 'Players',
    'Memberships', 'Revenue', 'Promotions', 'Tables', 'QR Scans',
    'Activity Logs', 'Settings'
  ];

  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = res.data.sheets.map(s => s.properties.title);
    
    const missingSheets = REQUIRED_SHEETS.filter(s => !existingSheets.includes(s));
    
    if (missingSheets.length === 0) {
      console.log("All required sheets already exist.");
      return;
    }
    
    console.log("Adding missing sheets:", missingSheets);
    
    const requests = missingSheets.map(title => ({
      addSheet: {
        properties: {
          title: title
        }
      }
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests
      }
    });
    
    console.log("Successfully created all missing sheets!");
  } catch (err) {
    console.error("Error updating sheets:", err.message);
  }
}

main();
