import { supabase } from './supabaseClient';
import { BusinessPricing, TableConfig } from './pricing';

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
  menu_items?: { name: string; price: number }[];
  active_discounts?: Record<string, { percent: number; applyToFood: boolean }>;
  goals?: any;
  has_logged_in?: boolean;
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

  getBusiness: async (id: string): Promise<BusinessData | null> => {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, business_name, owner_name, contact_number, address, google_sheet_id, business_type, status, pricing_rules, tables, dashboard_pin, menu_items, active_discounts, goals')
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
      } else {
        // Full legacy format (just rules)
        data.pricing_rules = { rules: parsedPricing, globalSettings: { rounding_mode: 'nearest_5' } };
      }
    }

    return data;
  },

  updateTableDiscount: async (businessId: string, tableId: string, percent: number, applyToFood: boolean) => {
    const business = await businessManager.getBusiness(businessId);
    if (!business) throw new Error('Business not found');

    const active_discounts = business.active_discounts || {};
    if (percent > 0) {
      active_discounts[tableId] = { percent, applyToFood };
    } else {
      delete active_discounts[tableId];
    }

    const { error } = await supabase
      .from('businesses')
      .update({ active_discounts })
      .eq('id', businessId);

    if (error) throw error;
    return active_discounts;
  }
};
