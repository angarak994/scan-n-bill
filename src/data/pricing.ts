export type PricingTier = {
  name: string;
  monthlyPrice: string;
  yearlyPrice?: string;
  description: string;
  features: string[];
  isRecommended?: boolean;
  ctaText: string;
};

export const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    monthlyPrice: '₹999',
    description: 'For small clubs getting started.',
    features: [
      'Up to 5 tables/consoles',
      'QR sessions & timers',
      'Manual booking',
      'Basic Dashboard',
      'Basic Reports',
      'Members',
      'Basic QKhata',
      'Telegram owner controls',
      'Google Sheets sync',
      'Standard support'
    ],
    ctaText: 'Start Free Trial',
  },
  {
    name: 'Growth',
    monthlyPrice: '₹1,999',
    description: 'Our most popular plan for growing venues.',
    features: [
      'Up to 15 tables/consoles',
      'Everything in Starter',
      'Advanced QKhata',
      'Advanced Reports & Analytics',
      'Membership plans',
      'Promotions',
      'WhatsApp customer automation',
      'Telegram automation',
      'Food & Beverage',
      'Customer booking',
      'Loyalty/engagement features',
      'Priority support'
    ],
    isRecommended: true,
    ctaText: 'Start Growing',
  },
  {
    name: 'Pro',
    monthlyPrice: '₹3,999',
    description: 'For established or high-volume businesses.',
    features: [
      'Unlimited tables/consoles',
      'Everything in Growth',
      'AI Business Assistant',
      'Centralized customer acquisition',
      'Advanced customer CRM',
      'Smart booking/waitlist',
      'Advanced analytics',
      'Multi-location support',
      'API/integrations',
      'Staff & advanced permissions',
      'Priority support'
    ],
    ctaText: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    description: 'For chains, franchises and large entertainment businesses.',
    features: [
      'Multi-location management',
      'Custom integrations/API',
      'Dedicated onboarding',
      'Custom workflows',
      'White-label options',
      'Dedicated account support'
    ],
    ctaText: 'Talk to Sales',
  }
];
