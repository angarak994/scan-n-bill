import Link from 'next/link';
import Hero from '@/components/landing/Hero';
import WhyQcontrol from '@/components/landing/WhyQcontrol';
import ProductOverview from '@/components/landing/ProductOverview';
import HowItWorks from '@/components/landing/HowItWorks';
import RealTimeManagement from '@/components/landing/RealTimeManagement';
import AIBusinessAssistant from '@/components/landing/AIBusinessAssistant';
import FoodBeverage from '@/components/landing/FoodBeverage';
import Integrations from '@/components/landing/Integrations';
import Pricing from '@/components/landing/Pricing';
import BusinessUseCases from '@/components/landing/BusinessUseCases';
import ROIBusinessValue from '@/components/landing/ROIBusinessValue';
import SecurityReliability from '@/components/landing/SecurityReliability';
import FAQ from '@/components/landing/FAQ';
import FinalCTA from '@/components/landing/FinalCTA';

export const metadata = {
  title: 'Qcontrol - Run your gaming business smarter',
  description: 'The complete platform for gaming businesses. Manage sessions, tables, bookings, members, QKhata, payments, and integrations in one unified system.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-base text-text-primary overflow-x-hidden selection:bg-accent/30 selection:text-text-primary">
      {/* Navbar */}
      <nav className="w-full flex flex-wrap justify-between items-center px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto gap-4 sticky top-0 z-50 bg-bg-base/80 backdrop-blur-md border-b border-border-light/50">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 sm:w-8 sm:h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          <span className="text-lg sm:text-xl font-bold font-mono tracking-tighter">Qcontrol<span className="text-accent">.</span></span>
        </div>
        <div className="flex gap-2 sm:gap-4 items-center">
          <Link href="/login" className="px-4 py-2 sm:px-6 sm:py-2.5 rounded-full font-bold text-sm sm:text-base text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-colors">
            Log In
          </Link>
          <Link href="/register" className="px-4 py-2 sm:px-6 sm:py-2.5 bg-accent text-white font-bold text-sm sm:text-base rounded-full hover:bg-accent/90 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            Get Started
          </Link>
        </div>
      </nav>

      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Why Qcontrol */}
      <WhyQcontrol />

      {/* 3. Product Overview */}
      <ProductOverview />

      {/* 4. How It Works */}
      <HowItWorks />

      {/* 5. Real-Time Management */}
      <RealTimeManagement />

      {/* 6. AI Business Assistant */}
      <AIBusinessAssistant />

      {/* 7. Food & Beverage */}
      <FoodBeverage />

      {/* 8. Integrations */}
      <Integrations />

      {/* 9. Pricing */}
      <Pricing />

      {/* 10. Business Use Cases */}
      <BusinessUseCases />

      {/* 11. ROI / Business Value */}
      <ROIBusinessValue />

      {/* 12. Security & Reliability */}
      <SecurityReliability />

      {/* 13. FAQ */}
      <FAQ />

      {/* 14. Final CTA */}
      <FinalCTA />
      
      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 border-t border-border-light flex flex-col sm:flex-row justify-between items-center gap-4 text-text-secondary text-sm">
        <div>
          &copy; {new Date().getFullYear()} Qcontrol. All rights reserved.
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
        </div>
      </footer>
    </main>
  );
}
