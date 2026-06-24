import { google } from 'googleapis';

export interface Session {
  id?: string; // used internally as row index
  table_id: string;
  game_type: string;
  start_time: string;
  end_time: string | null;
  session_type: string;
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

// Reading columns A to I (9 columns) 
// Table ID(0) | Game Type(1) | Start Time(2) | End Time(3) | AM/PM(4) | Blank(5) | Duration(6) | Cost(7) | Status(8)
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
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === table_id && row[8] === 'ACTIVE') {
        return {
          id: (i + 1).toString(),
          table_id: row[0],
          game_type: row[1],
          start_time: row[2],
          end_time: row[3] || null,
          session_type: row[4],
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
      game_type: row[1],
      start_time: row[2],
      end_time: row[3] || null,
      session_type: row[4],
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
      `'${session.start_time}`,
      '', // end_time
      session.session_type,
      '', // blank column F
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
      `'${updatedSession.start_time}`,
      updatedSession.end_time ? `'${updatedSession.end_time}` : '',
      updatedSession.session_type,
      '', // blank column F
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
