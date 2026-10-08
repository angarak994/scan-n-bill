'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { useDemoEngine, calculateBill, formatCurrency, formatTime } from '@/components/landing/store/DemoEngine';

export default function Hero() {
  const { state, actions, now } = useDemoEngine();
  const [activeTab, setActiveTab] = useState<'Tables' | 'Sessions' | 'Members' | 'Settings'>('Tables');
  
  const [headline, setHeadline] = useState("");
  const [isReady, setIsReady] = useState(false);

  React.useEffect(() => {
    try {
      const variants = {
        "flagship": { h: "Run your club. Not your spreadsheets.", s: "Tables, sessions, billing, members and promotions in one live system." },
        "unified": { h: "Run your gaming business smarter.", s: "Every table, session and rupee in one connected system." },
        "visibility": { h: "Every table. Every session. Every rupee.", s: "See what's running, what's billed and what's earned, live." },
        "time-based": { h: "Your club runs by the hour. So should your software.", s: "Time-based billing and promotions built for pool, snooker and PS5 clubs." },
        "journey": { h: "From first frame to final bill.", s: "Start sessions by QR, track time live and bill automatically." },
        "promotions": { h: "Promotions that start and end on time.", s: "Set the window once. The price applies only while it is active." },
        "digital": { h: "Close the notebook. Open QControl.", s: "Replace paper notes and spreadsheets with live session tracking." },
        "status": { h: "Know your club before you walk in.", s: "Live table status on your dashboard and on Telegram." },
        "remote": { h: "Your phone is the control room.", s: "Start, pause and stop tables from Telegram." },
        "automation": { h: "Less paperwork. More play.", s: "Session tracking, billing and reports that handle themselves." }
      };
      
      const variantKeys = Object.keys(variants);
      let variantId = 'flagship';
      
      const urlParams = new URLSearchParams(window.location.search);
      const override = urlParams.get('h');
      const sessionVariant = sessionStorage.getItem('heroVariant');
      
      if (override && variants[override as keyof typeof variants]) {
        variantId = override;
      } else if (sessionVariant && variants[sessionVariant as keyof typeof variants]) {
        variantId = sessionVariant;
      } else {
        let lastId = localStorage.getItem('lastVariantId');
        let order = JSON.parse(localStorage.getItem('variantOrder') || '[]');
        
        if (order.length === 0) {
          order = [...variantKeys].sort(() => Math.random() - 0.5);
          if (order[0] === lastId && order.length > 1) {
            order.push(order.shift() as string);
          }
        }
        
        variantId = order.shift() as string;
        localStorage.setItem('variantOrder', JSON.stringify(order));
        localStorage.setItem('lastVariantId', variantId);
        sessionStorage.setItem('heroVariant', variantId);
      }
      
      if (variants[variantId as keyof typeof variants]) {
        setTimeout(() => {
          setHeadline(variants[variantId as keyof typeof variants].h);
          setIsReady(true);
        }, 0);
      }
    } catch(e) {
      setIsReady(true);
    }
  }, []);

  const tabs = [
    { id: 'Tables', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { id: 'Sessions', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'Members', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
  ] as const;

  return (
    <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-24 pb-16 sm:pb-32 flex flex-col items-center text-center mt-6 sm:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <ScrollReveal animation="fade-up" delay={0}>
        <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent font-bold text-xs uppercase tracking-widest mb-8 border border-accent/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          The complete platform for gaming businesses
        </span>
      </ScrollReveal>
      
      {/* Hero Headline Container (Fixed height to prevent CLS) */}
      <div className="min-h-[140px] sm:min-h-[180px] md:min-h-[240px] w-full flex items-center justify-center">
        <h1 
          id="hero-headline"
          className={`text-4xl sm:text-6xl md:text-[5rem] font-black tracking-tighter leading-tight max-w-5xl [text-wrap:balance] transition-opacity duration-500 ${isReady ? 'opacity-100 animate-hero-reveal' : 'opacity-0'}`}
        >
          {headline || "Run your club. Not your spreadsheets."}
        </h1>
      </div>
      
      {/* Hero Subline Container */}
      <div className="min-h-[80px] sm:min-h-[100px] w-full flex items-start justify-center mt-6">
        <p 
          id="hero-subline"
          className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto [text-wrap:balance] opacity-0 animate-hero-reveal-delayed"
        >
          Tables, sessions, billing, members and promotions in one live system.
        </p>
      </div>
      
      <ScrollReveal animation="fade-up" delay={300} className="w-full relative z-10 group mt-8">
        <div className="w-full max-w-[1000px] mx-auto rounded-xl overflow-hidden border border-border bg-bg-surface glass-panel p-0 shadow-2xl">
          
          {/* Dashboard Header */}
          <div className="w-full h-12 bg-bg-card flex items-center px-4 sm:px-6 border-b border-border z-20 relative justify-between">
            <div className="flex items-center gap-3">
               <div className="w-6 h-6 bg-accent rounded text-bg-primary flex items-center justify-center font-bold text-xs tracking-tighter">Q</div>
               <span className="font-bold font-mono tracking-tighter text-sm">Corner Pocket Club</span>
            </div>
            <div className="bg-bg-surface px-3 py-1 rounded text-xs text-text-secondary font-mono border border-border">Live View</div>
          </div>
          
          <div className="relative w-full p-0 flex flex-col sm:flex-row bg-bg-surface">
            
            {/* Interactive Sidebar */}
            <div className="w-full sm:w-56 flex flex-col bg-bg-card border-r border-border p-4 gap-1 z-10 shrink-0">
              
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-accent/15 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface/50'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path></svg>
                  {tab.id}
                </button>
              ))}
              
              <div className="mt-auto px-2">
                <button className="w-full py-2 bg-bg-surface border border-border-light rounded-lg text-xs font-bold hover:bg-bg-card transition-colors">Logout</button>
              </div>
            </div>
            
            {/* Actual Main Content */}
            <div className="flex-1 p-6 flex flex-col h-full bg-transparent relative z-10 overflow-hidden text-left">
              
              {activeTab === 'Tables' && (
                <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-xl font-bold">Active Tables</div>
                    <div className="text-sm font-mono text-accent tabular-nums bg-accent/10 px-3 py-1 rounded-full border border-accent/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      Total: {formatCurrency(state.tables.reduce((sum, t) => sum + calculateBill(now, t.startedAt, t.pausedAt, t.accumulatedPausedMs, t.baseRate, state.promo, t.fbItems), 0))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {state.tables.map(table => {
                      const bill = calculateBill(now, table.startedAt, table.pausedAt, table.accumulatedPausedMs, table.baseRate, state.promo, table.fbItems);
                      const elapsedMs = table.startedAt ? Math.max(0, (table.pausedAt || now) - table.startedAt - table.accumulatedPausedMs) : 0;
                      
                      return (
                        <div key={table.id} className={`group relative h-36 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 overflow-hidden ${table.status === 'ACTIVE' ? 'card-glow border-accent/30 bg-bg-card/80' : 'bg-bg-surface/40 border border-border-light/60 hover:border-border-theme'}`}>
                          <div className="flex justify-between items-start z-10">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${table.status === 'ACTIVE' ? 'bg-accent/20 text-accent border border-accent/30' : table.status === 'PAUSED' ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-bg-card text-text-secondary border border-border-light'}`}>
                               {table.id}
                             </div>
                             <div className={`text-[10px] uppercase font-bold tracking-widest ${table.status === 'ACTIVE' ? 'text-accent' : table.status === 'PAUSED' ? 'text-warning' : 'text-text-disabled'}`}>
                               {table.status}
                             </div>
                          </div>
                          
                          <div className="z-10 transition-transform group-hover:-translate-y-6 duration-300 flex flex-col justify-end h-full">
                            {table.status !== 'AVAILABLE' ? (
                              <div>
                                <div className="text-lg font-mono font-bold text-text-primary mb-1">{formatCurrency(bill)}</div>
                                <div className="text-xs font-mono text-text-secondary">{formatTime(elapsedMs)}</div>
                              </div>
                            ) : (
                              <div className="text-xs text-text-disabled uppercase tracking-widest font-mono">Empty / Available</div>
                            )}
                          </div>

                          {/* Hover Action Buttons */}
                          <div className="absolute inset-x-2 bottom-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0 z-20">
                            {table.status === 'AVAILABLE' && (
                              <button onClick={() => actions.startTable(table.id, 'Guest')} className="flex-1 py-1.5 bg-accent text-white font-bold text-xs rounded hover:bg-accent/90 border border-transparent">Start</button>
                            )}
                            {table.status === 'ACTIVE' && (
                              <button onClick={() => actions.pauseTable(table.id)} className="flex-1 py-1.5 bg-warning text-bg-primary font-bold text-xs rounded hover:bg-warning/90 border border-transparent">Pause</button>
                            )}
                            {table.status === 'PAUSED' && (
                              <button onClick={() => actions.resumeTable(table.id)} className="flex-1 py-1.5 bg-accent text-white font-bold text-xs rounded hover:bg-accent/90 border border-transparent">Resume</button>
                            )}
                            {table.status !== 'AVAILABLE' && (
                              <button onClick={() => actions.stopTable(table.id)} className="flex-1 py-1.5 bg-error text-white font-bold text-xs rounded hover:bg-error/90 border border-transparent">Stop</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* F&B Quick Add Panel */}
                  <div className="flex-1 rounded-xl bg-bg-surface/30 border border-border-light relative overflow-hidden flex flex-col p-4 backdrop-blur-sm justify-center">
                     <div className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-3 text-center sm:text-left">Quick Actions (Try it)</div>
                     <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                       <button onClick={() => actions.startTable('T1', 'Walk-in')} className="px-4 py-2 bg-bg-card/50 border border-border-light rounded-lg text-sm hover:border-accent/50 hover:text-accent transition-colors flex items-center gap-2 font-mono">
                         <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span> Start T1
                       </button>
                       <button onClick={() => actions.addFbItem('T1', { name: 'Energy Drink', price: 150 })} className="px-4 py-2 bg-bg-card/50 border border-border-light rounded-lg text-sm hover:border-blue-400/50 hover:text-blue-400 transition-colors flex items-center gap-2 font-mono">
                         <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]"></span> Add Drink T1 (+₹150)
                       </button>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'Sessions' && (
                <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300 items-center justify-center text-center">
                   <svg className="w-12 h-12 text-text-disabled mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                   <h3 className="font-bold text-xl mb-2">Session History</h3>
                   <p className="text-text-secondary text-sm max-w-sm">Every stopped table automatically logs a detailed session receipt here.</p>
                </div>
              )}
              
              {activeTab === 'Members' && (
                <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                  <h3 className="font-bold text-xl mb-4">Members & QKhata</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between p-4 bg-bg-surface/50 border border-border-light rounded-lg items-center">
                      <div>
                        <div className="font-bold text-sm">Rahul Sharma</div>
                        <div className="text-xs text-text-secondary">VIP Member</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-error">Due: ₹2,450</div>
                        <button className="text-xs text-accent hover:underline mt-1 font-bold">Send Reminder</button>
                      </div>
                    </div>
                    <div className="flex justify-between p-4 bg-bg-surface/50 border border-border-light rounded-lg items-center opacity-70">
                      <div>
                        <div className="font-bold text-sm">Aditya Gupta</div>
                        <div className="text-xs text-text-secondary">Standard Member</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-success">Advance: ₹500</div>
                        <button className="text-xs text-text-secondary hover:text-text-primary mt-1 font-bold">View Ledger</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'Settings' && (
                <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300 items-center justify-center text-center">
                   <svg className="w-12 h-12 text-text-disabled mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                   <h3 className="font-bold text-xl mb-2">Club Settings</h3>
                   <p className="text-text-secondary text-sm max-w-sm">Configure Happy Hours, Rates, and Telegram Bots.</p>
                </div>
              )}

            </div>
            
            {/* Overlay reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-0"></div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
