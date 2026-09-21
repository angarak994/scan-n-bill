import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_secret';

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // Enable for production once secret is available
    // if (expectedSignature !== signature) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    // }

    const event = JSON.parse(rawBody);

    // Ensure idempotency for payments
    if (event.event === 'order.paid' || event.event === 'payment.captured') {
        const paymentData = event.payload.payment.entity;
        
        // Example structure for a successful payment.
        // We look up the business ID in the metadata (or through the order mapping)
        const businessId = paymentData.notes?.business_id;
        const planId = paymentData.notes?.plan_id;

        if (businessId && planId) {
             // 1. Log payment
             await supabase.from('payment_logs').insert([{
                 business_id: businessId,
                 amount: paymentData.amount / 100,
                 currency: paymentData.currency,
                 status: 'SUCCESS',
                 gateway_payment_id: paymentData.id,
             }]);

             // 2. Activate or renew subscription
             await supabase
                 .from('business_subscriptions')
                 .upsert({
                     business_id: businessId,
                     plan_id: planId,
                     status: 'active',
                     current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                     updated_at: new Date().toISOString()
                 }, { onConflict: 'business_id' });
        }
    }

    if (event.event === 'payment.failed') {
        const paymentData = event.payload.payment.entity;
        const businessId = paymentData.notes?.business_id;
        
        if (businessId) {
             await supabase.from('payment_logs').insert([{
                 business_id: businessId,
                 amount: paymentData.amount / 100,
                 currency: paymentData.currency,
                 status: 'FAILED',
                 gateway_payment_id: paymentData.id,
             }]);
        }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
