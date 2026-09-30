import { google } from 'googleapis';
import { businessManager } from './businessManager';
import { supabase } from './supabaseClient';
import { formatTimeReadable, getCurrentISTDateStr } from './billing';
const REQUIRED_SHEETS = [
  'Dashboard', 'Active Sessions', 'Completed Sessions', 'Players',
  'Memberships', 'Revenue', 'Promotions', 'Tables', 'QR Scans',
  'Activity Logs', 'Settings'
];

export async function getGoogleSheetsClient() {
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient as any });
}

export async function appendRow(sheetName: string, values: any[], businessId?: string, maxRetries = 3) {
  let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    if (business && business.google_sheet_id) spreadsheetId = business.google_sheet_id;
  }
  if (!spreadsheetId) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sheets = await getGoogleSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values]
        }
      });
      return; // Success
    } catch (error: any) {
      if (error.message && error.message.includes('Unable to parse range')) {
        console.log(`Sheet '${sheetName}' not found. Initializing sheets...`);
        try { await initializeGoogleSheet(spreadsheetId); } catch (e) { console.error("Failed to init sheets", e); }
      }
      if (attempt === maxRetries) {
        console.error(`[CRITICAL] Failed to append row to ${sheetName} after ${maxRetries} attempts:`, error);
        // We log the error but we don't throw to avoid crashing the session logic.
      } else {
        console.warn(`[WARN] Google Sheets API failed, retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Exponential-ish backoff
      }
    }
  }
}

export async function logActivityToSheet(action: string, metadata: any, businessId?: string) {
  const timestamp = new Date().toISOString();
  await appendRow('Activity Logs', [
    timestamp,
    action,
    metadata.user || 'System',
    metadata.table || '',
    metadata.session || '',
    metadata.details || JSON.stringify(metadata)
  ], businessId);
}

export async function getMembershipByCustomer(customerQuery: string, businessId?: string) {
  try {
    let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (businessId) {
      const business = await businessManager.getBusiness(businessId);
      if (business && business.google_sheet_id) spreadsheetId = business.google_sheet_id;
    }
    if (!spreadsheetId) return null;
    const sheets = await getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Memberships!A:H',
    });
    const rows = res.data.values || [];
    if (rows.length <= 1) return null;
    
    // Search by name or mobile
    const match = rows.slice(1).find(row => 
      (row[1]?.toLowerCase() === customerQuery.toLowerCase()) || 
      (row[2] === customerQuery)
    );
    
    if (match && match[7] === 'Active') {
      return { id: match[0], name: match[1], mobile: match[2], tier: match[4] };
    }
    return null;
  } catch (error) {
    console.error('getMembershipByCustomer Error:', error);
    return null;
  }
}

export async function syncBookingToSheet(bookingData: any, businessId?: string) {
  // Store: Booking ID, Business ID, Customer Name, Table, Date, Time, Duration, Status, Session ID, Created At, Updated At
  await appendRow('Bookings', [
    bookingData.id || 'Pending',
    businessId || bookingData.business_id || '',
    bookingData.customer_name,
    bookingData.table_id,
    bookingData.booking_date,
    bookingData.start_time,
    bookingData.duration_minutes || 60,
    bookingData.status || 'confirmed',
    bookingData.session_id || '',
    new Date().toISOString(),
    new Date().toISOString()
  ], businessId);
}

export async function upsertRow(sheetName: string, idColumnIndex: number, uniqueId: string, values: any[], businessId?: string, maxRetries = 3) {
  let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    if (business && business.google_sheet_id) spreadsheetId = business.google_sheet_id;
  }
  if (!spreadsheetId) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sheets = await getGoogleSheetsClient();
      // 1. Fetch existing rows to find ID
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`,
      });
      const rows = res.data.values || [];
      let rowIndex = -1;
      
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][idColumnIndex] === uniqueId) {
          rowIndex = i;
          break;
        }
      }

      if (rowIndex >= 0) {
        // Update existing row
        const range = `${sheetName}!A${rowIndex + 1}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [values] }
        });
      } else {
        // Append new row
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${sheetName}'!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [values] }
        });
      }
      return; // Success
    } catch (error: any) {
      if (error.message && error.message.includes('Unable to parse range')) {
        console.log(`Sheet '${sheetName}' not found. Initializing sheets...`);
        try { await initializeGoogleSheet(spreadsheetId); } catch (e) { console.error("Failed to init sheets", e); }
      }
      if (attempt === maxRetries) {
        console.error(`[CRITICAL] Failed to upsert row to ${sheetName} after ${maxRetries} attempts:`, error);
      } else {
        console.warn(`[WARN] Google Sheets API failed, retrying (${attempt}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
}

export async function updateRowDirectly(sheetName: string, rowNum: string, values: any[], businessId?: string, maxRetries = 3) {
  let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    if (business && business.google_sheet_id) spreadsheetId = business.google_sheet_id;
  }
  if (!spreadsheetId) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sheets = await getGoogleSheetsClient();
      const range = `${sheetName}!A${rowNum}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });
      return;
    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error(`[CRITICAL] Failed to direct update row in ${sheetName}:`, error);
      } else {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
}

export async function appendAndGetRange(sheetName: string, values: any[], businessId?: string, maxRetries = 3): Promise<string | null> {
  let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    if (business && business.google_sheet_id) spreadsheetId = business.google_sheet_id;
  }
  if (!spreadsheetId) return null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sheets = await getGoogleSheetsClient();
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] }
      });
      return res.data.updates?.updatedRange || null;
    } catch (error: any) {
      if (error.message && error.message.includes('Unable to parse range')) {
        console.log(`Sheet '${sheetName}' not found. Initializing sheets...`);
        try { await initializeGoogleSheet(spreadsheetId); } catch (e) { }
      }
      if (attempt === maxRetries) {
        console.error(`[CRITICAL] Failed to append and get range in ${sheetName}:`, error);
      } else {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  return null;
}

export async function syncSessionToSheet(sessionId: string, businessId?: string) {
  try {
    const { data: session } = await supabase.from('sessions').select('*').eq('id', sessionId).single();
    if (!session) return;

    // Fetch related QKhata charge if any
    const { data: qkhata } = await supabase.from('payments')
      .select('*')
      .eq('session_id', sessionId)
      .eq('payment_method', 'QKhata')
      .limit(1).single();

    const startReadable = session.start_time ? formatTimeReadable(session.start_time) : '';
    const endReadable = session.end_time ? formatTimeReadable(session.end_time) : '';
    const qkhataStatus = qkhata ? 'Charged' : (session.payment_status === 'Pending' ? 'Pending' : 'N/A');
    const qkhataAmount = qkhata ? qkhata.amount : 0;

    const shortId = session.id ? session.id.split('-')[0].toUpperCase() : 'UNKNOWN';
    const customerName = session.customer_name || 'Guest';
    const formattedCustomerName = session.num_players && session.num_players > 1 
      ? `${customerName} (${session.num_players} Players)`
      : customerName;

    const values = [
      shortId,
      session.date || getCurrentISTDateStr(),
      formattedCustomerName,
      session.member_id || '',
      session.table_id || '',
      session.game_type || '',
      startReadable,
      endReadable,
      session.duration || '0m',
      session.paused_duration_seconds || 0,
      session.applied_pricing || 'Fixed Rate',
      session.cost || 0,
      session.payment_status || 'Pending',
      session.status || 'ACTIVE',
      session.completed_by || 'System',
      qkhataStatus,
      qkhataAmount,
      qkhata?.id || '',
      session.notes || ''
    ];

    if (session.google_sheet_row_id) {
       await updateRowDirectly('Sessions', session.google_sheet_row_id, values, businessId || session.business_id);
    } else {
       const range = await appendAndGetRange('Sessions', values, businessId || session.business_id);
       if (range) {
          // Range format typically like 'Sessions'!A15:S15
          const rowMatch = range.match(/[a-zA-Z]+(\d+)/);
          if (rowMatch && rowMatch[1]) {
             await supabase.from('sessions').update({ google_sheet_row_id: rowMatch[1] }).eq('id', sessionId);
          }
       }
    }
  } catch (err) {
    console.error('syncSessionToSheet Error:', err);
  }
}

export async function syncMemberToSheet(customerId: string, businessId?: string) {
  try {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!customer) return;

    const { data: membership } = await supabase.from('memberships').select('*').eq('id', customer.id).single();

    const values = [
      customer.id,
      customer.name || 'Unknown',
      customer.phone || '',
      customer.email || '',
      membership ? membership.tier : 'None',
      new Date(customer.created_at).toLocaleDateString(),
      customer.total_billed || 0,
      customer.total_paid || 0,
      customer.outstanding_balance || 0,
      customer.updated_at ? new Date(customer.updated_at).toLocaleString() : '',
      'Active'
    ];

    await upsertRow('Members', 0, customer.id, values, businessId || customer.business_id);
  } catch (err) {
    console.error('syncMemberToSheet Error:', err);
  }
}
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

    // Now inject headers for any sheet that is empty, OR force overwrite them to ensure they are up to date!
    for (const reqSheet of requiredSheets) {
      // Always overwrite headers to ensure schema updates are applied
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${reqSheet.title}'!A1:${String.fromCharCode(65 + reqSheet.headers.length - 1)}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [reqSheet.headers] }
      });
    }

    // Apply Premium Formatting (Bold Headers, Background Color, Freeze Row 1, Auto-Resize)
    try {
      const latestSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const formatRequests: any[] = [];
      
      latestSpreadsheet.data.sheets?.forEach(sheet => {
        const sheetId = sheet.properties?.sheetId;
        if (sheetId !== undefined) {
          // Freeze top row
          formatRequests.push({
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          });
          
          // Format header row (Bold, dark gray background, white text)
          formatRequests.push({
            repeatCell: {
              range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
            }
          });
          
          // Auto-resize columns A to Z
          formatRequests.push({
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 20
              }
            }
          });
        }
      });
      
      if (formatRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: formatRequests }
        });
      }
    } catch (formatErr) {
      console.error('Failed to apply premium formatting to sheets:', formatErr);
    }
    
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
  }
}
