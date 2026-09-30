'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Container, Section } from './ui/Primitives';
import { useDemoStore } from './store/DemoProvider';
function formatDuration(ms: number) {
  if (ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function HeroNew() {
  const { state } = useDemoStore();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  return (
    <Section className="relative min-h-[90svh] flex items-center pt-[var(--space-32)] pb-[var(--space-24)] overflow-hidden !border-t-0">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-7 flex flex-col items-start z-10">
            <h1 className="text-[var(--text-5xl)] lg:text-[var(--text-6xl)] font-bold font-display tracking-tight leading-[1.1] mb-[var(--space-6)] text-balance reveal-initial reveal-visible min-h-[140px] flex flex-col justify-end" suppressHydrationWarning>
              Premium billiards club meets precise realtime instrument.
            </h1>

            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] max-w-xl mb-[var(--space-12)] leading-[1.6] text-balance reveal-initial reveal-visible min-h-[60px]" style={{transitionDelay: '100ms'}} suppressHydrationWarning>
              Run more of your club from one place. Live tables, accurate billing, QR sessions, promotions, and Telegram control. Built for performance.
            </p>

            <div className="flex flex-col sm:flex-row gap-[var(--space-4)] w-full sm:w-auto reveal-initial reveal-visible" style={{transitionDelay: '200ms'}}>
              <Button variant="primary" className="py-[var(--space-4)] px-[var(--space-8)] text-[var(--text-base)]">
                Start Free Trial
              </Button>
              <Button variant="secondary" className="py-[var(--space-4)] px-[var(--space-8)] text-[var(--text-base)]">
                Explore QControl
              </Button>
            </div>
          </div>

          {/* Right Column: Mini Console */}
          <div className="lg:col-span-5 relative z-10 w-full reveal-initial reveal-visible" style={{transitionDelay: '300ms'}}>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] p-[var(--space-4)] font-mono text-[var(--text-xs)]">
              <div className="flex items-center justify-between mb-[var(--space-4)] border-b border-[var(--border-hairline)] pb-[var(--space-2)]">
                <span className="text-[var(--text-muted)] uppercase tracking-wider font-bold">Terminal / Live View</span>
                <span className="flex items-center gap-2 text-[var(--success)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></span>
                  Connected
                </span>
              </div>
              
              <div className="space-y-[var(--space-2)]">
                {state.tables.slice(0, 4).map(table => (
                  <button 
                    key={table.id}
                    onClick={() => setSelectedTable(table.id === selectedTable ? null : table.id)}
                    className={`w-full flex items-center justify-between p-[var(--space-2)] rounded-[var(--radius-sm)] transition-interactive focus-ring border ${selectedTable === table.id ? 'bg-[var(--bg-surface)] border-[var(--border-strong)]' : 'bg-transparent border-transparent hover:bg-[var(--bg-surface)]'}`}
                  >
                    <div className="flex items-center gap-[var(--space-4)]">
                      <span className="font-bold text-[var(--text-primary)]">T{table.id.padStart(2, '0')}</span>
                      <span className={`${table.status === 'ACTIVE' ? 'text-[var(--success)]' : table.status === 'PAUSED' ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
                        {table.status}
                      </span>
                    </div>
                    {table.status !== 'AVAILABLE' && (
                       <div className="flex items-center gap-[var(--space-4)] tabular-nums text-[var(--text-primary)]">
                         <span>{formatDuration(table.elapsedTime)}</span>
                         <span className="font-bold w-16 text-right">₹{table.currentBill}</span>
                       </div>
                    )}
                  </button>
                ))}
              </div>
              
              {selectedTable && (
                <div className="mt-[var(--space-4)] p-[var(--space-3)] bg-[var(--bg-surface)] rounded-[var(--radius-sm)] border border-[var(--border-strong)] animate-in fade-in slide-in-from-top-2">
                  <div className="text-[var(--text-secondary)] mb-[var(--space-2)] flex justify-between">
                     <span>Table {selectedTable} Detail</span>
                     <span>Rate: ₹{state.tables.find(t => t.id === selectedTable)?.rate}/hr</span>
                  </div>
                  <div className="flex gap-[var(--space-2)]">
                    <Button variant="secondary" className="py-[var(--space-2)] px-[var(--space-3)] text-[var(--text-xs)] flex-1">Pause</Button>
                    <Button variant="secondary" className="py-[var(--space-2)] px-[var(--space-3)] text-[var(--text-xs)] flex-1 text-[var(--danger)]">Stop</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
