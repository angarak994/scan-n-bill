'use client';

import React, { useState, useMemo } from 'react';
import { calculateROI } from '../config/pricing';
import { Section, Container, H2, Card } from '../ui/Primitives';

export default function Calculator() {
  const [tables, setTables] = useState(8);
  const [sessions, setSessions] = useState(4);
  const [price, setPrice] = useState(250);

  const results = useMemo(() => calculateROI({
    tables, sessionsPerDay: sessions, avgSessionPrice: price
  }), [tables, sessions, price]);

  return (
    <Section className="bg-[var(--bg-surface)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          <div className="lg:col-span-6 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              See what QControl costs your club.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)] text-balance">
              Estimate based on your inputs. Value framing, not usage-based pricing. QControl is a flat subscription.
            </p>

            <div className="w-full max-w-sm space-y-[var(--space-6)]">
              <div>
                <div className="flex justify-between items-center mb-[var(--space-2)]">
                  <label htmlFor="tables-slider" className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">Number of Tables</label>
                  <span className="text-[var(--text-primary)] font-mono font-bold tabular-nums">{tables}</span>
                </div>
                <input 
                  id="tables-slider"
                  type="range" min="1" max="30" 
                  value={tables} 
                  onChange={(e) => setTables(Number(e.target.value))} 
                  className="w-full accent-[var(--accent)]" 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-[var(--space-2)]">
                  <label htmlFor="sessions-slider" className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">Avg. Sessions/Table/Day</label>
                  <span className="text-[var(--text-primary)] font-mono font-bold tabular-nums">{sessions}</span>
                </div>
                <input 
                  id="sessions-slider"
                  type="range" min="1" max="20" 
                  value={sessions} 
                  onChange={(e) => setSessions(Number(e.target.value))} 
                  className="w-full accent-[var(--accent)]" 
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-[var(--space-2)]">
                  <label htmlFor="price-slider" className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">Avg. Price per Session</label>
                  <span className="text-[var(--text-primary)] font-mono font-bold tabular-nums">₹{price}</span>
                </div>
                <input 
                  id="price-slider"
                  type="range" min="50" max="1000" step="50" 
                  value={price} 
                  onChange={(e) => setPrice(Number(e.target.value))} 
                  className="w-full accent-[var(--accent)]" 
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 w-full">
            <Card elevated className="p-[var(--space-8)]">
              <div className="flex flex-col gap-[var(--space-6)]">
                <div>
                  <div className="text-[var(--text-sm)] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-[var(--space-2)]">Estimated Monthly Revenue</div>
                  <div className="text-[var(--text-5xl)] font-bold font-mono text-[var(--text-primary)] tracking-tight tabular-nums">₹{results.monthlyRevenue.toLocaleString('en-IN')}</div>
                </div>
                
                <div className="h-px bg-[var(--border-hairline)] w-full"></div>

                <div className="grid grid-cols-2 gap-[var(--space-4)]">
                  <div>
                    <div className="text-[var(--text-xs)] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-[var(--space-2)]">QControl Cost/Mo</div>
                    <div className="text-[var(--text-xl)] font-bold font-mono text-[var(--accent)] tabular-nums">
                      {results.qcontrolPrice !== null ? `₹${results.qcontrolPrice.toLocaleString('en-IN')}` : 'Talk to Sales'}
                    </div>
                  </div>
                  
                  {results.costPercentage !== null && (
                    <div>
                      <div className="text-[var(--text-xs)] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-[var(--space-2)]">Cost as % of Rev</div>
                      <div className="text-[var(--text-xl)] font-bold font-mono text-[var(--text-primary)] tabular-nums">{results.costPercentage.toFixed(2)}%</div>
                    </div>
                  )}
                </div>

                {results.sessionsToPay !== null && (
                   <div className="mt-[var(--space-4)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 p-[var(--space-4)] rounded-[var(--radius-md)] flex items-start gap-[var(--space-4)]">
                     <div className="w-8 h-8 rounded-[var(--radius-full)] bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center shrink-0">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                     </div>
                     <div>
                       <div className="font-bold text-[var(--text-primary)] text-[var(--text-sm)]">
                         {results.sessionsToPay <= 1 
                            ? 'One session can pay for it.' 
                            : `Only ${results.sessionsToPay} sessions needed to pay for the entire month.`}
                       </div>
                       <div className="text-[var(--text-xs)] text-[var(--text-secondary)] mt-[var(--space-1)] font-mono">
                         Cost per session: ₹{results.costPerSession?.toFixed(2)}
                       </div>
                     </div>
                   </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
