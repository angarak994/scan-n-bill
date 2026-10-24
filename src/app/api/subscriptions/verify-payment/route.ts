import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId } = await request.json();

    if (!razorpay_payment_id || !razorpay_order_id) {
      return NextResponse.json({ error: 'Missing payment transaction credentials' }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    // Cryptographic signature verification using constant-time comparison
    if (secret && process.env.NODE_ENV === 'production') {
      if (!razorpay_signature) {
        return NextResponse.json({ error: 'Missing payment signature header' }, { status: 400 });
      }

      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const sigBuffer = Buffer.from(razorpay_signature);
      const genBuffer = Buffer.from(generatedSignature);

      if (sigBuffer.length !== genBuffer.length || !crypto.timingSafeEqual(sigBuffer, genBuffer)) {
        return NextResponse.json({ error: 'Payment cryptographic verification failed. Signature mismatch.' }, { status: 400 });
      }
    }

    // Idempotency: Prevent replay attacks
    const { data: existingPayment } = await supabase
      .from('payment_logs')
      .select('id')
      .eq('gateway_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json({ success: true, message: 'Payment already processed.' });
    }

    // Fetch agreed price from subscription / business
    let agreedPricePaisa = 199900;
    let isYearly = false;
    try {
      const { data: sub } = await supabase
        .from('business_subscriptions')
        .select('*')
        .eq('business_id', session.businessId)
        .maybeSingle();
      if (sub?.agreed_price_paisa) agreedPricePaisa = Number(sub.agreed_price_paisa);
      if (sub?.billing_interval === 'yearly') isYearly = true;
    } catch {}

    const amountInr = agreedPricePaisa / 100;
    const periodDays = isYearly ? 365 : 30;

    // 1. Log payment (replay prevention)
    try {
      await supabase.from('payment_logs').insert([{
        business_id: session.businessId,
        amount: amountInr,
        currency: 'INR',
        status: 'SUCCESS',
        gateway_payment_id: razorpay_payment_id,
        created_at: new Date().toISOString(),
      }]);
    } catch (e: any) {
      console.warn('[PaymentLog] Warning:', e?.message);
    }

    // 2. Activate or renew subscription
    try {
      await supabase
        .from('business_subscriptions')
        .update({
          status: 'active',
          current_period_end: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('business_id', session.businessId);
    } catch (e: any) {
      console.warn('[SubscriptionUpdate] Warning:', e?.message);
    }

    const { invalidateEntitlementCache } = require('@/lib/entitlements');
    invalidateEntitlementCache(session.businessId);

    return NextResponse.json({ success: true, activatedUntil: new Date(Date.now() + periodDays * 86400000).toISOString() });

  } catch (error: any) {
    console.error('Verify payment error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
