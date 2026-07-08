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
      router.push(`/dashboard?b=${data.businessId}&pin=${data.pin}`);
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
            <h1 className="text-3xl font-bold mb-2">Club Portal Login</h1>
            <p className="text-text-secondary text-sm">Access your QControl dashboard.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/50 text-danger rounded-lg text-sm font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Club Name or Phone</label>
              <input required type="text" name="identifier" value={formData.identifier} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors" placeholder="e.g. Rack & Roll Billiards" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Admin PIN</label>
              <input required type="password" name="pin" value={formData.pin} onChange={handleChange} className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent transition-colors font-mono tracking-widest" placeholder="••••" />
            </div>

            <button disabled={loading} type="submit" className="w-full mt-4 bg-text-primary text-bg-base font-bold py-4 rounded-xl hover:bg-text-secondary transition-colors shadow-lg disabled:opacity-50">
              {loading ? 'Authenticating...' : 'Secure Login'}
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-text-secondary">New to QControl? <Link href="/register" className="text-accent font-bold hover:underline">Register your club</Link></p>
          </div>
        </div>
      </div>
    </main>
  );
}
