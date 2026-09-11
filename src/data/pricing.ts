export type PricingTier = {
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  description: string;
  features: string[];
  isRecommended?: boolean;
  ctaText: string;
};

export const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    monthlyPrice: '{{PRICE_STARTER_MONTHLY}}',
    yearlyPrice: '{{PRICE_STARTER_YEARLY}}',
    description: 'Perfect for small clubs starting their automation journey.',
    features: [
      'Up to 5 tables/consoles',
      'QR Smart Timers',
      'Basic QKhata tracking',
      'Standard Dashboard',
      'Email support'
    ],
    ctaText: 'Start for free',
  },
  {
    name: 'Professional',
    monthlyPrice: '{{PRICE_PRO_MONTHLY}}',
    yearlyPrice: '{{PRICE_PRO_YEARLY}}',
    description: 'For growing businesses that need full operational control.',
    features: [
      'Unlimited tables/consoles',
      'AI Business Assistant',
      'WhatsApp & Telegram integrations',
      'Advanced Reporting & Analytics',
      'Food & Beverage QR menus',
      'Priority 24/7 support'
    ],
    isRecommended: true,
    ctaText: 'Get Professional',
  },
  {
    name: 'Enterprise',
    monthlyPrice: '{{PRICE_ENT_MONTHLY}}',
    yearlyPrice: '{{PRICE_ENT_YEARLY}}',
    description: 'Custom solutions for multi-location entertainment venues.',
    features: [
      'Multi-tenant franchise support',
      'Custom API integrations',
      'Dedicated account manager',
      'On-premise hardware support',
      'White-labeled customer portal'
    ],
    ctaText: 'Contact Sales',
  }
];
