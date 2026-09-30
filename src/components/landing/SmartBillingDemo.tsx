'use client';
import React, { useState } from 'react';
import { formatCurrency, formatTime } from '@/components/landing/store/DemoEngine';

export default function SmartBillingDemo() {
  const [game, setGame] = useState<'Pool' | 'Snooker'>('Pool');
  const [durationMins, setDurationMins] = useState(90); // 1.5 hours
  const [promoActive, setPromoActive] = useState(false);
  const [fbItems, setFbItems] = useState<{name: string, price: number}[]>([]);

  const poolRate = 200;
  const snookerRate = 250;
  const promoDiscount = 50; // Flat discount per hour if active

  const baseRate = game === 'Pool' ? poolRate : snookerRate;
  const activeRate = promoActive ? Math.max(0, baseRate - promoDiscount) : baseRate;
  
  const durationHours = durationMins / 60;
  const tableCharge = durationHours * activeRate;
  const fbTotal = fbItems.reduce((acc, item) => acc + item.price, 0);
  
  const total = Math.ceil(tableCharge + fbTotal);

  const toggleFb = (name: string, price: number) => {
    if (fbItems.some(i => i.name === name)) {
      setFbItems(fbItems.filter(i => i.name !== name));
    } else {
      setFbItems([...fbItems, { name, price }]);
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 border-t border-border-light">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        
        <div className="order-2 lg:order-1 relative">
          <div className="w-full rounded-2xl p-6 relative z-10 font-mono glass-panel">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-light">
              <div className="font-bold font-sans">Billing Calculator</div>
              <div className="text-xs text-text-secondary tracking-widest">LIVE MATH</div>
            </div>

            <div className="space-y-6">
              {/* Game Select */}
              <div>
                <div className="text-xs text-text-secondary uppercase mb-2">Game Type</div>
                <div className="flex gap-2">
                  <button onClick={() => setGame('Pool')} className={`flex-1 py-2 text-sm rounded border ${game === 'Pool' ? 'border-accent text-accent bg-accent/10' : 'border-border-light text-text-secondary hover:bg-bg-card'}`}>Pool (₹200/hr)</button>
                  <button onClick={() => setGame('Snooker')} className={`flex-1 py-2 text-sm rounded border ${game === 'Snooker' ? 'border-accent text-accent bg-accent/10' : 'border-border-light text-text-secondary hover:bg-bg-card'}`}>Snooker (₹250/hr)</button>
                </div>
              </div>

              {/* Duration Slider */}
              <div>
                <div className="flex justify-between text-xs text-text-secondary uppercase mb-2">
                  <span>Duration</span>
                  <span>{formatTime(durationMins * 60 * 1000)}</span>
                </div>
                <input 
                  type="range" min="15" max="300" step="15" value={durationMins} 
                  onChange={(e) => setDurationMins(parseInt(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* Promo Toggle */}
              <div className="flex justify-between items-center p-3 rounded-lg border border-border-light bg-bg-base">
                <div>
                  <div className="text-sm font-bold font-sans">Happy Hour (-₹50/hr)</div>
                  <div className="text-xs text-text-secondary font-sans">Simulate active promotion</div>
                </div>
                <button 
                  onClick={() => setPromoActive(!promoActive)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${promoActive ? 'bg-success' : 'bg-bg-card border border-border-light'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${promoActive ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>

              {/* F&B */}
              <div>
                <div className="text-xs text-text-secondary uppercase mb-2">Add-ons</div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFb('Coke', 60)} className={`px-3 py-1.5 text-xs rounded-full border ${fbItems.some(i => i.name === 'Coke') ? 'bg-accent/20 border-accent text-accent' : 'border-border-light text-text-secondary hover:bg-bg-card'}`}>+ Coke (₹60)</button>
                  <button onClick={() => toggleFb('Fries', 120)} className={`px-3 py-1.5 text-xs rounded-full border ${fbItems.some(i => i.name === 'Fries') ? 'bg-accent/20 border-accent text-accent' : 'border-border-light text-text-secondary hover:bg-bg-card'}`}>+ Fries (₹120)</button>
                  <button onClick={() => toggleFb('Water', 40)} className={`px-3 py-1.5 text-xs rounded-full border ${fbItems.some(i => i.name === 'Water') ? 'bg-accent/20 border-accent text-accent' : 'border-border-light text-text-secondary hover:bg-bg-card'}`}>+ Water (₹40)</button>
                </div>
              </div>
            </div>

            {/* Receipt output */}
            <div className="mt-8 bg-bg-card p-4 rounded-xl border border-border-light text-sm">
              <div className="flex justify-between mb-2">
                <span className="text-text-secondary">Table Time ({durationMins}m @ ₹{activeRate}/hr)</span>
                <span>{formatCurrency(tableCharge)}</span>
              </div>
              {fbItems.map((item, idx) => (
                <div key={idx} className="flex justify-between mb-2 animate-entrance">
                  <span className="text-text-secondary">{item.name}</span>
                  <span>{formatCurrency(item.price)}</span>
                </div>
              ))}
              <div className="border-t border-border-light mt-4 pt-4 flex justify-between items-end">
                <span className="font-bold text-lg font-sans">Total Bill</span>
                <span className="text-3xl font-black text-accent">{formatCurrency(total)}</span>
              </div>
            </div>
            
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">Smart Billing</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Billing without the guesswork.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            The QControl billing engine handles all the complex math for you. It automatically calculates precise durations, factors in game-specific rates, applies active promotions, and tallies food orders into one unified receipt.
          </p>
          
          <ul className="space-y-4">
            {['100% deterministic pure functions', 'No manual data entry errors', 'Instant receipt generation'].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-text-primary">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
      </div>
    </section>
  );
}
