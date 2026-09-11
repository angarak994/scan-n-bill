import Link from 'next/link';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function FinalCTA() {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 mb-12">
      <ScrollReveal animation="scale" delay={0}>
        <div className="bg-gradient-to-br from-bg-surface to-bg-card border border-border-theme p-8 sm:p-16 rounded-3xl text-center relative overflow-hidden shadow-2xl">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
          
          <ScrollReveal animation="fade-up" delay={200}>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6">
              Ready to take control?
            </h2>
            <p className="text-text-secondary text-lg sm:text-xl max-w-2xl mx-auto mb-10">
              Join leading gaming lounges upgrading their operations with Qcontrol. Setup takes less than 15 minutes.
            </p>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={400}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="px-8 py-4 bg-accent text-white font-bold rounded-full text-lg hover:bg-accent/90 transition-all shadow-[0_0_30px_rgba(141,213,182,0.3)] hover:scale-105 transform">
                Start your 14-day free trial
              </Link>
              <Link href="/contact" className="px-8 py-4 bg-transparent text-text-primary font-bold rounded-full text-lg hover:bg-bg-base transition-all border border-border-light hover:scale-105 transform">
                Talk to Sales
              </Link>
            </div>
            <p className="text-text-disabled text-sm mt-6">
              No credit card required. Cancel anytime.
            </p>
          </ScrollReveal>
        </div>
      </ScrollReveal>
    </section>
  );
}
