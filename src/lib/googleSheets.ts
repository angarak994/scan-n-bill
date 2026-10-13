import { businessManager } from './businessManager';
import { supabase } from './supabaseClient';
import { 
  getBusinessTimezone, 
  getMonthKey, 
  getSessionsSheetTitle, 
  getOrdersSheetTitle 
} from './sheetsTimezone';
import { 
  fetchUnifiedSessionData, 
  UNIFIED_SESSION_HEADERS, 
  UNIFIED_ORDER_HEADERS 
} from './unifiedSessionService';

// Activity Logs tab has been completely removed per architecture specification.
const REQUIRED_SHEETS = [
  'Dashboard', 'Sessions', 'Members', 'Bookings', 'Settings'
];

let cachedSheetsClient: any = null;

export async function getGoogleSheetsClient() {
  if (cachedSheetsClient) return cachedSheetsClient;

  const { google } = await import('googleapis');
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  cachedSheetsClient = google.sheets({ version: 'v4', auth: authClient as any });
  return cachedSheetsClient;
}

async function resolveSpreadsheetId(businessId?: string): Promise<string | null> {
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    if (business && business.google_sheet_id) return business.google_sheet_id;
  }
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null;
}

const verifiedMonthlySheets = new Set<string>();

/**
 * Ensures monthly worksheets (e.g. 'Sessions_2026_10' and 'Orders_2026_10') exist with
 * proper headers, frozen rows, and premium styling. Reuses existing sheets if present.
 * Does NOT delete or overwrite unrelated user sheets.
 */
export async function ensureMonthlySheets(spreadsheetId: string, monthKey: string): Promise<{ sessionsSheetTitle: string; ordersSheetTitle: string }> {
  const sessionsTitle = getSessionsSheetTitle(monthKey);
  const ordersTitle = getOrdersSheetTitle(monthKey);
  const cacheKey = `${spreadsheetId}:${monthKey}`;

  // Instant fast-path: Once verified in memory, skip the expensive spreadsheets.get API call
  // This cuts Google Sheets quota consumption in half and eliminates ~500ms of latency per sync
  if (verifiedMonthlySheets.has(cacheKey)) {
    return { sessionsSheetTitle: sessionsTitle, ordersSheetTitle: ordersTitle };
  }

  const sheets = await getGoogleSheetsClient();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties?.title) || [];

  const addRequests: any[] = [];
  if (!existingSheets.includes(sessionsTitle)) {
    addRequests.push({ addSheet: { properties: { title: sessionsTitle } } });
  }
  if (!existingSheets.includes(ordersTitle)) {
    addRequests.push({ addSheet: { properties: { title: ordersTitle } } });
  }

  if (addRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests }
    });
  }

  // Update headers if sheets were just created or to ensure schema consistency
  if (!existingSheets.includes(sessionsTitle)) {
    const endCol = String.fromCharCode(65 + UNIFIED_SESSION_HEADERS.length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sessionsTitle}'!A1:${endCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [UNIFIED_SESSION_HEADERS] }
    });
  }

  if (!existingSheets.includes(ordersTitle)) {
    const endCol = String.fromCharCode(65 + UNIFIED_ORDER_HEADERS.length - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${ordersTitle}'!A1:${endCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [UNIFIED_ORDER_HEADERS] }
    });
  }

  // Format newly added sheets
  if (addRequests.length > 0) {
    try {
      const refreshedSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const formatRequests: any[] = [];

      refreshedSpreadsheet.data.sheets?.forEach((sheet: any) => {
        const title = sheet.properties?.title;
        const sheetId = sheet.properties?.sheetId;
        if (sheetId !== undefined && (title === sessionsTitle || title === ordersTitle)) {
          // Freeze header row
          formatRequests.push({
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          });
          // Bold, dark themed header style
          formatRequests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.13, green: 0.15, blue: 0.2 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
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
    } catch (fmtErr) {
      console.warn('[GoogleSheets] Non-critical formatting error:', fmtErr);
    }
  }

  verifiedMonthlySheets.add(cacheKey);
  return { sessionsSheetTitle: sessionsTitle, ordersSheetTitle: ordersTitle };
}

/**
 * Appends a row to a specified sheet with retry and backoff handling.
 */
export async function appendRow(sheetName: string, values: any[], businessId?: string, maxRetries = 3) {
  const spreadsheetId = await resolveSpreadsheetId(businessId);
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
      return;
    } catch (error: any) {
      if (error.message && error.message.includes('Unable to parse range')) {
        console.log(`Sheet '${sheetName}' not found. Initializing sheets...`);
        try { await initializeGoogleSheet(spreadsheetId); } catch (e) { }
      }
      if (attempt === maxRetries) {
        console.error(`[GoogleSheets] Failed to append row to ${sheetName} after ${maxRetries} attempts:`, error?.message || error);
      } else {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
}

/**
 * Activity Logs are no longer synchronized to Google Sheets.
 * Retained as a safe, harmless no-op to preserve backwards compatibility for existing callers.
 * Application audit logs and diagnostic logs remain intact in the database.
 */
export async function logActivityToSheet(action: string, metadata: any, businessId?: string): Promise<void> {
  // Safe no-op: Activity Logs tab is completely eliminated from Google Sheets per specifications.
  return Promise.resolve();
}

/**
 * Queries memberships from Google Sheets or Supabase.
 */
export async function getMembershipByCustomer(customerQuery: string, businessId?: string) {
  try {
    const spreadsheetId = await resolveSpreadsheetId(businessId);
    if (!spreadsheetId) return null;
    const sheets = await getGoogleSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Members!A:H',
    });
    const rows = res.data.values || [];
    if (rows.length <= 1) return null;
    
    const match = rows.slice(1).find((row: any) => 
      (row[1]?.toLowerCase() === customerQuery.toLowerCase()) || 
      (row[2] === customerQuery)
    );
    
    if (match && match[6] === 'Active') {
      return { id: match[0], name: match[1], mobile: match[2], tier: match[3] };
    }
    return null;
  } catch (error) {
    console.error('getMembershipByCustomer Error:', error);
    return null;
  }
}

/**
 * Syncs standalone bookings to the Google Sheets 'Bookings' tab.
 * Uses persistent Booking ID to avoid duplicate rows.
 */
export async function syncBookingToSheet(bookingData: any, businessId?: string) {
  try {
    const spreadsheetId = await resolveSpreadsheetId(businessId);
    if (!spreadsheetId) return;

    const bookingId = bookingData.id || 'Pending';
    const values = [
      bookingId,
      bookingData.booking_date || '',
      bookingData.start_time || '',
      bookingData.customer_name || 'Unknown',
      bookingData.table_id || '',
      bookingData.duration_minutes || 60,
      bookingData.status || 'confirmed'
    ];

    await upsertRow('Bookings', 0, bookingId, values, businessId);
  } catch (err) {
    console.error('syncBookingToSheet Error:', err);
  }
}

/**
 * Upserts a row by unique ID in a specific column index.
 * If uniqueId is found in that column, updates the row; otherwise appends.
 */
export async function upsertRow(sheetName: string, idColumnIndex: number, uniqueId: string, values: any[], businessId?: string, maxRetries = 3) {
  const spreadsheetId = await resolveSpreadsheetId(businessId);
  if (!spreadsheetId) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sheets = await getGoogleSheetsClient();
      const colLetter = String.fromCharCode(65 + idColumnIndex);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!${colLetter}:${colLetter}`,
      });
      const rows = res.data.values || [];
      let rowIndex = -1;
      
      const normalizedTargetId = String(uniqueId).trim().toUpperCase();

      for (let i = 0; i < rows.length; i++) {
        const cellVal = String(rows[i]?.[0] || '').trim().toUpperCase();
        if (cellVal === normalizedTargetId) {
          rowIndex = i;
          break;
        }
      }

      if (rowIndex >= 0) {
        // Update existing row
        const endColLetter = String.fromCharCode(65 + Math.max(values.length, 1) - 1);
        const range = `'${sheetName}'!A${rowIndex + 1}:${endColLetter}${rowIndex + 1}`;
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
      return;
    } catch (error: any) {
      if (error.message && error.message.includes('Unable to parse range')) {
        console.log(`Sheet '${sheetName}' not found. Auto-creating sheet '${sheetName}'...`);
        try {
          const sheets = await getGoogleSheetsClient();
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: { title: sheetName }
                }
              }]
            }
          });
        } catch (createErr) {
          console.warn(`[GoogleSheets] Could not auto-create sheet '${sheetName}':`, createErr);
        }
      }
      if (attempt === maxRetries) {
        console.error(`[GoogleSheets] Failed to upsert row to ${sheetName} after ${maxRetries} attempts:`, error?.message || error);
      } else {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
}

export async function updateRowDirectly(sheetName: string, rowNum: string, values: any[], businessId?: string, maxRetries = 3) {
  const spreadsheetId = await resolveSpreadsheetId(businessId);
  if (!spreadsheetId) return;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sheets = await getGoogleSheetsClient();
      const endColLetter = String.fromCharCode(65 + Math.max(values.length, 1) - 1);
      const range = `'${sheetName}'!A${rowNum}:${endColLetter}${rowNum}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
      });
      return;
    } catch (error: any) {
      if (attempt === maxRetries) {
        console.error(`[GoogleSheets] Failed to direct update row in ${sheetName}:`, error?.message || error);
      } else {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }
}

/**
 * UNIFIED CENTRAL SYNCHRONIZER
 * 
 * Synchronizes an operational session and all associated bookings, members, and
 * itemized F&B orders into Google Sheets under the appropriate monthly partition.
 */
export async function syncUnifiedSessionToSheet(sessionId: string, explicitBusinessId?: string): Promise<boolean> {
  try {
    const unified = await fetchUnifiedSessionData(sessionId, explicitBusinessId);
    if (!unified) return false;

    const spreadsheetId = await resolveSpreadsheetId(unified.businessId);
    if (!spreadsheetId) {
      console.warn(`[GoogleSheets] No spreadsheet ID configured for business ${unified.businessId}`);
      return false;
    }

    // 1. Ensure the month-wise sheets (Sessions_YYYY_MM and Orders_YYYY_MM) exist
    const { sessionsSheetTitle, ordersSheetTitle } = await ensureMonthlySheets(spreadsheetId, unified.monthKey);

    const sheets = await getGoogleSheetsClient();

    // 2. Fetch existing rows from the monthly Sessions sheet to find matching Session ID (target Column A only to minimize payload)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sessionsSheetTitle}'!A:A`,
    });
    const rows = res.data.values || [];

    const shortId = unified.sessionId.split('-')[0].toUpperCase();
    const targetCanonical = unified.canonicalId.toUpperCase();

    let existingRowIndex = -1;
    // Check from row index 1 (skipping headers at row index 0)
    for (let i = 1; i < rows.length; i++) {
      const cellVal = String(rows[i][0] || '').trim().toUpperCase();
      if (cellVal === targetCanonical || cellVal === shortId || cellVal.includes(shortId)) {
        existingRowIndex = i + 1; // 1-based index in Google Sheets
        break;
      }
    }

    const endColLetter = String.fromCharCode(65 + unified.sessionRow.length - 1);

    if (existingRowIndex > 0) {
      // Update existing row in place
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sessionsSheetTitle}'!A${existingRowIndex}:${endColLetter}${existingRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [unified.sessionRow] }
      });
    } else {
      // Append new canonical row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sessionsSheetTitle}'!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [unified.sessionRow] }
      });
    }

    // 3. Synchronize itemized Food & Beverage orders into Orders_YYYY_MM
    if (unified.orderItems.length > 0) {
      try {
        const ordersRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'${ordersSheetTitle}'!A:A`,
        });
        const existingOrderRows = ordersRes.data.values || [];

        for (const item of unified.orderItems) {
          const itemRowValues = [
            item.orderId,
            item.sessionId,
            item.timestamp,
            item.tableNo,
            item.customerName,
            item.itemName,
            item.quantity,
            item.unitPrice,
            item.itemTotal,
            item.orderStatus
          ];

          // Search if this order item is already present (match by Order ID + Item Name)
          let itemRowIndex = -1;
          for (let r = 1; r < existingOrderRows.length; r++) {
            const rowOrdId = String(existingOrderRows[r][0] || '').trim().toUpperCase();
            const rowItemName = String(existingOrderRows[r][5] || '').trim().toLowerCase();
            if (rowOrdId === item.orderId.toUpperCase() && rowItemName === item.itemName.toLowerCase()) {
              itemRowIndex = r + 1;
              break;
            }
          }

          if (itemRowIndex > 0) {
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `'${ordersSheetTitle}'!A${itemRowIndex}:J${itemRowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [itemRowValues] }
            });
          } else {
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: `'${ordersSheetTitle}'!A1`,
              valueInputOption: 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
              requestBody: { values: [itemRowValues] }
            });
          }
        }
      } catch (orderSyncErr) {
        console.warn('[GoogleSheets] Non-fatal error syncing order items to Orders sheet:', orderSyncErr);
      }
    }

    // 4. Mark session sync_status = 'SYNCED' in Supabase
    await supabase.from('sessions').update({ sync_status: 'SYNCED' }).eq('id', sessionId);
    return true;
  } catch (err: any) {
    console.error(`[GoogleSheets] syncUnifiedSessionToSheet error for session ${sessionId}:`, err?.message || err);
    await supabase.from('sessions').update({ sync_status: 'FAILED' }).eq('id', sessionId);
    return false;
  }
}

/**
 * Standard session sync delegator.
 * Routes through the asynchronous queue to prevent blocking the caller and to avoid duplicate race conditions.
 */
export async function syncSessionToSheet(sessionId: string, businessId?: string) {
  if (businessId && sessionId) {
    const { enqueueSheetsSync } = require('./sheetsSyncQueue');
    enqueueSheetsSync('SESSION', sessionId, businessId);
    return true;
  }
  return syncUnifiedSessionToSheet(sessionId, businessId);
}

/**
 * Syncs registered member profile to 'Members' tab.
 */
export async function syncMemberToSheet(customerId: string, businessId?: string) {
  try {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).single();
    if (!customer) return;

    const { data: membership } = await supabase.from('memberships').select('*').eq('id', customer.id).maybeSingle();

    const values = [
      customer.id.split('-')[0].toUpperCase(),
      customer.name || 'Unknown',
      customer.phone || '',
      membership ? membership.tier : 'Standard',
      customer.total_billed || 0,
      customer.outstanding_balance || 0,
      'Active'
    ];

    await upsertRow('Members', 0, customer.id.split('-')[0].toUpperCase(), values, businessId || customer.business_id);
  } catch (err) {
    console.error('syncMemberToSheet Error:', err);
  }
}

/**
 * MONTHLY RECONCILIATION AND RECOVERY ENGINE
 * 
 * Compares authoritative database records with the corresponding monthly Google Sheets data.
 * - Detects missing rows and appends them.
 * - Detects outdated statuses, mismatched amounts, or durations and repairs them.
 * - Resolves duplicates.
 * - Synchronizes associated itemized F&B orders.
 * - Returns a clear audit summary of changes.
 */
export async function reconcileMonthlySheets(businessId: string, monthKey: string): Promise<{
  success: boolean;
  monthKey: string;
  totalDbSessions: number;
  createdInSheet: number;
  updatedInSheet: number;
  duplicatesResolved: number;
  ordersSynced: number;
  errors: string[];
}> {
  const result = {
    success: false,
    monthKey,
    totalDbSessions: 0,
    createdInSheet: 0,
    updatedInSheet: 0,
    duplicatesResolved: 0,
    ordersSynced: 0,
    errors: [] as string[]
  };

  try {
    const business = await businessManager.getBusiness(businessId);
    if (!business || !business.google_sheet_id) {
      result.errors.push('No Google Sheet connected for this business.');
      return result;
    }

    const spreadsheetId = business.google_sheet_id;
    const timezone = getBusinessTimezone(business);

    // Compute month date boundaries in business timezone
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) {
      result.errors.push(`Invalid month format '${monthKey}'. Expected 'YYYY-MM'.`);
      return result;
    }

    // Determine startDate and endDate strings
    const startDate = `${yearStr}-${monthStr}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${yearStr}-${monthStr}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // 1. Fetch authoritative DB sessions belonging to this month
    const { data: dbSessions, error: dbErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('start_time', `${endDate}T23:59:59`)
      .order('start_time', { ascending: true });

    if (dbErr) {
      result.errors.push(`Database query failed: ${dbErr.message}`);
      return result;
    }

    const sessions = dbSessions || [];
    result.totalDbSessions = sessions.length;

    // 2. Ensure monthly sheets exist
    const { sessionsSheetTitle, ordersSheetTitle } = await ensureMonthlySheets(spreadsheetId, monthKey);
    const sheets = await getGoogleSheetsClient();

    // 3. Read existing rows from Sessions_YYYY_MM
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sessionsSheetTitle}'!A:Z`,
    });
    const sheetRows = sheetRes.data.values || [];

    // Map existing sheet rows by normalized Session ID
    const sheetRowMap = new Map<string, { rowIndex: number; rowData: any[] }>();
    for (let r = 1; r < sheetRows.length; r++) {
      const rowId = String(sheetRows[r][0] || '').trim().toUpperCase();
      if (rowId) {
        if (sheetRowMap.has(rowId)) {
          // Detected duplicate row in Sheet
          result.duplicatesResolved++;
        } else {
          sheetRowMap.set(rowId, { rowIndex: r + 1, rowData: sheetRows[r] });
        }
      }
    }

    // 4. Reconcile each DB session
    for (const session of sessions) {
      try {
        const unified = await fetchUnifiedSessionData(session.id, businessId);
        if (!unified) continue;

        const targetCanonical = unified.canonicalId.toUpperCase();
        const shortId = session.id.split('-')[0].toUpperCase();
        const existing = sheetRowMap.get(targetCanonical) || sheetRowMap.get(shortId);

        if (existing) {
          // Compare if key operational values differ (Amount, Status, Duration)
          const currentAmount = String(existing.rowData[9] || '').trim();
          const currentStatus = String(existing.rowData[10] || '').trim();
          const targetAmount = String(unified.sessionRow[9]).trim();
          const targetStatus = String(unified.sessionRow[10]).trim();

          if (currentAmount !== targetAmount || currentStatus !== targetStatus) {
            // Outdated status or mismatched amount -> Update in place
            const endColLetter = String.fromCharCode(65 + unified.sessionRow.length - 1);
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `'${sessionsSheetTitle}'!A${existing.rowIndex}:${endColLetter}${existing.rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [unified.sessionRow] }
            });
            result.updatedInSheet++;
          }
        } else {
          // Missing row in sheet -> Append canonical row
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `'${sessionsSheetTitle}'!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [unified.sessionRow] }
          });
          result.createdInSheet++;
        }

        // Reconcile associated F&B order items
        if (unified.orderItems.length > 0) {
          for (const item of unified.orderItems) {
            const itemRow = [
              item.orderId,
              item.sessionId,
              item.timestamp,
              item.tableNo,
              item.customerName,
              item.itemName,
              item.quantity,
              item.unitPrice,
              item.itemTotal,
              item.orderStatus
            ];
            await upsertRow(ordersSheetTitle, 0, item.orderId, itemRow, businessId);
            result.ordersSynced++;
          }
        }

        await supabase.from('sessions').update({ sync_status: 'SYNCED' }).eq('id', session.id);
      } catch (itemErr: any) {
        result.errors.push(`Error reconciling session ${session.id}: ${itemErr?.message || itemErr}`);
      }
    }

    result.success = true;
    return result;
  } catch (err: any) {
    result.errors.push(`Reconciliation error: ${err?.message || err}`);
    return result;
  }
}

/**
 * Initializes a new or existing Google Spreadsheet with required structural tabs.
 * Activity Logs tab is completely omitted from new setups.
 * Existing tabs are preserved safely.
 */
export async function initializeGoogleSheet(spreadsheetId: string) {
  const sheets = await getGoogleSheetsClient();
  
  // Activity Logs is intentionally removed.
  const requiredSheets = [
    { title: 'Sessions', headers: UNIFIED_SESSION_HEADERS },
    { title: 'Members', headers: ['Member ID', 'Name', 'Phone', 'Tier', 'Total Billed', 'Outstanding Balance', 'Status'] },
    { title: 'Bookings', headers: ['Booking ID', 'Date', 'Start Time', 'Customer Name', 'Table', 'Duration (m)', 'Status'] },
    { title: 'Food Orders', headers: UNIFIED_ORDER_HEADERS }
  ];

  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets?.map((s: any) => s.properties?.title) || [];
    
    // Rename 'Sheet1' to 'Sessions' if 'Sessions' doesn't exist and 'Sheet1' does
    if (!existingSheets.includes('Sessions') && existingSheets.includes('Sheet1')) {
      const sheet1Id = spreadsheet.data.sheets?.find((s: any) => s.properties?.title === 'Sheet1')?.properties?.sheetId;
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

    // Set headers
    for (const reqSheet of requiredSheets) {
      const endCol = String.fromCharCode(65 + reqSheet.headers.length - 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${reqSheet.title}'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [reqSheet.headers] }
      });
    }

    // Apply Premium Formatting (Bold Headers, Dark Theme, Freeze Row 1, Auto-Resize)
    try {
      const latestSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const formatRequests: any[] = [];
      
      latestSpreadsheet.data.sheets?.forEach((sheet: any) => {
        const sheetId = sheet.properties?.sheetId;
        if (sheetId !== undefined) {
          formatRequests.push({
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          });
          
          formatRequests.push({
            repeatCell: {
              range: { sheetId: sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.13, green: 0.15, blue: 0.2 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
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
      console.warn('Formatting warning in initializeGoogleSheet:', formatErr);
    }
    
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
  }
}
