import { NextResponse } from 'next/server';
import { getDeveloperSession } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { DEFAULT_LOCKED_FEATURES, DEFAULT_UNLOCKED_FEATURES } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'ALL';

    // 1. Fetch businesses with subscription data
    let query = supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'APPROVED') {
        query = query.or('status.eq.APPROVED,status.eq.ACTIVE');
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    if (search) {
      query = query.or(`business_name.ilike.%${search}%,owner_name.ilike.%${search}%,contact_number.ilike.%${search}%,id.eq.${search}`);
    }

    const { data: businesses, error } = await query;
    if (error) throw error;

    // 2. Fetch associated subscriptions
    const { data: subscriptions } = await supabase
      .from('business_subscriptions')
      .select(`
        *,
        subscription_plans (
          name,
          monthly_price
        )
      `);

    const subMap = new Map((subscriptions || []).map(s => [s.business_id, s]));

    // 3. Format businesses with normalized feature entitlements and subscription info
    const formatted = (businesses || []).map(b => {
      const sub = subMap.get(b.id) as any;
      const bStatus = (b.status || 'PENDING_APPROVAL').toUpperCase().trim();
      const rawEntitlements = b.feature_entitlements || b.qpulse_config?.feature_entitlements || null;
      const hasCustomEntitlements = rawEntitlements && Object.keys(rawEntitlements).length > 0;
      const baseDefaults = (bStatus === 'ACTIVE' && !hasCustomEntitlements) ? DEFAULT_UNLOCKED_FEATURES : DEFAULT_LOCKED_FEATURES;
      const entitlements = { ...baseDefaults, ...(rawEntitlements || {}) };

      const customPricing = b.custom_pricing || b.qpulse_config?.custom_pricing || null;
      const agreedPaisa = sub?.agreed_price_paisa ?? customPricing?.agreed_price_paisa ?? 0;
      const tablesCount = Array.isArray(b.tables) ? b.tables.length : 0;

      return {
        id: b.id,
        business_name: b.business_name,
        owner_name: b.owner_name,
        contact_number: b.contact_number,
        address: b.address,
        business_type: b.business_type,
        google_sheet_id: b.google_sheet_id,
        status: bStatus,
        approval_notes: b.approval_notes || b.qpulse_config?.approval_info?.notes || null,
        approved_at: b.approved_at || b.qpulse_config?.approval_info?.approved_at || null,
        approved_by: b.approved_by || b.qpulse_config?.approval_info?.approved_by || null,
        rejection_reason: b.rejection_reason || b.qpulse_config?.approval_info?.rejection_reason || null,
        onboarded_at: b.onboarded_at || b.qpulse_config?.onboarded_at || null,
        onboarded_by: b.onboarded_by || b.qpulse_config?.onboarded_by || null,
        tables_count: tablesCount,
        created_at: b.created_at,
        feature_entitlements: entitlements,
        subscription: sub ? {
          id: sub.id,
          status: sub.status,
          plan_name: sub.subscription_plans?.name || 'Growth',
          monthly_price: sub.subscription_plans?.monthly_price || 1999,
          agreed_price_paisa: agreedPaisa,
          agreed_price_inr: agreedPaisa / 100,
          billing_currency: sub.billing_currency || customPricing?.currency || 'INR',
          billing_interval: sub.billing_interval || customPricing?.billing_interval || 'monthly',
          trial_duration_days: sub.trial_duration_days || customPricing?.trial_duration_days || 15,
          current_period_end: sub.current_period_end,
          grace_period_days: sub.grace_period_days || customPricing?.grace_period_days || 3,
          custom_pricing_notes: sub.custom_pricing_notes || customPricing?.notes || null,
        } : null,
      };
    });

    // Counts summary
    const counts = {
      total: formatted.length,
      pending: formatted.filter(b => b.status === 'PENDING_APPROVAL').length,
      approved: formatted.filter(b => b.status === 'APPROVED' || b.status === 'ACTIVE').length,
      rejected: formatted.filter(b => b.status === 'REJECTED').length,
      suspended: formatted.filter(b => b.status === 'SUSPENDED').length,
    };

    return NextResponse.json({
      success: true,
      counts,
      businesses: formatted,
    });
  } catch (err: any) {
    console.error('Error fetching businesses for developer control:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch businesses' }, { status: 500 });
  }
}
