import { google } from 'googleapis';

export interface Session {
  id?: string; // used internally as row index
  table_id: string;
  game_type: 'snooker' | 'pool';
  start_time: string;
  end_time: string | null;
  session_type: 'AM' | 'PM';
  rate_per_hour: number;
  duration: string | null;
  cost: number | null;
  status: 'ACTIVE' | 'COMPLETED';
}

const getSheetsClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
};

const getSheetId = () => {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined in the environment.");
  return id;
};

const RANGE = 'Sheet1!A:I';

export const sessionRepository = {
  findActiveByTable: async (table_id: string): Promise<Session | null> => {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: RANGE,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;
    
    // Header is row 1. Data starts at row 2 (index 1).
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Format: table_id (0) | game_type (1) | start_time (2) | end_time (3) | session_type (4) | rate_per_hour (5) | duration_hours (6) | cost (7) | status (8)
      if (row[0] === table_id && row[8] === 'ACTIVE') {
        return {
          id: (i + 1).toString(), // row number
          table_id: row[0],
          game_type: row[1] as 'snooker' | 'pool',
          start_time: row[2],
          end_time: row[3] || null,
          session_type: row[4] as 'AM' | 'PM',
          rate_per_hour: parseFloat(row[5]),
          duration: row[6] || null,
          cost: row[7] ? parseFloat(row[7]) : null,
          status: row[8] as 'ACTIVE' | 'COMPLETED',
        };
      }
    }
    return null;
  },

  findActiveCount: async (): Promise<number> => {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: RANGE,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) return 0;
    
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][8] === 'ACTIVE') {
        count++;
      }
    }
    return count;
  },

  findById: async (id: string): Promise<Session | null> => {
    // id is the row number
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: `Sheet1!A${id}:I${id}`,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id,
      table_id: row[0],
      game_type: row[1] as 'snooker' | 'pool',
      start_time: row[2],
      end_time: row[3] || null,
      session_type: row[4] as 'AM' | 'PM',
      rate_per_hour: parseFloat(row[5]),
      duration: row[6] || null,
      cost: row[7] ? parseFloat(row[7]) : null,
      status: row[8] as 'ACTIVE' | 'COMPLETED',
    };
  },

  create: async (session: Session): Promise<void> => {
    const sheets = getSheetsClient();
    const row = [
      session.table_id,
      session.game_type,
      session.start_time,
      '', // end_time
      session.session_type,
      session.rate_per_hour.toString(),
      '', // duration
      '', // cost
      session.status,
    ];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: getSheetId(),
      range: 'Sheet1!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  },

  update: async (id: string, updates: Partial<Session>): Promise<void> => {
    const session = await sessionRepository.findById(id);
    if (!session) return;
    
    const updatedSession = { ...session, ...updates };
    const row = [
      updatedSession.table_id,
      updatedSession.game_type,
      updatedSession.start_time,
      updatedSession.end_time || '',
      updatedSession.session_type,
      updatedSession.rate_per_hour.toString(),
      updatedSession.duration || '',
      updatedSession.cost?.toString() || '',
      updatedSession.status,
    ];
    
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSheetId(),
      range: `Sheet1!A${id}:I${id}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  }
};
