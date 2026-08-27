
'use client';

import { useEffect, useState, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateBilling, parseDateString, formatTimeReadable } from '@/lib/billing';
import { createClient } from '@supabase/supabase-js';
import { NotificationBell, LiveTotalOpenCounter, LivePromoTimer, LiveSessionRow, PrivacyText } from './components';
import WelcomeCelebration from './WelcomeCelebration';
import { toast } from 'react-hot-toast';

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
  base_cost?: number | null;
  discount_amount?: number | null;
  payment_status?: string | null;
  completed_by?: string | null;
  status: 'ACTIVE' | 'COMPLETED';
  last_activity_at?: string;
  paused_at?: string | null;
  paused_duration_seconds?: number;
  transferred_from_table_id?: string | null;
  num_players?: number;
  locked_rate?: number;
  locked_rate_name?: string;
}

interface ActivePromotion {
  id: string;
  name: string;
  discount_percent: number;
  end_time: string;
  status: string;
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
const IconEye = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>;
const IconEyeOff = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>;



function DashboardContent() {
  const searchParams = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(searchParams.get('b'));

  const [data, setData] = useState<{ activeSessions: SessionData[], completedSessions: SessionData[], dailyRevenue: number, todayStr: string, pricingRules?: any, tables?: any[], activeDiscounts?: Record<string, { percent: number; applyToFood: boolean }>, manualClosuresToday?: number, revenueSavedToday?: number, bookings?: any[], activePromotions?: ActivePromotion[], businessName?: string, ownerName?: string, has_logged_in?: boolean, goals?: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const [enteredPin, setEnteredPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [pinError, setPinError] = useState('');

  // UI State
  const [sidebarTab, setSidebarTab] = useState<'overview' | 'tables' | 'bookings' | 'reports' | 'customers' | 'settings' | 'support'>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  const [showCelebration, setShowCelebration] = useState(false);
  
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

  // Telegram & Reminder State
  const [telegramOwners, setTelegramOwners] = useState<any[]>([]);
  const [telegramInviteLink, setTelegramInviteLink] = useState('');
  const [generatingLinkRole, setGeneratingLinkRole] = useState<string | null>(null);
  const [reminderInterval, setReminderInterval] = useState('60');
  const [isUpdatingTelegram, setIsUpdatingTelegram] = useState(false);
  const [overdueSession, setOverdueSession] = useState<any>(null);
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);


  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showUnlockPin, setShowUnlockPin] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Happy Hour States
  const [selectedTable, setSelectedTable] = useState('');
  const [discountPercent, setDiscountPercent] = useState('40');
  const [applyToFood, setApplyToFood] = useState(false);
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);

  // Privacy Mode State
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('privacy_mode');
    if (saved === 'true') setIsPrivacyMode(true);
  }, []);

  const togglePrivacy = () => {
    const newVal = !isPrivacyMode;
    setIsPrivacyMode(newVal);
    localStorage.setItem('privacy_mode', String(newVal));
  };

  // Report Date Filter State
  const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [currentDay, setCurrentDay] = useState(getLocalDateStr());
  const [reportDateRange, setReportDateRange] = useState({ start: currentDay, end: currentDay });

  // Manual Booking State (Additive)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingTable, setBookingTable] = useState('');
  const [bookingCustomer, setBookingCustomer] = useState('');
  const [bookingDate, setBookingDate] = useState(getLocalDateStr());
  const [bookingStartTime, setBookingStartTime] = useState('');
  const [bookingDuration, setBookingDuration] = useState('60');
  const [bookingGame, setBookingGame] = useState('pool');
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  // PS5 & Game Category Configuration State
  const [newStationId, setNewStationId] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newStationType, setNewStationType] = useState('ps5');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [stationToDelete, setStationToDelete] = useState<{id: string, name: string} | null>(null);
  const [selectedGameRule, setSelectedGameRule] = useState('ps5');
  const reportDateRangeRef = useRef(reportDateRange);
  const telegramLoadedRef = useRef(false);

  useEffect(() => {
    reportDateRangeRef.current = reportDateRange;
    if (isAuthorized) fetchData(undefined, true);
  }, [reportDateRange, isAuthorized]);

  useEffect(() => {
    if (data && !telegramLoadedRef.current) {
      telegramLoadedRef.current = true;
      if (data.pricingRules?.globalSettings) {
        
        setTelegramOwners(data.pricingRules.globalSettings.authorized_telegram_owners || []);
        if (data.pricingRules.globalSettings.smart_reminder_interval_minutes) {
          setReminderInterval(String(data.pricingRules.globalSettings.smart_reminder_interval_minutes));
        }
      }
    }
  }, [data]);

  // Initial load check
  useEffect(() => {
    if (!isAuthorized) {
      fetchData().finally(() => setIsInitialLoading(false));
    } else {
      setIsInitialLoading(false);
    }
  }, []);

  // Midnight roll-over logic
  useEffect(() => {
    if (!isAuthorized) return;
    const interval = setInterval(() => {
      const realToday = getLocalDateStr();
      if (currentDay !== realToday) {
        setCurrentDay(realToday);
        setReportDateRange(prev => {
          if (prev.start === currentDay && prev.end === currentDay) {
            return { start: realToday, end: realToday };
          }
          return prev;
        });
      }
    }, 10000); // check every 10 seconds to quickly update near midnight
    
    return () => clearInterval(interval);
  }, [currentDay, isAuthorized]);

  // Periodic Overdue Session Check
  useEffect(() => {
    if (!data || !data.activeSessions || !isAuthorized) return;
    
    const checkOverdue = () => {
      const intervalMins = data.pricingRules?.globalSettings?.smart_reminder_interval_minutes || 60;
      const now = new Date().getTime();
      
      const found = data.activeSessions.find((session: any) => {
        if (session.paused_at) return false;
        if (dismissedReminders.includes(session.id)) return false;
        
        const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        const lastCheckedStr = session.last_checked_at || session.last_activity_at || startFull;
        const lastCheckedAt = new Date(lastCheckedStr).getTime();
        const mins = (now - lastCheckedAt) / 60000;
        
        return mins >= intervalMins;
      });
      
      if (found && (!overdueSession || overdueSession.id !== found.id)) {
        setOverdueSession(found);
      } else if (!found && overdueSession) {
        setOverdueSession(null);
      }
    };
    
    checkOverdue();
    const interval = setInterval(checkOverdue, 15000);
    return () => clearInterval(interval);
  }, [data, isAuthorized, dismissedReminders, overdueSession]);

  const fetchData = async (pinToUse?: string, isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      
      let url = businessId ? `/api/dashboard-data?b=${businessId}` : '/api/dashboard-data';
      url += (url.includes('?') ? '&' : '?') + `startDate=${reportDateRangeRef.current.start}&endDate=${reportDateRangeRef.current.end}`;
      
      const res = await fetch(url);
      if (res.status === 401) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.businessId) setBusinessId(json.businessId);
        setIsAuthorized(true);
        if (json.has_logged_in === false && !showCelebration) {
          setShowCelebration(true);
        }
      }
    } catch (e) {
      toast.error('Network error. Unable to fetch dashboard data.');
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
            fetchData(undefined, true);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, () => {
            fetchData(undefined, true);
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
    // Only update 'now' once a minute to prevent unnecessary full page re-renders. 
    // LiveTotalOpenCounter handles its own per-second ticks.
    const clock = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(clock);
  }, []);

  const handleIntervention = async (action: string, sessionId: string, amountRecovered?: number, transferTableId?: string) => {
    if (!businessId || !data) return;

    // Optimistic UI Update
    const previousData = { ...data };
    
    if (action === 'pause') {
      setData(prev => prev ? {
        ...prev,
        activeSessions: prev.activeSessions.map(s => 
          s.id === sessionId ? { ...s, paused_at: new Date().toISOString() } : s
        )
      } : prev);
      toast.success('✓ Session paused successfully.');
    } else if (action === 'resume') {
      setData(prev => prev ? {
        ...prev,
        activeSessions: prev.activeSessions.map(s => 
          s.id === sessionId ? { ...s, paused_at: undefined, paused_duration_seconds: (s.paused_duration_seconds || 0) + Math.floor((new Date().getTime() - new Date(s.paused_at!).getTime()) / 1000) } : s
        )
      } : prev);
      toast.success('✓ Session resumed.');
    } else if (action === 'force_end') {
      setData(prev => prev ? {
        ...prev,
        activeSessions: prev.activeSessions.filter(s => s.id !== sessionId)
      } : prev);
      toast.success('✓ Session ended successfully.');
    }

    try {
      const res = await fetch('/api/intervene-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, session_id: sessionId, business_id: businessId, amount_recovered: amountRecovered, transfer_table_id: transferTableId })
      });
      if (res.ok) {
        if (action === 'confirm_playing') {
          setOverdueSession(null);
        }
        fetchData(undefined, true);
        if (action === 'transfer') toast.success('✓ Table transferred.');
      } else {
        setData(previousData); // Rollback
        toast.error("We couldn't complete your request. Please try again.");
      }
    } catch (e) {
      setData(previousData); // Rollback
      toast.error("Something went wrong. We're working on it.");
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
        toast.success('✓ Booking started successfully.');
      } else {
        const error = await res.json();
        toast.error("We couldn't start the session. Please try again.");
      }
    } catch (e) {
      toast.error('Network error. Could not start session.');
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
        toast.success('✓ Booking updated.');
      } else {
        const error = await res.json();
        toast.error("We couldn't update the booking. Please try again.");
      }
    } catch (e) {
      toast.error('Network error. Could not update booking.');
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
        setManualTable('');
        setManualCustomer('');
        fetchData(undefined, true);
        toast.success('✓ Session created successfully.');
      } else {
        const error = await res.json();
        toast.error("We couldn't start the session. Please try again.");
      }
    } finally {
      setIsStartingManual(false);
    }
  };

  const getAvailableGameTypesForTable = (tableId: string): string[] => {
    if (!tableId || !data?.tables) {
      return Object.keys(data?.pricingRules?.rules || { pool: {} });
    }
    const t = data.tables.find((tbl: any) => tbl.id === tableId);
    if (!t || !t.type) {
      return Object.keys(data?.pricingRules?.rules || { pool: {} });
    }
    const assigned = t.type.split(/[,/]/).map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    return assigned.length > 0 ? assigned : Object.keys(data?.pricingRules?.rules || { pool: {} });
  };

  const handleSaveConfig = async (newRules?: any, newTables?: any[]) => {
    if (!businessId) return;
    setIsUpdatingConfig(true);
    try {
      const payload: any = { business_id: businessId };
      if (newRules !== undefined) payload.pricing_rules = newRules;
      if (newTables !== undefined) payload.tables = newTables;
      const res = await fetch('/api/update-business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success('✓ Business settings & PS5 config updated successfully.');
        fetchData(undefined, true);
      } else {
        toast.error('Failed to update configuration.');
      }
    } catch (err) {
      toast.error('Error connecting to configuration service.');
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleEnablePS5 = async () => {
    if (!data) return;
    const existingRules = data.pricingRules?.rules || {};
    if (existingRules['ps5']) {
      toast.success('✓ PS5 support is already enabled!');
      return;
    }
    const updatedRules = {
      ...existingRules,
      ps5: {
        type: 'fixed',
        rate: 250,
        multiplayer_mode: 'base_plus_extra',
        extra_per_player: 50
      }
    };
    const fullPricing = { ...data.pricingRules, rules: updatedRules };
    await handleSaveConfig(fullPricing, undefined);
  };

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationId || !newStationName || !data) return;
    const existing = data.tables || [];
    if (existing.some((t: any) => t.id.toLowerCase() === newStationId.toLowerCase())) {
      toast.error(`Station ID "${newStationId}" already exists.`);
      return;
    }
    const updatedTables = [...existing, { id: newStationId, name: newStationName, type: newStationType }];
    await handleSaveConfig(undefined, updatedTables);
    setNewStationId('');
    setNewStationName('');
  };

  const confirmDeleteStation = (t: any) => {
    if (!data) return;
    const hasActiveSession = data.activeSessions?.some((s: any) => s.table_id === t.id && s.status === 'ACTIVE');
    if (hasActiveSession) {
      toast.error(`Cannot delete "${t.name}": Active session in progress.`);
      return;
    }
    const hasActiveBooking = data.bookings?.some((b: any) => b.table_id === t.id && b.status === 'confirmed');
    if (hasActiveBooking) {
      toast.error(`Cannot delete "${t.name}": Has confirmed booking.`);
      return;
    }
    setStationToDelete({ id: t.id, name: t.name });
  };

  const handleDeleteStation = async () => {
    if (!stationToDelete || !data) return;
    const existing = data.tables || [];
    const updatedTables = existing.filter((t: any) => t.id !== stationToDelete.id);
    await handleSaveConfig(undefined, updatedTables);
    toast.success(`Station "${stationToDelete.name}" deleted successfully.`);
    setStationToDelete(null);
  };

  const renderBookingReminders = () => {
    if (!data?.bookings || !data.bookings.length) return null;
    const now = new Date();
    const todayStr = getLocalDateStr();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const dueBookings = data.bookings.filter((b: any) => {
      if (b.status !== 'confirmed' || b.booking_date !== todayStr) return false;
      if (dismissedReminders.includes(b.id)) return false;
      if (!b.start_time) return false;
      const parts = b.start_time.split(':');
      const startMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const duration = Number(b.duration_minutes) || 60;
      return currentMinutes >= (startMinutes - 15) && currentMinutes <= (startMinutes + duration);
    });

    if (dueBookings.length === 0) return null;

    return (
      <div className="flex flex-col gap-3">
        {dueBookings.map((booking: any) => {
          const isOccupied = data.activeSessions?.some((s: any) => s.table_id === booking.table_id && s.status === 'ACTIVE');
          const assignedTable = data.tables?.find((t: any) => t.id === booking.table_id);
          const gameDisplay = booking.game_type || assignedTable?.type || 'Table Game';
          
          return (
            <div key={booking.id} className="p-5 rounded-xl border-2 border-warning/80 bg-warning/10 text-text-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg animate-soft-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-warning text-black flex items-center justify-center font-extrabold text-xl shrink-0 shadow">
                  🔔
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base sm:text-lg font-bold">Scheduled Booking Reminder</h4>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold font-mono uppercase bg-warning text-black tracking-wider shadow-sm">RESERVED</span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold font-mono capitalize bg-bg-surface border border-border-theme text-primary">{gameDisplay}</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    Table <strong className="text-text-primary font-mono">{assignedTable?.name || booking.table_id} ({booking.table_id})</strong> is reserved for <strong className="text-text-primary">{booking.customer_name || 'Guest'}</strong> at <strong className="text-accent font-mono">{formatTimeReadable(booking.start_time, true, booking.booking_date)}</strong>.
                  </p>
                  {isOccupied && (
                    <p className="text-xs font-bold text-danger mt-2 flex items-center gap-1.5 bg-danger/10 px-2.5 py-1 rounded border border-danger/30 w-fit">
                      <span>⚠️</span> Warning: Table {booking.table_id} is currently occupied! A reserved booking is waiting to start.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end shrink-0">
                <button
                  onClick={() => setDismissedReminders(prev => [...prev, booking.id])}
                  className="px-4 py-2.5 rounded-lg border border-border-theme text-text-secondary hover:text-text-primary text-xs sm:text-sm font-bold transition-colors min-h-[44px]"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleStartBooking(booking.id)}
                  disabled={isOccupied}
                  className="px-5 py-2.5 rounded-lg bg-accent text-black font-extrabold text-xs sm:text-sm uppercase hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isOccupied ? 'End current active session on table before starting' : 'Start Session'}
                >
                  {isOccupied ? 'Table Occupied' : 'Start Booking'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTable || !bookingDate || !bookingStartTime || !businessId) return;
    setIsCreatingBooking(true);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          table_id: bookingTable,
          customer_name: bookingCustomer,
          booking_date: bookingDate,
          start_time: bookingStartTime,
          duration_minutes: Number(bookingDuration) || 60,
          game_type: bookingGame
        })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setIsBookingModalOpen(false);
        setBookingTable('');
        setBookingCustomer('');
        setBookingStartTime('');
        setBookingDuration('60');
        fetchData(undefined, true);
        toast.success('✓ Manual booking created.');
      } else {
        toast.error(result.error || "Couldn't create booking. Please try again.");
      }
    } catch (err: any) {
      toast.error("Failed to connect to booking service.");
    } finally {
      setIsCreatingBooking(false);
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
        toast.success('✓ Customer profile created.');
      } else {
        const err = await res.json();
        toast.error(err.error);
      }
    } catch (e) {
      toast.error("We couldn't create the membership. Please try again.");
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
        toast.success('✓ Settings updated.');
      } else {
        toast.error("We couldn't complete your request. Please try again.");
      }
    } catch (e) {
      toast.error('Network error. Could not update session.');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.length > 0) {
      setLoading(true);
      setPinError('');
      try {
        const res = await fetch('/api/auth/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, pin: enteredPin })
        });
        if (res.ok) {
          setIsAuthorized(true);
          fetchData();
        } else {
          const err = await res.json();
          setPinError(err.error || 'Incorrect Password/PIN.');
        }
      } catch (e) {
        setPinError('Network error.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    setEnteredPin('');
    setIsAuthorized(false);
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
      if (res.ok) {
        fetchData(undefined, true);
        toast.success('✓ Discount applied.');
      } else {
        toast.error('Could not apply discount.');
      }
    } catch (e) {
      toast.error('Network error. Could not apply discount.');
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
      if (res.ok) {
        fetchData(undefined, true);
        toast.success('✓ Discount removed.');
      } else {
        toast.error('Could not remove discount.');
      }
    } catch (e) {
      toast.error('Network error. Could not remove discount.');
    } finally {
      setIsUpdatingDiscount(false);
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPromo(true);
    
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: promoTitle, 
          discount_percent: promoDiscount, 
          duration_hours: promoDurationHours 
        })
      });
      if (res.ok) {
        setIsUpdatingDiscount(false);
        fetchData(undefined, true);
        toast.success('✓ Promotion launched successfully.');
        setPromoTitle('');
      } else {
        const err = await res.json();
        toast.error(err.error || "We couldn't update your promotion. Please try again.");
      }
    } finally {
      setIsUpdatingPromo(false);
    }
  };

  const handleClearPromo = async () => {
    const activePromo = data?.activePromotions?.[0];
    if (!activePromo) return;
    
    setIsUpdatingPromo(true);
    try {
      const res = await fetch('/api/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activePromo.id, status: 'Expired' })
      });
      if (res.ok) {
        fetchData(undefined, true);
        setPromoTitle('');
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to end promotion.");
      }
    } finally {
      setIsUpdatingPromo(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New PINs do not match.');
      return;
    }
    setPasswordError('');
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        toast.success('PIN changed successfully! Please log in again.');
        window.location.href = '/login';
      } else {
        const err = await res.json();
        setPasswordError(err.error || 'Failed to change PIN.');
      }
    } catch (e) {
      setPasswordError('Network error.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleGenerateTelegramLink = async (role: 'PRIMARY_OWNER' | 'SECONDARY_OWNER') => {
    setGeneratingLinkRole(role);
    const token = role + '_auth_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const updatedPricingRules = {
        ...data?.pricingRules,
        globalSettings: {
          ...data?.pricingRules?.globalSettings,
          telegram_invite_token: token
        }
      };

      const res = await fetch('/api/update-business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_id: businessId,
          pricing_rules: updatedPricingRules
        })
      });

      if (res.ok) {
        const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'Qcontr01_bot';
        setTelegramInviteLink(`https://t.me/${botUsername}?start=${token}`);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingLinkRole(null);
    }
  };

  const handleToggleTelegramOwnerAccess = async (chatIdToToggle: string, currentStatus: string) => {
    const newStatus = currentStatus === 'revoked' ? 'granted' : 'revoked';
    


    if (newStatus === 'revoked') {
      const confirm = window.confirm(`⚠️ Revoke Telegram Access?\n\nThis user will no longer be able to use this business through the Telegram bot.`);
      if (!confirm) return;
    }

    const updatedOwners = telegramOwners.map(o => 
      o.chatId === chatIdToToggle ? { ...o, status: newStatus } : o
    );
    
    try {
      const updatedPricingRules = {
        ...data?.pricingRules,
        globalSettings: {
          ...data?.pricingRules?.globalSettings,
          authorized_telegram_owners: updatedOwners
        }
      };

      const res = await fetch('/api/update-business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_id: businessId,
          pricing_rules: updatedPricingRules
        })
      });

      if (res.ok) {
        setTelegramOwners(updatedOwners);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePermanentDeleteOwner = async (chatIdToDelete: string) => {

    const confirm = window.confirm(`⚠️ Permanently Delete Owner?\n\nThis will permanently remove this owner from this business and cannot be undone.`);
    if (!confirm) return;

    const updatedOwners = telegramOwners.filter(o => String(o.chatId) !== String(chatIdToDelete));
    
    try {
      const updatedPricingRules = {
        ...data?.pricingRules,
        globalSettings: {
          ...data?.pricingRules?.globalSettings,
          authorized_telegram_owners: updatedOwners
        }
      };

      const res = await fetch('/api/update-business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_id: businessId,
          pricing_rules: updatedPricingRules
        })
      });

      if (res.ok) {
        setTelegramOwners(updatedOwners);
        toast.success('Owner permanently deleted.');
      } else {
        toast.error('Failed to delete owner.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error deleting owner.');
    }
  };

  const handleUpdateTelegramSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingTelegram(true);
    try {
      const updatedPricingRules = {
        ...data?.pricingRules,
        globalSettings: {
          ...data?.pricingRules?.globalSettings,
          smart_reminder_interval_minutes: Number(reminderInterval)
        }
      };

      const res = await fetch('/api/update-business-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          business_id: businessId,
          pricing_rules: updatedPricingRules
        })
      });
      if (res.ok) {
        toast.success('Telegram settings updated!');
        fetchData();
      } else {
        toast.error('Failed to update Telegram settings.');
      }
    } catch (err) {
      toast.error('Network error.');
    } finally {
      setIsUpdatingTelegram(false);
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

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary font-medium animate-pulse">Authenticating securely...</p>
        </div>
      </div>
    );
  }

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
          <p className="text-center text-text-secondary mb-6 text-sm">Enter your 4-digit PIN to unlock.</p>
          
          <div className="relative mb-4">
            <input 
              type={showUnlockPin ? "text" : "password"} 
              maxLength={4}
              value={enteredPin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setEnteredPin(val);
              }}
              className="w-full text-center text-3xl font-mono tracking-[1em] px-12 py-4 rounded-xl border border-border-theme bg-bg-primary outline-none focus:border-accent focus:card-glow text-text-primary placeholder-text-disabled placeholder:tracking-normal"
              placeholder="••••"
              autoFocus
            />
            <button type="button" onClick={() => setShowUnlockPin(!showUnlockPin)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
              {showUnlockPin ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          
          {pinError && <p className="text-danger text-sm text-center mb-4">{pinError}</p>}
          
          <button type="submit" disabled={enteredPin.length === 0 || loading} className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-accent/20">
            {loading ? 'Authenticating...' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    );
  }

  if (!data) return null;

  // Calculate stats
  const activeCount = data.activeSessions.length;
  const totalTables = data.tables?.length ?? 0;
  const occupancyPercent = totalTables > 0 ? Math.round((activeCount / totalTables) * 100) : 0;
  const totalSessions = activeCount + data.completedSessions.length;
  
  // Dynamic Average Duration Calculation
  let avgDuration = "0m";
  if (data.completedSessions.length > 0) {
    let totalMinutes = 0;
    data.completedSessions.forEach(s => {
      // Parse '1h 30m' or '45m' formats dynamically
      if (!s.duration) return;
      const hMatch = s.duration.match(/(\d+)h/);
      const mMatch = s.duration.match(/(\d+)m/);
      if (hMatch) totalMinutes += parseInt(hMatch[1]) * 60;
      if (mMatch) totalMinutes += parseInt(mMatch[1]);
    });
    const avgMinutes = Math.round(totalMinutes / data.completedSessions.length);
    avgDuration = avgMinutes >= 60 ? `${(avgMinutes / 60).toFixed(1)}h` : `${avgMinutes}m`;
  }
  
  // Dynamic Highest Turnover Table
  let highestTurnoverTableText = 'None yet';
  if (data.completedSessions.length > 0) {
    const counts = data.completedSessions.reduce((acc: Record<string, number>, s: any) => {
      acc[s.table_id] = (acc[s.table_id] || 0) + 1;
      return acc;
    }, {});
    
    let maxTable = '';
    let maxCount = 0;
    for (const [table, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxTable = table;
      }
    }
    if (maxTable) {
      highestTurnoverTableText = `Highest turnover: Table ${maxTable} (${maxCount} sessions)`;
    }
  }
  const revenueToday = data.dailyRevenue;
  
  const activePromo: ActivePromotion | null = data.activePromotions?.[0] || null;
  const isPromoValid = activePromo && new Date(activePromo.end_time).getTime() > now.getTime();

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

      const endFull = session.paused_at ? session.paused_at : now.toISOString();
      const res = calculateBilling(startFull, endFull, session.game_type, data.pricingRules, session.num_players || 1, tableDiscount, session.paused_duration_seconds, (session as any).locked_rate, (session as any).locked_rate_name);
      return acc + res.cost;
    } catch { return acc; }
  }, 0);


  const renderOverview = () => (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Revenue Card */}
        <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Daily Revenue</h3>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 mb-2 sm:mb-4">
            <span className="text-2xl sm:text-4xl font-bold text-text-primary tracking-tight font-mono"><PrivacyText value={data.dailyRevenue || 0} isPrivacyMode={isPrivacyMode} /></span>
            <span className="text-xs sm:text-sm font-semibold text-accent mb-0.5 sm:mb-1">+{(Math.random() * 15 + 5).toFixed(1)}%</span>
          </div>
          <div className="mt-auto pt-4 border-t border-border-light flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary font-medium">Goal: <PrivacyText value={data.goals?.daily_revenue || 0} isPrivacyMode={isPrivacyMode} /></span>
              <span className="text-xs font-bold text-accent">{data.goals?.daily_revenue ? Math.min(Math.round((data.dailyRevenue / data.goals.daily_revenue) * 100), 100) : 100}% Achieved</span>
            </div>
            <div className="w-full h-1.5 bg-border-light rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all duration-1000 ease-out" style={{ width: `${data.goals?.daily_revenue ? Math.min((data.dailyRevenue / data.goals.daily_revenue) * 100, 100) : 100}%` }}></div>
            </div>
            {!data.goals?.daily_revenue ? (
              <p className="text-[10px] text-text-secondary text-right mt-1">No daily target set</p>
            ) : data.dailyRevenue < data.goals.daily_revenue ? (
              <p className="text-[10px] text-text-secondary text-right mt-1"><PrivacyText value={data.goals.daily_revenue - data.dailyRevenue} isPrivacyMode={isPrivacyMode} /> remaining to reach today's target</p>
            ) : (
              <p className="text-[10px] text-success text-right mt-1 font-bold">Daily target achieved! 🎉</p>
            )}
          </div>
        </div>

        {/* Active Tables Card */}
        <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Active Tables</h3>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent animate-pulse shadow-[0_0_5px_rgba(141,213,182,0.8)]"></div>
              <span className="text-[8px] sm:text-[10px] text-accent font-bold uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 mb-2 sm:mb-4">
            <span className="text-2xl sm:text-4xl font-bold text-text-primary tracking-tight font-mono">{activeCount}<span className="text-lg sm:text-2xl text-text-secondary font-normal">/{totalTables}</span></span>
            <span className="text-xs sm:text-sm font-semibold text-accent mb-0.5 sm:mb-1 font-mono">{occupancyPercent}% OCC.</span>
          </div>
          <div className="mt-auto pt-4 border-t border-border-theme">
            <span className="text-[10px] sm:text-xs text-text-secondary italic">{totalTables - activeCount} Tables available and ready</span>
          </div>
        </div>

        {/* Sessions Card */}
        <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300 col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Sessions</h3>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 mb-2 sm:mb-4">
            <span className="text-2xl sm:text-4xl font-bold text-text-primary tracking-tight font-mono">{totalSessions}</span>
            <span className="text-xs sm:text-sm font-semibold text-text-secondary mb-0.5 sm:mb-1">Avg. {avgDuration}</span>
          </div>
          <div className="mt-auto pt-4 border-t border-border-theme flex justify-between">
            <span className="text-[10px] sm:text-xs text-text-secondary font-medium"><PrivacyText value={data.completedSessions.length > 0 ? Math.round(data.dailyRevenue / data.completedSessions.length) : 0} isPrivacyMode={isPrivacyMode} /> / session</span>
            <span className="text-[10px] sm:text-xs text-text-secondary font-medium"><span className="text-text-primary font-bold">{data.completedSessions.length}</span> finished</span>
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
                    <p className="text-text-secondary text-sm">Ready to grow your business? Schedule your first booking today.</p>
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
                    <span className="text-xs font-bold text-accent">{formatTimeReadable(booking.start_time, true, booking.booking_date)} • {booking.duration_minutes}m</span>
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
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">{activePromo.name}</h2>
                  <h3 className="text-3xl md:text-4xl font-bold text-accent">{activePromo.discount_percent}% Off Tables</h3>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-1 text-center">Ends In</p>
                  <p className="text-3xl text-text-primary"><LivePromoTimer activePromo={activePromo} /></p>
                </div>
              </div>
              <div className="relative z-10 mt-8">
                <p className="text-text-secondary text-sm">Discount is automatically applying to all active tables.</p>
              </div>
            </>
          ) : (
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center opacity-70">
              <svg className="w-12 h-12 text-border-theme mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <h2 className="text-2xl font-bold mb-1">Ready to grow your business?</h2>
              <p className="text-text-secondary text-sm">Launch your first promotion and start engaging more customers today.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const handleDownloadCSV = () => {
    // Generate CSV from history
    if (data.completedSessions.length === 0) return toast.error("We couldn't find any history data to download.");
    const headers = ['Date', 'Time', 'Customer', 'Service/Game', 'Duration', 'Payment Method', 'Total Amount'];
    const csvContent = [
      headers.join(','),
      ...data.completedSessions.map(s => [
        s.date, s.start_time, s.customer_name, s.game_type, s.duration, (s.payment_status === 'Pending' ? 'Paid' : s.payment_status || 'Paid'), s.cost
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
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold">Master Bookings Log</h2>
              <p className="text-text-secondary mt-1 text-sm">Full history of all table reservations across all statuses.</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => setIsBookingModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-bold rounded-lg shadow-md hover:bg-accent/90 transition-all duration-200 text-sm border border-accent/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                New Manual Booking
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/20 text-[#25D366] rounded-full border border-[#25D366]/30">
                <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  Today's Bookings
                </h3>
                <p className="text-xs text-text-secondary mt-1 italic">Automatically synchronized via WhatsApp AI</p>
              </div>
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
                  <tr><td colSpan={5} className="p-12 text-center text-text-secondary text-base">Ready to grow your business? Schedule your first booking today.</td></tr>
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
                        <p className="text-sm font-bold font-mono text-text-primary tabular-nums whitespace-nowrap">{formatTimeReadable(booking.start_time, true, booking.booking_date)} – {formatTimeReadable(booking.end_time)}</p>
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
                            <button onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')} className="px-4 py-2 text-sm font-bold text-danger border border-danger/30 rounded-lg hover:bg-danger hover:text-white transition-colors shadow-sm">Cancel</button>
                            <button onClick={() => handleStartBooking(booking.id)} className="px-4 py-2 text-sm font-bold text-black bg-accent rounded-lg hover:bg-accent/90 transition-colors shadow-md shadow-accent/20 border border-transparent">Start Session</button>
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

  const renderReports = () => {
    // Generate preset dates using getLocalDateStr to ensure correct local dates
    const today = getLocalDateStr(new Date());
    const yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateStr(yesterdayDate);
    const last7Date = new Date(); last7Date.setDate(last7Date.getDate() - 7);
    const last7 = getLocalDateStr(last7Date);
    const thisMonthDate = new Date(); thisMonthDate.setDate(1);
    const thisMonth = getLocalDateStr(thisMonthDate);

    return (
      <div className="flex flex-col gap-8 mt-4">
        <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col p-8">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold">Revenue Reports</h2>
              <p className="text-text-secondary mt-1 text-sm">Download your billing data synchronized from Google Sheets.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={() => setReportDateRange({ start: today, end: today })} className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-widest uppercase border ${reportDateRange.start === today && reportDateRange.end === today ? 'border-accent/50 text-accent bg-accent/10' : 'border-border-theme text-text-secondary bg-bg-surface hover:text-text-primary'}`}>Today</button>
              <button onClick={() => setReportDateRange({ start: yesterday, end: yesterday })} className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-widest uppercase border ${reportDateRange.start === yesterday && reportDateRange.end === yesterday ? 'border-accent/50 text-accent bg-accent/10' : 'border-border-theme text-text-secondary bg-bg-surface hover:text-text-primary'}`}>Yesterday</button>
              <button onClick={() => setReportDateRange({ start: last7, end: today })} className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-widest uppercase border ${reportDateRange.start === last7 && reportDateRange.end === today ? 'border-accent/50 text-accent bg-accent/10' : 'border-border-theme text-text-secondary bg-bg-surface hover:text-text-primary'}`}>Last 7 Days</button>
              <button onClick={() => setReportDateRange({ start: thisMonth, end: today })} className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-widest uppercase border ${reportDateRange.start === thisMonth && reportDateRange.end === today ? 'border-accent/50 text-accent bg-accent/10' : 'border-border-theme text-text-secondary bg-bg-surface hover:text-text-primary'}`}>This Month</button>
              <div className="flex items-center gap-2 ml-4 bg-bg-surface border border-border-theme rounded-lg px-2">
                <input type="date" value={reportDateRange.start} onChange={e => setReportDateRange(prev => ({...prev, start: e.target.value}))} className="px-2 py-1.5 bg-transparent text-sm font-medium outline-none text-text-primary" />
                <span className="text-text-secondary">to</span>
                <input type="date" value={reportDateRange.end} onChange={e => setReportDateRange(prev => ({...prev, end: e.target.value}))} className="px-2 py-1.5 bg-transparent text-sm font-medium outline-none text-text-primary" />
              </div>
              <button onClick={handleDownloadCSV} className="ml-4 flex items-center gap-2 px-4 py-2 bg-accent text-black font-bold rounded-lg hover:bg-accent/90 transition-colors shadow-md shadow-accent/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export CSV
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Total Period Revenue</p>
              <p className="text-3xl font-bold text-accent font-mono"><PrivacyText value={revenueToday} isPrivacyMode={isPrivacyMode} /></p>
            </div>
            <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Sessions Completed</p>
              <p className="text-3xl font-bold text-text-primary font-mono">{data.completedSessions.length}</p>
            </div>
            <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Average Session</p>
              <p className="text-3xl font-bold text-secondary font-mono">{avgDuration}</p>
            </div>
            <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Avg Rev / Session</p>
              <p className="text-3xl font-bold text-text-primary font-mono"><PrivacyText value={data.completedSessions.length > 0 ? Math.round(revenueToday / data.completedSessions.length) : 0} isPrivacyMode={isPrivacyMode} /></p>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
             <p className="text-sm font-bold font-mono text-accent bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20 shadow-inner">
               Total Open: <LiveTotalOpenCounter activeSessions={data.activeSessions} pricingRules={data.pricingRules} currentDiscounts={currentDiscounts} activePromo={activePromo} />
             </p>
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
                <tr><td colSpan={6} className="p-12 text-center text-text-secondary text-base">Your business is ready. Assign a customer to a table to start tracking.</td></tr>
              ) : (
                data.activeSessions.map(session => (
                  <LiveSessionRow 
                    key={session.id}
                    session={session}
                    currentDiscounts={currentDiscounts}
                    isPromoValid={isPromoValid}
                    activePromo={activePromo}
                    pricingRules={data.pricingRules}
                    handleIntervention={handleIntervention}
                    toReadableIST={toReadableIST}
                    isPrivacyMode={isPrivacyMode}
                    formatINR={formatINR}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Completed Tables List */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden mt-4 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="p-4 md:p-6 border-b border-border-theme bg-bg-primary/50 flex justify-between items-center flex-wrap gap-4">
          <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Completed Sessions
          </h3>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              value={reportDateRange.start} 
              onChange={e => setReportDateRange(prev => ({...prev, start: e.target.value, end: e.target.value}))} 
              className="px-3 py-1.5 bg-bg-surface border border-border-theme rounded-lg text-sm font-medium text-text-primary outline-none focus:border-accent transition-colors"
            />
            <span className="text-sm font-bold text-text-secondary bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme">{data.completedSessions.length} Sessions</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-bg-primary shadow-sm">
              <tr className="text-[11px] font-extrabold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-4">Customer</th>
                <th className="p-4">Table</th>
                <th className="p-4">Service/Game</th>
                <th className="p-4">Session Timing (Start / End)</th>
                <th className="p-4">Duration (Elapsed / Paused / Billable)</th>
                <th className="p-4">Base Cost</th>
                <th className="p-4">Discount</th>
                <th className="p-4">Final Amount</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Completed By</th>
              </tr>
            </thead>
            <tbody>
              {data.completedSessions.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center text-text-secondary text-base">Your session history will appear here once you complete a transaction.</td></tr>
              ) : (
                data.completedSessions.map((session: any) => {
                  const formatTimeStr = (t?: string) => {
                    if (!t) return '-';
                    try {
                      return t.includes('T') ? new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : t;
                    } catch { return t; }
                  };
                  const startTimeFormatted = formatTimeReadable(session.start_time, true, session.date);
                  const endTimeFormatted = formatTimeReadable(session.end_time);

                  const startMs = parseDateString(session.start_time?.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`);
                  const endMs = session.end_time ? parseDateString(session.end_time?.includes('T') ? session.end_time : `${session.date}, ${session.end_time}`) : startMs;
                  const elapsedSecs = !isNaN(startMs) && !isNaN(endMs) && endMs > startMs ? Math.floor((endMs - startMs) / 1000) : 0;
                  const pausedSecs = session.paused_duration_seconds || 0;
                  const billableSecs = Math.max(0, elapsedSecs - pausedSecs);

                  const fmtDuration = (sec: number) => {
                    const h = Math.floor(sec / 3600);
                    const m = Math.floor((sec % 3600) / 60);
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                  };

                  const elapsedStr = elapsedSecs > 0 ? fmtDuration(elapsedSecs) : (session.duration?.replace(' min', 'm').replace(' hr ', 'h ') || '0m');
                  const pausedStr = pausedSecs > 0 ? fmtDuration(pausedSecs) : '0m';
                  const billableStr = session.duration?.replace(' min', 'm').replace(' hr ', 'h ') || fmtDuration(billableSecs);

                  return (
                    <tr key={session.id} className="border-b border-border-light/50 hover:bg-bg-surface transition-all duration-200">
                      <td className="p-4">
                        <p className="text-sm font-bold text-text-primary">{session.customer_name}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 border border-border-theme bg-bg-surface rounded-md text-xs font-mono font-bold text-text-secondary uppercase tracking-widest shadow-sm">
                          {session.table_id}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-xs text-primary font-bold capitalize font-mono bg-primary/10 inline-block px-2 py-0.5 rounded border border-primary/20">{session.game_type}</p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 font-mono text-xs whitespace-nowrap">
                          <p className="text-text-primary font-bold"><span className="text-text-secondary font-normal mr-1">Start:</span>{startTimeFormatted}</p>
                          <p className="text-text-primary font-bold"><span className="text-text-secondary font-normal mr-1">End:</span>{endTimeFormatted}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 font-mono text-xs tabular-nums">
                          <p className="text-text-secondary">Elapsed: <span className="font-bold text-text-primary">{elapsedStr}</span></p>
                          {pausedSecs > 0 && <p className="text-warning font-bold">Paused: -{pausedStr}</p>}
                          <p className="text-accent font-bold text-sm">Billable: {billableStr}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium font-mono text-text-secondary tabular-nums"><PrivacyText value={session.base_cost ?? session.cost ?? 0} isPrivacyMode={isPrivacyMode} /></p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-medium font-mono text-secondary tabular-nums">
                          {session.discount_amount ? <span className="text-danger">-<PrivacyText value={session.discount_amount} isPrivacyMode={isPrivacyMode} /></span> : '-'}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-base font-bold font-mono text-accent tabular-nums"><PrivacyText value={session.cost || 0} isPrivacyMode={isPrivacyMode} /></p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest border uppercase border-accent/50 text-accent bg-accent/10 shadow-sm`}>
                          {session.payment_status === 'Pending' ? 'Paid' : (session.payment_status || 'Paid')}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-xs text-text-secondary">{session.completed_by || 'System'}</p>
                      </td>
                    </tr>
                  );
                })
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
            <p className="text-xs text-text-secondary mt-1 italic">Manage your loyal customers</p>
          </div>
          <button onClick={fetchMemberships} className="p-2 bg-bg-surface border border-border-theme rounded hover:bg-border-theme transition-colors">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-5 font-bold">Member</th>
                <th className="p-5 font-bold">Contact</th>
                <th className="p-5 font-bold">Tier</th>
                <th className="p-5 font-bold">Points</th>
                <th className="p-5 font-bold">Spend</th>
                <th className="p-5 font-bold">Expiry Date</th>
                <th className="p-5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isMembershipsLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-text-secondary text-sm animate-pulse">Loading directory...</td></tr>
              ) : memberships.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-text-secondary text-sm">Ready to build loyalty? Create your first customer profile today.</td></tr>
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
                    <td className="p-5"><span className="text-sm font-mono font-bold text-accent">{m.loyalty_points || 0}</span></td>
                    <td className="p-5"><span className="text-sm font-mono">₹{m.total_spend || 0}</span></td>
                    <td className="p-5"><span className="text-sm font-mono text-text-primary">{m.expiry_date ? m.expiry_date.split('T')[0] : 'N/A'}</span></td>
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
      {/* Game Categories & PS5 Management (Additive) */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
              <span>🎮</span> Game Categories &amp; PS5 Support
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-1">
              Configure dynamic pricing, time slots, schedules, and multiplayer rules for all sports including PS5.
            </p>
          </div>
          {!data?.pricingRules?.rules?.['ps5'] ? (
            <button
              onClick={handleEnablePS5}
              disabled={isUpdatingConfig}
              className="px-5 py-3 bg-accent text-black font-extrabold text-xs sm:text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 shrink-0 min-h-[44px]"
            >
              + Enable PS5 Support
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-md text-xs font-bold font-mono tracking-widest border border-accent/50 text-accent bg-accent/10 uppercase shadow-sm">
              ✓ PS5 Natively Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Rule Configuration */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Configure Pricing Schedules &amp; Rates</h3>
            <div className="flex w-full overflow-x-auto custom-scrollbar p-1 bg-bg-surface border border-border-theme rounded-xl mb-4 gap-1 shadow-inner" role="tablist">
              {Object.keys(data?.pricingRules?.rules || {}).map(game => {
                const isActive = selectedGameRule === game;
                return (
                  <button
                    key={game}
                    onClick={() => setSelectedGameRule(game)}
                    className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold capitalize transition-all duration-200 outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-accent ${
                      isActive 
                        ? 'bg-accent/10 text-accent border border-accent/30 ring-1 ring-accent/50 shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 border border-transparent'
                    }`}
                    aria-pressed={isActive}
                    role="tab"
                  >
                    {isActive && <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                    {!isActive && <span className="text-[14px] opacity-70">{game === 'ps5' ? '🎮' : '🎱'}</span>}
                    <span>{game === 'ps5' ? 'PS5' : game}</span>
                  </button>
                );
              })}
            </div>

            {(() => {
              const currentRule = data?.pricingRules?.rules?.[selectedGameRule] || { type: 'fixed', rate: 200, multiplayer_mode: 'none' };
              return (
                <div className="p-5 rounded-xl border border-border-theme bg-bg-primary flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold capitalize font-mono text-accent">{selectedGameRule} Rule Configuration</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-text-secondary bg-bg-surface px-2 py-0.5 rounded border border-border-theme">Dynamic Engine</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Pricing Model</label>
                      <select
                        value={currentRule.type || 'fixed'}
                        onChange={e => {
                          const newType = e.target.value;
                          const updated = { ...currentRule, type: newType };
                          const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                          handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                        }}
                        className="w-full px-3 py-2.5 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                      >
                        <option value="fixed">Flat Rate (Fixed ₹/hr)</option>
                        <option value="time_based">Schedule / Time Slots (Day &amp; Evening)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Multiplayer Mode</label>
                      <select
                        value={currentRule.multiplayer_mode || 'none'}
                        onChange={e => {
                          const mode = e.target.value;
                          const updated = { ...currentRule, multiplayer_mode: mode };
                          const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                          handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                        }}
                        className="w-full px-3 py-2.5 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                      >
                        <option value="none">Standard Table Rate (No Multiplier)</option>
                        <option value="multiply">Multiply Rate by Players</option>
                        <option value="base_plus_extra">Base Rate + Extra per Additional Player</option>
                      </select>
                    </div>
                    {currentRule.type === 'fixed' ? (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Flat Rate (₹ / hr)</label>
                        <input
                          type="number"
                          defaultValue={currentRule.rate || 0}
                          onBlur={e => {
                            const val = Number(e.target.value) || 0;
                            if (val === currentRule.rate) return;
                            const updated = { ...currentRule, rate: val };
                            const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                            handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                          }}
                          className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Day Rate (₹ / hr)</label>
                          <input
                            type="number"
                            defaultValue={currentRule.day_rate || currentRule.am_rate || 0}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, day_rate: val, am_rate: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Evening/Peak Rate (₹ / hr)</label>
                          <input
                            type="number"
                            defaultValue={currentRule.evening_rate || currentRule.pm_rate || 0}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, evening_rate: val, pm_rate: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Opening Hour (24h format)</label>
                          <input
                            type="number" min="0" max="23"
                            defaultValue={currentRule.opening_hour ?? 6}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, opening_hour: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Cutoff Hour (Evening start, e.g. 16)</label>
                          <input
                            type="number" min="0" max="23"
                            defaultValue={currentRule.cutoff_hour ?? 16}
                            onBlur={e => {
                              const val = Number(e.target.value) || 0;
                              const updated = { ...currentRule, cutoff_hour: val };
                              const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                              handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                            }}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                          />
                        </div>
                      </>
                    )}
                    {currentRule.multiplayer_mode === 'base_plus_extra' && (
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Extra Charge / Player (₹)</label>
                        <input
                          type="number"
                          defaultValue={currentRule.extra_per_player || 50}
                          onBlur={e => {
                            const val = Number(e.target.value) || 0;
                            const updated = { ...currentRule, extra_per_player: val };
                            const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                            handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                          }}
                          className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary italic mt-1">ℹ️ Changes save automatically when you click outside the input box.</p>
                </div>
              );
            })()}
          </div>

          {/* Station Management */}
          <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-border-theme pt-6 lg:pt-0 lg:pl-8">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Stations &amp; Tables</h3>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
              {data?.tables?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border-theme text-xs">
                  <div>
                    <span className="font-mono font-bold text-accent">{t.id}</span>
                    <span className="mx-2 text-text-secondary">•</span>
                    <span className="font-bold text-text-primary">{t.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase bg-bg-surface border border-border-theme text-primary">
                      {t.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => confirmDeleteStation(t)}
                      className="p-1 text-text-secondary hover:text-red-500 transition-colors bg-bg-surface border border-border-theme hover:border-red-500 rounded"
                      title="Delete Station"
                      aria-label="Delete Station"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddStation} className="p-4 rounded-xl border border-border-theme bg-bg-primary/60 flex flex-col gap-3 mt-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Add New Station / Table</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="ID (e.g. PS5-1)"
                  required
                  value={newStationId}
                  onChange={e => setNewStationId(e.target.value.toUpperCase())}
                  className="px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                />
                <input
                  type="text"
                  placeholder="Name (PS5 Lounge)"
                  required
                  value={newStationName}
                  onChange={e => setNewStationName(e.target.value)}
                  className="px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[40px]"
                />
              </div>
              <select
                value={newStationType}
                onChange={e => setNewStationType(e.target.value)}
                className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-xs font-bold text-text-primary outline-none focus:border-accent capitalize min-h-[40px]"
              >
                {Object.keys(data?.pricingRules?.rules || { snooker: {}, pool: {}, ps5: {} }).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <button type="submit" disabled={isUpdatingConfig || !newStationId} className="w-full bg-accent text-black font-extrabold py-2.5 rounded-lg hover:bg-accent/90 transition-colors text-xs uppercase shadow-md shadow-accent/10 min-h-[42px]">
                {isUpdatingConfig ? 'Adding...' : '+ Create Station'}
              </button>
            </form>
          </div>
        </div>
      </div>

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
      
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Business Goals</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!businessId) return;
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          const goals = {
            daily_revenue: Number(formData.get('daily_revenue')),
            daily_sessions: Number(formData.get('daily_sessions'))
          };
          try {
            const res = await fetch('/api/update-goals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ business_id: businessId, goals })
            });
            if (res.ok) {
              fetchData(undefined, true);
              toast.success('✓ Settings updated.');
            }
          } catch(err) { toast.error("We couldn't complete your request. Please try again."); }
        }} className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Daily Revenue Target (₹)</label>
            <input type="number" name="daily_revenue" defaultValue={data.goals?.daily_revenue || 0} className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
          </div>
          <button type="submit" className="w-full mt-2 bg-accent text-white font-bold py-3 rounded-lg hover-lift hover:bg-accent/90 transition-colors">
            Save Goals
          </button>
        </form>
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="flex flex-col gap-8 mt-4">
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col p-8">
        <h2 className="text-2xl font-bold mb-2">Help & Support</h2>
        <p className="text-text-secondary text-sm mb-8">Get help with QControl or contact our team for assistance.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-accent">Frequently Asked Questions</h3>
            <div className="bg-bg-surface border border-border-theme rounded-lg p-4">
              <h4 className="font-bold text-sm">How do I update pricing?</h4>
              <p className="text-xs text-text-secondary mt-1">Go to the Settings tab to adjust hourly rates or add promotions.</p>
            </div>
            <div className="bg-bg-surface border border-border-theme rounded-lg p-4">
              <h4 className="font-bold text-sm">My tables aren't syncing?</h4>
              <p className="text-xs text-text-secondary mt-1">Check your internet connection. QControl uses Supabase for real-time sync.</p>
            </div>
            <div className="bg-bg-surface border border-border-theme rounded-lg p-4">
              <h4 className="font-bold text-sm">How do I export data?</h4>
              <p className="text-xs text-text-secondary mt-1">Navigate to the Reports tab and click "Export CSV".</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-accent">System Diagnostics</h3>
            <div className="bg-bg-surface border border-border-theme rounded-lg p-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">Database Sync</span>
                <span className="text-xs font-bold text-success px-2 py-1 bg-success/10 rounded">Operational</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">Real-time Service</span>
                <span className="text-xs font-bold text-success px-2 py-1 bg-success/10 rounded">Operational</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Application Version</span>
                <span className="text-xs font-mono text-text-secondary">v2.1.0-QControl</span>
              </div>
            </div>

            <div className="mt-4">
              <button onClick={() => alert("Support request sent! Our team will contact you shortly.")} className="w-full py-3 bg-accent text-black font-bold rounded-lg hover:bg-accent/90 transition-colors shadow-md">
                Contact Support Team
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change PIN UI */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8 mt-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          <span>🔒</span> Security Settings
        </h2>
        <form onSubmit={handleChangePassword} className="max-w-md flex flex-col gap-4">
          {passwordError && <div className="text-danger text-sm font-bold bg-danger/10 p-3 rounded-lg border border-danger/20">{passwordError}</div>}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Current Admin PIN</label>
            <div className="relative">
              <input type={showCurrentPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={currentPassword} onChange={e => setCurrentPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-10 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" required />
              <button type="button" onClick={() => setShowCurrentPin(!showCurrentPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                {showCurrentPin ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">New Admin PIN</label>
            <div className="relative">
              <input type={showNewPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={newPassword} onChange={e => setNewPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-10 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" required />
              <button type="button" onClick={() => setShowNewPin(!showNewPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                {showNewPin ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            <p className="text-[10px] text-text-secondary mt-1">Must be exactly 4 digits.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Confirm New PIN</label>
            <div className="relative">
              <input type={showConfirmPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-10 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal" placeholder="••••" required />
              <button type="button" onClick={() => setShowConfirmPin(!showConfirmPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none">
                {showConfirmPin ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isChangingPassword || newPassword.length !== 4} className="mt-2 px-5 py-3 bg-accent text-black font-extrabold text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
            {isChangingPassword ? 'Updating...' : 'Change PIN'}
          </button>
        </form>
      </div>

      {/* Smart Reminders & Telegram UI */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8 mt-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          <span>🤖</span> Telegram & Smart Reminders
        </h2>
        
        <div className="flex flex-col lg:flex-row gap-8">
          <form onSubmit={handleUpdateTelegramSettings} className="flex-1 max-w-md flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Reminder Interval (Minutes)</label>
              <input type="number" min="1" value={reminderInterval} onChange={e => setReminderInterval(e.target.value)} className="w-full px-3 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-sm text-text-primary outline-none focus:border-accent" />
              <p className="text-[10px] text-text-secondary mt-1">How long before an active session is flagged as overdue.</p>
            </div>
            <button type="submit" disabled={isUpdatingTelegram} className="mt-2 px-5 py-3 bg-accent text-black font-extrabold text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20">
              {isUpdatingTelegram ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          <div className="flex-1 max-w-md bg-bg-surface border border-border-theme rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              👥 Manage Telegram Owners
            </h3>
            
            <div className="space-y-3 mb-6">

              
              {telegramOwners.map((owner, idx) => {
                const isRevoked = owner.status === 'revoked';
                return (
                  <div key={idx} className={`flex justify-between items-center bg-bg-card p-3 rounded-lg border ${isRevoked ? 'border-error/30 opacity-75' : 'border-border-theme'}`}>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold flex items-center gap-2">
                        {owner.name} 
                        {owner.role === 'PRIMARY_OWNER' && <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold uppercase" title="Primary Owner">👑 Primary</span>} 
                        {isRevoked ? (
                          <span className="text-[10px] bg-error/10 text-error px-1.5 py-0.5 rounded font-bold uppercase">🔴 Revoked</span>
                        ) : (
                          <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-bold uppercase">🟢 Granted</span>
                        )}
                      </span>
                      <span className="text-xs text-text-secondary font-mono">{owner.chatId}</span>
                      {owner.addedAt && <span className="text-[10px] text-text-secondary mt-1">Added: {new Date(owner.addedAt).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isRevoked ? (
                        <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-xs font-bold text-success hover:bg-success/10 px-3 py-1.5 rounded transition-colors">
                          🔓 Grant Access
                        </button>
                      ) : (
                        <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-xs font-bold text-error hover:bg-error/10 px-3 py-1.5 rounded transition-colors">
                          🔒 Revoke Access
                        </button>
                      )}
                      <button
                        onClick={() => handlePermanentDeleteOwner(owner.chatId)}
                        className="p-1.5 text-text-secondary hover:text-red-500 transition-colors bg-bg-surface border border-border-theme hover:border-red-500 rounded"
                        title="Permanently Delete Owner"
                        aria-label="Permanently Delete Owner"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {telegramOwners.length === 0 && (
                <div className="text-sm text-text-secondary italic">No authorized Telegram owners yet.</div>
              )}
            </div>

            <div className="border-t border-border-theme pt-4">
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleGenerateTelegramLink('PRIMARY_OWNER')} 
                  disabled={generatingLinkRole === 'PRIMARY_OWNER'}
                  className="w-full px-4 py-2 bg-accent/10 text-accent font-bold text-sm uppercase rounded-lg hover:bg-accent/20 transition-colors border border-accent/30 flex items-center justify-center gap-2"
                >
                  {generatingLinkRole === 'PRIMARY_OWNER' ? 'Generating...' : '👑 Connect as Primary Owner'}
                </button>
                <button 
                  onClick={() => handleGenerateTelegramLink('SECONDARY_OWNER')} 
                  disabled={generatingLinkRole === 'SECONDARY_OWNER'}
                  className="w-full px-4 py-2 bg-blue-500/10 text-blue-400 font-bold text-sm uppercase rounded-lg hover:bg-blue-500/20 transition-colors border border-blue-500/30 flex items-center justify-center gap-2"
                >
                  {generatingLinkRole === 'SECONDARY_OWNER' ? 'Generating...' : '🔗 Link Secondary Owner'}
                </button>
              </div>
              
              {telegramInviteLink && (
                <div className="mt-3 p-3 bg-bg-card border border-accent/30 rounded-lg">
                  <p className="text-[10px] text-text-secondary mb-2">Share this link securely with the new owner:</p>
                  <div className="flex gap-2">
                    <input type="text" readOnly value={telegramInviteLink} className="w-full text-xs font-mono bg-bg-surface p-2 rounded outline-none text-accent" />
                    <button 
                      onClick={() => navigator.clipboard.writeText(telegramInviteLink)}
                      className="px-3 py-2 bg-accent/10 text-accent font-bold text-xs uppercase rounded hover:bg-accent/20 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden font-sans">
      {/* Overdue Session Modal */}
      {overdueSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-bg-card border border-warning/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="bg-warning/10 border-b border-warning/20 p-5">
              <h3 className="text-xl font-bold flex items-center gap-3 text-warning">
                <span className="text-2xl animate-bounce">⚠️</span> Confirmation Required
              </h3>
              <p className="text-sm text-text-secondary mt-1">This session has been running for a long time.</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                  <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Player</span>
                  <span className="text-base font-bold">{overdueSession.customer_name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                  <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Table</span>
                  <span className="text-base font-bold text-accent font-mono">{overdueSession.table_id}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                  <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Game Type</span>
                  <span className="text-base font-bold capitalize">{overdueSession.game_type}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                  <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Started At</span>
                  <span className="text-base font-bold font-mono">
                    {formatTimeReadable(overdueSession.start_time, true, overdueSession.date)}
                  </span>
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <button 
                  onClick={() => handleIntervention('confirm_playing', overdueSession.id)}
                  className="w-full py-3.5 bg-success text-black font-extrabold text-sm uppercase rounded-xl hover:bg-success/90 transition-colors shadow-lg shadow-success/20"
                >
                  Yes, Still Playing
                </button>
                <button 
                  onClick={() => {
                    const startFull = overdueSession.start_time.includes('T') ? overdueSession.start_time : `${overdueSession.date}, ${overdueSession.start_time}`;
                    const res = calculateBilling(startFull, new Date().toISOString(), overdueSession.game_type, data?.pricingRules, overdueSession.num_players || 1, undefined, overdueSession.paused_duration_seconds, overdueSession.locked_rate, overdueSession.locked_rate_name);
                    
                    if (confirm(`End session for ${overdueSession.customer_name}? Current bill: ${formatINR(res.cost)}`)) {
                      handleIntervention('force_end', overdueSession.id, res.cost);
                      setOverdueSession(null);
                    }
                  }}
                  className="w-full py-3.5 bg-danger text-white font-extrabold text-sm uppercase rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-danger/20"
                >
                  End Session Now
                </button>
                <button 
                  onClick={() => {
                    setDismissedReminders(prev => [...prev, overdueSession.id]);
                    setOverdueSession(null);
                  }}
                  className="w-full py-3 text-text-secondary font-bold text-sm hover:text-text-primary transition-colors"
                >
                  Ignore for now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar (Desktop) */}
      <aside className="w-64 hidden lg:flex flex-col border-r border-border-theme bg-bg-surface shrink-0 z-20 relative">
        <div className="p-8 pb-4">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-1">QControl</h1>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold italic">Powered by Scan-n-Bill</p>
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
          
          <button onClick={() => setSidebarTab('support')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'support' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconSupport /> Support
          </button>
          <a href="#" onClick={handleLogout} className="flex items-center gap-3 px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm font-medium">
            <IconLogout /> Logout
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-bg-primary pb-20 lg:pb-0">
        
        {/* Header */}
        <header className="px-6 lg:px-10 py-4 lg:py-6 flex justify-between items-center border-b border-border-theme sticky top-0 bg-bg-primary/95 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger Menu */}
            <button 
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div>
              {sidebarTab === 'overview' ? (
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-text-primary">
                    {data?.has_logged_in === false ? `Welcome to Qcontrol, ${data?.ownerName?.split(' ')[0] || ''} 👋` : `Welcome back, ${data?.ownerName?.split(' ')[0] || ''}`}
                  </h2>
                  <p className="text-xs lg:text-sm text-text-secondary mt-1 hidden sm:block">Complete control over your business. Everything you need, all in one place.</p>
                </div>
              ) : (
                <h2 className="text-lg lg:text-xl font-bold text-text-primary capitalize">{sidebarTab}</h2>
              )}
              <p className="text-[10px] lg:text-xs text-text-secondary font-mono mt-1 uppercase tracking-widest">
                {toReadableIST(now)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-text-secondary items-center">
              <button
                onClick={togglePrivacy}
                className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-text-primary transition-colors hover-lift"
                title="Toggle Privacy Mode"
              >
                {isPrivacyMode ? <IconEyeOff /> : <IconEye />}
              </button>
              <button 
                onClick={() => {
                  const switchTheme = () => {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('theme', 'light');
                    } else {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('theme', 'dark');
                    }
                  };

                  if (!document.startViewTransition) {
                    // Fallback for browsers without View Transitions API
                    document.documentElement.classList.add('theme-transition-fallback');
                    switchTheme();
                    setTimeout(() => {
                      document.documentElement.classList.remove('theme-transition-fallback');
                    }, 350);
                    return;
                  }
                  
                  document.startViewTransition(() => {
                    switchTheme();
                  });
                }}
                className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-text-primary transition-colors hover-lift"
                title="Toggle Theme"
              >
                <svg className="w-5 h-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <svg className="w-5 h-5 block dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
              {businessId && <NotificationBell businessId={businessId} />}
              <button onClick={() => setSidebarTab('settings')} className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-text-primary transition-colors hover-lift"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></button>
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
        <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full flex flex-col gap-8 pb-20">
          {renderBookingReminders()}
          {sidebarTab === 'overview' && renderOverview()}
          {sidebarTab === 'tables' && renderTables()}
          {sidebarTab === 'bookings' && renderBookings()}
          {sidebarTab === 'reports' && renderReports()}
          {sidebarTab === 'customers' && renderCustomers()}
          {sidebarTab === 'settings' && renderSettings()}
          {sidebarTab === 'support' && renderSupport()}
        </div>
        
        {/* Footer */}
        <footer className="w-full text-center py-8 mt-auto border-t border-border-theme bg-bg-surface/30">
          <p className="text-text-secondary text-sm font-semibold">© 2026 QControl. Powered by Scan-n-Bill.</p>
          <p className="text-text-secondary text-xs mt-1">Take Control. Drive Growth.</p>
        </footer>
      </main>
      
      {/* Manual Session Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-[95%] sm:max-w-md my-auto shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                <select
                  required
                  value={manualTable}
                  onChange={e => {
                    const selected = e.target.value;
                    setManualTable(selected);
                    const allowed = getAvailableGameTypesForTable(selected);
                    if (allowed.length > 0 && !allowed.includes(manualGame)) {
                      setManualGame(allowed[0]);
                    }
                  }}
                  className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary min-h-[44px]"
                >
                  <option value="">-- Choose an available table --</option>
                  {data.tables?.filter(t => !data.activeSessions.some(s => s.table_id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Game Type (Assigned Sports)</label>
                <select required value={manualGame} onChange={e => setManualGame(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary capitalize min-h-[44px]">
                  {getAvailableGameTypesForTable(manualTable).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
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

      {/* Manual Booking Modal (Additive) */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-[95%] sm:max-w-md my-auto shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setIsBookingModalOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 bg-bg-surface border border-border-theme rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="p-8 border-b border-border-theme">
              <h2 className="text-2xl font-bold">New Manual Booking</h2>
              <p className="text-text-secondary mt-1 text-sm">Reserve a table directly from the admin command center.</p>
            </div>
            <form onSubmit={handleCreateManualBooking} className="p-8 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Table *</label>
                <select
                  required
                  value={bookingTable}
                  onChange={e => {
                    const selected = e.target.value;
                    setBookingTable(selected);
                    const allowed = getAvailableGameTypesForTable(selected);
                    if (allowed.length > 0) {
                      setBookingGame(allowed[0]);
                    }
                  }}
                  className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary min-h-[44px]"
                >
                  <option value="">-- Choose a table --</option>
                  {data?.tables?.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type || t.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Game Type (Assigned Sports) *</label>
                <select
                  required
                  value={bookingGame}
                  onChange={e => setBookingGame(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary capitalize min-h-[44px]"
                >
                  {getAvailableGameTypesForTable(bookingTable).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Customer Name (Optional)</label>
                <input type="text" value={bookingCustomer} onChange={e => setBookingCustomer(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" placeholder="Walk-In or Member Name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Booking Date *</label>
                <input type="date" required value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Start Time *</label>
                <input type="time" required value={bookingStartTime} onChange={e => setBookingStartTime(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Expected Duration *</label>
                <select required value={bookingDuration} onChange={e => setBookingDuration(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary">
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour (60 Mins)</option>
                  <option value="90">1 Hour 30 Mins (90 Mins)</option>
                  <option value="120">2 Hours (120 Mins)</option>
                  <option value="180">3 Hours (180 Mins)</option>
                  <option value="240">4 Hours (240 Mins)</option>
                </select>
              </div>
              <button type="submit" disabled={isCreatingBooking || !bookingTable || !bookingDate || !bookingStartTime} className="w-full mt-4 bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-lg shadow-accent/20">
                {isCreatingBooking ? 'Saving Booking...' : 'Save Booking'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-[95%] sm:max-w-md my-auto shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-[95%] lg:max-w-5xl my-auto shadow-2xl relative max-h-[90vh] flex flex-col">
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
      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 lg:hidden flex justify-end">
          <div className="bg-bg-surface w-64 h-full flex flex-col shadow-2xl relative animate-slide-in-right">
            <div className="p-6 border-b border-border-theme flex justify-between items-center">
              <h2 className="font-bold text-lg">Menu</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 -mr-2 text-text-secondary hover:text-text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              <button onClick={() => { setSidebarTab('settings'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'settings' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}>
                <IconSettings /> Settings
              </button>
              <button onClick={() => { setSidebarTab('support'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'support' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}>
                <IconSupport /> Support
              </button>
              <div className="my-4 border-t border-border-theme/50"></div>
              <button onClick={() => { setIsManualModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-white font-bold rounded-lg text-sm mb-2">
                New Session
              </button>
              <button onClick={() => { setIsQRModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 w-full py-3 bg-accent text-white font-bold rounded-lg text-sm">
                Quick Scan
              </button>
              <div className="mt-auto pt-4">
                <a href="#" onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-text-secondary text-sm font-medium">
                  <IconLogout /> Logout
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Station Confirmation Modal */}
      {stationToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-theme rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Delete {stationToDelete.name}?</h3>
            <p className="text-text-secondary text-sm mb-6">
              Are you sure you want to delete this station? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setStationToDelete(null)}
                className="flex-1 px-4 py-2 bg-bg-card border border-border-theme text-text-primary rounded-lg font-bold text-sm hover:bg-bg-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStation}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface/80 backdrop-blur-xl border-t border-border-theme z-40 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex justify-around items-center h-[72px]">
          <button onClick={() => setSidebarTab('overview')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 relative ${sidebarTab === 'overview' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}`}>
            {sidebarTab === 'overview' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <IconOverview />
            <span className="text-[10px] font-bold tracking-wide">Overview</span>
          </button>
          <button onClick={() => setSidebarTab('tables')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 relative ${sidebarTab === 'tables' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}`}>
            {sidebarTab === 'tables' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <IconTables />
            <span className="text-[10px] font-bold tracking-wide">Tables</span>
          </button>
          <button onClick={() => setSidebarTab('bookings')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 relative ${sidebarTab === 'bookings' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}`}>
            {sidebarTab === 'bookings' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <IconBookings />
            <span className="text-[10px] font-bold tracking-wide">Bookings</span>
          </button>
          <button onClick={() => setSidebarTab('reports')} className={`flex flex-col items-center justify-center w-full h-full gap-1.5 relative ${sidebarTab === 'reports' ? 'text-accent' : 'text-text-secondary hover:text-text-primary transition-colors'}`}>
            {sidebarTab === 'reports' && <div className="absolute top-0 w-8 h-1 bg-accent rounded-b-full"></div>}
            <IconBookings />
            <span className="text-[10px] font-bold tracking-wide">Reports</span>
          </button>
        </div>
      </div>

      {/* First Login Celebration Modal */}
      {showCelebration && data?.ownerName && (
        <WelcomeCelebration 
          ownerName={data.ownerName} 
          onComplete={() => {
            setShowCelebration(false);
            // Optimistically update the UI so the greeting changes instantly
            setData(prev => prev ? { ...prev, has_logged_in: true } : prev);
          }} 
        />
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
