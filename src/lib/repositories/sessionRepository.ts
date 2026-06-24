import { google } from 'googleapis';

export interface Session {
  id?: string; // used internally as row index
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

// Reading columns A to J (10 columns)
// Date(0) | Customer Name(1) | Table No(2) | Game Type(3) | Start Time(4) | End Time(5) | Duration(6) | Applied Pricing(7) | Amount(8) | Status(9)
const RANGE = 'Sheet1!A:J';

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
      if (row[2] === table_id && row[9] === 'ACTIVE') {
        return {
          id: (i + 1).toString(),
          date: row[0],
          customer_name: row[1],
          table_id: row[2],
          game_type: row[3],
          start_time: row[4],
          end_time: row[5] || null,
          duration: row[6] || null,
          applied_pricing: row[7] || null,
          cost: row[8] ? parseFloat(row[8]) : null,
          status: row[9] as 'ACTIVE' | 'COMPLETED',
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
      if (rows[i][9] === 'ACTIVE') {
        count++;
      }
    }
    return count;
  },

  findAllToday: async (dateStr: string): Promise<Session[]> => {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: RANGE,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];
    
    const sessions: Session[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === dateStr || row[9] === 'ACTIVE') {
        sessions.push({
          id: (i + 1).toString(),
          date: row[0],
          customer_name: row[1],
          table_id: row[2],
          game_type: row[3],
          start_time: row[4],
          end_time: row[5] || null,
          duration: row[6] || null,
          applied_pricing: row[7] || null,
          cost: row[8] ? parseFloat(row[8]) : null,
          status: row[9] as 'ACTIVE' | 'COMPLETED',
        });
      }
    }
    return sessions;
  },

  findById: async (id: string): Promise<Session | null> => {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: getSheetId(),
      range: `Sheet1!A${id}:J${id}`,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id,
      date: row[0],
      customer_name: row[1],
      table_id: row[2],
      game_type: row[3],
      start_time: row[4],
      end_time: row[5] || null,
      duration: row[6] || null,
      applied_pricing: row[7] || null,
      cost: row[8] ? parseFloat(row[8]) : null,
      status: row[9] as 'ACTIVE' | 'COMPLETED',
    };
  },

  create: async (session: Session): Promise<void> => {
    const sheets = getSheetsClient();
    
    // First, dynamically find the sheetId of the first sheet to insert a row
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: getSheetId(),
    });
    const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId || 0;

    // Insert a new blank row at Row 2 (index 1)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: getSheetId(),
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: 1,
                endIndex: 2
              },
              inheritFromBefore: false
            }
          }
        ]
      }
    });

    const row = [
      session.date,
      session.customer_name,
      session.table_id,
      session.game_type,
      `'${session.start_time}`,
      '', // end_time
      '', // duration
      '', // applied_pricing
      '', // cost
      session.status,
    ];
    
    // Update the newly inserted Row 2
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSheetId(),
      range: 'Sheet1!A2:J2',
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
      updatedSession.date,
      updatedSession.customer_name,
      updatedSession.table_id,
      updatedSession.game_type,
      `'${updatedSession.start_time}`,
      updatedSession.end_time ? `'${updatedSession.end_time}` : '',
      updatedSession.duration || '',
      updatedSession.applied_pricing || '',
      updatedSession.cost?.toString() || '',
      updatedSession.status,
    ];
    
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: getSheetId(),
      range: `Sheet1!A${id}:J${id}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });
  }
};
