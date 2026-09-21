import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';

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
          <Link href="/register" className="w-full sm:w-auto px-8 py-4 bg-accent text-white font-bold rounded-full text-base sm:text-lg hover:bg-accent/90 transition-all shadow-[0_0_40px_rgba(141,213,182,0.4)] flex items-center justify-center gap-2 hover-lift">
            Get Started
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
          </Link>
          <Link href="#product" className="w-full sm:w-auto px-8 py-4 bg-bg-surface text-text-primary font-bold rounded-full text-base sm:text-lg hover:bg-bg-card transition-all border border-border-theme flex items-center justify-center gap-2 hover-lift">
            Explore Qcontrol
          </Link>
        </div>
      </ScrollReveal>


    </section>
  );
}
