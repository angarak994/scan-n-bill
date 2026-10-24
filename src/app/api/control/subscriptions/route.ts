import { NextResponse } from 'next/server';
import { getDeveloperSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { developerAuditService } from '@/lib/services/developerAuditService';
import { invalidateBusinessCache } from '@/lib/businessManager';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const {
      businessId,
      agreedPriceInr,
      agreedPricePaisa,
      trialDurationDays = 15,
      gracePeriodDays = 3,
      billingInterval = 'monthly',
      notes = ''
    } = await request.json();

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required.' }, { status: 400 });
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    // Convert to minor currency units (paisa) safely
    const finalPricePaisa = Number(agreedPricePaisa) || (Number(agreedPriceInr) ? Math.round(Number(agreedPriceInr) * 100) : 0);
    const finalPriceInr = finalPricePaisa / 100;
    const finalTrialDays = Math.max(1, Number(trialDurationDays) || 15);
    const finalGraceDays = Math.max(0, Number(gracePeriodDays) || 3);
    const newPeriodEnd = new Date(Date.now() + finalTrialDays * 86400000).toISOString();

    // 1. Upsert or update business_subscriptions
    const { data: existingSub } = await supabase
      .from('business_subscriptions')
      .select('id, plan_id, status, current_period_end, razorpay_subscription_id')
      .eq('business_id', businessId)
      .maybeSingle();

    let planId = existingSub?.plan_id;
    if (!planId) {
      const { data: defaultPlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', 'Growth')
        .maybeSingle();
      planId = defaultPlan?.id;
    }

    const isCurrentlyActive = existingSub?.status === 'active';
    const subPayload: Record<string, any> = {
      business_id: businessId,
      plan_id: planId,
      status: isCurrentlyActive ? 'active' : 'trialing',
      agreed_price_paisa: finalPricePaisa,
      billing_currency: 'INR',
      billing_interval: billingInterval,
      trial_duration_days: finalTrialDays,
      grace_period_days: finalGraceDays,
      current_period_end: isCurrentlyActive && existingSub?.current_period_end ? existingSub.current_period_end : newPeriodEnd,
      custom_pricing_notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    if (existingSub) {
      const { error: subErr } = await supabase
        .from('business_subscriptions')
        .update(subPayload)
        .eq('id', existingSub.id);
      if (subErr) {
        // Fallback for standard subscription schema
        await supabase
          .from('business_subscriptions')
          .update({
            status: isCurrentlyActive ? 'active' : 'trialing',
            current_period_end: isCurrentlyActive && existingSub?.current_period_end ? existingSub.current_period_end : newPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSub.id);
      }
    } else {
      const { error: subInsertErr } = await supabase
        .from('business_subscriptions')
        .insert([subPayload]);
      if (subInsertErr) {
        await supabase
          .from('business_subscriptions')
          .insert([{
            business_id: businessId,
            plan_id: planId,
            status: 'trialing',
            current_period_end: newPeriodEnd,
          }]);
      }
    }

    // 2. Persist custom pricing snapshot on business record
    const customPricingSnapshot = {
      agreed_price_paisa: finalPricePaisa,
      agreed_price_inr: finalPriceInr,
      currency: 'INR',
      billing_interval: billingInterval,
      trial_duration_days: finalTrialDays,
      grace_period_days: finalGraceDays,
      configured_at: new Date().toISOString(),
      configured_by: devSession.email,
      notes: notes || null,
    };

    const currentQpulse = (business.qpulse_config || {}) as Record<string, any>;
    const updatedQpulse = {
      ...currentQpulse,
      custom_pricing: customPricingSnapshot,
    };

    const bizUpdateRes = await supabase
      .from('businesses')
      .update({
        custom_pricing: customPricingSnapshot,
        qpulse_config: updatedQpulse,
      })
      .eq('id', businessId);

    if (bizUpdateRes.error) {
      await supabase
        .from('businesses')
        .update({ qpulse_config: updatedQpulse })
        .eq('id', businessId);
    }

    invalidateBusinessCache(businessId);

    await developerAuditService.log({
      developer_email: devSession.email,
      action: 'CUSTOM_PRICING_CONFIGURED',
      target_business_id: businessId,
      details: {
        business_name: business.business_name,
        agreed_price_inr: finalPriceInr,
        agreed_price_paisa: finalPricePaisa,
        trial_duration_days: finalTrialDays,
        grace_period_days: finalGraceDays,
        billing_interval: billingInterval,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      businessId,
      customPricing: customPricingSnapshot,
      message: `Commercial terms configured: ₹${finalPriceInr.toLocaleString('en-IN')}/${billingInterval} with ${finalTrialDays}-day trial.`,
    });
  } catch (err: any) {
    console.error('Error configuring subscription commercial terms:', err);
    return NextResponse.json({ error: err.message || 'Failed to configure subscription' }, { status: 500 });
  }
}
