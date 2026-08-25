export type GameType = string;
export type SessionType = 'AM' | 'PM';

export interface PricingRule {
  type: 'fixed' | 'time_based';
  rate?: number; // for fixed
  day_rate?: number; // for time_based
  evening_rate?: number; // for time_based
  opening_hour?: number; // When day_rate starts (e.g. 11 for 11:00 AM)
  cutoff_hour?: number; // for time_based (0-23, when evening_rate starts)
  am_rate?: number; // legacy
  pm_rate?: number; // legacy
  is_per_person?: boolean; // legacy
  multiplayer_mode?: 'none' | 'multiply' | 'base_plus_extra';
  extra_per_player?: number; // for base_plus_extra mode
}
export interface GlobalSettings {
  rounding_mode?: 'nearest_5' | 'up_5' | 'down_5' | 'none';
  billing_mode?: 'per_minute' | '15_min_block';
  enable_peak_rules?: boolean;
  peak_start_hour?: number; // e.g. 17 (5 PM)
  peak_end_hour?: number; // e.g. 23 (11 PM)
  smart_reminder_interval_minutes?: number;
}

export type PricingRules = Record<string, PricingRule>;

export interface BusinessPricing {
  rules: PricingRules;
  globalSettings?: GlobalSettings;
  activePromotion?: any;
}

export interface TableConfig {
  id: string;
  name: string;
  type: string;
}

export interface DynamicPricingRule {
  id: string;
  business_id: string;
  table_type: string;
  rule_type: string;
  day_of_week: number[] | null;
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  rate_per_hour: number;
  priority: number;
  active: boolean;
}

export function resolveRate(tableType: string, rules: DynamicPricingRule[], now = new Date()): DynamicPricingRule | null {
  const currentDay = now.getDay();
  const currentHourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');

  const applicable = rules
    .filter(r => r.active)
    .filter(r => r.table_type === 'all' || r.table_type === tableType)
    .filter(r => !r.day_of_week || r.day_of_week.includes(currentDay))
    .filter(r => {
      if (!r.start_time || !r.end_time) return true;
      return currentHourStr >= r.start_time && currentHourStr < r.end_time;
    })
    .sort((a, b) => b.priority - a.priority);

  return applicable[0] || null;
}

