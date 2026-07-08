export interface GlobalSettings {
  rounding_mode?: 'nearest_5' | 'up_5' | 'down_5' | 'none';
}

export interface PricingRule {
  type: 'fixed' | 'time_based';
}

export type PricingRules = {
  _global?: GlobalSettings;
} & {
  [K in string as K extends '_global' ? never : K]: PricingRule;
};

const obj: any = {
  _global: { rounding_mode: 'nearest_5' },
  pool: { type: 'fixed' }
};

const g: GlobalSettings | undefined = obj._global;
const p: PricingRule = obj['pool'];
