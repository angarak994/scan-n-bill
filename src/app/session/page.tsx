'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { calculateCost, getCurrentRate } from '../../lib/billing';

type SessionState =
  | { status: 'loading' }
  | { status: 'idle'; table_id: string; game_type: string; pricingRules?: any }
  | { status: 'active'; id: string; customer_name: string; table_id: string; game_type: string; date: string; start_time: string; pricingRules?: any }
  | { status: 'completed'; duration: string; cost: number; end_time: string }
  | { status: 'error'; message: string };

export default function SessionPage({ searchParams }: { searchParams: Promise<{ table?: string; type?: string; b?: string; _scan?: string }> }) {
  const params = use(searchParams);
  const router = useRouter();
  const pathname = usePathname();
  
  const table_id = params.table;
  const game_type = params.type;
  const business_id = params.b;
  const scan_nonce = params._scan;

  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [customerName, setCustomerName] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentCost, setCurrentCost] = useState(0);
  const [currentActiveRate, setCurrentActiveRate] = useState(0);
  const [notifiedOneHour, setNotifiedOneHour] = useState(false);
  const [showHourNotification, setShowHourNotification] = useState(false);

  const fetchTableState = useCallback(async () => {
    if (!table_id) {
      Promise.resolve().then(() => setSession({ status: 'error', message: 'Table ID is missing from URL' }));
      return;
    }
    
    try {
      const res = await fetch(`/api/station-status?table_id=${table_id}${business_id ? `&b=${business_id}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        setSession({ status: 'error', message: data.error || 'Failed to load table status' });
        return;
      }
      if (data.status === 'idle') {
        setSession({ status: 'idle', table_id, game_type: game_type || 'unknown', pricingRules: data.pricingRules });
      } else if (data.status === 'active') {
        const localSessionStr = localStorage.getItem('qr_billing_active_session');
        const localSession = localSessionStr ? JSON.parse(localSessionStr) : null;

        // Condition 1: They scanned a DIFFERENT table. Invalidate the old one.
        if (localSession && localSession.table_id !== table_id) {
          try {
            await fetch('/api/end-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ table_id: localSession.table_id, business_id: localSession.business_id || business_id }),
            });
            localStorage.removeItem('qr_billing_active_session');
          } catch (err) {
            console.error('Failed to invalidate previous session', err);
          }
        }

        // Condition 2: They scanned the SAME table's QR code again (URL is clean, no _scan parameter).
        // If localSession matches data.id, but there's no _scan param, they just scanned the physical QR code to end it!
        if (localSession && localSession.id === data.id && !scan_nonce) {
          try {
            const endRes = await fetch('/api/end-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ table_id, business_id }),
            });
            const endData = await endRes.json();
            if (endRes.ok) {
              localStorage.removeItem('qr_billing_active_session');
              setSession({ status: 'completed', duration: endData.duration, cost: endData.cost, end_time: endData.end_time });
              return;
            }
          } catch (err) {
            console.error('Failed to end session via QR scan', err);
          }
        }

        setSession({
          status: 'active',
          id: data.id,
          customer_name: data.customer_name,
          table_id: data.table_id,
          game_type: data.game_type,
          date: data.date,
          start_time: data.start_time,
          pricingRules: data.pricingRules,
        });
      } else {
        setSession({ status: 'error', message: 'Unknown status received' });
      }
    } catch {
      setSession({ status: 'error', message: 'Network error occurred' });
    }
  }, [table_id, game_type, business_id, scan_nonce]);

  useEffect(() => {
    fetchTableState();
  }, [fetchTableState]);

  useEffect(() => {
    if (session.status !== 'active') {
      setElapsedSeconds(0);
      setCurrentCost(0);
      setNotifiedOneHour(false);
      setShowHourNotification(false);
      return;
    }
    
    const startMs = new Date(`${session.date}, ${session.start_time}`).getTime();

    const tick = () => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diffSecs);
      
      const { cost } = calculateCost(startMs, now, session.game_type, session.pricingRules);
      setCurrentCost(cost);
      setCurrentActiveRate(getCurrentRate(session.game_type, now, session.pricingRules).rate);

      if (diffSecs >= 3600 && !notifiedOneHour) {
        setNotifiedOneHour(true);
        setShowHourNotification(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const handleStart = async () => {
    if (!table_id || !game_type) {
      alert('Missing table or game type in URL');
      return;
    }
    if (!customerName || customerName.trim() === '') {
      alert('Please enter a Customer Name to start the session.');
      return;
    }
    
    try {
      const res = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id, game_type, customer_name: customerName, business_id }),
      });
      const data = await res.json();
      if (res.ok) {
          const nonce = Math.random().toString(36).substring(2, 10);
          localStorage.setItem('qr_billing_active_session', JSON.stringify({ id: data.id, table_id: data.table_id, business_id }));
          
          // Inject the _scan nonce into the URL without reloading the page
          // This way, if they refresh, the nonce is preserved. If they scan the raw QR again, the nonce is missing.
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('_scan', nonce);
          router.replace(newUrl.pathname + newUrl.search);

          setSession((prev: any) => ({
            status: 'active',
            id: data.id,
            customer_name: data.customer_name,
            table_id: data.table_id,
            game_type: data.game_type,
            date: data.date,
            start_time: data.start_time,
            pricingRules: prev.pricingRules,
          }));
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to start session');
    }
  };

  const handleEnd = async () => {
    // Only used for debugging or API failsafes now, no UI button exposed.
    if (session.status !== 'active') return;
    try {
      const res = await fetch('/api/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: session.table_id, business_id }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem('qr_billing_active_session');
        setSession({ status: 'completed', duration: data.duration, cost: data.cost, end_time: data.end_time });
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to end session');
    }
  };

  const formatElapsed = (totalSeconds: number) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (session.status === 'loading') {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-700 animate-pulse">
          <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 w-3/4 rounded mt-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 w-1/2 rounded"></div>
        </div>
      </main>
    );
  }

  if (session.status === 'error') {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-200 dark:border-red-800/30 text-center w-full max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">Oops!</h1>
          <p className="text-gray-600 dark:text-gray-400">{session.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center text-center gap-6">
        
        {session.status === 'idle' && (
          <>
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <span className="text-4xl">🎱</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Table: {session.table_id}</h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium capitalize">Game: {session.game_type}</p>
            </div>
            <div className="w-full mt-4 text-left">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name</label>
              <input 
                type="text" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter name to start..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <button
              onClick={handleStart}
              className="w-full mt-2 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Session
            </button>
          </>
        )}

        {session.status === 'active' && (
          <>
            {showHourNotification && (
              <div className="w-full bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded shadow-md relative mb-4 animate-bounce">
                <p className="font-bold">1 Hour Completed</p>
                <p>Continue Playing?</p>
                <button 
                  onClick={() => setShowHourNotification(false)}
                  className="absolute top-2 right-2 text-blue-500 hover:text-blue-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-md bg-green-400/50 animate-pulse"></div>
              <div className="relative bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-4 py-1 rounded-full text-sm font-bold tracking-wider flex items-center gap-2 border border-green-200 dark:border-green-800">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                ACTIVE
              </div>
            </div>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-1">Table: {session.table_id}</h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-4 capitalize">Game: {session.game_type} • {session.customer_name}</p>
              <div className="bg-gray-100 dark:bg-gray-900 px-8 py-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner flex flex-col items-center">
                <p className="text-5xl font-mono tabular-nums font-bold tracking-tight text-gray-800 dark:text-white">
                  {formatElapsed(elapsedSeconds)}
                </p>
                <p className="text-4xl font-bold tracking-tight text-green-600 dark:text-green-400 mt-4">
                  ₹{currentCost}
                </p>
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Active Rate: ₹{currentActiveRate} / hour</p>
            <div className="w-full mt-2 px-6 py-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-center text-sm">
              To end this session, please scan the table's QR code again.
            </div>
          </>
        )}

        {session.status === 'completed' && (
          <>
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Session Complete</h1>
              <div className="flex justify-center gap-4 text-sm font-medium text-gray-500 dark:text-gray-400 mb-6">
                <div className="bg-gray-100 dark:bg-gray-700/50 px-4 py-2 rounded-lg">
                  <span className="block text-xs uppercase tracking-wider mb-1">Duration</span>
                  <span className="text-gray-800 dark:text-gray-200">{session.duration}</span>
                </div>
              </div>
              <div className="mb-2">
                <span className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Total Amount</span>
                <p className="text-5xl font-bold text-gray-900 dark:text-white mt-1">₹{session.cost}</p>
              </div>
            </div>
            <button
              onClick={fetchTableState}
              className="w-full mt-4 px-6 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold text-lg transition-all"
            >
              Start New Session
            </button>
          </>
        )}
      </div>
    </main>
  );
}
