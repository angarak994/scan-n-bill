import { supabase } from './supabaseClient';

export interface BusinessFeatureEntitlements {
  whatsapp_ai: boolean;
  google_sheets: boolean;
  qr_sessions: boolean;
  telegram_bot: boolean;
  manual_booking: boolean;
  online_booking: boolean;
  memberships: boolean;
  reports_analytics: boolean;
  advanced_billing: boolean;
  payment_automation: boolean;
  fnb_inventory: boolean;
}

export const DEFAULT_LOCKED_FEATURES: BusinessFeatureEntitlements = {
  whatsapp_ai: false,
  google_sheets: false,
  qr_sessions: false,
  telegram_bot: false,
  manual_booking: true,
  online_booking: false,
  memberships: false,
  reports_analytics: false,
  advanced_billing: false,
  payment_automation: false,
  fnb_inventory: false,
};

export const DEFAULT_UNLOCKED_FEATURES: BusinessFeatureEntitlements = {
  whatsapp_ai: true,
  google_sheets: true,
  qr_sessions: true,
  telegram_bot: true,
  manual_booking: true,
  online_booking: true,
  memberships: true,
  reports_analytics: true,
  advanced_billing: true,
  payment_automation: true,
  fnb_inventory: true,
};

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
  entitlements: BusinessFeatureEntitlements;
  status: string; // 'trialing', 'active', 'past_due', 'canceled', 'expired', 'none', 'pending_approval', 'suspended'
  planName: string;
  businessStatus: string; // 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'DEACTIVATED'
};

// In-memory entitlement cache with short TTL (30s)
interface CacheEntry {
  data: EntitlementResult;
  expiresAt: number;
}
const entitlementCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000;

export function invalidateEntitlementCache(businessId?: string) {
  if (businessId) {
    entitlementCache.delete(businessId);
  } else {
    entitlementCache.clear();
  }
}

/**
 * Checks whether a business lifecycle state allows active operations.
 * Only APPROVED and legacy ACTIVE clubs are authorized.
 */
export function isOperationalStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  return s === 'APPROVED' || s === 'ACTIVE';
}

/**
 * Centralized server-side entitlement resolver.
 * Enforces developer-configured feature toggles and lifecycle states.
 */
export async function getBusinessEntitlement(businessId: string, forceRefresh = false): Promise<EntitlementResult> {
  if (!businessId) {
    return {
      hasAccess: false,
      features: FALLBACK_FEATURES,
      entitlements: DEFAULT_LOCKED_FEATURES,
      status: 'none',
      planName: 'None',
      businessStatus: 'UNKNOWN',
    };
  }

  const now = Date.now();
  if (!forceRefresh) {
    const cached = entitlementCache.get(businessId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  try {
    // 1. Fetch business status & feature entitlements
    let biz: any = null;
    let bizError: any = null;

    try {
      const primaryRes = await supabase
        .from('businesses')
        .select('id, status, feature_entitlements, qpulse_config')
        .eq('id', businessId)
        .maybeSingle();

      if (primaryRes.error && primaryRes.error.message?.includes('feature_entitlements')) {
        const fallbackRes = await supabase
          .from('businesses')
          .select('id, status, qpulse_config')
          .eq('id', businessId)
          .maybeSingle();
        biz = fallbackRes.data;
        bizError = fallbackRes.error;
      } else {
        biz = primaryRes.data;
        bizError = primaryRes.error;
      }
    } catch {
      const fallbackRes = await supabase
        .from('businesses')
        .select('id, status, qpulse_config')
        .eq('id', businessId)
        .maybeSingle();
      biz = fallbackRes.data;
      bizError = fallbackRes.error;
    }

    if (bizError || !biz) {
      return {
        hasAccess: false,
        features: FALLBACK_FEATURES,
        entitlements: DEFAULT_LOCKED_FEATURES,
        status: 'none',
        planName: 'None',
        businessStatus: 'NOT_FOUND',
      };
    }

    const bStatus = (biz.status || 'PENDING_APPROVAL').toUpperCase().trim();

    // Pending, rejected, suspended, or deactivated businesses are completely restricted
    if (!isOperationalStatus(bStatus)) {
      const result: EntitlementResult = {
        hasAccess: false,
        features: FALLBACK_FEATURES,
        entitlements: DEFAULT_LOCKED_FEATURES,
        status: bStatus.toLowerCase(),
        planName: 'Locked',
        businessStatus: bStatus,
      };
      entitlementCache.set(businessId, { data: result, expiresAt: now + CACHE_TTL_MS });
      return result;
    }

    // Resolve feature entitlements (merge with defaults; support column and qpulse_config fallback)
    const rawEntitlements = biz.feature_entitlements || biz.qpulse_config?.feature_entitlements || null;
    const storedEntitlements = (rawEntitlements || {}) as Partial<BusinessFeatureEntitlements>;
    const hasConfiguredFeatures = rawEntitlements && Object.keys(rawEntitlements).length > 0;
    const baseDefaults = bStatus === 'ACTIVE' && !hasConfiguredFeatures ? DEFAULT_UNLOCKED_FEATURES : DEFAULT_LOCKED_FEATURES;

    const resolvedEntitlements: BusinessFeatureEntitlements = {
      whatsapp_ai: storedEntitlements.whatsapp_ai ?? baseDefaults.whatsapp_ai,
      google_sheets: storedEntitlements.google_sheets ?? baseDefaults.google_sheets,
      qr_sessions: storedEntitlements.qr_sessions ?? baseDefaults.qr_sessions,
      telegram_bot: storedEntitlements.telegram_bot ?? baseDefaults.telegram_bot,
      manual_booking: storedEntitlements.manual_booking ?? baseDefaults.manual_booking,
      online_booking: storedEntitlements.online_booking ?? baseDefaults.online_booking,
      memberships: storedEntitlements.memberships ?? baseDefaults.memberships,
      reports_analytics: storedEntitlements.reports_analytics ?? baseDefaults.reports_analytics,
      advanced_billing: storedEntitlements.advanced_billing ?? baseDefaults.advanced_billing,
      payment_automation: storedEntitlements.payment_automation ?? baseDefaults.payment_automation,
      fnb_inventory: storedEntitlements.fnb_inventory ?? baseDefaults.fnb_inventory,
    };

    // 2. Fetch subscription status
    const { data: sub } = await supabase
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
      .maybeSingle();

    const plan = (sub?.subscription_plans as any) || { name: 'Growth', features: {} };
    const subStatus = sub?.status || 'active';
    const isExpired = sub?.current_period_end ? new Date(sub.current_period_end).getTime() < now : false;

    const isSubActive = subStatus === 'active' || subStatus === 'trialing' || subStatus === 'past_due' || !isExpired;

    // Map feature entitlements to legacy PlanFeatures structure
    const mappedPlanFeatures: PlanFeatures = {
      max_tables: plan.features?.max_tables || 999,
      has_qkhata: resolvedEntitlements.advanced_billing,
      has_advanced_qkhata: resolvedEntitlements.advanced_billing,
      has_advanced_reports: resolvedEntitlements.reports_analytics,
      has_memberships: resolvedEntitlements.memberships,
      has_promotions: resolvedEntitlements.advanced_billing,
      has_whatsapp: resolvedEntitlements.whatsapp_ai,
      has_telegram: resolvedEntitlements.telegram_bot,
      has_fnb: resolvedEntitlements.fnb_inventory,
      has_booking: resolvedEntitlements.online_booking || resolvedEntitlements.manual_booking,
      has_loyalty: resolvedEntitlements.memberships,
      has_ai: resolvedEntitlements.whatsapp_ai,
      has_api: true,
      max_locations: plan.features?.max_locations || 1,
    };

    const finalResult: EntitlementResult = {
      hasAccess: isSubActive && isOperationalStatus(bStatus),
      features: mappedPlanFeatures,
      entitlements: resolvedEntitlements,
      status: subStatus,
      planName: plan.name || 'Growth',
      businessStatus: bStatus,
    };

    entitlementCache.set(businessId, { data: finalResult, expiresAt: now + CACHE_TTL_MS });
    return finalResult;
  } catch (err) {
    console.error('[Entitlements] Error resolving business entitlements:', businessId, err);
    return {
      hasAccess: false,
      features: FALLBACK_FEATURES,
      entitlements: DEFAULT_LOCKED_FEATURES,
      status: 'error',
      planName: 'Unknown',
      businessStatus: 'ERROR',
    };
  }
}

/**
 * Checks whether a specific feature is enabled for a business.
 */
export async function hasFeature(businessId: string, feature: keyof BusinessFeatureEntitlements): Promise<boolean> {
  const result = await getBusinessEntitlement(businessId);
  if (!result.hasAccess) return false;
  return Boolean(result.entitlements[feature]);
}
