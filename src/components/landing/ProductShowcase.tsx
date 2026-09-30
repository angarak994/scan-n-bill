'use client';
import React, { useState } from 'react';
import { useDemoEngine, formatCurrency, formatTime } from '@/components/landing/store/DemoEngine';

export default function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<'Tables' | 'Sessions' | 'Billing' | 'Reports'>('Tables');
  const { state, now } = useDemoEngine();

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-border-light overflow-hidden">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
          Everything you need, built in.
        </h2>
        <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto">
          A modular ecosystem designed specifically for the complexities of modern gaming lounges and entertainment venues.
        </p>
      </div>

      <div className="w-full rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col md:flex-row h-auto md:h-[600px] glass-panel relative">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-bg-card border-b md:border-b-0 md:border-r border-border-light p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          {['Tables', 'Sessions', 'Billing', 'Reports'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-shrink-0 px-4 py-3 rounded-lg text-left font-bold transition-colors ${activeTab === tab ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:bg-bg-base hover:text-text-primary'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-bg-base p-6 md:p-10 overflow-y-auto">
          {activeTab === 'Tables' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl">Live Tables</h3>
                <button className="px-4 py-2 bg-accent text-white font-bold rounded-lg text-sm transition-colors hover:bg-accent/90">Add Table</button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {state.tables.map(table => {
                  const elapsedMs = table.startedAt ? Math.max(0, (table.pausedAt || now) - table.startedAt - table.accumulatedPausedMs) : 0;
                  return (
                    <div key={table.id} className="p-4 bg-bg-surface border border-border-light rounded-xl hover:border-border-theme transition-colors cursor-pointer flex justify-between items-center group">
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {table.name}
                          <span className={`w-2 h-2 rounded-full ${table.status === 'ACTIVE' ? 'bg-success' : table.status === 'PAUSED' ? 'bg-warning' : 'bg-text-disabled'}`}></span>
                        </div>
                        <div className="text-xs text-text-secondary mt-1">{table.gameType}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-bold group-hover:text-accent transition-colors">{table.status === 'AVAILABLE' ? '₹0' : formatCurrency((elapsedMs / 3600000) * table.baseRate)}</div>
                        <div className="text-xs text-text-secondary font-mono">{formatTime(elapsedMs)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'Sessions' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-bold text-xl mb-6">Session History</h3>
              <div className="bg-bg-surface border border-border-light rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-card text-text-secondary">
                    <tr>
                      <th className="p-4 font-normal">Table</th>
                      <th className="p-4 font-normal hidden sm:table-cell">Duration</th>
                      <th className="p-4 font-normal text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4].map(i => (
                      <tr key={i} className="border-t border-border-light hover:bg-bg-base transition-colors">
                        <td className="p-4 font-bold">Table 0{i}</td>
                        <td className="p-4 text-text-secondary font-mono hidden sm:table-cell">01:45:00</td>
                        <td className="p-4 text-right font-mono text-accent font-bold">₹350</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Billing' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-bg-surface border border-border-light rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <h4 className="font-bold text-lg mb-2">Automated Invoicing</h4>
              <p className="text-text-secondary max-w-sm">Detailed receipts are generated instantly and stored forever. Seamlessly export to PDF or send via WhatsApp.</p>
            </div>
          )}

          {activeTab === 'Reports' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-bold text-xl mb-6">Revenue Overview</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-bg-surface border border-border-light p-4 rounded-xl">
                  <div className="text-xs text-text-secondary mb-1">Today's Revenue</div>
                  <div className="text-2xl font-bold font-mono">₹4,250</div>
                </div>
                <div className="bg-bg-surface border border-border-light p-4 rounded-xl">
                  <div className="text-xs text-text-secondary mb-1">Active Sessions</div>
                  <div className="text-2xl font-bold font-mono text-accent">2</div>
                </div>
              </div>
              
              <div className="w-full h-48 bg-bg-surface border border-border-light rounded-xl flex items-end p-4 gap-2">
                {/* Dummy Chart */}
                {[40, 70, 45, 90, 60, 85, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-accent/20 rounded-t-sm hover:bg-accent/40 transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
}
