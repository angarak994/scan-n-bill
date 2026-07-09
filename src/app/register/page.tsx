'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    business_name: '',
    owner_name: '',
    contact_number: '',
    whatsapp_number: '',
    dashboard_pin: '',
    google_sheet_id: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register business');
      }

      // Registration successful! We'll auto-login them now
      sessionStorage.setItem('dashboard_pin', data.pin);
      router.push(`/dashboard?b=${data.businessId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register business');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-accent/5 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none -z-10"></div>

      <div className="w-full max-w-lg relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent mb-8 transition-colors font-medium text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Home
        </Link>
        
        <div className="bg-bg-card/80 backdrop-blur-xl border border-border-theme p-6 sm:p-10 rounded-3xl shadow-2xl">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black mb-3 tracking-tight">Register Your Club</h1>
            <p className="text-text-secondary text-sm font-medium">Join QControl and automate your business operations today.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 text-error rounded-xl text-sm font-bold flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Club Name *</label>
              <input required type="text" name="business_name" value={formData.business_name} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-medium placeholder-text-disabled" placeholder="e.g. Rack & Roll Billiards" />
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Owner Name *</label>
              <input required type="text" name="owner_name" value={formData.owner_name} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-medium placeholder-text-disabled" placeholder="Your full name" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Phone *</label>
                <input required type="text" name="contact_number" value={formData.contact_number} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-medium placeholder-text-disabled" placeholder="Contact number" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Admin PIN *</label>
                <input required type="password" name="dashboard_pin" value={formData.dashboard_pin} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono tracking-[0.5em] text-lg placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Google Sheet ID *</label>
              <input required type="text" name="google_sheet_id" value={formData.google_sheet_id} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-sm placeholder-text-disabled" placeholder="1BxiMVs0X_x..." />
              <p className="text-[10px] text-text-secondary">The ID from your Google Sheets URL.</p>
            </div>

            <div className="p-4 border border-accent/20 bg-accent/5 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-accent uppercase tracking-wider">Dedicated WhatsApp Number</label>
              <input type="text" name="whatsapp_number" value={formData.whatsapp_number} onChange={handleChange} className="w-full bg-bg-surface border border-accent/30 rounded-xl px-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono placeholder-text-disabled" placeholder="+1234567890" />
              <p className="text-[10px] text-text-secondary">Optional. Your Twilio number. Leave blank to use the shared gateway.</p>
            </div>

            <button disabled={loading} type="submit" className="w-full mt-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Account...
                </>
              ) : 'Launch Dashboard'}
            </button>
          </form>
          
          <div className="mt-8 text-center pt-6 border-t border-border-theme">
            <p className="text-sm text-text-secondary font-medium">Already have an account? <Link href="/login" className="text-accent font-bold hover:underline">Log in</Link></p>
          </div>
        </div>
      </div>
    </main>
  );
}
