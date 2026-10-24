import { supabase } from './supabaseClient';
import { BusinessPricing, TableConfig } from './pricing';
import { TableDiscountConfig } from './billing';

export interface BusinessData {
  id?: string;
  business_name: string;
  owner_name: string;
  contact_number: string;
  address?: string;
  google_sheet_id: string;
  business_type?: string;
  status?: string;
  pricing_rules?: BusinessPricing;
  tables?: TableConfig[];
  dashboard_pin?: string;
  menu_items?: { id?: string; name: string; price: number; category?: string; description?: string; image?: string; available?: boolean; is_pinned?: boolean }[];
  active_discounts?: Record<string, TableDiscountConfig>;
  goals?: { daily_revenue: number, daily_sessions: number };
  has_logged_in?: boolean;
  qpay_config?: { enabled: boolean; provider: string | null; secrets: any };
  qpulse_config?: { enabled: boolean; frequency: string; last_shown_date: string | null };
  payment_qr_config?: { enabled: boolean; qr_url: string | null };
  whatsapp_config?: { enabled: boolean; token: string; phoneId: string };
  sms_config?: { enabled: boolean; provider: string; authKey: string; senderId: string };
  public_contact_number?: string | null;
  slug?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

interface CacheEntry {
  data: BusinessData;
  expiresAt: number;
}
const businessCache = new Map<string, CacheEntry>();
const slugCache = new Map<string, { id: string, expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 60 seconds (instant invalidation maintained via invalidateBusinessCache on any write)

type InvalidationListener = (businessId?: string) => void;
const cacheListeners = new Set<InvalidationListener>();

export function registerCacheInvalidationListener(listener: InvalidationListener) {
  cacheListeners.add(listener);
}

export function invalidateBusinessCache(businessId?: string): void {
  if (businessId) {
    businessCache.delete(businessId);
    for (const [sKey, val] of slugCache.entries()) {
      if (val.id === businessId) {
        slugCache.delete(sKey);
      }
    }
  } else {
    businessCache.clear();
    slugCache.clear();
  }
  for (const listener of cacheListeners) {
    try {
      listener(businessId);
    } catch (e) {
      console.error('Cache listener error:', e);
    }
  }
}

export const businessManager = {
  registerBusiness: async (data: BusinessData): Promise<string> => {
    const { data: insertedData, error } = await supabase
      .from('businesses')
      .insert([{
        business_name: data.business_name,
        owner_name: data.owner_name,
        contact_number: data.contact_number,
        address: data.address || null,
        google_sheet_id: data.google_sheet_id,
        business_type: data.business_type || null,
        pricing_rules: data.pricing_rules || null,
        tables: data.tables || null,
        dashboard_pin: data.dashboard_pin || null,
        menu_items: data.menu_items || null,
        active_discounts: data.active_discounts || null,
      }])
      .select('id')
      .single();

    if (error || !insertedData) {
      throw new Error(error?.message || 'Failed to register business');
    }

    return insertedData.id;
  },

  getBusiness: async (id: string, forceRefresh = false): Promise<BusinessData | null> => {
    const now = Date.now();
    if (!forceRefresh) {
      const cached = businessCache.get(id);
      if (cached && cached.expiresAt > now) {
        return cached.data;
      }
    }

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    // Seamlessly handle DB legacy formats
    let parsedPricing = data.pricing_rules;
    if (parsedPricing) {
      if (parsedPricing.rules) {
        // Modern BusinessPricing format
        data.pricing_rules = parsedPricing;
      } else if (parsedPricing._global) {
        // Semi-legacy format
        const { _global, ...rules } = parsedPricing;
        data.pricing_rules = { rules, globalSettings: _global };
      }
    }

    // Seamlessly populate extended metadata from whatsapp_config if not present as top-level columns
    const waConfig = (data.whatsapp_config || {}) as any;
    if (!data.slug && waConfig.slug) data.slug = waConfig.slug;
    if (!data.public_contact_number && waConfig.public_contact_number) data.public_contact_number = waConfig.public_contact_number;
    if (data.latitude === undefined && waConfig.latitude !== undefined) data.latitude = waConfig.latitude;
    if (data.longitude === undefined && waConfig.longitude !== undefined) data.longitude = waConfig.longitude;
    if (data.google_place_id === undefined && waConfig.google_place_id !== undefined) data.google_place_id = waConfig.google_place_id;

    businessCache.set(id, { data, expiresAt: now + CACHE_TTL_MS });
    return data;
  },

  updateTableDiscount: async (
    businessId: string, 
    tableId: string, 
    configOrPercent: TableDiscountConfig | number | null, 
    applyToFoodLegacy?: boolean
  ) => {
    const business = await businessManager.getBusiness(businessId);
    if (!business) throw new Error('Business not found');

    const active_discounts = { ...(business.active_discounts || {}) };

    let config: TableDiscountConfig | null = null;
    if (typeof configOrPercent === 'number') {
      if (configOrPercent > 0) {
        config = {
          type: 'percentage',
          percent: configOrPercent,
          applyToFood: Boolean(applyToFoodLegacy),
          isActive: true,
        };
      }
    } else {
      config = configOrPercent;
    }

    const isRemoval = !config || 
      (config.percent === 0 && !config.amount) || 
      (config.amount === 0 && !config.percent);

    if (isRemoval) {
      if (tableId === 'all') {
        Object.keys(active_discounts).forEach(k => delete active_discounts[k]);
      } else {
        delete active_discounts[tableId];
      }
    } else if (config) {
      const isFixed = config.type === 'fixed' || (Number(config.amount) > 0 && !config.percent);
      const sanitized: TableDiscountConfig = {
        type: isFixed ? 'fixed' : 'percentage',
        percent: !isFixed ? Math.min(100, Math.max(1, Number(config.percent) || 0)) : undefined,
        amount: isFixed ? Math.max(1, Number(config.amount) || 0) : undefined,
        maxDiscount: config.maxDiscount ? Math.max(0, Number(config.maxDiscount)) : undefined,
        minBillAmount: config.minBillAmount ? Math.max(0, Number(config.minBillAmount)) : undefined,
        applyToFood: Boolean(config.applyToFood),
        label: config.label?.trim() || undefined,
        isActive: config.isActive !== false,
      };

      if (tableId === 'all') {
        const tables = business.tables || [];
        tables.forEach(t => {
          active_discounts[t.id] = { ...sanitized };
        });
        active_discounts['all'] = { ...sanitized };
      } else {
        active_discounts[tableId] = sanitized;
      }
    }

    const { error } = await supabase
      .from('businesses')
      .update({ active_discounts })
      .eq('id', businessId);

    if (error) throw error;
    businessCache.delete(businessId); // Invalidate cache
    return active_discounts;
  },

  getBusinessBySlug: async (slug: string): Promise<BusinessData | null> => {
    if (!slug) return null;
    const raw = decodeURIComponent(slug).trim();

    // Check if slug is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(raw)) {
      return businessManager.getBusiness(raw.toLowerCase());
    }

    const normalizedSlug = raw.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Check cache first
    const now = Date.now();
    const cachedId = slugCache.get(normalizedSlug);
    if (cachedId && cachedId.expiresAt > now) {
      return businessManager.getBusiness(cachedId.id);
    }

    // Direct match: check slug column or business_name
    const { data: directMatch } = await supabase
      .from('businesses')
      .select('id, business_name')
      .or(`slug.eq.${raw},business_name.ilike.${raw}`)
      .limit(1)
      .maybeSingle();

    if (directMatch) {
      slugCache.set(normalizedSlug, { id: directMatch.id, expiresAt: now + CACHE_TTL_MS });
      return businessManager.getBusiness(directMatch.id);
    }

    // Try targeted match by slug or name substring
    const { data: matchedBusinesses } = await supabase
      .from('businesses')
      .select('id, business_name')
      .ilike('business_name', `%${raw.replace(/[-_]/g, ' ')}%`)
      .limit(15);

    if (matchedBusinesses && matchedBusinesses.length > 0) {
      for (const b of matchedBusinesses) {
        const bSlug = (b.business_name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        slugCache.set(bSlug, { id: b.id, expiresAt: now + CACHE_TTL_MS });
        if (bSlug === normalizedSlug) {
          return businessManager.getBusiness(b.id);
        }
      }
    }

    // Fallback: bounded scan to resolve custom or modified slugs
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, business_name')
      .limit(100);

    if (error || !businesses) return null;
    
    for (const b of businesses) {
      const bSlug = (b.business_name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      slugCache.set(bSlug, { id: b.id, expiresAt: now + CACHE_TTL_MS });
      
      if (bSlug === normalizedSlug || b.id.toLowerCase() === raw.toLowerCase()) {
        return businessManager.getBusiness(b.id);
      }
    }
    
    return null;
  }
};
