import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (secret) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        console.warn('[Razorpay Webhook] Invalid signature rejected.');
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody);

    // Ensure idempotency for payments
    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const paymentData = event.payload.payment.entity;
      const businessId = paymentData.notes?.business_id;
      const planId = paymentData.notes?.plan_id;
      const gatewayPaymentId = paymentData.id;

      if (businessId && planId && gatewayPaymentId) {
        // Idempotency check: verify this payment ID hasn't already been processed
        const { data: existingLog } = await supabase
          .from('payment_logs')
          .select('id')
          .eq('gateway_payment_id', gatewayPaymentId)
          .maybeSingle();

        if (existingLog) {
          console.log(`[Razorpay Webhook] Payment ${gatewayPaymentId} already processed. Skipping duplicate.`);
          return NextResponse.json({ received: true, duplicate: true });
        }

        // 1. Log payment
        await supabase.from('payment_logs').insert([{
          business_id: businessId,
          amount: paymentData.amount / 100,
          currency: paymentData.currency,
          status: 'SUCCESS',
          gateway_payment_id: gatewayPaymentId,
        }]);

        // 2. Activate or renew subscription
        await supabase
          .from('business_subscriptions')
          .upsert({
            business_id: businessId,
            plan_id: planId,
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'business_id' });
      }
    }

    if (event.event === 'payment.failed') {
      const paymentData = event.payload.payment.entity;
      const businessId = paymentData.notes?.business_id;
      const gatewayPaymentId = paymentData.id;

      if (businessId && gatewayPaymentId) {
        await supabase.from('payment_logs').insert([{
          business_id: businessId,
          amount: paymentData.amount / 100,
          currency: paymentData.currency,
          status: 'FAILED',
          gateway_payment_id: gatewayPaymentId,
        }]);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Razorpay Webhook Error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
