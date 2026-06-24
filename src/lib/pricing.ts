export type GameType = string;
export type SessionType = 'AM' | 'PM';

export interface PricingRule {
  type: 'fixed' | 'time_based';
  rate?: number; // for fixed
  day_rate?: number; // for time_based
  evening_rate?: number; // for time_based
  cutoff_hour?: number; // for time_based (0-23, when evening_rate starts)
  am_rate?: number; // legacy
  pm_rate?: number; // legacy
}

export type PricingRules = Record<string, PricingRule>;

export interface TableConfig {
  id: string;
  name: string;
  type: string;
}

