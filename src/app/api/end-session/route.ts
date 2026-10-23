import { NextResponse, after } from 'next/server';
import { endSession } from '@/lib/sessionManager';
import { getSession } from '@/lib/auth';
import { checkRateLimit, checkRateLimitShared, createRateLimitResponse, getIpAddress } from '@/lib/utils/rateLimit';

export async function POST(request: Request) {
  try {
    const ip = getIpAddress(request);
    const rateCheck = await checkRateLimitShared(`end_sess_${ip}`, 60, 10 * 60 * 1000, true);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfter, rateCheck.correlationId);
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
      // Customer QR Flow: verify session token credential
      const { verifyQrSessionToken } = require('@/lib/security/qrTokenService');
      const qrAuth = await verifyQrSessionToken(request, undefined, table_id);
      if (!qrAuth.authorized) {
        return NextResponse.json({ error: qrAuth.error || 'Unauthorized: Valid session credential required.' }, { status: 401 });
      }
      business_id = qrAuth.businessId;
      table_id = qrAuth.tableId;
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

    const response = NextResponse.json(result, { status: 200 });
    try {
      const { clearQrSessionCookie } = require('@/lib/security/qrTokenService');
      clearQrSessionCookie(response);
    } catch (clearErr) {}

    return response;
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
