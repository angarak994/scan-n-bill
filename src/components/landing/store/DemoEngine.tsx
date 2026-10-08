'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';

// --- Types ---
export type TableStatus = 'AVAILABLE' | 'ACTIVE' | 'PAUSED';

export interface DemoTable {
  id: string;
  name: string;
  status: TableStatus;
  gameType: 'Pool' | 'Snooker';
  startedAt: number | null; // Timestamp
  pausedAt: number | null; // Timestamp
  accumulatedPausedMs: number;
  player: string | null;
  baseRate: number; // e.g., 200 per hour
  fbItems: { name: string; price: number }[];
}

export interface DemoPromo {
  id: string;
  name: string;
  rate: number;
  startTime: number; // Simulated absolute start time
  endTime: number;   // Simulated absolute end time
}

export interface DemoState {
  tables: DemoTable[];
  promo: DemoPromo;
  telegramLog: { id: string; sender: 'user' | 'bot'; text: ReactNode; time: number }[];
  qrActiveTable: string | null;
  qKhata: { name: string; balance: number; lastUpdate: number }[];
}

// --- Pure Functions ---

/**
 * Calculates the exact bill amount for a given session, including split billing if a promotion overlaps.
 * Rounding rule: Math.ceil(amount) to the nearest integer.
 */
export function calculateBill(
  now: number,
  startedAt: number | null,
  pausedAt: number | null,
  accumulatedPausedMs: number,
  baseRate: number,
  promo: DemoPromo,
  fbItems: { price: number }[]
): number {
  if (!startedAt) return 0;
  
  const endTime = pausedAt !== null ? pausedAt : now;
  const elapsedMs = Math.max(0, endTime - startedAt - accumulatedPausedMs);
  if (elapsedMs <= 0) return 0;

  let bill = 0;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  const sessionStart = startedAt;
  const sessionEnd = endTime;
  const promoStart = promo.startTime;
  const promoEnd = promo.endTime;

  const overlapStart = Math.max(sessionStart, promoStart);
  const overlapEnd = Math.min(sessionEnd, promoEnd);
  const overlapMs = Math.max(0, overlapEnd - overlapStart);
  
  const overlapHours = overlapMs / (1000 * 60 * 60);
  const nonOverlapHours = Math.max(0, elapsedHours - overlapHours);

  bill += overlapHours * promo.rate;
  bill += nonOverlapHours * baseRate;

  const fbTotal = fbItems.reduce((sum, item) => sum + item.price, 0);
  return Math.ceil(bill + fbTotal);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Context & Provider ---

interface DemoContextValue {
  state: DemoState;
  now: number; // The ticking clock
  startTable: (id: string, player?: string) => void;
  pauseTable: (id: string) => void;
  resumeTable: (id: string) => void;
  stopTable: (id: string) => void;
  addFbItem: (id: string, item: { name: string; price: number }) => void;
  addTelegramMsg: (sender: 'user' | 'bot', text: ReactNode) => void;
  setQrActiveTable: (id: string | null) => void;
  settleKhata: (name: string, amount: number) => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const generateDemoState = (baseTime: number): DemoState => ({
  tables: [
    { id: 'T1', name: 'Table 01', status: 'ACTIVE', gameType: 'Pool', startedAt: baseTime - (3600000 * 1.5), pausedAt: null, accumulatedPausedMs: 0, player: 'Arjun K.', baseRate: 200, fbItems: [{name: 'Coke', price: 60}] },
    { id: 'T2', name: 'Table 02', status: 'AVAILABLE', gameType: 'Snooker', startedAt: null, pausedAt: null, accumulatedPausedMs: 0, player: null, baseRate: 250, fbItems: [] },
    { id: 'T3', name: 'Table 03', status: 'PAUSED', gameType: 'Pool', startedAt: baseTime - (3600000 * 2), pausedAt: baseTime - (3600000 * 0.5), accumulatedPausedMs: 0, player: 'Guest', baseRate: 200, fbItems: [] },
  ],
  promo: {
    id: 'P1',
    name: 'Happy Hour',
    rate: 150,
    startTime: baseTime - (3600000 * 4), // Started 4 hours ago
    endTime: baseTime + (3600000 * 2),   // Ends in 2 hours
  },
  telegramLog: [
    { id: 'm1', sender: 'user', text: '/status', time: baseTime - 60000 },
    { id: 'm2', sender: 'bot', text: 'Live tables status loaded.', time: baseTime - 59000 }
  ],
  qrActiveTable: null,
  qKhata: [
    { name: 'Rahul M.', balance: -1250, lastUpdate: baseTime - 86400000 },
    { name: 'Karan S.', balance: -400, lastUpdate: baseTime - 172800000 },
    { name: 'Arjun K.', balance: 1500, lastUpdate: baseTime - 43200000 }, // Advance payment
  ],
});

export function DemoEngineProvider({ children }: { children: ReactNode }) {
  // Use a fixed timestamp for SSR to prevent hydration mismatch (Date.now() is impure)
  const [now, setNow] = useState(1700000000000);
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Initial State seeded deterministically for SSR
  const [state, setState] = useState<DemoState>(() => generateDemoState(1700000000000));

  // Ticker (1s interval) only active when tab is visible
  useEffect(() => {
    // Immediately catch up to real time on client side
    const realNow = Date.now();
    setTimeout(() => {
      setNow(realNow);
      setState(generateDemoState(realNow));
    }, 0);

    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
      if (!document.hidden) {
        setNow(Date.now()); // Instantly catch up
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let intervalId: NodeJS.Timeout;
    if (isTabVisible) {
      intervalId = setInterval(() => {
        setNow(Date.now());
      }, 1000);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTabVisible]);

  // Actions
  const startTable = useCallback((id: string, player: string = 'Guest') => {
    setState(prev => ({
      ...prev,
      tables: prev.tables.map(t => 
        t.id === id ? { ...t, status: 'ACTIVE', startedAt: Date.now(), pausedAt: null, accumulatedPausedMs: 0, player, fbItems: [] } : t
      )
    }));
  }, []);

  const pauseTable = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tables: prev.tables.map(t => 
        t.id === id && t.status === 'ACTIVE' ? { ...t, status: 'PAUSED', pausedAt: Date.now() } : t
      )
    }));
  }, []);

  const resumeTable = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tables: prev.tables.map(t => {
        if (t.id === id && t.status === 'PAUSED' && t.pausedAt) {
          const pauseDuration = Date.now() - t.pausedAt;
          return { ...t, status: 'ACTIVE', pausedAt: null, accumulatedPausedMs: t.accumulatedPausedMs + pauseDuration };
        }
        return t;
      })
    }));
  }, []);

  const stopTable = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      tables: prev.tables.map(t => 
        t.id === id ? { ...t, status: 'AVAILABLE', startedAt: null, pausedAt: null, accumulatedPausedMs: 0, player: null, fbItems: [] } : t
      )
    }));
  }, []);

  const addFbItem = useCallback((id: string, item: { name: string; price: number }) => {
    setState(prev => ({
      ...prev,
      tables: prev.tables.map(t => 
        t.id === id ? { ...t, fbItems: [...t.fbItems, item] } : t
      )
    }));
  }, []);

  const addTelegramMsg = useCallback((sender: 'user' | 'bot', text: ReactNode) => {
    setState(prev => ({
      ...prev,
      telegramLog: [...prev.telegramLog, { id: `msg-${Date.now()}-${Math.random()}`, sender, text, time: Date.now() }]
    }));
  }, []);

  const setQrActiveTable = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, qrActiveTable: id }));
  }, []);

  const settleKhata = useCallback((name: string, amount: number) => {
    setState(prev => ({
      ...prev,
      qKhata: prev.qKhata.map(k => 
        k.name === name ? { ...k, balance: k.balance + amount, lastUpdate: Date.now() } : k
      )
    }));
  }, []);

  return (
    <DemoContext.Provider value={{
      state, now, startTable, pauseTable, resumeTable, stopTable, addFbItem, addTelegramMsg, setQrActiveTable, settleKhata
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoEngine() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemoEngine must be used within DemoEngineProvider');
  return ctx;
}
