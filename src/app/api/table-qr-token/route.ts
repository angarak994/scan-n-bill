import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { regenerateTableQrToken, getOrCreateTableQrToken } from '@/lib/security/qrTokenService';
import { checkRateLimitShared, getTrustedClientIp, createRateLimitResponse } from '@/lib/utils/rateLimit';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Business owner login required' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    const ip = getTrustedClientIp(request);

    // Rate limit token management operations
    const rateCheck = await checkRateLimitShared(`qr_manage_${ip}`, 20, 60 * 1000, true);
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfter, rateCheck.correlationId);
    }

    const body = await request.json();
    const tableId = body.table_id || body.tableId;
    const action = body.action || 'get'; // 'get' | 'regenerate'

    if (!tableId) {
      return NextResponse.json({ error: 'table_id is required' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';

    if (action === 'regenerate') {
      const { newToken, correlationId } = await regenerateTableQrToken(businessId, tableId);
      return NextResponse.json({
        success: true,
        action: 'regenerated',
        token: newToken,
        qrUrl: `${origin}/qr/t/${newToken}`,
        correlationId
      });
    } else {
      const token = await getOrCreateTableQrToken(businessId, tableId);
      return NextResponse.json({
        success: true,
        action: 'retrieved',
        token,
        qrUrl: `${origin}/qr/t/${token}`
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[table-qr-token] Error managing QR token:', error);
    return NextResponse.json({ error: error.message || 'Failed to manage QR token' }, { status: 500 });
  }
}
