import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import QRCode from 'qrcode';
import { businessManager } from '@/lib/businessManager';

const getSheetsClient = () => {
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/^"|"$|'^|'$/g, '').replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { business_name, owner_name, contact_number, address, google_sheet_id, business_type, pricing_rules, tables, dashboard_pin, menu_items } = data;

    if (!business_name || !owner_name || !contact_number || !google_sheet_id || !dashboard_pin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract ID if user pasted full URL
    let finalSheetId = google_sheet_id.trim();
    if (finalSheetId.includes('/d/')) {
      const match = finalSheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        finalSheetId = match[1];
      }
    }

    // Verify Google Sheet and Inject Headers if empty
    const sheets = getSheetsClient();
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: finalSheetId });
      const firstSheetTitle = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
      
      // Check if A1 is empty
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: finalSheetId,
        range: `'${firstSheetTitle}'!A1:J1`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0 || rows[0][0] === '') {
        // Inject headers
        const headers = ['Session ID', 'Date', 'Customer Name', 'Table No', 'Game Type', 'Start Time', 'End Time', 'Duration', 'Applied Pricing', 'Amount', 'Status'];
        await sheets.spreadsheets.values.update({
          spreadsheetId: finalSheetId,
          range: `'${firstSheetTitle}'!A1:K1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers],
          },
        });
      }
    } catch (err: any) {
      console.error("Google Sheets API Error:", err?.message || err);
      return NextResponse.json({ error: `Google Sheets Error: ${err?.message || 'Invalid ID or missing permissions. Share it with the service account.'}` }, { status: 400 });
    }

    // Register Business in Supabase
    const businessId = await businessManager.registerBusiness({
      business_name,
      owner_name,
      contact_number,
      address,
      google_sheet_id: finalSheetId,
      business_type,
      pricing_rules,
      tables,
      dashboard_pin,
      menu_items,
      created_at: new Date().toISOString()
    });

    // Generate QRs
    const origin = request.headers.get('origin') || 'https://billiards-qr-sessions.vercel.app';
    
    // Use dynamic tables or fallback if none provided
    const dynamicTables = (tables && tables.length > 0) ? tables : [
      { name: 'Table 1', id: 'Table 1', type: 'general' }
    ];

    const qrs = await Promise.all(dynamicTables.map(async (t: any) => {
      const tableId = t.id || t.table_id;
      const url = `${origin}/session?table=${encodeURIComponent(tableId)}&type=${t.type}&b=${businessId}`;
      const dataUrl = await QRCode.toDataURL(url);
      return {
        name: t.name,
        dataUrl,
      };
    }));

    // Dashboard QR
    const dashboardUrl = `${origin}/dashboard?b=${businessId}`;
    const dashboardQr = await QRCode.toDataURL(dashboardUrl);
    qrs.push({ name: 'Owner Dashboard', dataUrl: dashboardQr });

    return NextResponse.json({ success: true, businessId, qrs }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
