'use client';
import React, { useState, useEffect } from 'react';
import { formatCurrency } from '@/components/landing/store/DemoEngine';

export default function PromotionDemo() {
  const [currentTime, setCurrentTime] = useState(18); // 6:00 PM
  const [promoStart, setPromoStart] = useState(16); // 4:00 PM
  const [promoEnd, setPromoEnd] = useState(20); // 8:00 PM
  
  const baseRate = 250;
  const promoRate = 150;

  const isPromoActive = currentTime >= promoStart && currentTime < promoEnd;
  const currentRate = isPromoActive ? promoRate : baseRate;

  // Formatting hours (0 to 24) to AM/PM string
  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  // Ensure end > start when adjusting sliders
  const handleStartChange = (val: number) => {
    if (val >= promoEnd) setPromoEnd(val + 1);
    setPromoStart(val);
  };
  
  const handleEndChange = (val: number) => {
    if (val <= promoStart) setPromoStart(val - 1);
    setPromoEnd(val);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-border-light">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        
        <div>
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">Smart Promotions</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Automate your happy hours.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            Set up dynamic pricing rules that activate automatically. If a session crosses into a Happy Hour, QControl's engine splits the bill exactly to the minute. No manual calculator required.
          </p>
          
          <ul className="space-y-4">
            {['Zero manual rate switching', 'Exact minute-by-minute split billing', 'Boost utilization during dead hours'].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-text-primary">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="w-full rounded-2xl p-6 relative overflow-hidden z-10 glass-panel">
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="font-bold text-lg">Happy Hour Config</h3>
                <p className="text-sm text-text-secondary">Simulate how rates change over time.</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wider transition-colors duration-300 ${isPromoActive ? 'bg-success/10 text-success border-success/30' : 'bg-bg-base text-text-secondary border-border-light'}`}>
                {isPromoActive ? 'PROMO ACTIVE' : 'STANDARD RATE'}
              </div>
            </div>

            {/* Current Rate Display */}
            <div className="flex items-center justify-center mb-10">
              <div className="text-center">
                <div className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-1">Current Active Rate</div>
                <div className={`text-6xl font-black font-mono transition-colors duration-300 ${isPromoActive ? 'text-success' : 'text-text-primary'}`}>
                  {formatCurrency(currentRate)}<span className="text-xl text-text-secondary font-sans">/hr</span>
                </div>
              </div>
            </div>

            {/* Config Sliders */}
            <div className="space-y-6 mb-8 bg-bg-base p-4 rounded-xl border border-border-light">
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-text-secondary">Promo Start Time</span>
                  <span>{formatHour(promoStart)}</span>
                </div>
                <input 
                  type="range" min="10" max="23" value={promoStart} 
                  onChange={(e) => handleStartChange(parseInt(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-text-secondary">Promo End Time</span>
                  <span>{formatHour(promoEnd)}</span>
                </div>
                <input 
                  type="range" min="11" max="24" value={promoEnd} 
                  onChange={(e) => handleEndChange(parseInt(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            </div>

            {/* The Timeline Scrubber */}
            <div className="mt-8 relative pt-6">
              <div className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2 flex justify-between">
                <span>Simulate Time</span>
                <span>{formatHour(currentTime)}</span>
              </div>
              
              <div className="relative w-full h-8 flex items-center">
                {/* Base timeline background */}
                <div className="absolute w-full h-3 bg-bg-base rounded-full border border-border-light"></div>
                
                {/* Promo active window highlight */}
                <div 
                  className="absolute h-3 bg-success/30 border border-success/50 rounded-full transition-all duration-300"
                  style={{
                    left: `${((promoStart - 10) / 14) * 100}%`,
                    width: `${((promoEnd - promoStart) / 14) * 100}%`
                  }}
                ></div>
                
                {/* Time scrubber input */}
                <input 
                  type="range" min="10" max="24" step="1"
                  value={currentTime}
                  onChange={(e) => setCurrentTime(parseInt(e.target.value))}
                  className="absolute w-full h-8 opacity-0 cursor-pointer z-20"
                />
                
                {/* Custom scrubber handle */}
                <div 
                  className="absolute w-6 h-6 bg-accent rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10 pointer-events-none transition-all duration-100 flex items-center justify-center -ml-3"
                  style={{ left: `${((currentTime - 10) / 14) * 100}%` }}
                >
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-text-disabled mt-2 font-mono">
                <span>10 AM</span>
                <span>5 PM</span>
                <span>12 AM</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
