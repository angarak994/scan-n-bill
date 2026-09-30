'use client';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { useDemoEngine, calculateBill, formatCurrency, formatTime } from '@/components/landing/store/DemoEngine';

export default function RealTimeManagement() {
  const { state, now } = useDemoEngine();
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-base border-y border-border-light overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="order-2 lg:order-1 relative">
          {/* Mock Real-time UI representation */}
          <ScrollReveal animation="fade-up" delay={0}>
            <div className="relative w-full max-w-md mx-auto lg:mx-0 bg-bg-surface border border-border-theme rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[400px]">
              <div className="w-full h-12 border-b border-border-theme flex items-center justify-between px-4 bg-bg-card">
                <span className="font-bold text-sm">Live Tables Console</span>
                <span className="flex items-center gap-2 text-xs font-mono text-accent">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                  CONNECTED
                </span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col gap-3 relative">
                <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-bg-surface to-transparent z-10 pointer-events-none"></div>
                
                {state.tables.map(table => {
                  const bill = calculateBill(now, table.startedAt, table.pausedAt, table.accumulatedPausedMs, table.baseRate, state.promo, table.fbItems);
                  const elapsedMs = table.startedAt ? Math.max(0, (table.pausedAt || now) - table.startedAt - table.accumulatedPausedMs) : 0;
                  
                  return (
                    <div key={table.id} className={`p-3 rounded-lg border border-border-light flex justify-between items-center transition-colors duration-300 ${table.status === 'ACTIVE' ? 'bg-bg-base border-accent/30' : 'bg-bg-base opacity-80'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${table.status === 'ACTIVE' ? 'bg-accent/20 text-accent' : table.status === 'PAUSED' ? 'bg-warning/20 text-warning' : 'bg-border-light text-text-secondary'}`}>
                          {table.id}
                        </div>
                        <div>
                          <div className="text-sm font-bold flex items-center gap-2">
                            {table.name} 
                            {table.status !== 'AVAILABLE' && <span className="text-[10px] uppercase tracking-wider text-text-secondary px-1.5 py-0.5 bg-bg-surface rounded border border-border-light">{table.status}</span>}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {table.status === 'AVAILABLE' ? 'Available' : table.player || 'Guest'}
                          </div>
                        </div>
                      </div>
                      
                      {table.status !== 'AVAILABLE' && (
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-accent" title={`₹${bill} = ${formatTime(elapsedMs)} x ₹${table.baseRate}/hr + ₹${table.fbItems.reduce((s, i) => s + i.price, 0)} F&B`}>
                            {formatCurrency(bill)}
                          </div>
                          <div className="text-xs font-mono text-text-secondary tabular-nums">
                            {formatTime(elapsedMs)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal animation="slide-left" delay={200} className="order-1 lg:order-2">
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">Instant Sync</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Real-time control. Zero delays.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            When a customer scans a QR code, the dashboard updates instantly. When a WhatsApp booking is confirmed, it blocks the calendar immediately. Every action across your venue is synchronized in real-time, preventing conflicts and revenue leaks.
          </p>
          
          <ul className="space-y-4">
            {['Live table status monitoring', 'Instant ledger updates across devices', 'Automated clash prevention'].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-text-primary">
                <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      </div>
    </section>
  );
}
