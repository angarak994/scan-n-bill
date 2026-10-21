import { NextResponse, after } from 'next/server';
import { endSession } from '@/lib/sessionManager';
import { getSession } from '@/lib/auth';
import { checkRateLimit, getIpAddress } from '@/lib/utils/rateLimit';

export async function POST(request: Request) {
  try {
    const ip = getIpAddress(request);
    if (!checkRateLimit(`end_sess_${ip}`, 60, 10 * 60 * 1000)) {
       return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const sessionCookie = await getSession();
    const body = await request.json();
    let table_id = body.table_id || body.tableId;
    let business_id = body.business_id || body.businessId;
    let amount_paid = body.amount_paid !== undefined ? body.amount_paid : body.amountPaid;
    let payment_method = body.payment_method || body.paymentMethod || 'Cash';
    let due_date = body.due_date || body.dueDate;
    let split_payments = body.split_payments || body.splitPayments;
    let source = body.source || 'QR';
    
    if (sessionCookie && sessionCookie.businessId) {
      if (business_id && sessionCookie.businessId !== business_id) {
        return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
      }
      business_id = sessionCookie.businessId; // Force business_id to match token
      source = 'System';
    } else {
      // Unauthenticated QR Flow
      if (!business_id) {
        return NextResponse.json({ error: 'business_id is required for QR actions' }, { status: 400 });
      }
      const { businessManager } = require('@/lib/businessManager');
      const business = await businessManager.getBusiness(business_id);
      if (!business) return NextResponse.json({ error: 'Invalid business' }, { status: 404 });

      const configuredTables = business.tables || [];
      const matchedTable = configuredTables.find((t: any) =>
        String(t.id).trim().toLowerCase() === String(table_id).trim().toLowerCase() ||
        String(t.name).trim().toLowerCase() === String(table_id).trim().toLowerCase()
      );
      if (configuredTables.length > 0 && !matchedTable) {
        return NextResponse.json({ error: `Table '${table_id}' is not configured for this business.` }, { status: 400 });
      }
      if (matchedTable) {
        table_id = matchedTable.id;
      }
    }

    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }
    const result = await endSession(table_id, business_id, source, amount_paid, payment_method);

    // Non-blocking Google Sheets background flush:
    // Uses Next.js after() to keep serverless function alive until Sheets sync completes,
    // while returning HTTP 200 to the client immediately (eliminates up to 6s response delay).
    if (result && result.session_id && business_id) {
      const { scheduleBackgroundTask, flushSheetsSyncQueue } = require('@/lib/sheetsSyncQueue');
      scheduleBackgroundTask(async () => {
        try {
          await flushSheetsSyncQueue(business_id, 4000);
        } catch (sheetSyncErr) {
          console.warn('[EndSession] Background sheets sync flush warning:', sheetSyncErr);
        }
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
