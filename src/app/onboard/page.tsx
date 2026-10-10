'use client';

import { useState } from 'react';
import { PricingRules, TableConfig, GlobalSettings } from '@/lib/pricing';

export default function OnboardPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    contact_number: '',
    address: '',
    google_sheet_id: '',
    business_type: '',
    dashboard_pin: '',
  });

  const [pricingRules, setPricingRules] = useState<PricingRules>({});
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ rounding_mode: 'nearest_5' });
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [menuItems, setMenuItems] = useState<{name: string, price: number}[]>([]);

  // Temp states for pricing
  const [newGameType, setNewGameType] = useState('');
  const [newPriceType, setNewPriceType] = useState<'fixed' | 'time_based'>('fixed');
  const [newFixedRate, setNewFixedRate] = useState('');
  const [newDayRate, setNewDayRate] = useState('');
  const [newEveningRate, setNewEveningRate] = useState('');
  const [newOpeningHour, setNewOpeningHour] = useState('11'); // Default to 11 AM
  const [newCutoffHour, setNewCutoffHour] = useState('16');
  const [newMultiplayerMode, setNewMultiplayerMode] = useState<'none' | 'multiply' | 'base_plus_extra'>('none');
  const [newExtraPerPlayer, setNewExtraPerPlayer] = useState('');

  // Temp states for tables
  const [newTableName, setNewTableName] = useState('');
  const [newTableGameType, setNewTableGameType] = useState('');

  // Temp states for menu
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrs, setQrs] = useState<{ name: string; dataUrl: string }[]>([]);
  const [createdBusinessId, setCreatedBusinessId] = useState<string>('');

  const [onboardMode, setOnboardMode] = useState<'selection' | 'demo' | 'pricing' | 'payment' | 'production'>('selection');
  const [selectedPlan, setSelectedPlan] = useState<'essential' | 'growth'>('growth');

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDemoSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setLoading(true);
    setError('');

    try {
      // Safely route the user to the Read-Only Static Demo without touching production databases
      setTimeout(() => {
         window.location.href = '/demo';
      }, 500); // Small delay to show the loading animation for realism
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const launchInstantDemo = () => {
    setOnboardMode('demo'); // Just to show the loading screen if we had one, but handleDemoSubmit does setLoading
    handleDemoSubmit();
  };

  // ... (keeping existing handlers below)
  const addPricingRule = () => {
    if (!newGameType) return;
    const gameTypeKey = newGameType.toLowerCase().trim();
    if (newPriceType === 'fixed') {
      setPricingRules(prev => ({ 
        ...prev, 
        [gameTypeKey]: { 
          type: 'fixed', 
          rate: Number(newFixedRate), 
          multiplayer_mode: newMultiplayerMode,
          extra_per_player: newMultiplayerMode === 'base_plus_extra' ? Number(newExtraPerPlayer) : undefined
        } 
      }));
    } else {
      setPricingRules(prev => ({ 
        ...prev, 
        [gameTypeKey]: { 
          type: 'time_based', 
          day_rate: Number(newDayRate), 
          evening_rate: Number(newEveningRate),
          opening_hour: Number(newOpeningHour),
          cutoff_hour: Number(newCutoffHour),
          multiplayer_mode: newMultiplayerMode,
          extra_per_player: newMultiplayerMode === 'base_plus_extra' ? Number(newExtraPerPlayer) : undefined
        } 
      }));
    }
    setNewGameType('');
    setNewFixedRate('');
    setNewDayRate('');
    setNewEveningRate('');
    setNewOpeningHour('11');
    setNewCutoffHour('16');
    setNewMultiplayerMode('none');
    setNewExtraPerPlayer('');
  };

  const removePricingRule = (key: string) => {
    const updated = { ...pricingRules };
    delete updated[key];
    setPricingRules(updated);
    setTables(prev => prev.filter(t => t.type !== key));
  };

  const addTable = () => {
    if (!newTableName || !newTableGameType) return;
    const newId = newTableName.trim();
    setTables(prev => [...prev, { id: newId, name: newTableName, type: newTableGameType }]);
    setNewTableName('');
  };

  const removeTable = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
  };

  const addMenuItem = () => {
    if (!newMenuName || !newMenuPrice) return;
    setMenuItems(prev => [...prev, { name: newMenuName.trim(), price: Number(newMenuPrice) }]);
    setNewMenuName('');
    setNewMenuPrice('');
  };

  const removeMenuItem = (index: number) => {
    setMenuItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.business_name || !formData.owner_name || !formData.contact_number || !formData.google_sheet_id || !formData.dashboard_pin) {
        setError('Please fill out all required fields.');
        return;
      }
      if (!/^\d{4}$/.test(formData.dashboard_pin)) {
        setError('Dashboard PIN must be exactly 4 digits.');
        return;
      }
    }
    if (step === 2) {
      const ruleCount = Object.keys(pricingRules).length;
      if (ruleCount === 0) {
        setError('Please define at least one pricing rule.');
        return;
      }
    }
    setError('');
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tables.length === 0) {
      setError('Please add at least one table to generate QRs.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        pricing_rules: { rules: pricingRules, globalSettings },
        tables: tables,
        menu_items: menuItems
      };

      const res = await fetch('/api/onboard-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to onboard business');
      }

      setQrs(data.qrs);
      setCreatedBusinessId(data.businessId);
      if (data.pin) {
        sessionStorage.setItem('dashboard_pin', data.pin);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = () => {
    window.print();
  };

  if (qrs.length > 0) {
    return (
      <main className="dark flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary text-text-primary">
        <div className="max-w-6xl w-full flex flex-col gap-8 items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-4xl font-black text-accent">Business Generated Successfully!</h1>
            <p className="text-xl text-text-secondary">
              Your tables are set up and pricing rules applied.
            </p>
            <a
              href={`/dashboard`}
              className="px-8 py-4 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:scale-105 mt-2 print:hidden"
            >
              Enter Dashboard →
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (onboardMode === 'selection') {
    return (
      <main className="dark flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary text-text-primary bg-grid-pattern">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">How would you like to start?</h1>
            <p className="text-text-secondary text-lg">Choose a deployment mode for your club.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Demo Sandbox Card */}
            <div 
              onClick={launchInstantDemo}
              className={`group cursor-pointer glass-panel p-8 rounded-2xl flex flex-col items-center text-center hover:-translate-y-2 transition-all duration-300 hover:border-accent shadow-2xl bg-bg-surface ${loading && onboardMode === 'demo' ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">Quick Demo Sandbox</h2>
              <p className="text-text-secondary mb-6 text-sm leading-relaxed">
                Start instantly with a pre-configured dashboard. We auto-generate tables and standard pricing so you can test QControl immediately. No Google Sheets required.
              </p>
              <div className="mt-auto px-6 py-2 rounded-full border border-border group-hover:bg-accent group-hover:text-white group-hover:border-transparent font-bold text-sm transition-colors">
                {loading && onboardMode === 'demo' ? 'Launching...' : 'Launch Sandbox'}
              </div>
            </div>

            {/* Production Setup Card */}
            <div 
              onClick={() => setOnboardMode('pricing')}
              className="group cursor-pointer glass-panel p-8 rounded-2xl flex flex-col items-center text-center hover:-translate-y-2 transition-all duration-300 hover:border-blue-500 shadow-2xl bg-bg-surface"
            >
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">Full Production Setup</h2>
              <p className="text-text-secondary mb-6 text-sm leading-relaxed">
                Configure your real business. Set up custom time-based pricing rules, link your Google Sheets for QKhata, and generate live QR codes for your tables.
              </p>
              <div className="mt-auto px-6 py-2 rounded-full border border-border group-hover:bg-blue-500 group-hover:text-white group-hover:border-transparent font-bold text-sm transition-colors">
                Start Production Setup
              </div>
            </div>

          </div>
        </div>
      </main>
    );
  }

  if (onboardMode === 'demo') {
    return (
      <main className="dark flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary text-text-primary bg-grid-pattern">
        <div className="flex flex-col items-center justify-center gap-6 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent border-t-transparent animate-spin"></div>
          <h1 className="text-2xl font-bold text-accent">Generating Demo Sandbox...</h1>
          <p className="text-text-secondary">Please wait while we seed realistic demo data.</p>
        </div>
      </main>
    );
  }
  if (onboardMode === 'pricing') {
    return (
      <main className="dark flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary text-text-primary bg-grid-pattern">
        <div className="max-w-5xl w-full">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setOnboardMode('selection')} className="text-text-secondary hover:text-text-primary bg-bg-surface p-2 rounded-full border border-border">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-3xl font-bold">Choose Your License</h1>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Essential Plan */}
            <div 
              onClick={() => setSelectedPlan('essential')}
              className={`glass-panel p-8 rounded-2xl flex flex-col border-2 transition-all cursor-pointer ${selectedPlan === 'essential' ? 'border-accent shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-bg-card' : 'border-border bg-bg-surface hover:border-border-theme'}`}
            >
              <h3 className="text-xl font-bold text-text-secondary mb-2">Essential</h3>
              <div className="mb-6"><span className="text-4xl font-black">₹999</span><span className="text-text-secondary">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-sm">
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Up to 5 Tables</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Standard QR Billing</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Basic Telegram Alerts</li>
              </ul>
              <button onClick={() => { setSelectedPlan('essential'); setOnboardMode('payment'); }} className={`w-full py-3 rounded-xl font-bold transition-all ${selectedPlan === 'essential' ? 'bg-accent text-white' : 'bg-bg-card text-text-primary border border-border'}`}>
                Select Essential
              </button>
            </div>

            {/* Growth Plan */}
            <div 
              onClick={() => setSelectedPlan('growth')}
              className={`glass-panel p-8 rounded-2xl flex flex-col border-2 transition-all cursor-pointer relative overflow-hidden ${selectedPlan === 'growth' ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.15)] bg-bg-card' : 'border-border bg-bg-surface hover:border-border-theme'}`}
            >
              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">Recommended</div>
              <h3 className="text-xl font-bold text-blue-500 mb-2">Growth</h3>
              <div className="mb-6"><span className="text-4xl font-black">₹2,499</span><span className="text-text-secondary">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-sm">
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Unlimited Tables</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>QKhata (Google Sheets Sync)</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Time-based Smart Pricing</li>
                <li className="flex items-center gap-3"><svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Food & Beverage Engine</li>
              </ul>
              <button onClick={() => { setSelectedPlan('growth'); setOnboardMode('payment'); }} className={`w-full py-3 rounded-xl font-bold transition-all ${selectedPlan === 'growth' ? 'bg-blue-600 text-white' : 'bg-bg-card text-text-primary border border-border'}`}>
                Select Growth
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (onboardMode === 'payment') {
    return (
      <main className="dark flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary text-text-primary bg-grid-pattern">
        <div className="max-w-md w-full glass-panel rounded-2xl shadow-2xl overflow-hidden border border-border bg-bg-surface p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setOnboardMode('pricing')} className="text-text-secondary hover:text-text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-2xl font-bold">Secure Checkout</h1>
          </div>
          
          <div className="bg-bg-card border border-border rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-text-secondary">Selected Plan</span>
              <span className="font-bold capitalize">{selectedPlan}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-black">
              <span>Total Due</span>
              <span>₹{selectedPlan === 'essential' ? '999' : '2,499'}</span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">Card Number</label>
              <div className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-secondary flex items-center justify-between font-mono">
                <span>•••• •••• •••• 4242</span>
                <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M2.993 6.696C2.993 5.759 3.75 5 4.687 5h14.626c.937 0 1.694.759 1.694 1.696v10.608c0 .937-.757 1.696-1.694 1.696H4.687c-.937 0-1.694-.759-1.694-1.696V6.696zM4.687 6.696h14.626v2.122H4.687V6.696zm0 4.243v6.365h14.626v-6.365H4.687z"/></svg>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">Expiry</label>
                <div className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-secondary font-mono">12 / 28</div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-2 uppercase tracking-wider">CVC</label>
                <div className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-secondary font-mono">•••</div>
              </div>
            </div>
          </div>

          <button onClick={() => setOnboardMode('production')} className="w-full px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Pay & Continue Setup
          </button>
          <p className="text-xs text-text-secondary text-center mt-4">Simulated secure checkout for Demo Environment.</p>
        </div>
      </main>
    );
  }

  // Production Setup Flow
  return (
    <main className="dark flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary text-text-primary bg-grid-pattern">
      <div className="max-w-2xl w-full bg-bg-surface rounded-2xl shadow-2xl overflow-hidden border border-border">
        <div className="bg-bg-card border-b border-border p-8 relative">
          <button onClick={() => setOnboardMode('selection')} className="absolute top-8 left-8 text-text-secondary hover:text-text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-3xl font-extrabold text-center">Production Setup</h1>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mt-6">
            <div className={`flex flex-col items-center opacity-${step >= 1 ? '100' : '50'} transition-opacity`}>
              <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold mb-2 shadow">1</div>
              <span className="text-sm font-medium">Business</span>
            </div>
            <div className={`flex flex-col items-center opacity-${step >= 2 ? '100' : '50'} transition-opacity`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 shadow ${step >= 2 ? 'bg-white text-blue-600' : 'bg-blue-800/50 text-white'}`}>2</div>
              <span className="text-sm font-medium">Pricing</span>
            </div>
            <div className={`flex flex-col items-center opacity-${step >= 3 ? '100' : '50'} transition-opacity`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 shadow ${step >= 3 ? 'bg-white text-blue-600' : 'bg-blue-800/50 text-white'}`}>3</div>
              <span className="text-sm font-medium">Menu</span>
            </div>
            <div className={`flex flex-col items-center opacity-${step >= 4 ? '100' : '50'} transition-opacity`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 shadow ${step >= 4 ? 'bg-white text-blue-600' : 'bg-blue-800/50 text-white'}`}>4</div>
              <span className="text-sm font-medium">Tables</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl font-medium">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Business Details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Business Name *</label>
                <input required type="text" name="business_name" value={formData.business_name} onChange={handleBasicChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g., Strike Zone" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner Name *</label>
                <input required type="text" name="owner_name" value={formData.owner_name} onChange={handleBasicChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g., John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Number *</label>
                <input required type="text" name="contact_number" value={formData.contact_number} onChange={handleBasicChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g., +1234567890" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Sheet ID *</label>
                <input required type="text" name="google_sheet_id" value={formData.google_sheet_id} onChange={handleBasicChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-gray-100" placeholder="From the Sheet URL" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Required: Share your sheet with the service account email.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dashboard PIN (4 Digits) *</label>
                <input required type="password" maxLength={4} pattern="\d{4}" name="dashboard_pin" value={formData.dashboard_pin} onChange={handleBasicChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-gray-100" placeholder="e.g. 1234" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">This securely locks your dashboard so customers cannot see your revenue.</p>
              </div>
              
              <button onClick={handleNext} className="w-full mt-4 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg transition-all">
                Next: Configure Pricing →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Pricing Rules</h2>
                <button onClick={() => setStep(1)} className="text-sm font-medium text-blue-600 hover:underline">← Back</button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-600 mb-2">
                <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">Global Billing Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Billing Rounding Mode</label>
                    <select 
                      value={globalSettings.rounding_mode || 'nearest_5'}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, rounding_mode: e.target.value as any })}
                      className="w-full md:w-1/2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100"
                    >
                      <option value="nearest_5">Nearest ₹5 (e.g. ₹122 → ₹120, ₹123 → ₹125) - Default</option>
                      <option value="up_5">Round Up to ₹5 (e.g. ₹121 → ₹125)</option>
                      <option value="down_5">Round Down to ₹5 (e.g. ₹124 → ₹120)</option>
                      <option value="none">No Rounding (Exact Amount)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Applies automatically to all active sessions to ensure clean bills.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Billing Interval Mode</label>
                    <select 
                      value={globalSettings.billing_mode || 'per_minute'}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, billing_mode: e.target.value as any })}
                      className="w-full md:w-1/2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100"
                    >
                      <option value="per_minute">Per-Minute Billing (Standard)</option>
                      <option value="15_min_block">15-Minute Blocks (Slab Billing)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Slab Billing always rounds playtime UP to the next 15-minute mark (e.g. 17 mins = 30 mins billed).</p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox"
                        id="enable_peak_rules"
                        checked={globalSettings.enable_peak_rules ?? true}
                        onChange={(e) => setGlobalSettings({ ...globalSettings, enable_peak_rules: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enable_peak_rules" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enable Peak & Off-Peak Smart Billing
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Enforces 1-hour minimum during Peak Hours, and gives a 15-min free promo during Off-Peak.</p>
                    
                    {(globalSettings.enable_peak_rules ?? true) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Peak Start Hour</label>
                          <select 
                            value={globalSettings.peak_start_hour ?? 17}
                            onChange={(e) => setGlobalSettings({ ...globalSettings, peak_start_hour: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100"
                          >
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i}>{i === 0 ? 12 : i > 12 ? i - 12 : i}:00 {i >= 12 ? 'PM' : 'AM'}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Peak End Hour</label>
                          <select 
                            value={globalSettings.peak_end_hour ?? 23}
                            onChange={(e) => setGlobalSettings({ ...globalSettings, peak_end_hour: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100"
                          >
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i}>{i === 0 ? 12 : i > 12 ? i - 12 : i}:00 {i >= 12 ? 'PM' : 'AM'}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-600">
                <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">Add New Game Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Game / Sport Type (e.g. PS5, Bowling, Pool)</label>
                    <input type="text" value={newGameType} onChange={e => setNewGameType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pricing Model</label>
                    <select value={newPriceType} onChange={e => setNewPriceType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100">
                      <option value="fixed">Fixed Rate</option>
                      <option value="time_based">Time-Based Rates</option>
                    </select>
                  </div>
                </div>

                {newPriceType === 'fixed' ? (
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hourly Rate (₹)</label>
                    <input type="number" value={newFixedRate} onChange={e => setNewFixedRate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Day Rate (₹)</label>
                      <input type="number" value={newDayRate} onChange={e => setNewDayRate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Evening Rate (₹)</label>
                      <input type="number" value={newEveningRate} onChange={e => setNewEveningRate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100" />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Day Rate Starts At (Opening)</label>
                        <select value={newOpeningHour} onChange={e => setNewOpeningHour(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100">
                          {Array.from({ length: 24 }).map((_, i) => {
                            const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
                            const ampm = i >= 12 ? 'PM' : 'AM';
                            return <option key={i} value={i}>{hour}:00 {ampm}</option>;
                          })}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Evening Rate Starts At (Cutoff)</label>
                        <select value={newCutoffHour} onChange={e => setNewCutoffHour(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100">
                          {Array.from({ length: 24 }).map((_, i) => {
                            const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
                            const ampm = i >= 12 ? 'PM' : 'AM';
                            return <option key={i} value={i}>{hour}:00 {ampm}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-4">
                  <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Multiplayer Pricing Mode (Optional)</label>
                  <select 
                    value={newMultiplayerMode} 
                    onChange={e => setNewMultiplayerMode(e.target.value as any)} 
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100 mb-3"
                  >
                    <option value="none">None (Flat Rate for Table)</option>
                    <option value="multiply">Multiply Rate by Number of Players (e.g. 150 -&gt; 300 -&gt; 450)</option>
                    <option value="base_plus_extra">Base Rate + Extra Rate Per Additional Player (e.g. 200 + 50/extra player)</option>
                  </select>

                  {newMultiplayerMode === 'base_plus_extra' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Extra Rate Per Additional Player (₹)</label>
                      <input 
                        type="number" 
                        value={newExtraPerPlayer} 
                        onChange={e => setNewExtraPerPlayer(e.target.value)} 
                        placeholder="e.g. 50"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100" 
                      />
                    </div>
                  )}
                </div>

                <button onClick={addPricingRule} className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg transition-colors text-sm w-full">
                  + Add Pricing Rule
                </button>
              </div>

              <div className="space-y-3">
                {Object.entries(pricingRules).map(([game, rule]) => (
                  <div key={game} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-white capitalize text-lg">{game}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {rule.type === 'fixed' 
                          ? `Fixed Rate: ₹${rule.rate}/hr` 
                          : `Day: ₹${rule.day_rate}/hr | Evening: ₹${rule.evening_rate}/hr`}
                        {(rule.multiplayer_mode === 'multiply' || rule.is_per_person) && <span className="ml-2 font-bold text-orange-500">(Multiply per player)</span>}
                        {rule.multiplayer_mode === 'base_plus_extra' && <span className="ml-2 font-bold text-purple-500">(+₹{rule.extra_per_player}/extra player)</span>}
                      </p>
                    </div>
                    <button onClick={() => removePricingRule(game)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
                {Object.keys(pricingRules).length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500">
                    No pricing rules added yet.
                  </div>
                )}
              </div>

              <button onClick={handleNext} className="w-full mt-4 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg transition-all">
                Next: Configure Menu →
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Food & Drinks Menu</h2>
                <button onClick={() => setStep(2)} className="text-sm font-medium text-blue-600 hover:underline">← Back</button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add items like Cigarettes, Cold Drinks, Water Bottles, Snacks.</p>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Item Name</label>
                    <input type="text" value={newMenuName} onChange={e => setNewMenuName(e.target.value)} placeholder="e.g. Redbull" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price (₹)</label>
                    <input type="number" value={newMenuPrice} onChange={e => setNewMenuPrice(e.target.value)} placeholder="e.g. 150" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none text-gray-800 dark:text-gray-100" />
                  </div>
                </div>
                <button onClick={addMenuItem} className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold rounded-lg transition-colors text-sm w-full">
                  + Add Item
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {menuItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-white">{item.name}</h4>
                      <span className="inline-block mt-1 text-green-600 dark:text-green-400 font-bold">
                        ₹{item.price}
                      </span>
                    </div>
                    <button onClick={() => removeMenuItem(idx)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              
              {menuItems.length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500">
                  No menu items added. You can add them later.
                </div>
              )}

              <button onClick={handleNext} className="w-full mt-4 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg transition-all">
                Next: Configure Tables →
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Table Setup</h2>
                <button onClick={() => setStep(3)} className="text-sm font-medium text-blue-600 hover:underline">← Back</button>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Table Name (e.g. Pool Table 1)</label>
                    <input type="text" value={newTableName} onChange={e => setNewTableName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Game Type (Linked to Pricing)</label>
                    <select value={newTableGameType} onChange={e => setNewTableGameType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 outline-none">
                      <option value="">Select a game type...</option>
                      {Object.keys(pricingRules).map(game => (
                        <option key={game} value={game} className="capitalize">{game}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button onClick={addTable} className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold rounded-lg transition-colors text-sm w-full">
                  + Add Table
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tables.map(table => (
                  <div key={table.id} className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-white">{table.name}</h4>
                      <span className="inline-block mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-semibold rounded text-gray-600 dark:text-gray-300 capitalize">
                        {table.type}
                      </span>
                    </div>
                    <button onClick={() => removeTable(table.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
              
              {tables.length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500">
                  No tables added yet.
                </div>
              )}

              <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="w-full mt-4 px-6 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Generating Business...' : 'Generate QR Codes & Finish'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
