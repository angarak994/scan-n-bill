"use client";

import { useState } from 'react';
import Link from 'next/link';
import { pricingTiers } from '@/data/pricing';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-base">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Simple, transparent pricing
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto mb-8">
            No hidden fees. Scale your plan as your venue grows.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center bg-bg-surface p-1 rounded-full border border-border-light relative z-10 shadow-sm">
            <button 
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${!isYearly ? 'bg-bg-base text-text-primary shadow' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${isYearly ? 'bg-bg-base text-text-primary shadow' : 'text-text-secondary hover:text-text-primary'}`}
            >
              Yearly <span className="text-accent text-xs ml-1">Save 20%</span>
            </button>
          </div>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {pricingTiers.map((tier, idx) => (
          <ScrollReveal key={idx} animation={tier.isRecommended ? 'scale' : 'fade-up'} delay={tier.isRecommended ? 300 : idx * 150} className={tier.isRecommended ? 'z-10' : ''}>
            <div 
              className={`relative bg-bg-surface rounded-2xl border ${tier.isRecommended ? 'border-accent shadow-[0_0_30px_rgba(16,185,129,0.1)] scale-100 md:scale-105 h-full' : 'border-border-light shadow-lg h-full'} p-8 flex flex-col hover-lift`}
            >
            {tier.isRecommended && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Recommended
              </div>
            )}
            
            <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
            <p className="text-text-secondary text-sm h-10 mb-6">{tier.description}</p>
            
            <div className="mb-8">
              <span className="text-4xl font-black">{isYearly ? tier.yearlyPrice : tier.monthlyPrice}</span>
              <span className="text-text-secondary">/mo</span>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {tier.features.map((feature, fIdx) => (
                <li key={fIdx} className="flex items-start gap-3 text-sm text-text-primary">
                  <svg className="w-5 h-5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Link 
              href="/register" 
              className={`w-full py-3 rounded-xl font-bold text-center transition-all ${tier.isRecommended ? 'bg-accent text-white hover:bg-accent/90' : 'bg-bg-base text-text-primary border border-border-theme hover:bg-border-light'}`}
            >
              {tier.ctaText}
            </Link>
          </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
