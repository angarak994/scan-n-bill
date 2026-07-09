'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    identifier: '',
    pin: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Success, route to dashboard
      sessionStorage.setItem('dashboard_pin', data.pin);
      router.push(`/dashboard?b=${data.businessId}`);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-accent/5 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none -z-10"></div>

      <div className="w-full max-w-md relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-accent mb-8 transition-colors font-medium text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Home
        </Link>
        
        <div className="bg-bg-card/80 backdrop-blur-xl border border-border-theme p-6 sm:p-10 rounded-3xl shadow-2xl">
          <div className="mb-10 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent rotate-3 transition-transform hover:rotate-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
            </div>
            <h1 className="text-3xl font-black mb-3 tracking-tight">Welcome Back</h1>
            <p className="text-text-secondary text-sm font-medium">Log in to manage your QControl dashboard.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/20 text-error rounded-xl text-sm font-bold flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Club Name or Phone</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-disabled">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <input required type="text" name="identifier" value={formData.identifier} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl pl-11 pr-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-medium placeholder-text-disabled" placeholder="e.g. Rack & Roll Billiards" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Admin PIN</label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-disabled">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input required type="password" name="pin" maxLength={4} value={formData.pin} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-xl pl-11 pr-4 py-3.5 text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono tracking-[0.5em] text-lg placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" />
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full mt-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : 'Secure Login'}
            </button>
          </form>
          
          <div className="mt-8 text-center pt-6 border-t border-border-theme">
            <p className="text-sm text-text-secondary font-medium">New to QControl? <Link href="/register" className="text-accent font-bold hover:underline">Register your club</Link></p>
          </div>
        </div>
      </div>
    </main>
  );
}
