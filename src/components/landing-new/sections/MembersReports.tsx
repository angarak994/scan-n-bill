'use client';

import React, { useState, useEffect } from 'react';
import { Section, Container, H2, Card, Button } from '../ui/Primitives';

function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  
  return count;
}

export default function MembersReports() {
  const [memberTab, setMemberTab] = useState<'spending' | 'sessions' | 'qkhata'>('spending');
  const [reportRange, setReportRange] = useState<'today' | 'week' | 'month'>('today');

  const reportData = {
    today: { rev: 18420, sessions: 42, growth: '+12.4%' },
    week: { rev: 114500, sessions: 285, growth: '+8.2%' },
    month: { rev: 485000, sessions: 1205, growth: '+15.8%' }
  };
  
  const currentReport = reportData[reportRange];
  const animatedRev = useCountUp(currentReport.rev);

  return (
    <div className="bg-[var(--bg-base)]">
      {/* 05 — Members & QKhata */}
      <Section id="members" className="bg-[var(--bg-base)]">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
            <div className="order-2 lg:order-1 lg:col-span-6 relative w-full">
               <Card elevated className="p-[var(--space-6)] relative z-10 border-[var(--border-strong)]">
                  <div className="flex items-center gap-[var(--space-4)] mb-[var(--space-6)] pb-[var(--space-6)] border-b border-[var(--border-hairline)]">
                    <div className="w-16 h-16 rounded-[var(--radius-full)] bg-[var(--warning)]/10 flex items-center justify-center text-[var(--warning)] font-bold text-[var(--text-2xl)]">R</div>
                    <div>
                      <h3 className="text-[var(--text-xl)] font-bold text-[var(--text-primary)]">Rahul Sharma</h3>
                      <div className="text-[var(--text-sm)] text-[var(--text-secondary)]">VIP Member since 2024</div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-[var(--space-2)] mb-[var(--space-6)] bg-[var(--bg-base)] p-[var(--space-1)] rounded-[var(--radius-md)] border border-[var(--border-strong)]">
                     <button onClick={() => setMemberTab('spending')} className={`flex-1 py-[var(--space-2)] text-[var(--text-sm)] font-bold rounded-[var(--radius-sm)] transition-interactive focus-ring ${memberTab === 'spending' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'}`}>Spending</button>
                     <button onClick={() => setMemberTab('sessions')} className={`flex-1 py-[var(--space-2)] text-[var(--text-sm)] font-bold rounded-[var(--radius-sm)] transition-interactive focus-ring ${memberTab === 'sessions' ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'}`}>Sessions</button>
                     <button onClick={() => setMemberTab('qkhata')} className={`flex-1 py-[var(--space-2)] text-[var(--text-sm)] font-bold rounded-[var(--radius-sm)] transition-interactive focus-ring ${memberTab === 'qkhata' ? 'bg-[var(--bg-elevated)] text-[var(--warning)] shadow-[var(--shadow-sm)] border border-[var(--warning)]/30' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'}`}>QKhata</button>
                  </div>

                  {/* Tab Content */}
                  <div className="min-h-[160px] animate-in fade-in duration-300 relative">
                     {memberTab === 'spending' && (
                       <div className="flex flex-col gap-[var(--space-4)]">
                         <div className="flex justify-between items-end">
                           <div className="text-[var(--text-sm)] text-[var(--text-secondary)]">Total Lifetime Spent</div>
                           <div className="text-[var(--text-3xl)] font-bold font-mono text-[var(--text-primary)] tabular-nums">₹42,500</div>
                         </div>
                         <div className="h-24 flex items-end gap-[var(--space-2)] pt-[var(--space-4)] border-t border-[var(--border-hairline)] mt-[var(--space-2)]">
                           {/* Mini Chart */}
                           {[30, 50, 40, 70, 90, 60].map((h, i) => (
                             <div key={i} className="flex-1 bg-[var(--border-strong)] rounded-t-[var(--radius-sm)] transition-all hover:bg-[var(--text-secondary)]" style={{ height: `${h}%` }}></div>
                           ))}
                         </div>
                       </div>
                     )}
                     {memberTab === 'sessions' && (
                       <div className="flex flex-col gap-[var(--space-3)]">
                         {[
                           { date: 'Today, 2:30 PM', game: 'Pool', duration: '2h 15m' },
                           { date: 'Mon, 6:00 PM', game: 'Snooker', duration: '1h 45m' },
                           { date: 'Last Sat, 8:00 PM', game: 'Pool', duration: '3h 30m' }
                         ].map((s, i) => (
                           <div key={i} className="flex justify-between items-center bg-[var(--bg-base)] p-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--border-hairline)]">
                             <div>
                               <div className="font-bold text-[var(--text-sm)] text-[var(--text-primary)]">{s.game}</div>
                               <div className="text-[var(--text-xs)] text-[var(--text-secondary)]">{s.date}</div>
                             </div>
                             <div className="font-mono text-[var(--text-sm)] text-[var(--text-secondary)]">{s.duration}</div>
                           </div>
                         ))}
                       </div>
                     )}
                     {memberTab === 'qkhata' && (
                       <div className="flex flex-col gap-[var(--space-4)] h-full justify-center">
                         <div className="bg-[var(--warning)]/5 border border-[var(--warning)]/20 p-[var(--space-4)] rounded-[var(--radius-md)] flex justify-between items-center">
                           <div>
                             <div className="text-[var(--text-xs)] font-bold text-[var(--warning)] tracking-wider">STORE CREDIT</div>
                             <div className="text-[var(--text-2xl)] font-mono font-bold text-[var(--text-primary)] mt-[var(--space-1)] tabular-nums">₹1,200</div>
                           </div>
                           <Button variant="secondary" className="!text-[var(--warning)] !border-[var(--warning)]/50">Add Funds</Button>
                         </div>
                         <p className="text-[var(--text-xs)] text-[var(--text-secondary)] text-center">Rahul can start tables and order F&B using this balance via QR.</p>
                       </div>
                     )}
                  </div>
               </Card>
            </div>
            
            <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col items-start pt-[var(--space-8)]">
              <H2 className="mb-[var(--space-6)]">
                Know your players.
              </H2>
              <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)] text-balance">
                Turn walk-ins into regulars. Track member spending, session history, and manage digital wallets (QKhata) to lock in loyalty and upfront cash flow.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* 06 — Reports */}
      <Section id="reports" className="bg-[var(--bg-surface)]">
         <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
            <div className="lg:col-span-5 flex flex-col items-start pt-[var(--space-8)]">
              <H2 className="mb-[var(--space-6)]">
                Know your business.
              </H2>
              <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)] text-balance">
                Measurable clubs grow faster. Track real-time revenue, table utilization, F&B sales, and member balances down to the rupee. Find out exactly when your peak hours are.
              </p>
            </div>
            <div className="lg:col-span-7 w-full relative">
               <Card elevated className="p-[var(--space-8)] border-[var(--border-strong)] z-10">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-[var(--space-4)] sm:gap-0 mb-[var(--space-8)]">
                    <div>
                      <div className="text-[var(--text-sm)] font-mono text-[var(--text-secondary)] mb-[var(--space-2)] uppercase tracking-wider font-bold">Revenue</div>
                      <div className="text-[var(--text-5xl)] font-black font-tabular text-[var(--text-primary)] mb-[var(--space-2)] tracking-tight">₹{animatedRev.toLocaleString()}</div>
                      <div className="flex gap-[var(--space-4)]">
                         <div className="px-[var(--space-2)] py-[var(--space-1)] bg-[var(--accent)]/10 text-[var(--accent)] text-[var(--text-xs)] font-bold rounded-[var(--radius-sm)] flex items-center gap-1">
                           <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                           {currentReport.growth}
                         </div>
                         <div className="text-[var(--text-xs)] text-[var(--text-secondary)] flex items-center font-bold tracking-wider">
                           {currentReport.sessions} SESSIONS
                         </div>
                      </div>
                    </div>
                    
                    {/* Range Switcher */}
                    <div className="flex bg-[var(--bg-base)] p-[var(--space-1)] rounded-[var(--radius-md)] border border-[var(--border-strong)]">
                       {(['today', 'week', 'month'] as const).map(range => (
                         <button 
                           key={range}
                           onClick={() => setReportRange(range)}
                           className={`px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] font-bold rounded-[var(--radius-sm)] transition-interactive focus-ring capitalize ${reportRange === range ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'}`}
                         >
                           {range}
                         </button>
                       ))}
                    </div>
                  </div>
                  
                  {/* SVG Chart */}
                  <div className="h-32 w-full mt-[var(--space-8)] relative border-b border-[var(--border-strong)]">
                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <path 
                        d={`M 0 100 L 0 ${100 - (reportRange === 'today' ? 40 : reportRange === 'week' ? 30 : 50)} 
                            C 20 ${100 - (reportRange === 'today' ? 60 : reportRange === 'week' ? 50 : 70)}, 
                              40 ${100 - (reportRange === 'today' ? 30 : reportRange === 'week' ? 80 : 40)}, 
                              60 ${100 - (reportRange === 'today' ? 80 : reportRange === 'week' ? 60 : 90)} 
                            S 80 ${100 - (reportRange === 'today' ? 50 : reportRange === 'week' ? 90 : 60)}, 
                              100 ${100 - (reportRange === 'today' ? 90 : reportRange === 'week' ? 100 : 80)} 
                            L 100 100 Z`} 
                        fill="url(#chartGradient)" 
                        className="transition-all duration-1000 ease-in-out"
                      />
                      <path 
                        d={`M 0 ${100 - (reportRange === 'today' ? 40 : reportRange === 'week' ? 30 : 50)} 
                            C 20 ${100 - (reportRange === 'today' ? 60 : reportRange === 'week' ? 50 : 70)}, 
                              40 ${100 - (reportRange === 'today' ? 30 : reportRange === 'week' ? 80 : 40)}, 
                              60 ${100 - (reportRange === 'today' ? 80 : reportRange === 'week' ? 60 : 90)} 
                            S 80 ${100 - (reportRange === 'today' ? 50 : reportRange === 'week' ? 90 : 60)}, 
                              100 ${100 - (reportRange === 'today' ? 90 : reportRange === 'week' ? 100 : 80)}`} 
                        fill="none" 
                        stroke="var(--accent)" 
                        strokeWidth="3"
                        className="transition-all duration-1000 ease-in-out"
                      />
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  
               </Card>
            </div>
          </div>
        </Container>
      </Section>
    </div>
  );
}
