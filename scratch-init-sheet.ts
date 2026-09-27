export async function initializeGoogleSheet(spreadsheetId: string) {
  const sheets = await getGoogleSheetsClient();
  
  // Define required sheets and their headers
  const requiredSheets = [
    { title: 'Sessions', headers: ['Session ID', 'Date', 'Customer Name', 'Member ID', 'Table No', 'Game Type', 'Start Time', 'End Time', 'Duration', 'Paused (s)', 'Applied Pricing', 'Amount', 'Payment Status', 'Status', 'Completed By', 'QKhata Status', 'QKhata Amount', 'QKhata ID', 'Notes'] },
    { title: 'Activity Logs', headers: ['Timestamp', 'Action', 'User', 'Table', 'Session', 'Details'] },
    { title: 'Members', headers: ['ID', 'Name', 'Phone', 'Email', 'Tier', 'Joined', 'Total Billed', 'Total Paid', 'Outstanding Balance', 'Last Updated', 'Status'] },
    { title: 'Bookings', headers: ['Booking ID', 'Business ID', 'Customer Name', 'Table', 'Date', 'Start Time', 'Duration (m)', 'Status', 'Session ID', 'Created At', 'Updated At'] },
    { title: 'Food Orders', headers: ['Timestamp', 'Table No', 'Customer Name', 'Items Ordered', 'Order Total', 'Status'] }
  ];

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    
    // Rename 'Sheet1' to 'Sessions' if 'Sessions' doesn't exist and 'Sheet1' does
    if (!existingSheets.includes('Sessions') && existingSheets.includes('Sheet1')) {
      const sheet1Id = spreadsheet.data.sheets?.find(s => s.properties?.title === 'Sheet1')?.properties?.sheetId;
      if (sheet1Id !== undefined) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: sheet1Id, title: 'Sessions' },
                fields: 'title'
              }
            }]
          }
        });
        existingSheets[existingSheets.indexOf('Sheet1')] = 'Sessions';
      }
    }

    const requests: any[] = [];
    for (const reqSheet of requiredSheets) {
      if (!existingSheets.includes(reqSheet.title)) {
        requests.push({
          addSheet: { properties: { title: reqSheet.title } }
        });
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
    }

    // Now inject headers for any sheet that is empty
    for (const reqSheet of requiredSheets) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${reqSheet.title}'!A1:Z1`
      });
      const rows = res.data.values;
      if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0 || rows[0][0] === '') {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${reqSheet.title}'!A1:${String.fromCharCode(65 + reqSheet.headers.length - 1)}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [reqSheet.headers] }
        });
      }
    }
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
  }
}
