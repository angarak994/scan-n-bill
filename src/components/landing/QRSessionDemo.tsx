'use client';
import React from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { useDemoEngine, formatCurrency, calculateBill, formatTime } from '@/components/landing/store/DemoEngine';

export default function QRSessionDemo() {
  const { state, now, addFbItem, setQrActiveTable } = useDemoEngine();

  // Pick Table 1 (or any active table) to demonstrate QR
  const table = state.tables.find(t => t.id === 'T1');
  
  const elapsedMs = table && table.startedAt ? Math.max(0, (table.pausedAt || now) - table.startedAt - table.accumulatedPausedMs) : 0;
  const bill = table ? calculateBill(now, table.startedAt, table.pausedAt, table.accumulatedPausedMs, table.baseRate, state.promo, table.fbItems) : 0;

  const handleOrder = () => {
    if (table) {
      addFbItem(table.id, { name: 'Energy Drink', price: 120 });
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-primary overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        
        <div className="relative">
          <ScrollReveal animation="fade-up" delay={200}>
            <div className="relative w-full max-w-[320px] mx-auto rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[650px] p-2 glass-panel">
              <div className="w-full h-full bg-bg-surface rounded-2xl overflow-hidden flex flex-col border border-border relative">
                
                {/* Dynamic Island Notch */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-20"></div>
                
                <div className="bg-bg-primary p-6 pt-12 pb-8 border-b border-border-light text-center">
                  <h3 className="font-bold text-xl text-text-primary mb-1">Corner Pocket Club</h3>
                  <p className="text-text-secondary text-sm">Table 01 • Pool</p>
                </div>
                
                <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
                  {table && table.status !== 'AVAILABLE' ? (
                    <>
                      <div className="text-center">
                        <div className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-2">Current Bill</div>
                        <div className="text-5xl font-mono font-bold text-accent mb-2 animate-soft-pulse">{formatCurrency(bill)}</div>
                        <div className="text-sm font-mono text-text-secondary tabular-nums">{formatTime(elapsedMs)}</div>
                      </div>
                      
                      <div className="space-y-3 mt-4">
                         <div className="text-xs font-bold text-text-secondary uppercase tracking-widest border-b border-border-light pb-2">Order History</div>
                         <div className="flex justify-between items-center text-sm text-text-primary">
                           <span>Table Rate ({formatTime(elapsedMs)})</span>
                           <span className="font-mono">₹{bill - table.fbItems.reduce((s,i)=>s+i.price,0)}</span>
                         </div>
                         {table.fbItems.map((item, idx) => (
                           <div key={idx} className="flex justify-between items-center text-sm text-text-primary animate-entrance">
                             <span>{item.name}</span>
                             <span className="font-mono">₹{item.price}</span>
                           </div>
                         ))}
                      </div>
                      
                      <button onClick={handleOrder} className="w-full mt-auto py-3 bg-bg-surface border border-border-theme hover:border-accent/50 text-text-primary font-bold rounded-xl transition-all shadow-sm active:scale-95">
                        Order Energy Drink (+₹120)
                      </button>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-theme flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4"></path></svg>
                      </div>
                      <h4 className="font-bold text-lg mb-2">Table Available</h4>
                      <p className="text-sm text-text-secondary mb-6">Scan the QR on the table to start your session.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal animation="slide-left" delay={0}>
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">QR Customer Experience</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Empower your players.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            Customers scan a QR code to start a session, watch their bill live, and order food—without ever hunting down a waiter or downloading an app. The orders instantly hit your dashboard.
          </p>
          
          <ul className="space-y-4">
            {['Zero downloads required', 'Live timer & bill visibility', 'F&B ordering hits POS instantly'].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-text-primary">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>

      </div>
    </section>
  );
}
