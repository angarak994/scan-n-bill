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

  // Temp states for pricing
  const [newGameType, setNewGameType] = useState('');
  const [newPriceType, setNewPriceType] = useState<'fixed' | 'time_based'>('fixed');
  const [newFixedRate, setNewFixedRate] = useState('');
  const [newDayRate, setNewDayRate] = useState('');
  const [newEveningRate, setNewEveningRate] = useState('');
  const [newOpeningHour, setNewOpeningHour] = useState('11'); // Default to 11 AM
  const [newCutoffHour, setNewCutoffHour] = useState('16');

  // Temp states for tables
  const [newTableName, setNewTableName] = useState('');
  const [newTableGameType, setNewTableGameType] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrs, setQrs] = useState<{ name: string; dataUrl: string }[]>([]);

  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addPricingRule = () => {
    if (!newGameType) return;
    const gameTypeKey = newGameType.toLowerCase().trim();
    if (newPriceType === 'fixed') {
      setPricingRules(prev => ({ ...prev, [gameTypeKey]: { type: 'fixed', rate: Number(newFixedRate) } }));
    } else {
      setPricingRules(prev => ({ 
        ...prev, 
        [gameTypeKey]: { 
          type: 'time_based', 
          day_rate: Number(newDayRate), 
          evening_rate: Number(newEveningRate),
          opening_hour: Number(newOpeningHour),
          cutoff_hour: Number(newCutoffHour)
        } 
      }));
    }
    setNewGameType('');
    setNewFixedRate('');
    setNewDayRate('');
    setNewEveningRate('');
    setNewOpeningHour('11');
    setNewCutoffHour('16');
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
        tables: tables
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = () => {
    // In a real app, we'd use JSZip, but here we can just trigger multiple downloads
    // or provide a simple print window.
    window.print();
  };

  if (qrs.length > 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="max-w-6xl w-full flex flex-col gap-8 items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-4xl font-bold text-green-600 dark:text-green-400">Business Onboarded Successfully!</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Your tables are set up and pricing rules applied. Print these QR codes to accept sessions.
            </p>
            <button
              onClick={handleDownloadAll}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors mt-4 print:hidden"
            >
              Print All QR Codes
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full print:grid-cols-2 print:gap-4">
            {qrs.map((qr) => (
              <div key={qr.name} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl flex flex-col items-center border border-gray-200 dark:border-gray-700 print:shadow-none print:border-2">
                <h2 className="text-xl font-bold mb-4 text-center">{qr.name}</h2>
                <img src={qr.dataUrl} alt={qr.name} className="w-48 h-48 mb-4 border-4 border-white shadow-sm rounded-lg" />
                <a
                  href={qr.dataUrl}
                  download={`${qr.name.replace(/ /g, '_')}_QR.png`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors w-full text-center print:hidden"
                >
                  Download PNG
                </a>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <h1 className="text-3xl font-extrabold text-center">Self-Service Setup</h1>
          <div className="flex justify-center gap-8 mt-6">
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
                  <p className="text-xs text-gray-500 mt-2">Applies automatically to all active sessions to ensure clean bills (divisible by 5).</p>
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
                          : `Day: ₹${rule.day_rate}/hr | Evening: ₹${rule.evening_rate}/hr (Changes at ${rule.cutoff_hour! > 12 ? rule.cutoff_hour! - 12 : rule.cutoff_hour === 0 ? 12 : rule.cutoff_hour} ${rule.cutoff_hour! >= 12 ? 'PM' : 'AM'})`}
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
                Next: Configure Tables →
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Table Setup</h2>
                <button onClick={() => setStep(2)} className="text-sm font-medium text-blue-600 hover:underline">← Back</button>
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
