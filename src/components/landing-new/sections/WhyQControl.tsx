'use client';

import React from 'react';
import { Section, Container, H2, Card } from '../ui/Primitives';

export default function WhyQControl() {
  return (
    <Section id="why" className="bg-[var(--bg-base)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-start">
          
          <div className="lg:col-span-5 lg:sticky lg:top-[var(--space-32)] pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              Designed for how a club actually works.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6]">
              Generic POS systems don't understand time-based billing, table states, or remote Telegram control. QControl was engineered from the ground up to handle the specific operational reality of billiards and snooker.
            </p>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-[var(--space-8)]">
            {/* Flow 1: Realtime Control */}
            <Card elevated>
               <h3 className="text-[var(--text-xl)] font-bold mb-[var(--space-2)]">Remote Realtime Control</h3>
               <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-6)]">Start a table from your phone on Telegram, and watch the dashboard and customer QR screens update instantly.</p>
               
               <div className="flex flex-col sm:flex-row items-center gap-[var(--space-2)] text-[var(--text-sm)] font-mono text-[var(--text-muted)] p-[var(--space-6)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-md)]">
                  <span className="bg-[var(--info)] text-white px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] font-bold w-full sm:w-auto text-center">Telegram</span>
                  <span className="text-[var(--border-strong)] rotate-90 sm:rotate-0">→</span>
                  <span className="bg-[var(--accent)] text-white px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] font-bold w-full sm:w-auto text-center">Dashboard</span>
                  <span className="text-[var(--border-strong)] rotate-90 sm:rotate-0">→</span>
                  <span className="bg-[var(--success)] text-white px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] font-bold w-full sm:w-auto text-center">Customer QR</span>
               </div>
            </Card>

            {/* Flow 2: Accurate Billing */}
            <Card elevated>
               <h3 className="text-[var(--text-xl)] font-bold mb-[var(--space-2)]">Mathematical Billing</h3>
               <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-6)]">Never guess the final amount. The engine mathematically prorates time to the minute and applies the correct game rate.</p>
               
               <div className="flex flex-wrap items-center justify-center gap-[var(--space-2)] text-[var(--text-sm)] font-mono text-[var(--text-muted)] p-[var(--space-6)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-md)]">
                  <span className="bg-[var(--bg-base)] border border-[var(--border-strong)] px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)]">Duration</span>
                  <span className="text-[var(--border-strong)]">×</span>
                  <span className="bg-[var(--bg-base)] border border-[var(--border-strong)] px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)]">Rate</span>
                  <span className="text-[var(--border-strong)]">+</span>
                  <span className="bg-[var(--bg-base)] border border-[var(--border-strong)] px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)]">F&B</span>
                  <span className="text-[var(--border-strong)]">=</span>
                  <span className="bg-[var(--accent)] text-white px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] font-bold">Total Bill</span>
               </div>
            </Card>

            {/* Flow 3: Promotions */}
            <Card elevated>
               <h3 className="text-[var(--text-xl)] font-bold mb-[var(--space-2)]">Time-Aware Promotions</h3>
               <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-6)]">If a session crosses into a Happy Hour, the engine splits the bill and applies the discount only to the minutes that qualify. Zero manual intervention.</p>
               
               <div className="flex flex-col sm:flex-row items-center gap-[var(--space-2)] text-[var(--text-sm)] font-mono text-[var(--text-muted)] p-[var(--space-6)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[var(--radius-md)]">
                  <span className="bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-secondary)] px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] w-full sm:w-auto text-center">Standard (₹200/hr)</span>
                  <span className="text-[var(--border-strong)] rotate-90 sm:rotate-0">→</span>
                  <span className="bg-[var(--warning)] text-black border border-transparent px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] font-bold w-full sm:w-auto text-center">6 PM Promo (₹150/hr)</span>
                  <span className="text-[var(--border-strong)] rotate-90 sm:rotate-0">→</span>
                  <span className="bg-[var(--bg-base)] border border-[var(--border-strong)] text-[var(--text-secondary)] px-[var(--space-3)] py-[var(--space-1)] rounded-[var(--radius-sm)] w-full sm:w-auto text-center">Standard (₹200/hr)</span>
               </div>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
