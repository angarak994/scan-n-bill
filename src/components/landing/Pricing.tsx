"use client";

import Link from 'next/link';
import { pricingTiers } from '@/data/pricing';
import ScrollReveal from '@/components/ui/ScrollReveal';
import InteractiveCard from '@/components/landing/InteractiveCard';

export default function Pricing() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-base" id="pricing">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-10 sm:mb-14">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Run your entire gaming business from one system.
          </h2>
          <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto mb-6">
            Simple, transparent pricing. Scale your plan as your venue grows.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-accent mb-10">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              14-day free trial — no credit card required
            </div>
            <div className="hidden sm:block text-border-theme">•</div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              No setup fee
            </div>
            <div className="hidden sm:block text-border-theme">•</div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Cancel or change anytime
            </div>
          </div>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-20">
        {pricingTiers.map((tier, idx) => (
          <ScrollReveal key={idx} animation={tier.isRecommended ? 'scale' : 'fade-up'} delay={tier.isRecommended ? 300 : idx * 150} className={tier.isRecommended ? 'z-10' : ''}>
            <InteractiveCard className={`h-full rounded-2xl ${tier.isRecommended ? 'scale-100 lg:scale-105' : ''}`}>
              <div 
                className={`relative bg-bg-surface rounded-2xl border ${tier.isRecommended ? 'border-accent shadow-[0_0_30px_rgba(16,185,129,0.15)] h-full' : 'border-border-light shadow-lg h-full'} p-6 sm:p-8 flex flex-col hover-lift`}
              >
              {tier.isRecommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                  Recommended
                </div>
              )}
              
              <h3 className="text-xl sm:text-2xl font-black mb-2">{tier.name}</h3>
              <p className="text-text-secondary text-sm h-10 mb-6 leading-relaxed">{tier.description}</p>
              
              <div className="mb-8 border-b border-border-light pb-8">
                {tier.monthlyPrice === 'Custom' ? (
                  <span className="text-4xl font-black">{tier.monthlyPrice}</span>
                ) : (
                  <>
                    <span className="text-4xl font-black">{tier.monthlyPrice}</span>
                    <span className="text-text-secondary">/month</span>
                  </>
                )}
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                {tier.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3 text-sm text-text-primary">
                    <svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                    <span className="leading-snug flex items-center gap-1.5">
                      {feature}
                      {feature.toLowerCase().includes('telegram') && <svg className="w-4 h-4 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>}
                      {feature.toLowerCase().includes('whatsapp') && <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                    </span>
                  </li>
                ))}
              </ul>
              
              <Link 
                href="/register" 
                className={`w-full py-3.5 rounded-xl font-bold text-center transition-all mt-auto relative z-20 ${tier.isRecommended ? 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20' : 'bg-bg-base text-text-primary border border-border-theme hover:bg-border-light hover:border-accent/50'}`}
              >
                {tier.ctaText}
              </Link>
            </div>
            </InteractiveCard>
          </ScrollReveal>
        ))}
      </div>

      {/* Clean Comparison Section */}
      <ScrollReveal animation="fade-up" delay={200}>
        <div className="max-w-5xl mx-auto bg-bg-card border border-border-theme rounded-2xl p-8 sm:p-12 text-center shadow-xl">
          <h3 className="text-2xl sm:text-3xl font-bold mb-4">Everything your business needs, in one system.</h3>
          <p className="text-text-secondary mb-10 max-w-2xl mx-auto">
            Stop juggling multiple apps. QControl centralizes your entire workflow so you can focus on delivering a great customer experience.
          </p>
          
          <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-sm sm:text-base font-bold text-text-primary">
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">Tables</span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">Sessions</span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">Members</span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">QKhata</span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">Booking</span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light flex items-center gap-2">WhatsApp <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light flex items-center gap-2">Telegram <svg className="w-4 h-4 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg></span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">AI</span>
            <svg className="w-4 h-4 text-accent hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">Analytics</span>
            <svg className="w-4 h-4 text-accent hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            <span className="px-4 py-2 bg-bg-surface rounded-lg border border-border-light">Multi-location</span>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
