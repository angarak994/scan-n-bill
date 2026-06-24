import { supabase } from './supabaseClient';
import { PricingRules, TableConfig } from './pricing';

export interface BusinessData {
  id?: string;
  business_name: string;
  owner_name: string;
  contact_number: string;
  address?: string;
  google_sheet_id: string;
  business_type?: string;
  status?: string;
  pricing_rules?: PricingRules;
  tables?: TableConfig[];
  dashboard_pin?: string;
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
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }
};
