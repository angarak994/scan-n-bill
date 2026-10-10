import Pricing from '@/components/landing/Pricing';
import Link from 'next/link';
import MouseGlow from '@/components/landing/MouseGlow';

export const metadata = {
  title: 'Pricing & Plans | QControl',
  description: 'Simple, transparent pricing. Scale your plan as your venue grows. Run your entire gaming business from one system.',
};

export default function PricingPage() {
  return (
    <main className="dark min-h-screen bg-bg-primary text-text-primary overflow-x-hidden selection:bg-accent/30 selection:text-text-primary relative bg-grid-pattern">
      <div className="absolute top-0 inset-x-0 h-[800px] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(16, 185, 129, 0.15), transparent 70%)' }}></div>
      <MouseGlow />
      
      {/* Navbar */}
      <nav className="w-full flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto gap-4 sticky top-0 z-50 bg-bg-primary/70 backdrop-blur-xl border-b border-border/50">
        <Link href="/" className="flex items-center gap-2">
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="text-lg sm:text-xl font-bold font-mono tracking-tighter">Qcontrol<span className="text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">.</span></span>
        </Link>

        <div className="flex justify-end gap-2 sm:gap-4 items-center">
          <Link href="/demo" className="hidden lg:block px-4 py-2 sm:px-6 sm:py-2.5 rounded-full font-bold text-sm sm:text-base text-accent bg-accent/10 hover:bg-accent/20 transition-colors">
            Explore Demo
          </Link>
          <Link href="/login" className="px-4 py-2 sm:px-6 sm:py-2.5 rounded-full font-bold text-sm sm:text-base text-text-secondary hover:text-text-primary transition-colors">
            Log In
          </Link>
          <Link href="/onboard" className="px-4 py-2 sm:px-6 sm:py-2.5 bg-accent text-white font-bold text-sm sm:text-base rounded-full hover:bg-accent/90 transition-all border border-transparent hover:border-accent">
            Register Business
          </Link>
        </div>
      </nav>

      {/* Pricing Section */}
      <div className="pt-8 pb-24 relative z-10">
          <Pricing />
      </div>

    </main>
  );
}
