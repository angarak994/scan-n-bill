require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const REQUIRED_SHEETS = [
  'Dashboard', 'Active Sessions', 'Completed Sessions', 'Players',
  'Memberships', 'Revenue', 'Promotions', 'Tables', 'QR Scans',
  'Activity Logs', 'Settings'
];

async function ensureSheetsExist() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTitles = res.data.sheets.map(s => s.properties.title);
    const sheetsToCreate = REQUIRED_SHEETS.filter(title => !existingTitles.includes(title));

    if (sheetsToCreate.length > 0) {
      const requests = sheetsToCreate.map(title => ({ addSheet: { properties: { title } } }));
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
      console.log('Created sheets:', sheetsToCreate);
    } else {
      console.log('All required sheets already exist.');
    }
  } catch (error) {
    console.error('Error ensuring sheets exist:', error.message);
  }
}

ensureSheetsExist();
