import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    // Get the plan details from Supabase
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Check for developer-negotiated custom subscription price
    let agreedPricePaisa: number | null = null;
    let billingCurrency = 'INR';

    try {
      const { data: sub } = await supabase
        .from('business_subscriptions')
        .select('*')
        .eq('business_id', session.businessId)
        .maybeSingle();
      if (sub?.agreed_price_paisa) agreedPricePaisa = Number(sub.agreed_price_paisa);
      if (sub?.billing_currency) billingCurrency = sub.billing_currency;
    } catch {
      // Sub query non-fatal
    }

    if (!agreedPricePaisa) {
      try {
        const { data: biz } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', session.businessId)
          .single();
        const customPricing = biz?.custom_pricing || biz?.qpulse_config?.custom_pricing;
        if (customPricing?.agreed_price_paisa) {
          agreedPricePaisa = Number(customPricing.agreed_price_paisa);
          if (customPricing.currency) billingCurrency = customPricing.currency;
        }
      } catch {
        // Biz query non-fatal
      }
    }

    // Use negotiated price if configured, otherwise standard plan price
    let chargeAmountPaisa = plan.monthly_price * 100;
    if (agreedPricePaisa && agreedPricePaisa > 0) {
      chargeAmountPaisa = agreedPricePaisa;
    }

    const orderOptions = {
        amount: chargeAmountPaisa,
        currency: sub?.billing_currency || "INR",
        receipt: `receipt_order_${Date.now()}`,
        notes: {
            business_id: session.businessId,
            plan_id: planId,
            is_negotiated: Boolean(sub && sub.agreed_price_paisa && sub.agreed_price_paisa > 0),
        }
    };

    let orderId = `order_sim_${Date.now()}`;
    let orderAmount = chargeAmountPaisa;
    let orderCurrency = sub?.billing_currency || "INR";

    try {
      const order = await razorpay.orders.create(orderOptions);
      orderId = order.id;
      orderAmount = order.amount;
      orderCurrency = order.currency;
    } catch (rzpErr: any) {
      // If dummy credentials in development/test environment, create predictable order reference
      console.warn('[Razorpay] Order create warning (using simulated order for development):', rzpErr?.message || rzpErr);
      if (process.env.NODE_ENV === 'production' && process.env.RAZORPAY_KEY_ID) {
        throw rzpErr;
      }
    }

    return NextResponse.json({
        success: true,
        orderId,
        amount: orderAmount,
        currency: orderCurrency,
        planName: plan.name,
        isNegotiated: Boolean(sub && sub.agreed_price_paisa && sub.agreed_price_paisa > 0),
    });


  } catch (error: any) {
    console.error('Create checkout error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
  }
}
