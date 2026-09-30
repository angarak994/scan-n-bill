'use client';

import React, { useState } from 'react';
import { Section, Container, H2 } from '../ui/Primitives';

export default function BeforeAfter() {
  const [isAfter, setIsAfter] = useState(true);

  return (
    <Section className="bg-[var(--bg-base)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-start">
          <div className="lg:col-span-4 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              The difference is night and day.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)]">
              Replace fragmented operations, paper notes, and generic POS systems with one connected system built exclusively for billiards.
            </p>
            
            <div className="inline-flex bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--radius-sm)] p-[var(--space-1)]">
              <button 
                onClick={() => setIsAfter(false)}
                className={`px-[var(--space-6)] py-[var(--space-3)] text-[var(--text-sm)] font-bold rounded-[var(--radius-sm)] transition-interactive focus-ring ${!isAfter ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'}`}
              >
                Without QControl
              </button>
              <button 
                onClick={() => setIsAfter(true)}
                className={`px-[var(--space-6)] py-[var(--space-3)] text-[var(--text-sm)] font-bold rounded-[var(--radius-sm)] transition-interactive focus-ring ${isAfter ? 'bg-[var(--accent)] text-white border border-transparent' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'}`}
              >
                With QControl
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 w-full min-h-[300px]">
             {!isAfter ? (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)] animate-in fade-in duration-300">
                 {['Paper notes & mental math', 'Missed sessions & lost revenue', 'Pricing confusion during promos', 'Owner stuck watching tables', 'Generic POS systems', 'Manual WhatsApp updates', 'Spreadsheet nightmares', 'No customer self-service'].map((item, i) => (
                   <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-strong)] p-[var(--space-6)] rounded-[var(--radius-md)] flex flex-col justify-center h-32">
                     <span className="text-[var(--danger)] font-bold text-[var(--text-xl)] mb-[var(--space-2)]">✕</span>
                     <span className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">{item}</span>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)] animate-in fade-in duration-300">
                 {['Automated mathematical billing', 'Live dashboard visibility', 'Time-aware promotions', 'Remote Telegram control', 'Built specifically for Billiards', 'Digital QKhata wallets', 'Real-time revenue reports', 'QR-based customer sessions'].map((item, i) => (
                   <div key={i} className="bg-[var(--bg-elevated)] border border-[var(--accent)]/30 p-[var(--space-6)] rounded-[var(--radius-md)] flex flex-col justify-center h-32 shadow-[var(--shadow-sm)]">
                     <span className="text-[var(--accent)] font-bold text-[var(--text-xl)] mb-[var(--space-2)]">✓</span>
                     <span className="text-[var(--text-sm)] font-bold text-[var(--text-primary)]">{item}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
