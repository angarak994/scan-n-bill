import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuthoritativeOrder } from '@/lib/services/foodOrderService';
import { verifyQrSessionToken } from '@/lib/security/qrTokenService';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    const isOwner = Boolean(sessionCookie && sessionCookie.businessId);

    const body = await request.json();
    let sessionId = body.session_id || body.sessionId;
    let businessId = body.business_id || body.businessId;
    const cart = body.cart;
    const customPrices = body.customPrices || {};
    const idempotencyKey = body.idempotency_key || body.idempotencyKey || request.headers.get('x-idempotency-key') || undefined;

    if (!sessionId || !cart) {
      return NextResponse.json({ error: 'Missing required fields: session_id and cart are required.' }, { status: 400 });
    }

    // Owner authorization vs QR session authorization
    if (sessionCookie?.businessId) {
      if (businessId && sessionCookie.businessId !== businessId) {
        return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
      }
      businessId = sessionCookie.businessId;
    } else {
      // Customer QR session authorization
      // Verify session token from cookie or header to prevent IDOR attacks
      const qrAuth = await verifyQrSessionToken(request, sessionId);
      if (!qrAuth.authorized) {
        return NextResponse.json({ error: qrAuth.error || 'Unauthorized: Invalid or expired session credential.' }, { status: 401 });
      }
      // Force authoritative businessId and sessionId from verified credential
      businessId = qrAuth.businessId;
      sessionId = qrAuth.sessionId;
    }

    const orderResult = await createAuthoritativeOrder({
      businessId,
      sessionId,
      cart,
      customPrices,
      source: isOwner ? 'Dashboard' : 'QR',
      idempotencyKey,
      isOwner
    });

    return NextResponse.json({
      success: true,
      order_id: orderResult.orderId,
      order_ref: orderResult.orderRef,
      order_total: orderResult.orderTotal,
      new_food_cost: orderResult.newFoodCost,
      items: orderResult.lineItems
    }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[place-order] Error placing order:', error);
    return NextResponse.json({ error: error.message || 'Failed to place order' }, { status: 400 });
  }
}
