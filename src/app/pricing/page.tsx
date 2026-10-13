import Pricing from '@/components/landing/Pricing';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const MouseGlow = dynamic(() => import('@/components/landing/MouseGlow'));
import Navbar from '@/components/landing/Navbar';

export const metadata = {
  title: 'Pricing & Plans | QControl',
  description: 'Simple, transparent pricing. Scale your plan as your venue grows. Run your entire gaming business from one system.',
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden selection:bg-accent/30 selection:text-text-primary relative bg-grid-pattern">
      <div className="absolute top-0 inset-x-0 h-[800px] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(16, 185, 129, 0.15), transparent 70%)' }}></div>
      <MouseGlow />
      
      <Navbar />

      {/* Pricing Section */}
      <div className="pt-8 pb-24 relative z-10">
          <Pricing />
      </div>

    </main>
  );
}
