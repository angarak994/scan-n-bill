'use client';

import React from 'react';
import { Section, Container, H2, Card } from '../ui/Primitives';

export default function BuiltForBilliards() {
  return (
    <Section className="bg-[var(--bg-base)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          <div className="lg:col-span-5 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              An architecture built for the game.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6]">
              Every entity in QControl is interconnected. A session inherently knows its table, game type, promotion, F&B orders, and member ledger. No more fragmented data.
            </p>
          </div>

          <div className="lg:col-span-7 w-full">
            <Card elevated className="relative h-[400px] sm:h-[500px] hidden sm:flex items-center justify-center p-0 overflow-hidden">
               {/* SVG Lines */}
               <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 text-[var(--text-primary)]" stroke="currentColor">
                  <path strokeWidth="1" strokeDasharray="4 4" d="M 50% 50% L 20% 30% M 50% 50% L 80% 30% M 50% 50% L 20% 70% M 50% 50% L 80% 70% M 50% 50% L 50% 20% M 50% 50% L 50% 80% M 50% 50% L 85% 50% M 50% 50% L 15% 50%"></path>
               </svg>
               
               {/* Nodes */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-[var(--accent)] text-white rounded-[var(--radius-full)] flex items-center justify-center font-bold font-display shadow-[var(--shadow-md)] z-10 transition-interactive hover:scale-105">Session</div>
               
               <div className="absolute top-[20%] left-[50%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>Table</div>
               <div className="absolute top-[80%] left-[50%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>Bill</div>
               
               <div className="absolute top-[50%] left-[15%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>Timer</div>
               <div className="absolute top-[50%] left-[85%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>Game</div>
               
               <div className="absolute top-[30%] left-[20%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>F&B</div>
               <div className="absolute top-[30%] left-[80%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>Member</div>
               
               <div className="absolute top-[70%] left-[20%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>Promotion</div>
               <div className="absolute top-[70%] left-[80%] -translate-x-1/2 -translate-y-1/2 px-[var(--space-4)] py-[var(--space-2)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-full)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] hover:border-[var(--accent)] transition-interactive focus-ring" tabIndex={0}>QKhata</div>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
