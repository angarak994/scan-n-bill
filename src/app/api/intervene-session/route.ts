import { NextResponse, after } from 'next/server';
import { handleSessionIntervention } from '@/lib/services/interventionService';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, session_id, business_id, amount_recovered, payment_method, due_date, transfer_table_id, split_payments } = body;

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    const result = await handleSessionIntervention({
      action,
      session_id,
      business_id,
      amount_recovered,
      payment_method,
      due_date,
      transfer_table_id,
      split_payments,
      performed_by: 'dashboard_user'
    });

    if (business_id) {
      const { scheduleBackgroundTask, flushSheetsSyncQueue } = require('@/lib/sheetsSyncQueue');
      scheduleBackgroundTask(async () => {
        try {
          await flushSheetsSyncQueue(business_id, 4000);
        } catch (sheetSyncErr) {
          console.warn('[InterveneSession] Background sheets sync flush warning:', sheetSyncErr);
        }
      });
    }

    return NextResponse.json({ success: true, sessionResult: result.sessionResult });
  } catch (error: any) {
    console.error('Intervention Error:', error);
    // Determine status code based on error
    let status = error.statusCode || 500;
    if (status === 500) {
      if (error.message.includes('Missing') || error.message.includes('Invalid') || error.message.includes('is not') || error.message.includes('must be registered') || error.message.includes('must pay full')) {
        status = 400;
      } else if (error.message.includes('not found')) {
        status = 404;
      } else if (error.message.includes('in progress') || error.message.includes('already closed')) {
        status = 409;
      }
    }
    return NextResponse.json({ error: error.message }, { status });
  }
}
