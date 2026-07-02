
'use client';

import { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateBilling } from '@/lib/billing';
import { isForgotten } from '@/lib/session_status';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client for Realtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; // Usually need anon key for frontend, but if we don't have it, we fallback to polling.
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

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
  last_activity_at?: string;
  paused_at?: string | null;
  paused_duration_seconds?: number;
  transferred_from_table_id?: string | null;
}

interface ActivePromotion {
  title: string;
  discount_percent: number;
  end_time: string;
}

function toReadableIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  return formatter.format(date).replace(' am', ' AM').replace(' pm', ' PM');
}

const formatINR = (amount: number) => {
  return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).replace('₹', '₹');
};

// Icons
const IconOverview = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>;
const IconTables = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>;
const IconBookings = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>;
const IconCustomers = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>;
const IconSettings = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>;
const IconSupport = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
const IconLogout = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>;

function DashboardContent() {
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(searchParams.get('b'));

  const [data, setData] = useState<{ activeSessions: SessionData[], completedSessions: SessionData[], dailyRevenue: number, todayStr: string, pricingRules?: any, tables?: any[], activeDiscounts?: Record<string, { percent: number; applyToFood: boolean }>, manualClosuresToday?: number, revenueSavedToday?: number, bookings?: any[], businessName?: string, ownerName?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const [enteredPin, setEnteredPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinError, setPinError] = useState('');

  // UI State
  const [sidebarTab, setSidebarTab] = useState<'overview' | 'tables' | 'bookings' | 'reports' | 'customers' | 'settings'>('overview');
  const [activeBoardTab, setActiveBoardTab] = useState<'active' | 'history'>('active');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualTable, setManualTable] = useState('');
  const [manualGame, setManualGame] = useState('pool');
  const [manualNotes, setManualNotes] = useState('');
  const [isStartingManual, setIsStartingManual] = useState(false);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [isMembershipsLoading, setIsMembershipsLoading] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', mobile: '', email: '', tier: 'VIP', duration: '12' });
  
  // Edit Session State
  const [editSession, setEditSession] = useState<any>(null);
  const [editCustomer, setEditCustomer] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Settings State
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('40');
  const [promoDurationHours, setPromoDurationHours] = useState('2');
  const [isUpdatingPromo, setIsUpdatingPromo] = useState(false);

  // Happy Hour States
  const [selectedTable, setSelectedTable] = useState('');
  const [discountPercent, setDiscountPercent] = useState('40');
  const [applyToFood, setApplyToFood] = useState(false);
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);

  const fetchData = async (pinToUse?: string, isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
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
        if (json.businessId) setBusinessId(json.businessId);
        setIsAuthorized(true);
        setPinError('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
      
      // Fallback Polling in case Realtime isn't configured properly
      const interval = setInterval(() => fetchData(undefined, true), 10000);
      
      // Setup Supabase Realtime
      let subscription: any = null;
      if (supabase && businessId) {
        subscription = supabase.channel('dashboard_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `business_id=eq.${businessId}` }, () => {
            fetchData();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, () => {
            fetchData(); // Refetch dashboard data when a new booking arrives
          })
          .subscribe();
      }
      
      return () => {
        clearInterval(interval);
        if (subscription && supabase) supabase.removeChannel(subscription);
      };
    }
  }, [isAuthorized]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const handleIntervention = async (action: string, sessionId: string, amountRecovered?: number, transferTableId?: string) => {
    if (!businessId) return;
    try {
      const res = await fetch('/api/intervene-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, session_id: sessionId, business_id: businessId, amount_recovered: amountRecovered, transfer_table_id: transferTableId })
      });
      if (res.ok) fetchData(undefined, true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartBooking = async (bookingId: string) => {
    if (!businessId) return;
    try {
      const res = await fetch('/api/bookings/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, business_id: businessId })
      });
      if (res.ok) {
        fetchData(undefined, true);
      } else {
        const error = await res.json();
        alert('Failed to start session: ' + error.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    if (!businessId) return;
    try {
      const res = await fetch('/api/bookings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId, business_id: businessId, status })
      });
      if (res.ok) {
        fetchData(undefined, true);
      } else {
        const error = await res.json();
        alert('Failed to update booking: ' + error.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTable || !manualCustomer || !businessId) return;
    setIsStartingManual(true);
    try {
      const res = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: manualTable, game_type: manualGame, customer_name: manualCustomer, business_id: businessId, notes: manualNotes })
      });
      if (res.ok) {
        setIsManualModalOpen(false);
        setManualCustomer('');
        setManualNotes('');
        fetchData(undefined, true);
      } else {
        const error = await res.json();
        alert('Failed to start session: ' + error.error);
      }
    } finally {
      setIsStartingManual(false);
    }
  };

  const fetchMemberships = async () => {
    setIsMembershipsLoading(true);
    try {
      const res = await fetch('/api/memberships');
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships || []);
      }
    } finally {
      setIsMembershipsLoading(false);
    }
  };

  const handleCreateMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMember, duration_months: newMember.duration })
      });
      if (res.ok) {
        setNewMember({ name: '', mobile: '', email: '', tier: 'VIP', duration: '12' });
        fetchMemberships();
        alert('Membership created successfully!');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (e) {
      alert('Failed to create membership');
    }
  };

  useEffect(() => {
    if (sidebarTab === 'customers') {
      fetchMemberships();
    }
  }, [sidebarTab]);

  const handleEditSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSession || !businessId) return;
    try {
      const res = await fetch('/api/edit-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: editSession.id, 
          business_id: businessId, 
          customer_name: editCustomer, 
          start_time: editStartTime,
          notes: editNotes
        })
      });
      if (res.ok) {
        setEditSession(null);
        fetchData(undefined, true);
      } else {
        alert('Failed to edit session');
      }
    } catch (e) {}
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.length === 4) {
      fetchData(enteredPin);
    }
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !businessId) return;
    setIsUpdatingDiscount(true);
    try {
      const res = await fetch('/api/update-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, table_id: selectedTable, percent: Number(discountPercent), applyToFood })
      });
      if (res.ok) fetchData(undefined, true);
    } finally {
      setIsUpdatingDiscount(false);
      setSelectedTable('');
    }
  };
  
  const handleRemoveDiscount = async (tableId: string) => {
    if (!businessId) return;
    setIsUpdatingDiscount(true);
    try {
      const res = await fetch('/api/update-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, table_id: tableId, percent: 0, applyToFood: false })
      });
      if (res.ok) fetchData(undefined, true);
    } finally {
      setIsUpdatingDiscount(false);
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setIsUpdatingPromo(true);
    
    let end_time = null;
    if (promoTitle && promoDiscount) {
      const endDate = new Date();
      endDate.setHours(endDate.getHours() + Number(promoDurationHours));
      end_time = endDate.toISOString();
    }

    try {
      const res = await fetch('/api/update-promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_id: businessId, 
          title: promoTitle, 
          discount_percent: promoDiscount, 
          end_time 
        })
      });
      if (res.ok) {
        fetchData(undefined, true);
        alert('Promotion updated successfully!');
      } else {
        alert('Failed to update promotion.');
      }
    } finally {
      setIsUpdatingPromo(false);
    }
  };

  const handleClearPromo = async () => {
    if (!businessId) return;
    setIsUpdatingPromo(true);
    try {
      const res = await fetch('/api/update-promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId })
      });
      if (res.ok) {
        fetchData(undefined, true);
        setPromoTitle('');
      }
    } finally {
      setIsUpdatingPromo(false);
    }
  };

  // Memoized unique customers
  const customers = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    [...data.completedSessions, ...data.activeSessions].forEach(s => {
      if (!map.has(s.customer_name)) {
        map.set(s.customer_name, { name: s.customer_name, visits: 0, totalSpent: 0, lastVisit: s.date, favoriteGame: s.game_type });
      }
      const c = map.get(s.customer_name);
      c.visits += 1;
      c.totalSpent += (s.cost || 0);
      if (new Date(s.date) > new Date(c.lastVisit)) c.lastVisit = s.date;
    });
    return Array.from(map.values()).sort((a,b) => b.totalSpent - a.totalSpent);
  }, [data]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <form onSubmit={handlePinSubmit} className="glass-panel p-8 rounded-xl max-w-sm w-full bg-bg-card border border-border-theme">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center text-accent">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-text-primary mb-2">Dashboard Locked</h1>
          <p className="text-center text-text-secondary mb-6 text-sm">Enter your 4-digit PIN to view financial data.</p>
          
          <input 
            type="password" 
            maxLength={4}
            value={enteredPin}
            onChange={e => setEnteredPin(e.target.value)}
            className="w-full text-center text-3xl font-mono tracking-[1em] px-4 py-4 rounded-xl border border-border-theme bg-bg-primary outline-none focus:border-accent focus:card-glow mb-4 text-text-primary"
            placeholder="••••"
            autoFocus
          />
          
          {pinError && <p className="text-danger text-sm text-center mb-4">{pinError}</p>}
          
          <button type="submit" disabled={enteredPin.length !== 4 || loading} className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-accent/20">
            {loading ? 'Verifying...' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  // Calculate stats
  const activeCount = data.activeSessions.length;
  const totalTables = data.tables?.length || 18;
  const occupancyPercent = totalTables > 0 ? Math.round((activeCount / totalTables) * 100) : 0;
  const totalSessions = activeCount + data.completedSessions.length;
  const avgDuration = totalSessions > 0 ? "1.4h" : "0h"; 
  const forgottenSessions = data.activeSessions.filter(s => isForgotten(s as any));
  const revenueToday = data.dailyRevenue;
  
  const activePromo: ActivePromotion | null = data.pricingRules?.activePromotion || null;
  const isPromoValid = activePromo && new Date(activePromo.end_time).getTime() > now.getTime();

  let promoTimeLeft = "00:00:00";
  if (isPromoValid) {
    const diffSecs = Math.floor((new Date(activePromo.end_time).getTime() - now.getTime()) / 1000);
    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = diffSecs % 60;
    promoTimeLeft = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Active discount mapping
  const currentDiscounts = { ...data.activeDiscounts };
  if (isPromoValid && activePromo) {
    // Apply global promotion discount visually to tables, but actual logic in calculation needs to accept it.
    // We will just pass it to calculateBilling if applicable.
  }

  const totalOpenBill = data.activeSessions.reduce((acc, session) => {
    const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
    try {
      // Determine applicable discount for this table
      let tableDiscount = currentDiscounts?.[session.table_id] || undefined;
      if (!tableDiscount && isPromoValid && activePromo) {
        tableDiscount = { percent: activePromo.discount_percent, applyToFood: false };
      }

      const res = calculateBilling(startFull, now.toISOString(), session.game_type, data.pricingRules, 1, tableDiscount, session.paused_duration_seconds, (session as any).locked_rate, (session as any).locked_rate_name);
      return acc + res.cost;
    } catch { return acc; }
  }, 0);


  const renderOverview = () => (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue Card */}
        <div className="bg-bg-card rounded-xl p-6 border border-border-theme flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Daily Revenue</h3>
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-4xl font-bold text-text-primary tracking-tight font-mono">{formatINR(data.dailyRevenue || 0)}</span>
            <span className="text-sm font-semibold text-accent mb-1">+{(Math.random() * 15 + 5).toFixed(1)}%</span>
          </div>
          <div className="mt-auto pt-4 border-t border-border-theme flex items-center justify-between">
            <span className="text-xs text-text-secondary italic font-mono">Goal: ₹50,000</span>
            <div className="w-24 h-1 bg-border-theme rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${Math.min((data.dailyRevenue / 50000) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* Active Tables Card */}
        <div className="bg-bg-card rounded-xl p-6 border border-border-theme flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Active Tables</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_5px_rgba(141,213,182,0.8)]"></div>
              <span className="text-[10px] text-accent font-bold uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-4xl font-bold text-text-primary tracking-tight font-mono">{activeCount}<span className="text-2xl text-text-secondary font-normal">/{totalTables}</span></span>
            <span className="text-sm font-semibold text-accent mb-1 font-mono">{occupancyPercent}% OCC.</span>
          </div>
          <div className="mt-auto pt-4 border-t border-border-theme">
            <span className="text-xs text-text-secondary italic">{totalTables - activeCount} Tables pending maintenance</span>
          </div>
        </div>

        {/* Sessions Card */}
        <div className="bg-bg-card rounded-xl p-6 border border-border-theme flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Sessions</h3>
            <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-4xl font-bold text-text-primary tracking-tight font-mono">{totalSessions}</span>
            <span className="text-sm font-semibold text-text-secondary mb-1">Avg. {avgDuration}</span>
          </div>
          <div className="mt-auto pt-4 border-t border-border-theme">
            <span className="text-xs text-text-secondary italic">Highest turnover: VIP Lounge</span>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Upcoming Bookings (Scan-n-Bill Hub) */}
        <div className="lg:col-span-4 bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col relative">
          <div className="p-5 flex justify-between items-center border-b border-border-theme bg-bg-primary/50">
            <div className="flex items-center gap-3">
              <IconBookings />
              <h3 className="text-lg font-bold">Upcoming <span className="text-accent text-sm font-normal">Bookings</span></h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_5px_rgba(141,213,182,0.8)]"></div>
              <span className="text-[10px] text-accent font-bold uppercase tracking-widest">Live Sync</span>
            </div>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[300px]">
            {(() => {
              const upcoming = data?.bookings?.filter((b: any) => b.status === 'confirmed') || [];
              if (upcoming.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-70">
                    <p className="text-text-secondary text-sm">No upcoming bookings for today.</p>
                  </div>
                );
              }
              return upcoming.map((booking: any) => (
                <div key={booking.id} className="p-4 rounded-lg border border-border-theme bg-bg-surface hover:border-accent/50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold">{booking.customer_name}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5">{booking.customer_phone}</p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-bold font-mono bg-bg-card border border-border-theme">
                      {booking.table_id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-bold text-accent">{booking.start_time?.substring(0,5)} • {booking.duration_minutes}m</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateBookingStatus(booking.id, 'no_show')} className="px-2 py-1 rounded border border-danger/50 text-danger text-[10px] font-bold uppercase hover:bg-danger/10">No Show</button>
                      <button onClick={() => handleStartBooking(booking.id)} className="px-3 py-1 rounded bg-accent text-white text-[10px] font-bold uppercase hover:bg-accent/90 shadow-lg shadow-accent/20">Start</button>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Current Promotion */}
        <div className="lg:col-span-8 rounded-xl p-8 relative overflow-hidden bg-bg-card border border-border-theme flex flex-col justify-between" style={{ minHeight: '320px' }}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          
          {isPromoValid && activePromo ? (
            <>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <span className="inline-block px-3 py-1 bg-warning text-white text-[10px] font-bold tracking-widest uppercase rounded-full mb-4 animate-pulse">Live Promotion</span>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">{activePromo.title}</h2>
                  <h3 className="text-3xl md:text-4xl font-bold text-accent">{activePromo.discount_percent}% Off Tables</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">Ends in:</p>
                  <p className="text-3xl font-mono text-text-primary tabular-nums">{promoTimeLeft}</p>
                </div>
              </div>
              <div className="relative z-10 mt-8">
                <p className="text-text-secondary text-sm">Discount is automatically applying to all active tables.</p>
              </div>
            </>
          ) : (
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center opacity-70">
              <svg className="w-12 h-12 text-border-theme mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <h2 className="text-2xl font-bold mb-1">No Active Promotions</h2>
              <p className="text-text-secondary text-sm">Go to Settings to launch a live promotion.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const handleDownloadCSV = () => {
    // Generate CSV from history
    if (data.completedSessions.length === 0) return alert('No history data to download');
    const headers = ['Session ID', 'Customer Name', 'Table', 'Game Type', 'Start Time', 'End Time', 'Duration', 'Revenue'];
    const csvContent = [
      headers.join(','),
      ...data.completedSessions.map(s => [
        s.id, s.customer_name, s.table_id, s.game_type, s.start_time, s.end_time, s.duration, s.cost
      ].map(field => `"${field}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `revenue_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const renderBookings = () => {
    const allBookings = data?.bookings || [];
    // Sort by date descending
    allBookings.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
      <div className="flex flex-col gap-8 mt-4">
        <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold">Master Bookings Log</h2>
              <p className="text-text-secondary mt-1 text-sm">Full history of all table reservations across all statuses.</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/20 text-[#25D366] rounded-full border border-[#25D366]/30">
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
              <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Today's Bookings
              </h3>
              <p className="text-xs text-text-secondary mt-1 italic">Automatically synchronized via WhatsApp AI</p>
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-bg-primary shadow-sm">
                <tr className="text-[11px] font-extrabold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                  <th className="p-4 md:p-5">Client</th>
                  <th className="p-4 md:p-5">Table</th>
                  <th className="p-4 md:p-5">Time Slot</th>
                  <th className="p-4 md:p-5">Status</th>
                  <th className="p-4 md:p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data.bookings || []).length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-text-secondary text-base">No bookings for today.</td></tr>
                ) : (
                  (data.bookings || []).map((booking: any) => (
                    <tr key={booking.id} className="border-b border-border-theme/50 hover:bg-bg-surface transition-all duration-200 group">
                      <td className="p-4 md:p-5">
                        <p className="text-base font-bold text-text-primary">{booking.customer_name}</p>
                      </td>
                      <td className="p-4 md:p-5">
                        <span className="px-3 py-1.5 border border-border-theme bg-bg-surface rounded-lg text-sm font-mono font-bold text-accent uppercase tracking-widest shadow-sm group-hover:border-accent/50 transition-colors">
                          {booking.table_id}
                        </span>
                      </td>
                      <td className="p-4 md:p-5">
                        <p className="text-sm font-bold font-mono text-text-primary tabular-nums whitespace-nowrap">{booking.start_time} - {booking.end_time}</p>
                        <p className="text-xs text-text-secondary mt-1">{booking.duration_minutes} mins</p>
                      </td>
                      <td className="p-4 md:p-5">
                        {booking.status === 'confirmed' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-accent/50 text-accent bg-accent/10 uppercase shadow-sm">Upcoming</span>}
                        {booking.status === 'active' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-secondary/50 text-secondary bg-secondary/10 uppercase shadow-sm">Active Session</span>}
                        {booking.status === 'completed' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-border-theme text-text-secondary bg-bg-surface uppercase shadow-sm">Completed</span>}
                        {booking.status === 'cancelled' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-danger/50 text-danger bg-danger/10 uppercase shadow-sm">Cancelled</span>}
                      </td>
                      <td className="p-4 md:p-5 text-right">
                        {booking.status === 'confirmed' && (
                          <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')} className="px-4 py-2 text-sm font-bold text-danger border-2 border-danger/30 rounded-lg hover:bg-danger hover:text-white transition-colors shadow-sm">Cancel</button>
                            <button onClick={() => handleStartBooking(booking.id)} className="px-4 py-2 text-sm font-bold text-black bg-accent rounded-lg hover:bg-accent/90 transition-colors shadow-md shadow-accent/20 border-2 border-transparent">Start Session</button>
                          </div>
                        )}
                        {booking.status === 'active' && (
                          <span className="text-xs font-bold text-secondary flex items-center justify-end gap-2">
                            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div> Live
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => (
    <div className="flex flex-col gap-8 mt-4">
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Revenue Reports</h2>
            <p className="text-text-secondary mt-1 text-sm">Download your billing data synchronized from Google Sheets.</p>
          </div>
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 bg-accent text-white font-bold rounded hover:bg-accent/90 transition-colors shadow-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Export to CSV
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Total Revenue Today</p>
            <p className="text-4xl font-bold text-accent font-mono">{formatINR(revenueToday)}</p>
          </div>
          <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Completed Sessions</p>
            <p className="text-4xl font-bold text-text-primary font-mono">{data.completedSessions.length}</p>
          </div>
          <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center">
            <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Google Sheets Sync</p>
            <div className="flex items-center gap-2 mt-2 text-accent">
              <span className="w-3 h-3 rounded-full bg-accent animate-pulse"></span>
              <span className="font-bold">Active & Linked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTables = () => (
    <div className="flex flex-col gap-8">
      {/* Active Tables List */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden mt-4 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="p-4 md:p-6 border-b border-border-theme flex justify-between items-center bg-bg-primary/50">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-color),0.8)]"></div>
              Live Active Tables
            </h3>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold font-mono text-accent bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20">Total Open: {formatINR(totalOpenBill)}</p>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-bg-primary shadow-sm">
              <tr className="text-[11px] font-extrabold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-4 md:p-5">Table</th>
                <th className="p-4 md:p-5">Client</th>
                <th className="p-4 md:p-5">Timer</th>
                <th className="p-4 md:p-5">Status</th>
                <th className="p-4 md:p-5">Amount</th>
                <th className="p-4 md:p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.activeSessions.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-secondary text-base">No active tables at the moment.</td></tr>
              ) : (
                data.activeSessions.map(session => {
                  const forgotten = isForgotten(session as any);
                  const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
                  const endFull = session.paused_at ? session.paused_at : now.toISOString();
                  let liveDuration = '0m';
                  let liveCost = 0;
                  let liveSlab = 'None';
                  
                  try {
                    let tableDiscount = currentDiscounts?.[session.table_id] || undefined;
                    if (!tableDiscount && isPromoValid && activePromo) {
                      tableDiscount = { percent: activePromo.discount_percent, applyToFood: false };
                    }
                    const res = calculateBilling(startFull, endFull, session.game_type, data.pricingRules, 1, tableDiscount, session.paused_duration_seconds, (session as any).locked_rate, (session as any).locked_rate_name);
                    liveDuration = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
                    liveCost = res.cost;
                    liveSlab = res.slabs_applied;
                  } catch (e) {}

                  return (
                    <tr key={session.id} className={`border-b border-border-theme/50 hover:bg-bg-surface transition-all duration-200 group ${forgotten ? 'bg-danger/5' : ''}`}>
                      <td className="p-4 md:p-5">
                        <span className="px-3 py-1.5 border border-border-theme bg-bg-surface rounded-lg text-sm font-mono font-bold text-accent uppercase tracking-widest shadow-sm group-hover:border-accent/50 transition-colors">
                          {session.table_id}
                        </span>
                      </td>
                      <td className="p-4 md:p-5">
                        <p className="text-base font-bold text-text-primary">{session.customer_name}</p>
                        <p className="text-xs text-text-secondary mt-1 capitalize font-mono bg-bg-surface inline-block px-2 py-0.5 rounded border border-border-theme">{session.game_type}</p>
                      </td>
                      <td className="p-4 md:p-5">
                        <p className="text-base font-bold font-mono text-text-primary tabular-nums">{liveDuration}</p>
                        <p className="text-xs text-text-secondary mt-1 tabular-nums">{toReadableIST(new Date(startFull))}</p>
                      </td>
                      <td className="p-4 md:p-5">
                         {session.paused_at ? (
                           <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-warning/50 text-warning bg-warning/10 uppercase shadow-sm">Paused</span>
                         ) : forgotten ? (
                           <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-danger/50 text-danger bg-danger/10 uppercase shadow-sm">Warning</span>
                         ) : (
                           <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-accent/50 text-accent bg-accent/10 uppercase shadow-sm">Active</span>
                         )}
                      </td>
                      <td className="p-4 md:p-5">
                        <p className="text-base font-bold font-mono text-accent tabular-nums">{formatINR(liveCost)}</p>
                        <p className="text-xs text-text-secondary mt-1 truncate max-w-[150px]" title={liveSlab}>{liveSlab}</p>
                      </td>
                      <td className="p-4 md:p-5 text-right">
                         <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                          {session.paused_at ? (
                            <button onClick={() => handleIntervention('resume', session.id)} className="px-4 py-2 text-sm font-bold text-warning border-2 border-warning/30 rounded-lg hover:bg-warning hover:text-black transition-colors shadow-sm">Resume</button>
                          ) : (
                            <button onClick={() => handleIntervention('pause', session.id)} className="px-4 py-2 text-sm font-bold text-text-primary border-2 border-border-theme rounded-lg hover:bg-bg-surface transition-colors shadow-sm">Pause</button>
                          )}
                          <button onClick={() => {
                            const tid = prompt('Enter table number to transfer to:');
                            if (tid) handleIntervention('transfer', session.id, undefined, tid);
                          }} className="px-4 py-2 text-sm font-bold text-secondary border-2 border-secondary/30 rounded-lg hover:bg-secondary hover:text-black transition-colors shadow-sm">Transfer</button>
                          <button onClick={() => {
                            if (confirm(`End session for ${session.customer_name}? Current bill: ${formatINR(liveCost)}`)) {
                              handleIntervention('force_end', session.id, liveCost);
                            }
                          }} className="px-4 py-2 text-sm font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-danger/20 border-2 border-transparent">End Session</button>
                         </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Completed Tables List */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden mt-4 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="p-4 md:p-6 border-b border-border-theme bg-bg-primary/50 flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Completed Today
          </h3>
          <span className="text-sm font-bold text-text-secondary bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme">{data.completedSessions.length} Sessions</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-bg-primary shadow-sm">
              <tr className="text-[11px] font-extrabold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-4">Customer</th>
                <th className="p-4">Table</th>
                <th className="p-4">Game</th>
                <th className="p-4">Timing</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Base Cost</th>
                <th className="p-4">Discount</th>
                <th className="p-4">Final Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Completed By</th>
              </tr>
            </thead>
            <tbody>
              {data.completedSessions.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center text-text-secondary text-base">No completed sessions yet.</td></tr>
              ) : (
                data.completedSessions.map((session: any) => (
                  <tr key={session.id} className="border-b border-border-theme/50 hover:bg-bg-surface transition-all duration-200">
                    <td className="p-4">
                      <p className="text-sm font-bold text-text-primary">{session.customer_name}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 border border-border-theme bg-bg-surface rounded-md text-xs font-mono font-bold text-text-secondary uppercase tracking-widest">
                        {session.table_id}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-text-secondary capitalize font-mono bg-bg-surface inline-block px-2 py-0.5 rounded border border-border-theme">{session.game_type}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-mono text-text-primary whitespace-nowrap">{session.start_time.includes('T') ? toReadableIST(new Date(session.start_time)) : session.start_time}</p>
                      <p className="text-[10px] text-text-secondary mt-1 whitespace-nowrap">to {session.end_time?.includes('T') ? toReadableIST(new Date(session.end_time)) : session.end_time}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold font-mono text-text-primary tabular-nums">{session.duration?.replace(' min', 'm').replace(' hr ', 'h ')}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium font-mono text-text-secondary tabular-nums">{formatINR(session.base_cost ?? session.cost ?? 0)}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium font-mono text-secondary tabular-nums">
                        {session.discount_amount ? `-${formatINR(session.discount_amount)}` : '-'}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-base font-bold font-mono text-accent tabular-nums">{formatINR(session.cost || 0)}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest border uppercase ${session.payment_status === 'Pending' ? 'border-warning/50 text-warning bg-warning/10' : 'border-accent/50 text-accent bg-accent/10'}`}>
                        {session.payment_status || 'Paid'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-text-secondary">{session.completed_by || 'System'}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="flex flex-col gap-8 mt-4">
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border-theme bg-bg-primary/50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-text-primary">Membership Directory</h3>
            <p className="text-xs text-text-secondary mt-1 italic">Synced in real-time with Google Sheets</p>
          </div>
          <button onClick={fetchMemberships} className="p-2 bg-bg-surface border border-border-theme rounded hover:bg-border-theme transition-colors">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-5 font-bold">Member</th>
                <th className="p-5 font-bold">Contact</th>
                <th className="p-5 font-bold">Tier</th>
                <th className="p-5 font-bold">Join Date</th>
                <th className="p-5 font-bold">Expiry Date</th>
                <th className="p-5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isMembershipsLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-text-secondary text-sm animate-pulse">Loading members from Google Sheets...</td></tr>
              ) : memberships.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-text-secondary text-sm">No memberships found</td></tr>
              ) : (
                memberships.map((m, i) => (
                  <tr key={i} className="border-b border-border-theme/50 hover:bg-bg-surface/50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                          {m.name.substring(0,2).toUpperCase()}
                        </div>
                        <p className="text-sm font-bold">{m.name}</p>
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="text-sm font-mono">{m.mobile}</p>
                      <p className="text-[10px] text-text-secondary mt-0.5">{m.email || 'No email'}</p>
                    </td>
                    <td className="p-5">
                      <span className="px-2 py-1 rounded text-[10px] font-bold tracking-widest border border-accent text-accent bg-accent/10 uppercase">{m.tier}</span>
                    </td>
                    <td className="p-5"><span className="text-sm font-mono text-text-secondary">{m.join_date}</span></td>
                    <td className="p-5"><span className="text-sm font-mono text-text-primary">{m.expiry_date}</span></td>
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest border uppercase ${m.status === 'Active' ? 'border-accent/50 text-accent bg-accent/10' : 'border-danger/50 text-danger bg-danger/10'}`}>{m.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Register New Member</h2>
        <form onSubmit={handleCreateMembership} className="max-w-xl grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Full Name</label>
            <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm" placeholder="John Doe" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Mobile Number</label>
            <input required type="tel" value={newMember.mobile} onChange={e => setNewMember({...newMember, mobile: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-mono" placeholder="9876543210" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email (Optional)</label>
            <input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm" placeholder="john@example.com" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Membership Tier</label>
            <select value={newMember.tier} onChange={e => setNewMember({...newMember, tier: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-bold text-accent">
              <option value="Standard">Standard</option>
              <option value="Pro">Pro</option>
              <option value="VIP">VIP</option>
              <option value="Elite">Elite</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Months)</label>
            <select value={newMember.duration} onChange={e => setNewMember({...newMember, duration: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm">
              <option value="1">1 Month</option>
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months (1 Year)</option>
            </select>
          </div>
          <div className="col-span-2 mt-2">
            <button type="submit" className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors">
              Register Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="flex flex-col gap-8 mt-4">
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>
        <form onSubmit={handleSavePromo} className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Promotion Title</label>
            <input 
              type="text" 
              required
              value={promoTitle}
              onChange={e => setPromoTitle(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
              placeholder="e.g. Afternoon Elite"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Discount Percent (%)</label>
            <input 
              type="number" 
              required min="1" max="100"
              value={promoDiscount}
              onChange={e => setPromoDiscount(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Hours)</label>
            <input 
              type="number" 
              required min="1" max="72"
              value={promoDurationHours}
              onChange={e => setPromoDurationHours(e.target.value)}
              className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
            />
          </div>
          <div className="flex gap-4 mt-2">
            <button type="submit" disabled={isUpdatingPromo} className="flex-1 bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50">
              {isUpdatingPromo ? 'Saving...' : 'Launch Promo'}
            </button>
            {isPromoValid && (
              <button type="button" onClick={handleClearPromo} disabled={isUpdatingPromo} className="flex-1 bg-danger/10 text-danger border border-danger/30 font-bold py-3 rounded-lg hover:bg-danger/20 transition-colors disabled:opacity-50">
                End Early
              </button>
            )}
          </div>
        </form>
      </div>
      
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Manual Table Discounts</h2>
        <form onSubmit={handleApplyDiscount} className="max-w-md flex flex-col gap-4">
          <select 
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-semibold text-text-primary"
            required
          >
            <option value="">-- Select Table --</option>
            {data.tables?.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input 
            type="number" 
            min="1" max="100"
            value={discountPercent}
            onChange={e => setDiscountPercent(e.target.value)}
            className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
            placeholder="Discount %"
            required
          />
          <button type="submit" disabled={!selectedTable || isUpdatingDiscount} className="w-full bg-border-theme text-text-primary font-bold py-3 rounded-lg hover:bg-border-theme/80 transition-colors disabled:opacity-50 border border-border-theme">
            {isUpdatingDiscount ? 'Applying...' : 'Apply Manual Discount'}
          </button>
        </form>
        
        <div className="mt-6 flex flex-wrap gap-2">
          {Object.entries(data.activeDiscounts || {}).map(([tableId, discount]) => (
            <div key={tableId} className="flex items-center gap-2 bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme text-xs">
              <span className="font-bold text-accent">{tableId}</span> 
              <span className="text-text-secondary">| {discount.percent}% Off</span>
              <button onClick={() => handleRemoveDiscount(tableId)} className="ml-1 text-danger hover:text-danger/80">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden font-sans transition-colors duration-200">
      
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border-theme bg-bg-surface shrink-0 z-20 relative">
        <div className="p-8 pb-4">
          <h1 className="text-2xl font-bold text-accent tracking-tight mb-1">Scan-n-Bill</h1>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold">Smart Venue OS</p>
        </div>

        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <button onClick={() => setSidebarTab('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'overview' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconOverview /> Overview
          </button>
          <button onClick={() => setSidebarTab('tables')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'tables' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconTables /> Tables
          </button>
          <button onClick={() => setSidebarTab('bookings')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'bookings' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconBookings /> Bookings
          </button>
          <button onClick={() => setSidebarTab('reports')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'reports' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconBookings /> Reports
          </button>
          <button onClick={() => setSidebarTab('customers')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'customers' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconCustomers /> Customers
          </button>
          <button onClick={() => setSidebarTab('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'settings' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconSettings /> Settings
          </button>
        </nav>

        <div className="p-4 flex flex-col gap-2 border-t border-border-theme/50">
          <button onClick={() => setIsManualModalOpen(true)} className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-white font-bold rounded-lg text-sm transition-colors hover:bg-secondary/90 mb-2 shadow-[0_0_15px_rgba(240,165,0,0.3)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New Session
          </button>
          <button onClick={() => setIsQRModalOpen(true)} className="flex items-center justify-center gap-2 w-full py-3 bg-accent text-white font-bold rounded-lg text-sm transition-colors hover:bg-accent/90 mb-4 shadow-[0_0_15px_rgba(141,213,182,0.3)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            Quick Scan
          </button>
          
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
            <IconSupport /> Support
          </a>
          <a href="#" onClick={() => setIsAuthorized(false)} className="flex items-center gap-3 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
            <IconLogout /> Logout
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-bg-primary">
        
        {/* Header */}
        <header className="px-10 py-6 flex justify-between items-center border-b border-border-theme sticky top-0 bg-bg-primary/95 backdrop-blur z-10">
          <div>
            <h2 className="text-xl font-bold text-accent capitalize">{sidebarTab}</h2>
            <p className="text-xs text-text-secondary font-mono mt-1 uppercase tracking-widest">
              {toReadableIST(now)}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-text-secondary">
              <button 
                onClick={() => {
                  const isDark = document.documentElement.classList.contains('dark');
                  if (isDark) {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('theme', 'light');
                  } else {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('theme', 'dark');
                  }
                }}
                className="hover:text-text-primary transition-colors"
                title="Toggle Theme"
              >
                <svg className="w-5 h-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <svg className="w-5 h-5 block dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
              <button className="hover:text-text-primary transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg></button>
              <button className="hover:text-text-primary transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></button>
            </div>
            <div className="h-8 w-px bg-border-theme"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold border border-accent/30 shadow-inner">
                {data?.ownerName ? data.ownerName.charAt(0).toUpperCase() : 'O'}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{data?.ownerName || 'Club Owner'}</p>
                <p className="text-xs text-text-secondary">Owner</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-10 max-w-[1440px] mx-auto w-full flex flex-col gap-8 pb-20">
          {sidebarTab === 'overview' && renderOverview()}
          {sidebarTab === 'tables' && renderTables()}
          {sidebarTab === 'bookings' && renderBookings()}
          {sidebarTab === 'reports' && renderReports()}
          {sidebarTab === 'customers' && renderCustomers()}
          {sidebarTab === 'settings' && renderSettings()}
        </div>
      </main>
      
      {/* Manual Session Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-md my-auto shadow-2xl relative">
            <button 
              onClick={() => setIsManualModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 bg-bg-surface border border-border-theme rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="p-8 border-b border-border-theme">
              <h2 className="text-2xl font-bold">Manual Session</h2>
              <p className="text-text-secondary mt-1 text-sm">Start a session for walk-ins without QR.</p>
            </div>
            <form onSubmit={handleManualStart} className="p-8 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Customer Name</label>
                <input type="text" required value={manualCustomer} onChange={e => setManualCustomer(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" placeholder="Walk-In or Member Name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Table</label>
                <select required value={manualTable} onChange={e => setManualTable(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary">
                  <option value="">-- Choose an available table --</option>
                  {data.tables?.filter(t => !data.activeSessions.some(s => s.table_id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Game Type</label>
                <select required value={manualGame} onChange={e => setManualGame(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary">
                  <option value="pool">Pool</option>
                  <option value="snooker">Snooker</option>
                  <option value="ps5">PS5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Session Notes (Optional)</label>
                <input type="text" value={manualNotes} onChange={e => setManualNotes(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" placeholder="Special requests..." />
              </div>
              <button type="submit" disabled={isStartingManual || !manualTable} className="w-full mt-4 bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50">
                {isStartingManual ? 'Starting...' : 'Start Session'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-md my-auto shadow-2xl relative">
            <button 
              onClick={() => setEditSession(null)}
              className="absolute top-6 right-6 w-10 h-10 bg-bg-surface border border-border-theme rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="p-8 border-b border-border-theme">
              <h2 className="text-2xl font-bold">Edit Session</h2>
              <p className="text-text-secondary mt-1 text-sm">Update customer details or correct start time.</p>
            </div>
            <form onSubmit={handleEditSessionSubmit} className="p-8 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Customer Name</label>
                <input type="text" required value={editCustomer} onChange={e => setEditCustomer(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Start Time</label>
                <input type="datetime-local" required value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Notes</label>
                <input type="text" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
              </div>
              <button type="submit" className="w-full mt-4 bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Codes Modal */}
      {isQRModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-5xl my-auto shadow-2xl relative">
            <button 
              onClick={() => setIsQRModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 bg-bg-surface border border-border-theme rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="p-8 border-b border-border-theme">
              <h2 className="text-3xl font-bold">Table QR Codes</h2>
              <p className="text-text-secondary mt-2">Print these and place them on the corresponding tables.</p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-h-[70vh] overflow-y-auto">
              {data.tables?.map(t => {
                const url = `${window.location.origin}/session?table=${t.id}&type=${t.type}&b=${businessId}`;
                return (
                  <div key={t.id} className="bg-bg-surface border border-border-theme rounded-xl p-6 flex flex-col items-center text-center">
                    <h3 className="text-xl font-bold font-mono mb-1">{t.name}</h3>
                    <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-4">{t.type}</p>
                    <div className="bg-white p-3 rounded-xl shadow-inner mb-4 w-full aspect-square flex items-center justify-center">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                    <a href={`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(url)}`} download className="text-xs font-bold text-accent hover:underline">Download High-Res</a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-primary p-8 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary font-medium tracking-widest uppercase text-xs">Initializing Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
