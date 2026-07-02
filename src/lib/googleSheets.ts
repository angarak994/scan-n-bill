import { google } from 'googleapis';
import { businessManager } from './businessManager';

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

export async function appendRow(sheetName: string, values: any[], businessId?: string) {
  try {
    let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (businessId) {
      const business = await businessManager.getBusiness(businessId);
      if (business && business.google_sheet_id) spreadsheetId = business.google_sheet_id;
    }
    if (!spreadsheetId) return;

    const sheets = await getGoogleSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values]
      }
    });
  } catch (error) {
    console.error(`Failed to append row to ${sheetName}:`, error);
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

export async function logSessionStartToSheet(sessionData: any, businessId?: string) {
  // sessionData: { id, business_id, customer_name, table_id, start_time, status }
  await appendRow('Active Sessions', [
    sessionData.id,
    sessionData.business_id,
    sessionData.customer_name,
    sessionData.table_id,
    sessionData.start_time,
    sessionData.status || 'ACTIVE'
  ], businessId);
  
  await logActivityToSheet('START_SESSION', {
    user: 'Club Owner',
    table: sessionData.table_id,
    session: sessionData.id,
    details: `Session started for ${sessionData.customer_name}`
  }, businessId);
}

export async function logSessionEndToSheet(sessionData: any, businessId?: string) {
  // sessionData: { id, business_id, customer_name, table_id, start_time, end_time, duration, cost, final_amount, status }
  await appendRow('Completed Sessions', [
    sessionData.id,
    sessionData.business_id,
    sessionData.customer_name,
    sessionData.table_id,
    sessionData.start_time,
    sessionData.end_time,
    sessionData.duration,
    sessionData.cost, // Revenue
    sessionData.discounts || 0,
    sessionData.cost, // Final Amount
    'COMPLETED'
  ], businessId);
  
  await logActivityToSheet('END_SESSION', {
    user: 'System',
    table: sessionData.table_id,
    session: sessionData.id,
    details: `Session ended. Revenue: ₹${sessionData.cost}`
  }, businessId);
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
