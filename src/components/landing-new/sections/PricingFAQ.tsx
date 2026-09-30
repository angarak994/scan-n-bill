'use client';

import React, { useState } from 'react';
import { Button, Accordion, Card, Section, Container, H2 } from '../ui/Primitives';

const faqs = [
  { q: 'What is QControl?', a: 'QControl is an intelligent operating system designed specifically for billiards and snooker clubs. It manages tables, handles automated billing with promotions, offers Telegram bot control, and provides a QR-based checkout experience for players.' },
  { q: 'How do QR Sessions work?', a: 'Customers scan a QR code placed on their table. This opens a web app (no download required) where they can start a session, see their live bill tick up, order food and beverages, and alert staff when they are ready to check out.' },
  { q: 'Can I really control tables from Telegram?', a: 'Yes. Our Telegram bot integration allows owners and managers to start, pause, or stop any table directly from their chat interface. The changes sync instantly with the main dashboard and the customer\'s QR screen.' },
  { q: 'How does the billing engine handle promotions?', a: 'You can schedule promotions (like Happy Hours or Weekend Rates) with specific start and end times. If a player\'s session spans across standard and promotional hours, the billing engine mathematically prorates the cost to the exact minute without any manual calculation needed from your staff.' },
  { q: 'Does QControl manage Memberships?', a: 'Yes. QControl includes a comprehensive membership system. You can track lifetime spend, session history, and manage store credit (QKhata) so players can preload their accounts and pay via balance.' },
  { q: 'Is there a limit on the number of tables?', a: 'No. QControl supports clubs of all sizes, from a single premium table setup to multi-floor venues with 50+ tables. Our interface scales cleanly to keep everything visible at a glance.' }
];

export default function PricingFAQ() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bg-[var(--bg-base)] relative z-10">
      {/* 11 — Pricing */}
      <Section id="pricing" className="bg-[var(--bg-base)]">
        <Container>
          <div className="flex flex-col items-start mb-[var(--space-12)]">
            <H2 className="mb-[var(--space-6)]">
              Simple, transparent pricing.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] max-w-2xl text-balance">
              Choose the plan that fits your club. No hidden fees, no per-table limits on the Professional plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-8)] items-start">
             {/* Starter */}
             <Card className="p-[var(--space-8)]">
                <div className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-[var(--space-2)]">Starter</div>
                <div className="text-[var(--text-4xl)] font-bold text-[var(--text-primary)] mb-[var(--space-2)] tabular-nums">₹1,999<span className="text-[var(--text-lg)] text-[var(--text-muted)] font-normal">/mo</span></div>
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-6)]">Perfect for small clubs just getting started.</p>
                <Button variant="outline" className="w-full mb-[var(--space-8)]">Get Started</Button>
                <ul className="space-y-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Up to 5 Tables</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Standard Billing Engine</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Basic Reporting</li>
                  <li className="flex items-center gap-[var(--space-3)] text-[var(--text-muted)]"><svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>No Telegram Bot</li>
                </ul>
             </Card>

             {/* Professional */}
             <Card elevated className="p-[var(--space-8)] relative shadow-[var(--shadow-lg)] border-[var(--accent)]/50 md:-mt-4">
                <div className="absolute top-0 inset-x-0 h-1 bg-[var(--accent)] rounded-t-[var(--radius-lg)]"></div>
                <div className="text-[var(--text-sm)] font-bold text-[var(--accent)] uppercase tracking-wider mb-[var(--space-2)]">Professional</div>
                <div className="text-[var(--text-4xl)] font-bold text-[var(--text-primary)] mb-[var(--space-2)] tabular-nums">₹4,999<span className="text-[var(--text-lg)] text-[var(--text-muted)] font-normal">/mo</span></div>
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-6)]">For serious operators needing full control.</p>
                <Button variant="primary" className="w-full mb-[var(--space-8)]">Get Started</Button>
                <ul className="space-y-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Unlimited Tables</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Smart Promotion Engine</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Telegram Bot Control</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>QR Customer Experience</li>
                </ul>
             </Card>

             {/* Enterprise */}
             <Card className="p-[var(--space-8)]">
                <div className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-[var(--space-2)]">Enterprise</div>
                <div className="text-[var(--text-4xl)] font-bold text-[var(--text-primary)] mb-[var(--space-2)]">Custom</div>
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-6)]">Multi-location franchises and large venues.</p>
                <Button variant="outline" className="w-full mb-[var(--space-8)]">Talk to Sales</Button>
                <ul className="space-y-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-primary)]">
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Everything in Pro</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Multi-Location Sync</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Dedicated Account Manager</li>
                  <li className="flex items-center gap-[var(--space-3)]"><svg className="w-5 h-5 text-[var(--accent)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Custom Integrations</li>
                </ul>
             </Card>
          </div>
        </Container>
      </Section>

      {/* 12 — FAQ */}
      <Section id="faq" className="bg-[var(--bg-surface)]">
        <Container className="max-w-3xl">
          <div className="flex flex-col items-start mb-[var(--space-12)]">
            <H2 className="mb-[var(--space-6)]">
              Frequently Asked Questions
            </H2>
          </div>
          
          <Card elevated className="p-0 border-[var(--border-strong)]">
             {faqs.map((faq, idx) => (
               <Accordion 
                 key={idx} 
                 title={faq.q} 
                 isOpen={openFaq === idx} 
                 onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
               >
                 {faq.a}
               </Accordion>
             ))}
          </Card>
        </Container>
      </Section>
    </div>
  );
}
