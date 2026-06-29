import { google } from 'googleapis';
import { businessManager } from '../businessManager';
import { supabase } from '../supabaseClient';

export interface Session {
  id?: string;
  business_id?: string;
  date: string;
  customer_name: string;
  table_id: string;
  game_type: string;
  start_time: string;
  end_time: string | null;
  duration: string | null;
  applied_pricing: string | null;
  cost: number | null;
  status: 'ACTIVE' | 'COMPLETED';
  food_cost?: number;
  num_players?: number;
}

function toSheetsDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric'
    });
    return formatter.format(d);
  } catch {
    return isoString;
  }
}

function toSheetsTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    return formatter.format(d).replace(' am', ' AM').replace(' pm', ' PM');
  } catch {
    return isoString;
  }
}

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

const getSheetConfig = async (sheetsClient: any, businessId?: string) => {
  let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    if (business && business.google_sheet_id) {
      spreadsheetId = business.google_sheet_id;
    }
  }
  if (!spreadsheetId) throw new Error("Spreadsheet ID is not defined.");

  const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const firstSheet = spreadsheet.data.sheets?.[0]?.properties;
  
  return {
    spreadsheetId,
    sheetTitle: firstSheet?.title || 'Sheet1',
    sheetId: firstSheet?.sheetId || 0
  };
};

export const sessionRepository = {
  findActiveByTable: async (table_id: string, businessId?: string): Promise<Session | null> => {
    if (!businessId) return null;
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .eq('table_id', table_id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (error || !data) return null;
    return data as Session;
  },

  findActiveCount: async (businessId?: string): Promise<number> => {
    if (!businessId) return 0;
    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'ACTIVE');

    if (error) return 0;
    return count || 0;
  },

  findAllToday: async (dateStr: string, businessId?: string): Promise<Session[]> => {
    if (!businessId) return [];
    
    // Fetch all active sessions (could cross over midnight) OR sessions completed today
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('business_id', businessId)
      .or(`date.eq.${dateStr},status.eq.ACTIVE`);

    if (error || !data) return [];
    return data as Session[];
  },

  findById: async (id: string, businessId?: string): Promise<Session | null> => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Session;
  },

  create: async (session: Session, businessId?: string): Promise<void> => {
    if (!businessId) throw new Error("businessId required for Supabase DB");

    // 1. Insert into Supabase (Source of Truth)
    const { data: insertedData, error } = await supabase
      .from('sessions')
      .insert([{
        id: session.id,
        business_id: businessId,
        date: session.date,
        customer_name: session.customer_name,
        table_id: session.table_id,
        game_type: session.game_type,
        start_time: session.start_time,
        status: session.status,
        food_cost: session.food_cost || 0,
        num_players: session.num_players || 1,
      }])
      .select('id')
      .single();

    if (error || !insertedData) {
      throw new Error("Failed to create session in Database: " + error?.message);
    }

    // 2. Sync append to Google Sheets
    // Awaited to prevent Vercel Serverless from killing the background process
    try {
      const sheets = getSheetsClient();
      const config = await getSheetConfig(sheets, businessId);

      // Dynamically fetch headers to prevent column mismatch if user rearranges sheet
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${config.sheetTitle}'!1:1`,
      });
      const headers = headerResponse.data.values?.[0]?.map(h => String(h).trim().toLowerCase()) || [];
      
      const getIdx = (name: string) => headers.indexOf(name);
      const rowLength = Math.max(headers.length, 11); // Ensure enough columns
      const row = new Array(rowLength).fill('');
      
      const setVal = (colName: string, val: string) => {
        const idx = getIdx(colName);
        if (idx !== -1) {
          row[idx] = val;
        }
      };

      const shortId = session.id ? session.id.split('-')[0].toUpperCase() : 'UNKNOWN';
      const formattedCustomerName = session.num_players && session.num_players > 1 
        ? `${session.customer_name} (${session.num_players} Players)`
        : session.customer_name;

      // If headers are somehow missing or non-standard, fallback to default indices
      if (getIdx('date') === -1) {
        row[0] = shortId;
        row[1] = `'${toSheetsDate(session.start_time)}`;
        row[2] = formattedCustomerName;
        row[3] = session.table_id;
        row[4] = session.game_type;
        row[5] = `'${toSheetsTime(session.start_time)}`;
        row[10] = session.status;
      } else {
        setVal('session id', shortId);
        setVal('date', `'${toSheetsDate(session.start_time)}`);
        setVal('customer name', formattedCustomerName);
        setVal('table no', session.table_id);
        setVal('game type', session.game_type);
        setVal('start time', `'${toSheetsTime(session.start_time)}`);
        setVal('status', session.status);
      }
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `'${config.sheetTitle}'!A:K`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });

      // Mark synced in DB (Optional enhancement)
      await supabase.from('sessions').update({ sync_status: 'SYNCED' }).eq('id', insertedData.id);
    } catch (sheetError) {
      console.error("Google Sheets Sync Error on Create:", sheetError);
      await supabase.from('sessions').update({ sync_status: 'FAILED' }).eq('id', insertedData.id);
    }
  },

  update: async (id: string, updates: Partial<Session>, businessId?: string): Promise<void> => {
    // 1. Update Supabase
    const { data: updatedData, error } = await supabase
      .from('sessions')
      .update({
        end_time: updates.end_time,
        duration: updates.duration,
        applied_pricing: updates.applied_pricing,
        cost: updates.cost,
        status: updates.status,
        food_cost: updates.food_cost,
        num_players: updates.num_players,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updatedData) {
      throw new Error("Failed to update session in Database: " + error?.message);
    }

    // 2. Sync update to Google Sheets
    // Awaited to prevent Vercel Serverless from killing the background process
    try {
      const sheets = getSheetsClient();
      const config = await getSheetConfig(sheets, businessId);

      // To update the row in Google sheets, we dynamically map headers
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${config.sheetTitle}'`, // Get entire sheet to find the row
      });
      
      const rows = response.data.values;
      if (!rows || rows.length === 0) return;
      
      const headers = rows[0].map(h => String(h).trim().toLowerCase());
      const idIdx = headers.indexOf('session id');
      
      // Fallback index if headers are missing
      const searchIdIdx = idIdx !== -1 ? idIdx : 0;
      const shortId = updatedData.id ? updatedData.id.split('-')[0].toUpperCase() : 'UNKNOWN';
      
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        const sheetIdVal = String(rows[i][searchIdIdx] || '').trim().toUpperCase();
        if (sheetIdVal === shortId) {
          rowIndex = i + 1; // 1-based index
          break;
        }
      }

      if (rowIndex !== -1) {
        const rowLength = Math.max(headers.length, 11); // Ensure we have enough columns to K
        const row = new Array(rowLength).fill('');
        
        // Preserve existing data in the row for columns we aren't updating, in case user added custom columns
        const existingRow = rows[rowIndex - 1] || [];
        for (let j = 0; j < row.length; j++) {
          row[j] = existingRow[j] || '';
        }

        const setVal = (colName: string, val: string, fallbackIdx: number) => {
          const idx = headers.indexOf(colName);
          if (idx !== -1) {
            row[idx] = val;
          } else if (fallbackIdx < row.length) {
            row[fallbackIdx] = val; // Fallback
          }
        };

        const formattedCustomerName = updatedData.num_players && updatedData.num_players > 1 
          ? `${updatedData.customer_name} (${updatedData.num_players} Players)`
          : updatedData.customer_name;

        setVal('session id', shortId, 0);
        setVal('date', `'${toSheetsDate(updatedData.start_time)}`, 1);
        setVal('customer name', formattedCustomerName, 2);
        setVal('table no', updatedData.table_id, 3);
        setVal('game type', updatedData.game_type, 4);
        setVal('start time', `'${toSheetsTime(updatedData.start_time)}`, 5);
        setVal('end time', `'${toSheetsTime(updatedData.end_time)}`, 6);
        setVal('duration', updatedData.duration || '', 7);
        setVal('applied pricing', updatedData.applied_pricing || '', 8);
        setVal('amount', updatedData.cost?.toString() || '', 9);
        setVal('status', updatedData.status, 10);

        // Update just the exact row, across the required number of columns
        const endColLetter = String.fromCharCode(65 + row.length - 1); // 65 = 'A'
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: `'${config.sheetTitle}'!A${rowIndex}:${endColLetter}${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [row] },
        });

        await supabase.from('sessions').update({ sync_status: 'SYNCED' }).eq('id', id);
      }
    } catch (sheetError) {
      console.error("Google Sheets Sync Error on Update:", sheetError);
      await supabase.from('sessions').update({ sync_status: 'FAILED' }).eq('id', id);
    }
  }
};
