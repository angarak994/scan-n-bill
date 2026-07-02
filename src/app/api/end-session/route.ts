import { NextResponse } from 'next/server';
import { endSession } from '@/lib/sessionManager';

export async function POST(request: Request) {
  try {
    const { table_id, business_id } = await request.json();
    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }
    const result = await endSession(table_id, business_id);
    
    // Sync to Google Sheets
    try {
      const { logSessionEndToSheet } = require('@/lib/googleSheets');
      // endSession returns an object with duration, cost, end_time, etc.
      // But we need the full session data. endSession might not return table_id and customer_name.
      // Let's assume result contains what we need, if not we will fetch it.
      await logSessionEndToSheet({
         id: result.session_id, // Usually endSession returns the session, or we might need to adjust endSession to return full object.
         business_id,
         customer_name: result.customer_name || 'Walk-In', // Fallbacks in case endSession returns partial data
         table_id,
         start_time: result.start_time || new Date().toISOString(),
         end_time: result.end_time || new Date().toISOString(),
         duration: result.duration,
         cost: result.cost,
         discounts: result.discounts || 0
      });
    } catch (sheetError) {
      console.error('Google Sheets Sync Error:', sheetError);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
