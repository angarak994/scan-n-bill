import Link from 'next/link';
import { DemoEngineProvider } from '@/components/landing/store/DemoEngine';
import Hero from '@/components/landing/Hero';
import MouseGlow from '@/components/landing/MouseGlow';
import dynamic from 'next/dynamic';
import WhyQcontrol from '@/components/landing/WhyQcontrol';
import HowItWorks from '@/components/landing/HowItWorks';
import AIBusinessAssistant from '@/components/landing/AIBusinessAssistant';
import Integrations from '@/components/landing/Integrations';
import Pricing from '@/components/landing/Pricing';
import Navbar from '@/components/landing/Navbar';

const ProductShowcase = dynamic(() => import('@/components/landing/ProductShowcase'));
const RealTimeManagement = dynamic(() => import('@/components/landing/RealTimeManagement'));
const SmartBillingDemo = dynamic(() => import('@/components/landing/SmartBillingDemo'));
const PromotionDemo = dynamic(() => import('@/components/landing/PromotionDemo'));
const TelegramDemo = dynamic(() => import('@/components/landing/TelegramDemo'));
const QRSessionDemo = dynamic(() => import('@/components/landing/QRSessionDemo'));
const QKhataDemo = dynamic(() => import('@/components/landing/QKhataDemo'));
const PoolCursor = dynamic(() => import('@/components/landing/PoolCursor'));
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
    <DemoEngineProvider>
      <main className="min-h-screen bg-bg-primary text-text-primary overflow-x-hidden selection:bg-accent/30 selection:text-text-primary relative bg-grid-pattern">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-[800px] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(16, 185, 129, 0.15), transparent 70%)' }}></div>
        
        <MouseGlow />
        <PoolCursor />
        
        <Navbar />

      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Why Qcontrol */}
      <WhyQcontrol />

      {/* 3. Product Showcase */}
      <div id="features"><ProductShowcase /></div>

      {/* 4. How It Works */}
      <HowItWorks />

      {/* 5. Real-Time Management */}
      <RealTimeManagement />

      {/* 5.1 Smart Billing Demo */}
      <SmartBillingDemo />

      {/* 5.2 Promotion Demo */}
      <PromotionDemo />

      {/* 6. AI Business Assistant */}
      <AIBusinessAssistant />

      {/* 7. QR Session Demo */}
      <QRSessionDemo />

      {/* 8. Telegram Bot Demo */}
      <TelegramDemo />

      {/* 8.5 QKhata Demo */}
      <QKhataDemo />

      {/* 9. Integrations */}
      <div id="integrations"><Integrations /></div>

      {/* 9. Pricing */}
      <div id="pricing"><Pricing /></div>

      {/* 10. Business Use Cases */}
      <BusinessUseCases />

      {/* 11. ROI / Business Value */}
      <ROIBusinessValue />

      {/* 12. Security & Reliability */}
      <SecurityReliability />

      {/* 13. FAQ */}
      <div id="faq"><FAQ /></div>

      {/* 14. Final CTA */}
      <FinalCTA />
      
      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 border-t border-border-light flex flex-col sm:flex-row justify-between items-center gap-4 text-text-secondary text-sm">
        <div className="flex flex-col gap-1">
          <div className="font-bold text-text-primary">QControl</div>
          <div>Run your gaming business smarter with QControl.</div>
          <div className="mt-2 text-text-disabled">&copy; {new Date().getFullYear()} QControl. All rights reserved.</div>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
        </div>
      </footer>
    </main>
    </DemoEngineProvider>
  );
}
