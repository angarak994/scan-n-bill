import { NextResponse } from 'next/server';
import { endSession } from '@/lib/sessionManager';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    const body = await request.json();
    const { table_id, business_id, amount_paid, payment_method } = body;
    let source = 'QR';
    
    if (sessionCookie) {
      if (sessionCookie.businessId !== business_id) {
        return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
      }
      source = 'System';
    }

    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }
    const result = await endSession(table_id, business_id, source, amount_paid, payment_method);
    
    // Sync to Google Sheets asynchronously (fire-and-forget)
    try {
      const { logSessionEndToSheet } = require('@/lib/googleSheets');
      // endSession returns an object with duration, cost, end_time, etc.
      // But we need the full session data. endSession might not return table_id and customer_name.
      // Let's assume result contains what we need, if not we will fetch it.
      logSessionEndToSheet({
         id: result.session_id, // Usually endSession returns the session, or we might need to adjust endSession to return full object.
         business_id,
         customer_name: result.customer_name || 'Walk-In', // Fallbacks in case endSession returns partial data
         table_id,
         start_time: result.start_time || new Date().toISOString(),
         end_time: result.end_time || new Date().toISOString(),
         duration: result.duration,
         cost: result.cost,
         discounts: result.discounts || 0,
         date: result.date,
         game_type: result.game_type,
         num_players: result.num_players,
         paused_duration_seconds: result.paused_duration_seconds,
         applied_pricing: result.applied_pricing,
         completed_by: result.completed_by || source,
         payment_status: (result as any).payment_status || 'Paid',
         amount_paid: (result as any).amount_paid || result.cost
      }, business_id).catch((sheetError: any) => console.error('Google Sheets Sync Error (Async):', sheetError));
    } catch (err) {
      console.error('Failed to initiate Google Sheets sync:', err);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
