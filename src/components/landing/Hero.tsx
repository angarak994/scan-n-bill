import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';
import InteractiveCard from '@/components/landing/InteractiveCard';

export default function Hero() {
  return (
    <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-24 pb-16 sm:pb-32 flex flex-col items-center text-center mt-6 sm:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <div className="absolute top-0 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-accent/10 rounded-full blur-[50px] sm:blur-[100px] -z-10 pointer-events-none animate-pulse duration-[3000ms]"></div>
      
      <ScrollReveal animation="fade-up" delay={0}>
        <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent font-bold text-xs uppercase tracking-widest mb-8 border border-accent/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          The complete platform for gaming businesses
        </span>
      </ScrollReveal>
      
      <ScrollReveal animation="fade-up" delay={100}>
        <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-tight mb-6 sm:mb-8 max-w-5xl">
          Run your gaming business smarter with <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400 drop-shadow-sm">Qcontrol.</span>
        </h1>
      </ScrollReveal>
      
      <ScrollReveal animation="fade-up" delay={200}>
        <p className="text-base sm:text-xl text-text-secondary mb-8 sm:mb-12 max-w-3xl leading-relaxed">
          Manage sessions, tables, bookings, members, QKhata, payments, reports, and integrations in one unified system. We handle the operations so you can focus on growth.
        </p>
      </ScrollReveal>

      <ScrollReveal animation="fade-up" delay={300} className="w-full sm:w-auto">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4 justify-center">
          <InteractiveCard className="rounded-full">
            <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-accent text-white font-bold rounded-full text-base sm:text-lg hover:bg-accent/90 transition-all shadow-[0_0_40px_rgba(141,213,182,0.4)] flex items-center justify-center gap-2 hover-lift">
              Get Started
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
            </Link>
          </InteractiveCard>
          <InteractiveCard className="rounded-full">
            <Link href="#product" className="w-full sm:w-auto px-8 py-4 bg-bg-surface text-text-primary font-bold rounded-full text-base sm:text-lg hover:bg-bg-card transition-all border border-border-light flex items-center justify-center gap-2 hover-lift">
              Explore Qcontrol
            </Link>
          </InteractiveCard>
        </div>
      </ScrollReveal>


      <ScrollReveal animation="fade-up" delay={400} className="w-full mt-16 sm:mt-24 relative perspective-[2000px]">
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent z-10 bottom-0 h-1/3"></div>
        <div className="absolute inset-0 bg-accent/20 blur-[120px] rounded-full -z-10 animate-pulse duration-[4000ms]"></div>
        <div className="relative rounded-2xl border border-border-light/50 bg-bg-surface/50 shadow-2xl backdrop-blur-sm overflow-hidden transform rotate-x-[15deg] scale-95 hover:rotate-x-[5deg] hover:scale-100 transition-all duration-700 ease-out group">
          <div className="w-full h-10 bg-bg-card border-b border-border-light flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="mx-auto bg-bg-surface px-4 py-1 rounded text-xs text-text-secondary font-mono shadow-inner border border-border-light/50 group-hover:text-text-primary transition-colors">qcontrol.app</div>
          </div>
          <div className="relative aspect-[16/9] w-full bg-bg-card p-6 flex flex-col gap-6">
            <div className="flex gap-6 h-full">
              {/* Fake Sidebar */}
              <div className="w-1/4 h-full flex flex-col gap-4 border-r border-border-light/30 pr-6">
                <div className="w-full h-8 bg-border-light/20 rounded animate-pulse"></div>
                <div className="w-3/4 h-4 bg-border-light/20 rounded mt-4"></div>
                <div className="w-5/6 h-4 bg-border-light/20 rounded"></div>
                <div className="w-full h-4 bg-accent/10 rounded border border-accent/20"></div>
                <div className="w-4/5 h-4 bg-border-light/20 rounded"></div>
              </div>
              {/* Fake Main Content */}
              <div className="flex-1 flex flex-col gap-6 h-full">
                <div className="flex justify-between items-center">
                  <div className="w-1/3 h-8 bg-border-light/20 rounded animate-pulse"></div>
                  <div className="w-24 h-8 bg-accent/20 rounded-full border border-accent/30"></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-32 rounded-xl bg-gradient-to-br from-bg-surface to-bg-base border border-border-light/50 p-4 flex flex-col justify-between group-hover:border-accent/30 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20"><div className="w-2 h-2 rounded-full bg-accent animate-ping"></div></div>
                      <div className="w-full h-10 bg-border-light/10 rounded mt-auto"></div>
                    </div>
                  ))}
                </div>
                <div className="flex-1 rounded-xl bg-bg-surface border border-border-light/50 relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-blue-500/5 mix-blend-overlay"></div>
                </div>
              </div>
            </div>
            
            {/* Overlay reflection */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
