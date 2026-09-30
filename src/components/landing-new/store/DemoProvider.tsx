'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// --- Types ---
export type TableStatus = 'AVAILABLE' | 'ACTIVE' | 'PAUSED';
export type GameType = 'Pool' | 'Snooker';

export interface DemoTable {
  id: string;
  name: string;
  status: TableStatus;
  gameType: GameType;
  startTime: number | null;
  pausedAt: number | null;
  pausedDuration: number;
  player: string | null;
  baseRate: number; // e.g. 200 per hour
  fbCost: number;
}

export interface DemoPromo {
  id: string;
  name: string;
  rate: number;
  active: boolean;
}

export interface DemoState {
  tables: DemoTable[];
  promo: DemoPromo;
  telegramLog: { id: string; sender: 'user' | 'bot'; text: string | ReactNode; time: string }[];
  currentTime: number; // Simulated clock for timers
}

// --- Initial State ---
const initialState: DemoState = {
  tables: [
    { id: 'T1', name: 'Table 01', status: 'ACTIVE', gameType: 'Pool', startTime: Date.now() - 3600000 * 1.5, pausedAt: null, pausedDuration: 0, player: 'Arjun K.', baseRate: 200, fbCost: 0 },
    { id: 'T2', name: 'Table 02', status: 'AVAILABLE', gameType: 'Snooker', startTime: null, pausedAt: null, pausedDuration: 0, player: null, baseRate: 250, fbCost: 0 },
    { id: 'T3', name: 'Table 03', status: 'PAUSED', gameType: 'Pool', startTime: Date.now() - 3600000 * 2, pausedAt: Date.now() - 3600000 * 0.5, pausedDuration: 0, player: 'Guest', baseRate: 200, fbCost: 0 },
  ],
  promo: {
    id: 'P1',
    name: 'Weekend Pool Offer',
    rate: 150,
    active: false,
  },
  telegramLog: [
    { id: 'm1', sender: 'user', text: '/tables', time: '18:42' },
    { id: 'm2', sender: 'bot', text: 'Live tables status loaded.', time: '18:42' }
  ],
  currentTime: Date.now(),
};

// --- Actions ---
export type DemoAction = 
  | { type: 'START_TABLE'; payload: { id: string; player?: string } }
  | { type: 'PAUSE_TABLE'; payload: { id: string } }
  | { type: 'RESUME_TABLE'; payload: { id: string } }
  | { type: 'STOP_TABLE'; payload: { id: string } }
  | { type: 'TOGGLE_PROMO'; payload: { active: boolean } }
  | { type: 'ADD_TELEGRAM_MSG'; payload: { sender: 'user' | 'bot'; text: string | ReactNode } }
  | { type: 'TICK'; payload: { now: number } };

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'START_TABLE':
      return {
        ...state,
        tables: state.tables.map(t => 
          t.id === action.payload.id 
            ? { ...t, status: 'ACTIVE', startTime: state.currentTime, pausedAt: null, pausedDuration: 0, player: action.payload.player || 'Guest' }
            : t
        )
      };
    case 'PAUSE_TABLE':
      return {
        ...state,
        tables: state.tables.map(t => 
          t.id === action.payload.id && t.status === 'ACTIVE'
            ? { ...t, status: 'PAUSED', pausedAt: state.currentTime }
            : t
        )
      };
    case 'RESUME_TABLE':
      return {
        ...state,
        tables: state.tables.map(t => {
          if (t.id === action.payload.id && t.status === 'PAUSED' && t.pausedAt) {
            const addedPause = state.currentTime - t.pausedAt;
            return { ...t, status: 'ACTIVE', pausedAt: null, pausedDuration: t.pausedDuration + addedPause };
          }
          return t;
        })
      };
    case 'STOP_TABLE':
      return {
        ...state,
        tables: state.tables.map(t => 
          t.id === action.payload.id 
            ? { ...t, status: 'AVAILABLE', startTime: null, pausedAt: null, pausedDuration: 0, player: null, fbCost: 0 }
            : t
        )
      };
    case 'TOGGLE_PROMO':
      return { ...state, promo: { ...state.promo, active: action.payload.active } };
    case 'ADD_TELEGRAM_MSG':
      return {
        ...state,
        telegramLog: [...state.telegramLog, { 
          id: `msg-${Date.now()}-${Math.random()}`, 
          sender: action.payload.sender, 
          text: action.payload.text, 
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
        }]
      };
    case 'TICK':
      return { ...state, currentTime: action.payload.now };
    default:
      return state;
  }
}

// --- Context ---
const DemoContext = createContext<{
  state: DemoState;
  dispatch: React.Dispatch<DemoAction>;
} | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, initialState);

  useEffect(() => {
    // Shared timer ticker to keep tables in sync without individual intervals
    const interval = setInterval(() => {
      dispatch({ type: 'TICK', payload: { now: Date.now() } });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DemoContext.Provider value={{ state, dispatch }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoStore() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemoStore must be used within DemoProvider');
  return ctx;
}
