require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

async function listSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    });
    
    console.log("Found the following tabs:");
    res.data.sheets.forEach(sheet => {
      console.log(`- ${sheet.properties.title}`);
    });
  } catch (err) {
    console.error("Error fetching sheets:", err.message);
  }
}

listSheets();
