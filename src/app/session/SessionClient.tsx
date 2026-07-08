'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { calculateCost, getCurrentRate } from '../../lib/billing';

export type SessionState =
  | { status: 'loading' }
  | { status: 'idle'; table_id: string; game_type: string; pricingRules?: any; menuItems?: any; discount?: { percent: number; applyToFood: boolean } }
  | { status: 'active'; id: string; customer_name: string; table_id: string; game_type: string; date: string; start_time: string; pricingRules?: any; menuItems?: any; food_cost?: number; num_players?: number; discount?: { percent: number; applyToFood: boolean } }
  | { status: 'prompt_end'; id: string; table_id: string; game_type: string }
  | { status: 'completed'; duration: string; cost: number; end_time: string }
  | { status: 'error'; message: string };

interface SessionClientProps {
  initialState: SessionState;
  business_id?: string;
  table_id: string;
  game_type?: string;
}

export default function SessionClient({ initialState, business_id, table_id, game_type }: SessionClientProps) {
  const router = useRouter();

  const [session, setSession] = useState<SessionState>(initialState);
  const [customerName, setCustomerName] = useState('');
  const [numPlayers, setNumPlayers] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentCost, setCurrentCost] = useState(0);
  const [currentActiveRate, setCurrentActiveRate] = useState(0);
  const [notifiedOneHour, setNotifiedOneHour] = useState(false);
  const [showHourNotification, setShowHourNotification] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [cart, setCart] = useState<{ [key: string]: number }>({});
  const [isOrdering, setIsOrdering] = useState(false);
  const [billModalData, setBillModalData] = useState<{ duration: string; cost: number; end_time: string } | null>(null);

  const fetchTableState = useCallback(async () => {
    if (!table_id) return;
    
    try {
      const res = await fetch(`/api/station-status?table_id=${table_id}${business_id ? `&b=${business_id}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        setSession({ status: 'error', message: data.error || 'Failed to load table status' });
        return;
      }
      if (data.status === 'idle') {
        setSession((prev) => {
          if (prev.status === 'completed' || billModalData !== null) return prev;
          return { status: 'idle', table_id, game_type: game_type || 'unknown', pricingRules: data.pricingRules, menuItems: data.menuItems };
        });
      } else if (data.status === 'active') {
        setSession((prev) => {
          // If we are already on the "prompt end" or "completed" screen, stay there.
          if (prev.status === 'prompt_end' || prev.status === 'completed' || billModalData !== null) return prev;

          // Otherwise, sync smoothly to the live timer (whether we were idle, loading, or already active).
          return {
            status: 'active',
            id: data.id,
            customer_name: data.customer_name,
            table_id: data.table_id,
            game_type: data.game_type,
            date: data.date,
            start_time: data.start_time,
            pricingRules: data.pricingRules,
            menuItems: data.menuItems,
            food_cost: data.food_cost,
            num_players: data.num_players,
            discount: data.discount,
          };
        });
      }
    } catch {
      // Don't override with error on intermittent network failures to avoid flickering the UI for active users
    }
  }, [table_id, game_type, business_id]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchTableState();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [fetchTableState]);

  useEffect(() => {
    if (session.status !== 'active') {
      setElapsedSeconds(0);
      setCurrentCost(0);
      setNotifiedOneHour(false);
      setShowHourNotification(false);
      return;
    }
    
    const startMs = new Date(session.start_time).getTime();

    const tick = () => {
      const now = Date.now();
      const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diffSecs);
      
      const { cost } = calculateCost(startMs, now, session.game_type, session.pricingRules, session.num_players || 1, session.discount);
      setCurrentCost(cost);
      setCurrentActiveRate(getCurrentRate(session.game_type, now, session.pricingRules, session.num_players || 1).rate);

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
    if (isStarting) return;
    if (!customerName || customerName.trim() === '') {
      alert('Please enter a Customer Name to start the session.');
      return;
    }
    
    setIsStarting(true);
    try {
      const res = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id, game_type: game_type || (session.status !== 'loading' && session.status !== 'error' ? (session as any).game_type : 'unknown'), customer_name: customerName, business_id, num_players: numPlayers }),
      });
      const data = await res.json();
      if (res.ok) {
          const nonce = Math.random().toString(36).substring(2, 10);
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
            menuItems: prev.menuItems,
            discount: prev.discount,
            food_cost: 0,
            num_players: numPlayers,
          }));
      } else {
        setSession({ status: 'error', message: data.error || 'Failed to start session' });
      }
    } catch {
      setSession({ status: 'error', message: 'Network error occurred' });
    } finally {
      setIsStarting(false);
    }
  };

  const handleEnd = async () => {
    if (session.status !== 'active' && session.status !== 'prompt_end') return;
    if (isEnding) return;
    setIsEnding(true);

    const optimisticDuration = formatElapsed(elapsedSeconds);
    const optimisticCost = currentCost;
    setBillModalData({ 
      duration: optimisticDuration, 
      cost: optimisticCost, 
      end_time: new Date().toISOString() 
    });

    try {
      const res = await fetch('/api/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: session.table_id, business_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setBillModalData({ duration: data.duration, cost: data.cost, end_time: data.end_time });
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to sync session end with server');
    } finally {
      setIsEnding(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (session.status !== 'active') return;
    const items = Object.entries(cart).filter(([_, qty]) => qty > 0);
    if (items.length === 0) return;

    setIsOrdering(true);
    try {
      const res = await fetch('/api/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          business_id,
          cart
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCart({});
        setSession({ ...session, food_cost: data.new_food_cost });
        alert('Order placed successfully! It will be added to your final bill.');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Failed to place order.');
    } finally {
      setIsOrdering(false);
    }
  };

  const formatElapsed = (totalSeconds: number) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const shortId = session.status === 'active' && session.id ? session.id.split('-')[0].toUpperCase() : '';

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

  let isOffPeak = false;
  if (session.status === 'idle' && session.pricingRules?.globalSettings?.enable_peak_rules !== false) {
    const currentHour = new Date().getHours();
    const peakStart = session.pricingRules?.globalSettings?.peak_start_hour ?? 17;
    const peakEnd = session.pricingRules?.globalSettings?.peak_end_hour ?? 23;
    isOffPeak = !(currentHour >= peakStart && currentHour < peakEnd);
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
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service / Game Type</label>
                <select 
                  value={session.game_type}
                  onChange={(e) => setSession(prev => ({ ...prev, game_type: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all capitalize"
                >
                  {session.pricingRules?.rules && Object.keys(session.pricingRules.rules).length > 0 ? (
                    Object.keys(session.pricingRules.rules).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))
                  ) : (
                    <option value={session.game_type}>{session.game_type}</option>
                  )}
                </select>
              </div>
              {session.discount && session.discount.percent > 0 && (
                <div className="mt-3 inline-block bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md animate-pulse">
                  🎉 Happy Hour: {session.discount.percent}% OFF
                </div>
              )}
              {isOffPeak && (
                <div className="mt-4 w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-lg border border-emerald-400 animate-in zoom-in duration-500">
                  <h3 className="font-bold text-lg mb-1 flex justify-center items-center gap-2">
                    <span className="text-2xl">🌟</span> OFF-PEAK PROMO
                  </h3>
                  <p className="text-sm font-medium">Play for 1 Hour and get 15 Minutes FREE!</p>
                </div>
              )}
            </div>
            <div className="w-full mt-4 text-left">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Name</label>
              <input 
                type="text" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter name to start..."
                className="w-full px-4 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            
            {(session.pricingRules?.rules?.[session.game_type]?.is_per_person || 
              session.pricingRules?.rules?.[session.game_type]?.multiplayer_mode === 'multiply' || 
              session.pricingRules?.rules?.[session.game_type]?.multiplayer_mode === 'base_plus_extra') && (
              <div className="w-full mt-2 text-left">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Players</label>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setNumPlayers(Math.max(1, numPlayers - 1))}
                    className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center font-bold text-2xl">{numPlayers}</div>
                  <button 
                    onClick={() => setNumPlayers(numPlayers + 1)}
                    className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={isStarting}
              className={`w-full mt-2 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isStarting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isStarting ? 'Starting...' : 'Start Session'}
            </button>
          </>
        )}

        {session.status === 'prompt_end' && (
          <>
            <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full flex items-center justify-center mb-2 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Session is Active</h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium capitalize">Table: {session.table_id}</p>
            </div>
            <div className="w-full mt-4 text-left bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300">
              <p className="mb-2">This table currently has an active session.</p>
              <p>If you are done playing, please click <strong>End Session</strong> below to generate your final bill.</p>
            </div>
            <button
              onClick={handleEnd}
              disabled={isEnding}
              className={`w-full mt-2 px-6 py-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold text-lg shadow-lg shadow-red-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isEnding ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isEnding ? 'Finalizing Bill...' : 'End Session & Generate Bill'}
            </button>
            <button
              onClick={() => {
                const nonce = Math.random().toString(36).substring(2, 10);
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('_scan', nonce);
                router.replace(newUrl.pathname + newUrl.search);
                fetchTableState();
              }}
              className="w-full mt-2 px-6 py-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold text-lg transition-all"
            >
              Return to Live View
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
              <div className="text-center mb-6">
                <span className="inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-bold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20 shadow-sm">
                  <span className="relative flex h-2.5 w-2.5 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  ACTIVE
                </span>
                {shortId && (
                  <div className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Session ID: <span className="text-gray-700 dark:text-gray-300 font-mono">#{shortId}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-1">Table: {session.table_id}</h1>
              <div className="flex flex-col gap-1 mb-4">
                <p className="text-gray-500 dark:text-gray-400 font-medium capitalize">
                  Game: {session.game_type} • {session.customer_name} {session.num_players && session.num_players > 1 ? `(${session.num_players} Players)` : ''}
                </p>
                {session.discount && session.discount.percent > 0 && (
                  <p className="text-orange-500 font-bold text-sm">
                    {session.discount.percent}% Discount Applied {session.discount.applyToFood ? '(Incl. Food)' : ''}
                  </p>
                )}
              </div>
              <div className="bg-gray-100 dark:bg-gray-900 px-8 py-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner flex flex-col items-center">
                <p className="text-5xl font-mono tabular-nums font-bold tracking-tight text-gray-800 dark:text-white">
                  {formatElapsed(elapsedSeconds)}
                </p>
                {session.food_cost ? (
                  <div className="flex flex-col items-center mt-4">
                    <p className="text-sm text-gray-500 uppercase tracking-wider font-bold">Food Cost</p>
                    <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                      {session.discount && session.discount.percent > 0 && session.discount.applyToFood ? (
                        <>
                          <span className="text-gray-400 line-through text-lg mr-2">₹{session.food_cost}</span>
                          ₹{Math.round(session.food_cost * (1 - (session.discount.percent/100)))}
                        </>
                      ) : (
                        `₹${session.food_cost}`
                      )}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            
            <div className="mt-4 flex flex-col gap-2 text-center w-full max-w-xs mx-auto">
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Active Rate: 
                {session.discount && session.discount.percent > 0 ? (
                  <>
                    <span className="line-through mx-2 text-gray-400">₹{currentActiveRate}</span>
                    <span className="text-green-600 font-bold">₹{Math.round(currentActiveRate * (1 - (session.discount.percent/100)))} / hour</span>
                  </>
                ) : (
                  ` ₹${currentActiveRate} / hour`
                )}
              </p>
            </div>            
            {session.menuItems && session.menuItems.length > 0 && (
              <div className="w-full mt-4 text-left border-t border-gray-200 dark:border-gray-700 pt-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Order Food & Drinks</h2>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {session.menuItems.map((item: any) => (
                    <div key={item.name} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{item.name}</p>
                        <p className="text-sm text-green-600 dark:text-green-400 font-semibold">₹{item.price}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setCart(prev => ({ ...prev, [item.name]: Math.max(0, (prev[item.name] || 0) - 1) }))}
                          className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 font-bold"
                        >
                          -
                        </button>
                        <span className="w-4 text-center font-bold">{cart[item.name] || 0}</span>
                        <button 
                          onClick={() => setCart(prev => ({ ...prev, [item.name]: (prev[item.name] || 0) + 1 }))}
                          className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {Object.values(cart).some(q => q > 0) && (
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isOrdering}
                    className="w-full mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold shadow-lg transition-all"
                  >
                    {isOrdering ? 'Placing Order...' : `Place Order (₹${Object.entries(cart).reduce((acc, [name, qty]) => {
                      const price = session.menuItems.find((i: any) => i.name === name)?.price || 0;
                      return acc + (price * qty);
                    }, 0)})`}
                  </button>
                )}
              </div>
            )}

            <div className="w-full mt-4 px-6 py-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-dashed border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400 text-center text-sm">
              To end this session, please scan the table's QR code again.
            </div>
          </>
        )}

        {session.status === 'completed' && !billModalData && (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Session Completed</h1>
            <p>Your session has ended successfully.</p>
            <button
              onClick={() => {
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('_scan');
                window.location.href = newUrl.pathname + newUrl.search;
              }}
              className="w-full mt-6 px-6 py-4 rounded-xl bg-gray-100 font-semibold"
            >
              Start New Session
            </button>
          </div>
        )}
      </div>

      {/* Pop-up Bill Modal */}
      {billModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 p-8 w-full max-w-md transform scale-100 animate-in zoom-in-95 duration-300 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4 shadow-inner ring-4 ring-emerald-50 dark:ring-emerald-900/20">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Bill Generated</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">Please proceed to the counter to pay.</p>
            
            <div className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-700/50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider text-sm">Duration</span>
                <span className="font-bold text-gray-900 dark:text-gray-100 font-mono text-lg">{billModalData.duration}</span>
              </div>
              <div className="w-full h-px bg-gray-200 dark:bg-gray-700/50 my-4 border-dashed border-t"></div>
              <div className="flex justify-between items-end">
                <span className="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider text-sm mb-1">Total Amount</span>
                <span className="text-5xl font-black text-green-600 dark:text-green-400">₹{billModalData.cost}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setBillModalData(null);
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('_scan');
                window.location.href = newUrl.pathname + newUrl.search;
              }}
              className="w-full px-6 py-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 font-bold text-lg shadow-xl shadow-gray-900/20 transition-all active:scale-[0.98]"
            >
              Close & Start New Session
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
