'use client';

import React, { useState, useEffect } from 'react';
import { useDemoStore } from '../store/DemoProvider';
import { Section, Container, H2, Card, Badge } from '../ui/Primitives';

export default function PromotionEngine() {
  const { state, dispatch } = useDemoStore();
  
  // Use a simulated 24h timeline mapped from 0 to 100
  const [clockPos, setClockPos] = useState(50); // Scrubber
  const [promoStart, setPromoStart] = useState(30);
  const [promoEnd, setPromoEnd] = useState(70);

  // Sync with global store based on scrubber position
  const isPromoActive = clockPos >= promoStart && clockPos <= promoEnd;

  useEffect(() => {
    if (state.promo.active !== isPromoActive) {
      dispatch({ type: 'TOGGLE_PROMO', payload: { active: isPromoActive } });
    }
  }, [isPromoActive, state.promo.active, dispatch]);

  const formatTimeFromPercent = (pct: number) => {
    const hours = Math.floor((pct / 100) * 24);
    const mins = Math.floor((((pct / 100) * 24) % 1) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${mins.toString().padStart(2, '0')} ${ampm}`;
  };

  const getStatus = () => {
    if (clockPos < promoStart) return { label: 'SCHEDULED', variant: 'warning' as const };
    if (clockPos > promoEnd) return { label: 'EXPIRED', variant: 'default' as const };
    return { label: 'ACTIVE', variant: 'info' as const };
  };
  const status = getStatus();

  return (
    <Section id="promotions" className="bg-[var(--bg-base)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          <div className="order-2 lg:order-1 lg:col-span-7 relative w-full">
             <Card elevated className="p-[var(--space-8)]">
                <div className="flex justify-between items-start mb-[var(--space-8)]">
                   <div>
                     <h3 className="text-[var(--text-xl)] font-bold font-display text-[var(--text-primary)]">Happy Hour</h3>
                     <div className="text-[var(--text-sm)] text-[var(--text-secondary)]">Simulated Time: {formatTimeFromPercent(clockPos)}</div>
                   </div>
                   <Badge variant={status.variant}>
                     {status.label}
                   </Badge>
                </div>

                {/* Scrubber Area */}
                <div className="relative h-24 mb-[var(--space-6)] select-none">
                   {/* Base Timeline line */}
                   <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-[var(--border-strong)] rounded-full"></div>
                   
                   {/* Active Promo range visually */}
                   <div 
                     className="absolute top-1/2 -translate-y-1/2 h-1 bg-[var(--info)]/50 rounded-full transition-all duration-75"
                     style={{ left: `${promoStart}%`, width: `${promoEnd - promoStart}%` }}
                   ></div>

                   {/* Promo Start Handle */}
                   <div 
                     className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--info)] rounded-full cursor-ew-resize hover:scale-125 transition-transform"
                     style={{ left: `calc(${promoStart}% - 8px)` }}
                     onPointerDown={(e) => {
                       const el = e.currentTarget;
                       el.setPointerCapture(e.pointerId);
                       const startX = e.clientX;
                       const startVal = promoStart;
                       const move = (e2: PointerEvent) => {
                          const rect = el.parentElement!.getBoundingClientRect();
                          const dx = ((e2.clientX - startX) / rect.width) * 100;
                          let newVal = startVal + dx;
                          if (newVal < 0) newVal = 0;
                          if (newVal > promoEnd - 5) newVal = promoEnd - 5;
                          setPromoStart(newVal);
                       };
                       const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
                       el.addEventListener('pointermove', move);
                       el.addEventListener('pointerup', up);
                     }}
                   >
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[var(--text-xs)] font-mono text-[var(--text-secondary)] whitespace-nowrap bg-[var(--bg-elevated)] px-2 rounded border border-[var(--border-strong)]">{formatTimeFromPercent(promoStart)}</div>
                   </div>

                   {/* Promo End Handle */}
                   <div 
                     className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-[var(--info)] rounded-full cursor-ew-resize hover:scale-125 transition-transform"
                     style={{ left: `calc(${promoEnd}% - 8px)` }}
                     onPointerDown={(e) => {
                       const el = e.currentTarget;
                       el.setPointerCapture(e.pointerId);
                       const startX = e.clientX;
                       const startVal = promoEnd;
                       const move = (e2: PointerEvent) => {
                          const rect = el.parentElement!.getBoundingClientRect();
                          const dx = ((e2.clientX - startX) / rect.width) * 100;
                          let newVal = startVal + dx;
                          if (newVal > 100) newVal = 100;
                          if (newVal < promoStart + 5) newVal = promoStart + 5;
                          setPromoEnd(newVal);
                       };
                       const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
                       el.addEventListener('pointermove', move);
                       el.addEventListener('pointerup', up);
                     }}
                   >
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[var(--text-xs)] font-mono text-[var(--text-secondary)] whitespace-nowrap bg-[var(--bg-elevated)] px-2 rounded border border-[var(--border-strong)]">{formatTimeFromPercent(promoEnd)}</div>
                   </div>

                   {/* Clock Scrubber */}
                   <div className="absolute top-0 bottom-0 w-[2px] bg-[var(--accent)] cursor-ew-resize group" style={{ left: `${clockPos}%` }}
                      onPointerDown={(e) => {
                        const el = e.currentTarget;
                        el.setPointerCapture(e.pointerId);
                        const startX = e.clientX;
                        const startVal = clockPos;
                        const move = (e2: PointerEvent) => {
                           const rect = el.parentElement!.getBoundingClientRect();
                           const dx = ((e2.clientX - startX) / rect.width) * 100;
                           let newVal = startVal + dx;
                           if (newVal < 0) newVal = 0;
                           if (newVal > 100) newVal = 100;
                           setClockPos(newVal);
                        };
                        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
                        el.addEventListener('pointermove', move);
                        el.addEventListener('pointerup', up);
                      }}
                   >
                      <div className="absolute -top-3 -translate-y-full left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white font-bold text-[var(--text-xs)] px-2 py-1 rounded shadow-[var(--shadow-md)] group-hover:scale-110 transition-transform flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {formatTimeFromPercent(clockPos)}
                      </div>
                   </div>
                </div>

                <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-[var(--space-4)] rounded-[var(--radius-md)] flex justify-between items-center mt-[var(--space-4)]">
                   <div className="text-[var(--text-sm)] text-[var(--text-secondary)]">Current Billing Rate:</div>
                   <div className={`text-[var(--text-xl)] font-mono font-bold transition-colors tabular-nums ${isPromoActive ? 'text-[var(--info)]' : 'text-[var(--text-primary)]'}`}>
                     ₹{isPromoActive ? state.promo.rate : 200}/hr
                   </div>
                </div>
             </Card>
          </div>
          
          <div className="order-1 lg:order-2 lg:col-span-5 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              Promotions that run themselves.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)]">
              Visually drag and drop your promotion schedules. QControl automatically switches billing rates at the exact minute the promotion starts and reverts when it ends, splitting active sessions precisely.
            </p>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-[var(--space-4)] inline-flex items-start gap-[var(--space-4)]">
              <div className="w-8 h-8 rounded-[var(--radius-full)] bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
              </div>
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                <strong>Interactive Demo:</strong> Drag the green time scrubber back and forth across the blue promotion window to see the rate instantly change.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
