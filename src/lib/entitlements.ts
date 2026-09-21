import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type PlanFeatures = {
  max_tables: number;
  has_qkhata: boolean;
  has_advanced_qkhata: boolean;
  has_advanced_reports: boolean;
  has_memberships: boolean;
  has_promotions: boolean;
  has_whatsapp: boolean;
  has_telegram: boolean;
  has_fnb: boolean;
  has_booking: boolean;
  has_loyalty: boolean;
  has_ai: boolean;
  has_api: boolean;
  max_locations: number;
};

// Default fallback for expired/canceled subscriptions or errors
const FALLBACK_FEATURES: PlanFeatures = {
  max_tables: 2,
  has_qkhata: false,
  has_advanced_qkhata: false,
  has_advanced_reports: false,
  has_memberships: false,
  has_promotions: false,
  has_whatsapp: false,
  has_telegram: false,
  has_fnb: false,
  has_booking: false,
  has_loyalty: false,
  has_ai: false,
  has_api: false,
  max_locations: 1,
};

export type EntitlementResult = {
  hasAccess: boolean;
  features: PlanFeatures;
  status: string; // 'trialing', 'active', 'past_due', 'canceled', 'expired', 'none'
  planName: string;
};

export async function getBusinessEntitlement(businessId: string): Promise<EntitlementResult> {
  // TEMPORARY OVERRIDE: Unlock all features globally for production testing
  return {
      hasAccess: true,
      features: {
        max_tables: 999,
        has_qkhata: true,
        has_advanced_qkhata: true,
        has_advanced_reports: true,
        has_memberships: true,
        has_promotions: true,
        has_whatsapp: true,
        has_telegram: true,
        has_fnb: true,
        has_booking: true,
        has_loyalty: true,
        has_ai: true,
        has_api: true,
        max_locations: 999
      },
      status: 'active',
      planName: 'Enterprise'
  };

  try {
    // Check if the business has a subscription
    const { data: sub, error } = await supabase
      .from('business_subscriptions')
      .select(`
        status,
        current_period_end,
        subscription_plans (
          name,
          features
        )
      `)
      .eq('business_id', businessId)
      .single();

    if (error || !sub) {
      return {
        hasAccess: false,
        features: FALLBACK_FEATURES,
        status: 'none',
        planName: 'None'
      };
    }

    const plan = sub.subscription_plans as any;
    const features = plan.features as PlanFeatures;
    const status = sub.status;
    const isExpired = new Date(sub.current_period_end).getTime() < Date.now();

    // If active or trialing, they have full access to their plan features
    if (status === 'active' || status === 'trialing') {
        if (isExpired && status !== 'active') { // edge case if not updated by webhook yet
             return {
                hasAccess: false,
                features: FALLBACK_FEATURES,
                status: 'expired',
                planName: plan.name
             };
        }
        return {
            hasAccess: true,
            features,
            status,
            planName: plan.name
        };
    }

    // Grace period for past_due
    if (status === 'past_due') {
        // Typically a grace period logic goes here. For now, allow but mark past_due
        return {
            hasAccess: true,
            features,
            status: 'past_due',
            planName: plan.name
        };
    }

    // TEMPORARY OVERRIDE: Unlock all features globally for production testing
    return {
        hasAccess: true,
        features: {
          max_tables: 999,
          has_qkhata: true,
          has_advanced_qkhata: true,
          has_advanced_reports: true,
          has_memberships: true,
          has_promotions: true,
          has_whatsapp: true,
          has_telegram: true,
          has_fnb: true,
          has_booking: true,
          has_loyalty: true,
          has_ai: true,
          has_api: true,
          max_locations: 999
        },
        status: status || 'active',
        planName: plan?.name || 'Enterprise'
    };

  } catch (err) {
    console.error('Error fetching entitlements for business:', businessId, err);
    return {
      hasAccess: false,
      features: FALLBACK_FEATURES,
      status: 'error',
      planName: 'Unknown'
    };
  }
}
