import { NextResponse } from 'next/server';
import { getTableStatus } from '@/lib/sessionManager';
import { getTrustedClientIp, checkRateLimitShared, createRateLimitResponse } from '@/lib/utils/rateLimit';
import { createQrSessionToken, setQrSessionCookie } from '@/lib/security/qrTokenService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ip = getTrustedClientIp(request);
    const rateCheck = await checkRateLimitShared(`status_poll_${ip}`, 120, 60 * 1000);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfter, rateCheck.correlationId);
    }

    const { searchParams } = new URL(request.url);
    const table_id = searchParams.get('table_id') || searchParams.get('tableId') || searchParams.get('table');
    const business_id = searchParams.get('business_id') || searchParams.get('businessId') || searchParams.get('b') || undefined;

    if (!table_id) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }

    const status = await getTableStatus(table_id, business_id);
    const response = NextResponse.json(status);

    if (status.status === 'active' && status.id && business_id) {
      try {
        const token = await createQrSessionToken({
          businessId: business_id,
          tableId: status.table_id || table_id,
          sessionId: status.id
        });
        setQrSessionCookie(response, token);
      } catch (tokenErr) {
        // Silently skip if token generation fails on transient error
      }
    }

    return response;
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 500 });
  }
}
