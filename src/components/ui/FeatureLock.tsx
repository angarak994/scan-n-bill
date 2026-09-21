import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface FeatureLockProps {
  featureName: string;
  requiredPlan: string;
  description: string;
}

export default function FeatureLock({ featureName, requiredPlan, description }: FeatureLockProps) {
  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center p-6 relative overflow-hidden bg-bg-surface border border-border-light rounded-2xl">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }}>
      </div>
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-500">
        <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-6 shadow-inner border border-warning/20">
          <Lock className="w-8 h-8 text-warning" />
        </div>
        
        <h3 className="text-2xl font-black mb-3">{featureName} is locked</h3>
        <p className="text-text-secondary mb-8 leading-relaxed">
          {description} Upgrade to the <strong>{requiredPlan}</strong> plan to unlock this feature and scale your business operations.
        </p>
        
        <Link 
          href="/dashboard?tab=subscription" 
          className="w-full py-4 bg-accent text-white font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
        >
          View Plans & Upgrade
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
