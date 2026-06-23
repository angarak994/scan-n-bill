'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { calculateCost, IST_OFFSET } from '../../lib/billing';

type SessionState =
  | { status: 'loading' }
  | { status: 'idle'; table_id: string; game_type: string }
  | { status: 'active'; id: string; table_id: string; game_type: string; start_time: string; rate_per_hour: number; session_type: string }
  | { status: 'completed'; duration: string; cost: number; end_time: string }
  | { status: 'error'; message: string };

export default function SessionPage({ searchParams }: { searchParams: Promise<{ table?: string; type?: string }> }) {
  const params = use(searchParams);
  const table_id = params.table;
  const game_type = params.type;

  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentCost, setCurrentCost] = useState(0);
  const [currentActiveRate, setCurrentActiveRate] = useState(0);

  const fetchTableState = useCallback(async () => {
    if (!table_id) {
      Promise.resolve().then(() => setSession({ status: 'error', message: 'Table ID is missing from URL' }));
      return;
    }
    
    try {
      const res = await fetch(`/api/station-status?table_id=${table_id}`);
      const data = await res.json();
      if (!res.ok) {
        setSession({ status: 'error', message: data.error || 'Failed to load table status' });
        return;
      }
      if (data.status === 'idle') {
        setSession({ status: 'idle', table_id, game_type: game_type || 'unknown' });
      } else if (data.status === 'active') {
        // Automatically end the session when the QR code is scanned again
        try {
          const endRes = await fetch('/api/end-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_id }),
          });
          const endData = await endRes.json();
          if (endRes.ok) {
            setSession({ status: 'completed', duration: endData.duration, cost: endData.cost, end_time: endData.end_time });
          } else {
            setSession({ status: 'error', message: endData.error || 'Failed to end session automatically' });
          }
        } catch {
          setSession({ status: 'error', message: 'Network error while ending session' });
        }
      } else {
        setSession(data);
      }
    } catch {
      setSession({ status: 'error', message: 'Network error occurred' });
    }
  }, [table_id, game_type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTableState();
  }, [fetchTableState]);

  useEffect(() => {
    if (session.status !== 'active') return;
    const startMs = new Date(session.start_time).getTime();

    const tick = () => {
      const now = Date.now();
      setElapsedSeconds(Math.floor((now - startMs) / 1000));
      
      const cost = calculateCost(startMs, now, session.game_type);
      setCurrentCost(Math.round(cost / 10) * 10);
      
      const dateIst = new Date(now + IST_OFFSET);
      const isBefore4PM = dateIst.getUTCHours() < 16;
      const rateBefore4 = session.game_type.toLowerCase() === 'snooker' ? 200 : 100;
      const rateAfter4 = session.game_type.toLowerCase() === 'snooker' ? 300 : 150;
      setCurrentActiveRate(isBefore4PM ? rateBefore4 : rateAfter4);
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
    try {
      const res = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id, game_type }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession({
          status: 'active',
          id: data.id,
          table_id: data.table_id,
          game_type: data.game_type,
          start_time: data.start_time,
          rate_per_hour: data.rate_per_hour,
          session_type: data.session_type,
        });
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to start session');
    }
  };

  const handleEnd = async () => {
    if (session.status !== 'active') return;
    try {
      const res = await fetch('/api/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: session.table_id }),
      });
      const data = await res.json();
      if (res.ok) {
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
    return <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="animate-pulse text-lg">Loading table status...</div>
    </main>;
  }

  if (session.status === 'error') {
    return <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="text-red-500 text-center">
        <h1 className="text-2xl font-bold mb-2">Error</h1>
        <p>{session.message}</p>
      </div>
    </main>;
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
            <button
              onClick={handleStart}
              className="w-full mt-4 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Session
            </button>
          </>
        )}

        {session.status === 'active' && (
          <>
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-md bg-green-400/50 animate-pulse"></div>
              <div className="relative bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-4 py-1 rounded-full text-sm font-bold tracking-wider flex items-center gap-2 border border-green-200 dark:border-green-800">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                ACTIVE
              </div>
            </div>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Table: {session.table_id}</h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-4 capitalize">Game: {session.game_type} | {session.session_type}</p>
              <div className="bg-gray-100 dark:bg-gray-900 px-8 py-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner flex flex-col items-center">
                <p className="text-5xl font-mono tabular-nums font-bold tracking-tight text-gray-800 dark:text-white">
                  {formatElapsed(elapsedSeconds)}
                </p>
                <p className="text-4xl font-bold tracking-tight text-green-600 dark:text-green-400 mt-4">
                  ₹{currentCost}
                </p>
              </div>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">Active Rate: ₹{currentActiveRate}/hour</p>
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
