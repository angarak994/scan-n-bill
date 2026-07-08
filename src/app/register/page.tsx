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
    <main className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-8 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Home
        </Link>
        
        <div className="bg-bg-card border border-border-theme p-8 rounded-2xl shadow-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Register Your Club</h1>
            <p className="text-text-secondary text-sm">Join QControl and automate your business operations today.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/50 text-danger rounded-lg text-sm font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Club Name *</label>
              <input required type="text" name="business_name" value={formData.business_name} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors" placeholder="e.g. Rack & Roll Billiards" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Owner Name *</label>
              <input required type="text" name="owner_name" value={formData.owner_name} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors" placeholder="Your full name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Phone *</label>
                <input required type="text" name="contact_number" value={formData.contact_number} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors" placeholder="Contact number" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Admin PIN *</label>
                <input required type="password" name="dashboard_pin" value={formData.dashboard_pin} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono" placeholder="4-6 digits" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Google Sheet ID *</label>
              <input required type="text" name="google_sheet_id" value={formData.google_sheet_id} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono text-sm" placeholder="1BxiMVs0X_x..." />
              <p className="text-[10px] text-text-secondary mt-2">The ID from your Google Sheets URL.</p>
            </div>

            <div className="p-4 border border-accent/30 bg-accent/5 rounded-xl">
              <label className="block text-xs font-bold text-accent uppercase tracking-widest mb-2">Dedicated WhatsApp Number</label>
              <input type="text" name="whatsapp_number" value={formData.whatsapp_number} onChange={handleChange} className="w-full bg-bg-base border border-accent/50 rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono" placeholder="+1234567890" />
              <p className="text-[10px] text-text-secondary mt-2">Optional. Your Twilio number. Leave blank to use the shared gateway.</p>
            </div>

            <button disabled={loading} type="submit" className="w-full mt-4 bg-accent text-white font-bold py-4 rounded-xl hover:bg-accent/90 transition-colors shadow-lg disabled:opacity-50">
              {loading ? 'Creating Account...' : 'Launch Dashboard'}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-text-secondary">Already have an account? <Link href="/login" className="text-accent font-bold hover:underline">Log in</Link></p>
          </div>
        </div>
      </div>
    </main>
  );
}
