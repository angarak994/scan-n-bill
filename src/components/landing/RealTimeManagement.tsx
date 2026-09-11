import ScrollReveal from '@/components/ui/ScrollReveal';

export default function RealTimeManagement() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 bg-bg-base border-y border-border-light overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="order-2 lg:order-1 relative">
          {/* Mock Real-time UI representation */}
          <ScrollReveal animation="fade-up" delay={0}>
            <div className="relative w-full max-w-md mx-auto lg:mx-0 bg-bg-surface border border-border-theme rounded-2xl shadow-xl overflow-hidden aspect-[4/5] sm:aspect-square flex flex-col">
              <div className="w-full h-12 border-b border-border-theme flex items-center justify-between px-4 bg-bg-card">
                <span className="font-bold text-sm">Live Tables</span>
                <span className="flex items-center gap-2 text-xs font-mono text-accent">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                  SYNCING
                </span>
              </div>
              
              <div className="p-4 flex-1 flex flex-col gap-3 relative">
                {/* Overlay fading gradient to simulate continuous list */}
                <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-bg-surface to-transparent z-10"></div>
                
                {/* Mock items */}
                <ScrollReveal animation="slide-right" delay={300} className="bg-bg-base p-3 rounded-lg border border-border-light flex justify-between items-center animate-[slide-up_1s_ease-out]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">T1</div>
                    <div>
                      <div className="text-sm font-bold">QR Session Started</div>
                      <div className="text-xs text-text-secondary">Just now</div>
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono font-bold">00:01</div>
                </ScrollReveal>

                <ScrollReveal animation="slide-right" delay={500} className="bg-bg-base p-3 rounded-lg border border-border-light flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-info/20 text-info flex items-center justify-center font-bold text-xs">T4</div>
                    <div>
                      <div className="text-sm font-bold">Booking Confirmed</div>
                      <div className="text-xs text-text-secondary">via WhatsApp</div>
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono font-bold text-text-secondary">Tomorrow</div>
                </ScrollReveal>

                <ScrollReveal animation="slide-right" delay={700} className="bg-bg-base p-3 rounded-lg border border-border-light flex justify-between items-center opacity-70">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning/20 text-warning flex items-center justify-center font-bold text-xs">T2</div>
                    <div>
                      <div className="text-sm font-bold">Session Ended</div>
                      <div className="text-xs text-text-secondary">Added to QKhata</div>
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono font-bold text-text-secondary">1h 12m</div>
                </ScrollReveal>
              </div>
            </div>
          </ScrollReveal>
          
          {/* Decorative background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-accent/20 blur-[60px] rounded-full -z-10 pointer-events-none"></div>
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
