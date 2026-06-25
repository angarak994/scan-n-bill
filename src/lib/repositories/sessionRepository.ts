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
}

function toSheetsDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const p: Record<string, string> = {};
    parts.forEach(part => p[part.type] = part.value);
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
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
      }])
      .select('id')
      .single();

    if (error || !insertedData) {
      throw new Error("Failed to create session in Database: " + error?.message);
    }

    // 2. Async append to Google Sheets
    try {
      const sheets = getSheetsClient();
      const config = await getSheetConfig(sheets, businessId);

      const row = [
        session.date,
        session.customer_name,
        session.table_id,
        session.game_type,
        toSheetsDateTime(session.start_time),
        '', // end_time
        '', // duration
        '', // applied_pricing
        '', // cost
        session.status,
        insertedData.id // Append the DB ID at the end of the sheet for reference
      ];
      
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
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updatedData) {
      throw new Error("Failed to update session in Database: " + error?.message);
    }

    // 2. Async update to Google Sheets
    try {
      const sheets = getSheetsClient();
      const config = await getSheetConfig(sheets, businessId);

      // To update the row in Google sheets, we need to find which row has this UUID in column K
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: `'${config.sheetTitle}'!A:K`,
      });
      
      const rows = response.data.values;
      if (!rows || rows.length === 0) return;
      
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][10] === id) { // Column K is index 10
          rowIndex = i + 1; // 1-based index
          break;
        }
      }

      if (rowIndex !== -1) {
        const row = [
          updatedData.date,
          updatedData.customer_name,
          updatedData.table_id,
          updatedData.game_type,
          toSheetsDateTime(updatedData.start_time),
          toSheetsDateTime(updatedData.end_time),
          updatedData.duration || '',
          updatedData.applied_pricing || '',
          updatedData.cost?.toString() || '',
          updatedData.status,
          id
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range: `'${config.sheetTitle}'!A${rowIndex}:K${rowIndex}`,
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
