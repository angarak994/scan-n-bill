require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

async function setupSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 1. Get the sheetId for Sheet1
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheet1 = spreadsheet.data.sheets.find(s => s.properties.title === 'Sheet1');
    const sheetId = sheet1.properties.sheetId;

    // 2. Clear existing data
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A:I',
    });

    // 3. Write Headers
    const headers = [
      'TABLE ID',
      'GAME TYPE',
      'START TIME',
      'END TIME',
      'SESSION TYPE',
      'RATE/HR (₹)',
      'DURATION',
      'COST (₹)',
      'STATUS'
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Sheet1!A1:I1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers],
      },
    });

    // 4. Format Headers and Columns using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          // Freeze top row
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Format header row (bold, background color, text color)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 9,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.2, blue: 0.4 }, // Dark Blue
                  textFormat: {
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, // White
                    bold: true,
                    fontSize: 11,
                  },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Center align all data rows
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 9,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
            },
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 9,
              },
            },
          },
        ],
      },
    });

    console.log("Sheet formatted successfully!");
  } catch (error) {
    console.error("Error setting up sheet:", error.message);
  }
}

setupSheet();
