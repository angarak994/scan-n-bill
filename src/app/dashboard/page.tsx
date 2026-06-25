'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateBilling } from '@/lib/billing';

interface SessionData {
  id: string;
  date: string;
  customer_name: string;
  table_id: string;
  game_type: string;
  start_time: string;
  end_time: string | null;
  duration: string | null;
  applied_pricing: string | null;
  cost: number | null;
  status: 'ACTIVE' | 'COMPLETED';
}

function toReadableIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  return formatter.format(date).replace(' am', ' AM').replace(' pm', ' PM');
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get('b');

  const [data, setData] = useState<{ activeSessions: SessionData[], completedSessions: SessionData[], dailyRevenue: number, todayStr: string, pricingRules?: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  const [enteredPin, setEnteredPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinError, setPinError] = useState('');

  const fetchData = async (pinToUse?: string) => {
    try {
      setLoading(true);
      const currentPin = pinToUse || enteredPin;
      let url = businessId ? `/api/dashboard-data?b=${businessId}` : '/api/dashboard-data';
      if (currentPin) {
        url += (url.includes('?') ? '&' : '?') + `pin=${currentPin}`;
      }
      
      const res = await fetch(url);
      if (res.status === 401) {
        setIsAuthorized(false);
        setPinError('Incorrect PIN. Please try again.');
        setLoading(false);
        return;
      }

      if (res.ok) {
        const json = await res.json();
        setData(json);
        setIsAuthorized(true);
        setPinError('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
      const interval = setInterval(() => fetchData(), 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.length === 4) {
      fetchData(enteredPin);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <form onSubmit={handlePinSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 dark:border-gray-700">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">Dashboard Locked</h1>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">Enter your 4-digit PIN to view financial data.</p>
          
          <input 
            type="password" 
            maxLength={4}
            value={enteredPin}
            onChange={e => setEnteredPin(e.target.value)}
            className="w-full text-center text-3xl tracking-[1em] px-4 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-gray-900 dark:text-gray-100"
            placeholder="••••"
            autoFocus
          />
          
          {pinError && <p className="text-red-500 text-sm text-center mb-4">{pinError}</p>}
          
          <button type="submit" disabled={enteredPin.length !== 4 || loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
            {loading ? 'Verifying...' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 text-gray-900 dark:text-gray-100 font-sans">
        <div className="max-w-6xl mx-auto animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/6 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl mb-8"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-red-500 bg-red-50 dark:bg-red-900/30 p-6 rounded-xl border border-red-200 dark:border-red-800 text-lg font-bold shadow">
          Failed to load dashboard data. Check your connection.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 text-gray-900 dark:text-gray-100 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Live data for {data.todayStr}</p>
          </div>
          <button onClick={() => fetchData()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Refresh
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Daily Revenue</h2>
            <p className="text-4xl font-bold text-green-600">₹{data.dailyRevenue}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Active Tables</h2>
            <p className="text-4xl font-bold text-blue-600">{data.activeSessions.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Completed Sessions</h2>
            <p className="text-4xl font-bold text-purple-600">{data.completedSessions.length}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Active Sessions</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
                  <th className="p-4 font-semibold whitespace-nowrap">Table</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Customer</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Game</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Start Time</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Live Duration</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Current Slab</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Live Bill</th>
                </tr>
              </thead>
              <tbody>
                {data.activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-400">No active sessions</td>
                  </tr>
                ) : (
                  data.activeSessions.map(session => {
                    const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
                    const endFull = now.toISOString();
                    let liveDuration = '0 min';
                    let liveCost = 0;
                    let liveSlab = 'None';
                    try {
                      const res = calculateBilling(startFull, endFull, session.game_type, data.pricingRules);
                      liveDuration = res.duration;
                      liveCost = res.cost;
                      liveSlab = res.slabs_applied;
                    } catch (e) {}

                    return (
                      <tr key={session.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="p-4 font-semibold whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="relative flex h-2.5 w-2.5 mr-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                            </span>
                            {session.table_id}
                          </div>
                        </td>
                        <td className="p-4 whitespace-nowrap">{session.customer_name}</td>
                        <td className="p-4 capitalize whitespace-nowrap">{session.game_type}</td>
                        <td className="p-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {session.start_time.includes('T') ? toReadableIST(new Date(session.start_time)) : session.start_time}
                        </td>
                        <td className="p-4 font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{liveDuration}</td>
                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{liveSlab}</td>
                        <td className="p-4 font-bold text-green-600 dark:text-green-400 whitespace-nowrap">₹{liveCost}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Completed Today</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
                  <th className="p-4 font-semibold whitespace-nowrap">Table</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Customer</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Game</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Start Time</th>
                  <th className="p-4 font-semibold whitespace-nowrap">End Time</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Duration</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Slab Applied</th>
                  <th className="p-4 font-semibold whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.completedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">No completed sessions</td>
                  </tr>
                ) : (
                  data.completedSessions.map(session => (
                    <tr key={session.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4 font-semibold whitespace-nowrap">{session.table_id}</td>
                      <td className="p-4 whitespace-nowrap">{session.customer_name}</td>
                      <td className="p-4 capitalize whitespace-nowrap">{session.game_type}</td>
                      <td className="p-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        {session.start_time.includes('T') ? toReadableIST(new Date(session.start_time)) : session.start_time}
                      </td>
                      <td className="p-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                        {session.end_time?.includes('T') ? toReadableIST(new Date(session.end_time)) : session.end_time || '-'}
                      </td>
                      <td className="p-4 font-mono whitespace-nowrap">{session.duration}</td>
                      <td className="p-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{session.applied_pricing}</td>
                      <td className="p-4 font-bold text-green-600 dark:text-green-400 whitespace-nowrap">₹{session.cost}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
