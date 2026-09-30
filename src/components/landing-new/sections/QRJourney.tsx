'use client';

import React, { useState, useEffect } from 'react';
import { Section, Container, H2, Card, Button } from '../ui/Primitives';

const steps = [
  { id: 'scan', label: 'Scan QR', desc: 'Customer scans the table QR code.' },
  { id: 'select', label: 'Select Game', desc: 'Chooses Pool or Snooker.' },
  { id: 'start', label: 'Start Session', desc: 'Starts the live timer immediately.' },
  { id: 'play', label: 'Play & Order', desc: 'Customer tracks bill and orders F&B.' },
  { id: 'end', label: 'End Session', desc: 'Stops the timer.' },
  { id: 'bill', label: 'View Bill', desc: 'Digital receipt presented.' }
];

export default function QRJourney() {
  const [activeStep, setActiveStep] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setActiveStep((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderPhoneScreen = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-[var(--space-4)]">
             <div className="w-48 h-48 border-4 border-[var(--accent)] border-dashed rounded-[var(--radius-lg)] flex items-center justify-center animate-pulse">
               <svg className="w-16 h-16 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v16m8-8H4" /></svg>
             </div>
             <div className="text-[var(--text-sm)] font-bold text-[var(--text-primary)]">Align QR Code</div>
          </div>
        );
      case 1:
        return (
          <div className="p-[var(--space-6)] flex flex-col gap-[var(--space-4)] h-full">
            <div className="text-center font-bold mb-[var(--space-4)] text-[var(--text-xl)] text-[var(--text-primary)]">Table 05</div>
            <button className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-[var(--space-4)] rounded-[var(--radius-md)] flex items-center justify-between hover:border-[var(--accent)] transition-interactive focus-ring">
              <span className="font-bold text-[var(--text-primary)] text-[var(--text-sm)]">8-Ball Pool</span>
              <span className="text-[var(--text-sm)] text-[var(--text-muted)] font-mono">₹200/hr</span>
            </button>
            <button className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-[var(--space-4)] rounded-[var(--radius-md)] flex items-center justify-between hover:border-[var(--accent)] transition-interactive focus-ring">
              <span className="font-bold text-[var(--text-primary)] text-[var(--text-sm)]">Snooker</span>
              <span className="text-[var(--text-sm)] text-[var(--text-muted)] font-mono">₹300/hr</span>
            </button>
          </div>
        );
      case 2:
        return (
          <div className="p-[var(--space-6)] flex flex-col items-center justify-center h-full gap-[var(--space-8)]">
            <div className="text-center font-bold text-[var(--text-lg)] text-[var(--text-primary)]">Ready to start?</div>
            <button className="w-32 h-32 rounded-[var(--radius-full)] bg-[var(--accent)]/10 border-2 border-[var(--accent)] flex items-center justify-center shadow-[var(--shadow-lg)] transition-interactive hover:scale-105 focus-ring">
              <span className="font-bold text-[var(--accent)] text-[var(--text-xl)]">START</span>
            </button>
          </div>
        );
      case 3:
        return (
          <div className="p-[var(--space-6)] flex flex-col h-full gap-[var(--space-6)]">
            <div className="text-center">
              <div className="text-[var(--text-xs)] text-[var(--text-muted)] uppercase tracking-wider mb-[var(--space-2)] font-bold">Live Session</div>
              <div className="text-[var(--text-5xl)] font-mono font-bold text-[var(--text-primary)] mb-[var(--space-1)] tabular-nums">01:14:22</div>
              <div className="text-[var(--accent)] font-bold font-mono text-[var(--text-xl)] tabular-nums">₹315</div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-[var(--space-3)]">
               <button className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] py-[var(--space-3)] rounded-[var(--radius-sm)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] transition-interactive focus-ring hover:border-[var(--text-primary)]">Order F&B</button>
               <button className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] py-[var(--space-3)] rounded-[var(--radius-sm)] text-[var(--text-sm)] font-bold text-[var(--text-primary)] transition-interactive focus-ring hover:border-[var(--text-primary)]">Call Staff</button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="p-[var(--space-6)] flex flex-col items-center justify-center h-full gap-[var(--space-8)]">
            <div className="text-center font-bold text-[var(--text-lg)] text-[var(--danger)]">End Session?</div>
            <div className="text-center text-[var(--text-sm)] text-[var(--text-secondary)]">Are you sure you want to stop the timer?</div>
            <button className="w-full bg-[var(--danger)]/10 border-2 border-[var(--danger)] rounded-[var(--radius-md)] py-[var(--space-4)] flex items-center justify-center text-[var(--danger)] font-bold transition-interactive focus-ring hover:bg-[var(--danger)]/20">
              END NOW
            </button>
          </div>
        );
      case 5:
         return (
          <div className="p-[var(--space-6)] flex flex-col h-full bg-[var(--bg-elevated)] text-[var(--text-primary)]">
             <div className="text-center border-b border-[var(--border-hairline)] pb-[var(--space-4)] mb-[var(--space-4)]">
               <div className="font-bold text-[var(--text-xl)] text-[var(--text-primary)]">QControl Club</div>
               <div className="text-[var(--text-sm)] text-[var(--text-secondary)] font-mono">Receipt #4921</div>
             </div>
             <div className="space-y-[var(--space-3)] font-mono text-[var(--text-sm)] mb-auto text-[var(--text-secondary)]">
               <div className="flex justify-between"><span>Pool (1h 15m)</span><span className="tabular-nums">₹250</span></div>
               <div className="flex justify-between"><span>2x Red Bull</span><span className="tabular-nums">₹240</span></div>
               <div className="flex justify-between border-t border-[var(--border-hairline)] pt-[var(--space-3)] font-bold text-[var(--text-lg)] text-[var(--text-primary)]"><span>Total</span><span className="tabular-nums text-[var(--accent)]">₹490</span></div>
             </div>
             <Button variant="primary" className="w-full py-[var(--space-4)]">Pay at Desk</Button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <Section id="qr" className="bg-[var(--bg-surface)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          <div className="lg:col-span-5 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              The seamless QR experience.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)]">
               Customers scan the table, start a session, track their live bill, order food, and check out — all without downloading an app. 
            </p>
            
            <div className="text-[var(--text-xs)] font-bold text-[var(--text-muted)] mb-[var(--space-4)] tracking-wider">
              USE KEYBOARD ARROWS TO NAVIGATE
            </div>

            <div className="flex flex-col gap-[var(--space-2)] w-full">
              {steps.map((step, idx) => (
                <button 
                  key={step.id} 
                  onClick={() => setActiveStep(idx)}
                  className={`text-left p-[var(--space-4)] rounded-[var(--radius-md)] transition-interactive focus-ring border ${activeStep === idx ? 'bg-[var(--bg-elevated)] border-[var(--accent)] shadow-[var(--shadow-sm)]' : 'bg-transparent border-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                >
                  <div className={`font-bold text-[var(--text-sm)] ${activeStep === idx ? 'text-[var(--text-primary)]' : ''}`}>{idx + 1}. {step.label}</div>
                  {activeStep === idx && <div className="text-[var(--text-sm)] text-[var(--text-secondary)] mt-[var(--space-1)] animate-in fade-in slide-in-from-top-1">{step.desc}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 flex justify-center">
            {/* Phone Visual */}
            <div className="relative w-[300px] h-[600px] border-[8px] border-[var(--bg-elevated)] bg-[var(--bg-base)] rounded-[40px] shadow-[var(--shadow-lg)] shrink-0 ring-1 ring-[var(--border-strong)]">
               {/* Dynamic Content */}
               <div className="absolute inset-0 rounded-[32px] overflow-hidden bg-[var(--bg-surface)]">
                 {renderPhoneScreen()}
               </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
