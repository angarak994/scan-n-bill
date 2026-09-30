'use client';

import React, { useState } from 'react';
import { useDemoStore } from '../store/DemoProvider';
import { Section, Container, H2, Card, Badge } from '../ui/Primitives';

export default function SmartBilling() {
  const { state } = useDemoStore();
  const [duration, setDuration] = useState(135); // 2h 15m in minutes
  const [fbCost, setFbCost] = useState(250);

  const baseRate = 200; // per hour
  const promoRate = state.promo.active ? state.promo.rate : baseRate;
  
  // Calculate purely based on state
  const totalBase = Math.floor((duration / 60) * baseRate);
  const totalPromo = Math.floor((duration / 60) * promoRate);
  const discount = totalBase - totalPromo;
  const total = totalPromo + fbCost;

  const formatMin = (m: number) => {
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <Section id="billing" className="bg-[var(--bg-surface)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          <div className="lg:col-span-6 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              Billing without the guesswork.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)]">
              Stop calculating discounts by hand. Set your standard rates, add F&B items, and let the engine handle the complex math to the exact minute.
            </p>
            
            <div className="w-full max-w-sm space-y-[var(--space-6)]">
              <div>
                <div className="flex justify-between items-center mb-[var(--space-2)]">
                  <label htmlFor="duration-slider" className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">Play Duration</label>
                  <span className="text-[var(--text-primary)] font-mono font-bold">{formatMin(duration)}</span>
                </div>
                <input 
                  id="duration-slider"
                  type="range" min="15" max="300" step="15" 
                  value={duration} 
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                  aria-label="Adjust play duration"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-[var(--space-2)]">
                  <label htmlFor="fb-slider" className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">Food & Beverage</label>
                  <span className="text-[var(--text-primary)] font-mono font-bold tabular-nums">₹{fbCost}</span>
                </div>
                <input 
                  id="fb-slider"
                  type="range" min="0" max="2000" step="50" 
                  value={fbCost} 
                  onChange={(e) => setFbCost(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                  aria-label="Adjust Food and Beverage cost"
                />
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-6 w-full relative">
             <Card elevated className="overflow-hidden">
                <div className="flex flex-col gap-[var(--space-6)]">
                  <div className="text-[var(--text-xs)] font-bold font-mono text-[var(--text-muted)] border-b border-[var(--border-hairline)] pb-[var(--space-4)] mb-[var(--space-2)] tracking-wider">LIVE INVOICE PREVIEW</div>
                  
                  {state.promo.active && (
                    <div className="border border-[var(--info)]/30 bg-[var(--info)]/10 rounded-[var(--radius-md)] p-[var(--space-4)] flex justify-between items-center animate-in zoom-in-95 duration-300">
                       <div>
                         <div className="font-bold text-[var(--info)] text-[var(--text-sm)]">WEEKEND POOL OFFER</div>
                         <div className="mt-[var(--space-1)]"><Badge variant="info">ACTIVE</Badge></div>
                       </div>
                       <div className="text-right">
                         <div className="text-[var(--text-xs)] text-[var(--info)]/70 line-through">₹{baseRate}/hr</div>
                         <div className="font-mono font-bold text-[var(--info)] text-[var(--text-lg)]">₹{promoRate}/hr</div>
                       </div>
                    </div>
                  )}
                  
                  <div className="space-y-[var(--space-4)] font-mono text-[var(--text-sm)] relative">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>Base Duration ({formatMin(duration)})</span>
                      <span>₹{totalBase}</span>
                    </div>
                    {state.promo.active && discount > 0 && (
                      <div className="flex justify-between text-[var(--info)] font-bold animate-in slide-in-from-right-4">
                        <span>Promo Applied</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    {fbCost > 0 && (
                      <div className="flex justify-between text-[var(--text-secondary)]">
                        <span>F&B Total</span>
                        <span>₹{fbCost}</span>
                      </div>
                    )}
                    <div className="h-px w-full bg-[var(--border-strong)] my-[var(--space-4)]"></div>
                    <div className="flex justify-between text-[var(--text-primary)] font-bold text-[var(--text-xl)]">
                      <span>Total</span>
                      <span className="text-[var(--accent)] transition-all duration-300 tabular-nums">₹{total}</span>
                    </div>
                  </div>
                </div>
             </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
