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
  enable_peak_rules?: boolean;
  peak_start_hour?: number; // e.g. 17 (5 PM)
  peak_end_hour?: number; // e.g. 23 (11 PM)
}

export type PricingRules = Record<string, PricingRule>;

export interface BusinessPricing {
  rules: PricingRules;
  globalSettings?: GlobalSettings;
}

export interface TableConfig {
  id: string;
  name: string;
  type: string;
}

