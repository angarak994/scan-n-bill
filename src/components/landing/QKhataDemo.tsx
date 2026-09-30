'use client';
import React from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { useDemoEngine, formatCurrency } from '@/components/landing/store/DemoEngine';

export default function QKhataDemo() {
  const { state, settleKhata } = useDemoEngine();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 overflow-hidden border-t border-border-light">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        
        <ScrollReveal animation="slide-right" delay={0}>
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">Digital Ledger</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Never lose track of credit again.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            Replace your paper notebook with QKhata. Let regulars play on credit, track exact balances, send automated WhatsApp reminders, and settle debts instantly—all linked directly to their session bills.
          </p>
          
          <ul className="space-y-4">
            {['Track credits and advances effortlessly', 'Automated WhatsApp payment links', 'Zero disputes over old balances'].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-text-primary">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>

        <div className="relative">
          <ScrollReveal animation="fade-up" delay={200}>
            <div className="relative w-full max-w-md mx-auto bg-bg-surface border border-border-theme rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[400px]">
              <div className="w-full h-12 border-b border-border-theme flex items-center justify-between px-4 bg-bg-card">
                <span className="font-bold text-sm">QKhata Ledger</span>
                <span className="flex items-center gap-2 text-xs font-mono text-text-secondary">
                  LIVE SYNC
                </span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col gap-3 relative">
                {state.qKhata.map(account => (
                  <div key={account.name} className="p-4 rounded-xl border border-border-light bg-bg-base flex flex-col gap-3 transition-colors hover:border-border-theme">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-bg-surface border border-border-theme flex items-center justify-center font-bold text-sm">
                          {account.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-text-primary">{account.name}</div>
                          <div className="text-xs text-text-secondary">Last updated: {new Date(account.lastUpdate).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-mono font-bold ${account.balance < 0 ? 'text-danger' : 'text-success'}`}>
                          {account.balance < 0 ? '-' : '+'}{formatCurrency(Math.abs(account.balance))}
                        </div>
                        <div className="text-[10px] text-text-secondary uppercase tracking-widest">{account.balance < 0 ? 'Due' : 'Advance'}</div>
                      </div>
                    </div>
                    
                    {account.balance < 0 && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => settleKhata(account.name, Math.abs(account.balance))} className="flex-1 py-2 bg-accent/10 hover:bg-accent/20 text-accent font-bold text-sm rounded-lg border border-accent/20 transition-colors">
                          Settle Full
                        </button>
                        <button onClick={() => settleKhata(account.name, 500)} className="flex-1 py-2 bg-bg-surface hover:bg-bg-card text-text-primary font-bold text-sm rounded-lg border border-border-light transition-colors">
                          + ₹500
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>

      </div>
    </section>
  );
}
