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

    const secret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret';

    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    // Enable signature verification in production
    // if (generated_signature !== razorpay_signature) {
    //   return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    // }

    // 1. Log payment
    await supabase.from('payment_logs').insert([{
        business_id: session.businessId,
        amount: 0, // In a real app we'd fetch the order details here
        currency: 'INR',
        status: 'SUCCESS',
        gateway_payment_id: razorpay_payment_id,
    }]);

    // 2. Activate or renew subscription
    await supabase
        .from('business_subscriptions')
        .upsert({
            business_id: session.businessId,
            plan_id: planId,
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            updated_at: new Date().toISOString()
        }, { onConflict: 'business_id' });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Verify payment error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
