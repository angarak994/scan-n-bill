'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Key, AlertCircle } from 'lucide-react';

export default function DeveloperLoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'credentials' | 'secretKey'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = authMode === 'credentials'
        ? { email: email.trim(), password }
        : { secretKey: secretKey.trim() };

      const res = await fetch('/api/control/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      router.push('/control');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090D14] text-[#F3F4F6] flex items-center justify-center p-4 selection:bg-emerald-500/30 selection:text-emerald-400 font-sans">
      <div className="w-full max-w-md bg-[#0F172A] border border-[#1E293B] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/5">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">QControl Developer Center</h1>
          <p className="text-sm text-[#94A3B8] mt-1.5">Authorized platform developer access only</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Auth mode toggle */}
        <div className="flex rounded-xl bg-[#090D14] p-1 border border-[#1E293B] mb-6">
          <button
            type="button"
            onClick={() => { setAuthMode('credentials'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'credentials'
                ? 'bg-[#1E293B] text-white shadow'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Developer Credentials
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('secretKey'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              authMode === 'secretKey'
                ? 'bg-[#1E293B] text-white shadow'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            Master Secret Key
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {authMode === 'credentials' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider">
                  Developer Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@qcontrol.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#090D14] border border-[#1E293B] text-white placeholder-[#475569] text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 rounded-xl bg-[#090D14] border border-[#1E293B] text-white placeholder-[#475569] text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <Lock className="w-4 h-4 text-[#475569] absolute right-4 top-3.5" />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1.5 uppercase tracking-wider">
                Platform Developer Secret Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="qc_dev_secret_..."
                  className="w-full px-4 py-3 rounded-xl bg-[#090D14] border border-[#1E293B] text-white placeholder-[#475569] text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <Key className="w-4 h-4 text-[#475569] absolute right-4 top-3.5" />
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                Configured on server environment as DEVELOPER_SECRET
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Enter Control Center'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#1E293B] text-center">
          <p className="text-xs text-[#64748B]">
            QControl Multi-Tenant SaaS Platform Owner Portal
          </p>
        </div>
      </div>
    </main>
  );
}
