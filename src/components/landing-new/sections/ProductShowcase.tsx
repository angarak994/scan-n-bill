'use client';

import React, { useState } from 'react';
import { useDemoStore } from '../store/DemoProvider';
import { Card, Button, Section, Container, Badge, H2 } from '../ui/Primitives';

export default function ProductShowcase() {
  const { state, dispatch } = useDemoStore();
  const [activeTab, setActiveTab] = useState<'tables' | 'sessions' | 'members'>('tables');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const formatDuration = (ms: number) => {
    if (ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const tabs = [
    { id: 'tables', label: 'Tables' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'members', label: 'Members' }
  ] as const;

  return (
    <Section id="tables" className="bg-[var(--bg-surface)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-start">
          
          <div className="lg:col-span-4 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              Every table. One glance.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6]">
              See exactly what’s happening on your floor in real-time. Know which tables are active, which are paused, and who is playing, without leaving your post.
            </p>
          </div>

          <div className="lg:col-span-8 w-full">
             <Card elevated className="p-0 overflow-hidden">
                <div className="flex flex-col h-[500px]">
                   {/* Tabs Header */}
                   <div className="flex border-b border-[var(--border-strong)] px-[var(--space-4)]">
                      {tabs.map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => { setActiveTab(tab.id); setSelectedTable(null); }}
                          className={`px-[var(--space-6)] py-[var(--space-4)] text-[var(--text-sm)] font-bold border-b-2 transition-colors focus-ring ${activeTab === tab.id ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                   </div>

                   {/* Tab Content */}
                   <div className="flex-1 p-[var(--space-6)] overflow-y-auto">
                      {activeTab === 'tables' && (
                         <div className="flex flex-col gap-[var(--space-2)]">
                           {/* Header Row */}
                           <div className="grid grid-cols-12 gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-xs)] font-mono text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-hairline)]">
                             <div className="col-span-3">Table</div>
                             <div className="col-span-2">Status</div>
                             <div className="col-span-3">Player</div>
                             <div className="col-span-2 text-right">Time</div>
                             <div className="col-span-2 text-right">Bill</div>
                           </div>
                           
                           {/* Table Rows */}
                           {state.tables.map(table => {
                             let durationMs = 0;
                             if (table.status === 'ACTIVE' && table.startTime) {
                               durationMs = (state.currentTime - table.startTime) - table.pausedDuration;
                             } else if (table.status === 'PAUSED' && table.startTime && table.pausedAt) {
                               durationMs = (table.pausedAt - table.startTime) - table.pausedDuration;
                             }
                             const estimatedBill = Math.floor((durationMs / 3600000) * table.baseRate) + table.fbCost;
                             const isExpanded = selectedTable === table.id;

                             return (
                               <div key={table.id} className="flex flex-col">
                                 <button 
                                   onClick={() => setSelectedTable(isExpanded ? null : table.id)}
                                   className={`grid grid-cols-12 gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-4)] rounded-[var(--radius-md)] items-center transition-colors text-left focus-ring ${isExpanded ? 'bg-[var(--bg-surface)]' : 'hover:bg-[var(--bg-surface)]'} border ${table.status === 'ACTIVE' ? 'border-[var(--accent)]/30' : 'border-transparent'}`}
                                 >
                                   <div className="col-span-3 font-bold text-[var(--text-primary)]">{table.name} <span className="text-[var(--text-xs)] font-normal text-[var(--text-muted)] ml-[var(--space-2)] hidden sm:inline">{table.gameType}</span></div>
                                   <div className="col-span-2">
                                      <Badge variant={table.status === 'ACTIVE' ? 'success' : table.status === 'PAUSED' ? 'warning' : 'default'}>
                                        {table.status}
                                      </Badge>
                                   </div>
                                   <div className="col-span-3 text-[var(--text-sm)] text-[var(--text-secondary)] truncate">{table.player || '--'}</div>
                                   <div className="col-span-2 text-right font-mono text-[var(--text-sm)] tabular-nums">{table.status === 'AVAILABLE' ? '--:--:--' : formatDuration(durationMs)}</div>
                                   <div className="col-span-2 text-right font-mono font-bold text-[var(--text-primary)] tabular-nums">₹{table.status === 'AVAILABLE' ? '0' : estimatedBill}</div>
                                 </button>

                                 {/* Expanded Panel */}
                                 {isExpanded && (
                                   <div className="col-span-12 mt-[var(--space-2)] mb-[var(--space-4)] mx-[var(--space-4)] p-[var(--space-4)] bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-sm)] animate-in slide-in-from-top-2 fade-in duration-200">
                                     <div className="flex items-center gap-[var(--space-4)]">
                                        {table.status === 'AVAILABLE' ? (
                                          <Button onClick={() => dispatch({ type: 'START_TABLE', payload: { id: table.id, player: 'Walk-in' } })} variant="primary">Start Session</Button>
                                        ) : (
                                          <>
                                            {table.status === 'ACTIVE' ? (
                                              <Button onClick={() => dispatch({ type: 'PAUSE_TABLE', payload: { id: table.id } })} variant="secondary" className="!text-[var(--warning)] !border-[var(--warning)]/50">Pause</Button>
                                            ) : (
                                              <Button onClick={() => dispatch({ type: 'RESUME_TABLE', payload: { id: table.id } })} variant="secondary" className="!text-[var(--accent)] !border-[var(--accent)]/50">Resume</Button>
                                            )}
                                            <Button onClick={() => dispatch({ type: 'STOP_TABLE', payload: { id: table.id } })} variant="secondary" className="!text-[var(--danger)] !border-[var(--danger)]/50">Stop & Bill</Button>
                                          </>
                                        )}
                                        <div className="ml-auto text-[var(--text-xs)] text-[var(--text-muted)] font-mono">Rate: ₹{table.baseRate}/hr</div>
                                     </div>
                                   </div>
                                 )}
                               </div>
                             );
                           })}
                         </div>
                      )}
                      
                      {activeTab === 'sessions' && (
                         <div className="flex items-center justify-center h-full text-[var(--text-muted)] flex-col gap-[var(--space-2)]">
                           <p>Session history populates here.</p>
                         </div>
                      )}

                      {activeTab === 'members' && (
                         <div className="flex items-center justify-center h-full text-[var(--text-muted)] flex-col gap-[var(--space-2)]">
                           <p>Member management interface.</p>
                         </div>
                      )}
                   </div>
                </div>
             </Card>
          </div>
        </div>
      </Container>
    </Section>
  );
}
