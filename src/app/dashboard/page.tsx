
'use client';

import { useEffect, useState, Suspense, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { calculateBilling, parseDateString, formatTimeReadable } from '@/lib/billing';
import { MenuManagerTab } from './MenuManagerTab';
import { createClient } from '@supabase/supabase-js';
import { NotificationBell, LiveTotalOpenCounter, LivePromoTimer, LiveSessionRow, PrivacyText, Tooltip, CustomSelect, TimePicker } from './components';
import WelcomeCelebration from './WelcomeCelebration';
import { toast } from 'react-hot-toast';
import QKhataTab from './QKhataTab';
import PaymentsTab from './PaymentsTab';
import MessagingTab from './MessagingTab';
import QpulseWidget from '@/components/QpulseWidget';
import AIAssistantWidget from '@/components/AIAssistantWidget';

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
const IconMenu = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>;
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

  const [data, setData] = useState<{ activeSessions: SessionData[], completedSessions: SessionData[], dailyRevenue: number, todayStr: string, pricingRules?: any, tables?: any[], activeDiscounts?: Record<string, { percent: number; applyToFood: boolean }>, manualClosuresToday?: number, revenueSavedToday?: number, bookings?: any[], activePromotions?: ActivePromotion[], businessName?: string, ownerName?: string, has_logged_in?: boolean, goals?: any, google_sheet_id?: string, dbCustomers?: any[], whatsapp_config?: { enabled: boolean }, sms_config?: { enabled: boolean, provider: string, authKey: string, senderId: string }, menu_items?: any[] } | null>(null);
  const [reportsData, setReportsData] = useState<{ completedSessions: SessionData[], dailyRevenue: number, manualClosuresToday?: number, revenueSavedToday?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const [enteredPin, setEnteredPin] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [pinError, setPinError] = useState('');

  const now = new Date(); // Evaluated fresh on every render

  // UI State
  const [sidebarTab, _setSidebarTab] = useState<'overview' | 'tables' | 'bookings' | 'reports' | 'customers' | 'settings' | 'support' | 'qkhata' | 'payments' | 'messaging' | 'menu'>('overview');
  
  const setSidebarTab = (tab: any) => {
    _setSidebarTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as any;
      const validTabs = ['overview', 'tables', 'bookings', 'reports', 'customers', 'settings', 'support', 'qkhata', 'payments', 'messaging', 'menu'];
      if (validTabs.includes(hash)) {
        _setSidebarTab(hash);
      }
    };
    if (typeof window !== 'undefined' && window.location.hash) {
      handleHashChange();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handleHashChange);
      return () => window.removeEventListener('hashchange', handleHashChange);
    }
  }, []);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeBoardTab, setActiveBoardTab] = useState<'active' | 'history'>('active');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isClosingManual, setIsClosingManual] = useState(false);
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualCustomerId, setManualCustomerId] = useState<string | null>(null);
  const [manualTable, setManualTable] = useState('');
  const [manualGame, setManualGame] = useState('pool');
  const [manualPlayers, setManualPlayers] = useState('1');
  const [manualNotes, setManualNotes] = useState('');
  const [manualStartTime, setManualStartTime] = useState('');
  const [isStartingManual, setIsStartingManual] = useState(false);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [showQkhataPopover, setShowQkhataPopover] = useState(false);
  const [qkhataSearch, setQkhataSearch] = useState('');
  const [selectedQkhataMember, setSelectedQkhataMember] = useState<any>(null);

  const getDisplayName = (rawName: string, memberId?: string) => {
    if (memberId && memberships) {
      const qkMember = memberships.find((m: any) => m.id === memberId);
      if (qkMember) return qkMember.name;
    }
    if (!rawName) return 'Guest';
    if (!data?.dbCustomers) return rawName;
    const member = data.dbCustomers.find((c: any) => c.phone === rawName || c.name.toLowerCase() === rawName.toLowerCase());
    return member ? member.name : rawName;
  };

  const qkhataMembers = useMemo(() => {
    if (!memberships) return [];
    
    const balanceMap = new Map();
    if (data?.dbCustomers) {
      data.dbCustomers.forEach((c: any) => {
        if (c.phone) {
          const norm = c.phone.replace('+91', '').trim();
          balanceMap.set(norm, c.outstanding_balance || 0);
        }
      });
    }

    return memberships.map((m: any) => {
      const norm = m.mobile ? m.mobile.replace('+91', '').trim() : '';
      return {
        id: m.id,
        name: m.name,
        phone: m.mobile,
        outstanding_balance: balanceMap.get(norm) || 0
      };
    });
  }, [memberships, data]);

  const filteredQkhataMembers = useMemo(() => {
    return qkhataMembers.filter(m => 
      m.name.toLowerCase().includes(qkhataSearch.toLowerCase()) || 
      (m.phone && m.phone.includes(qkhataSearch))
    );
  }, [qkhataMembers, qkhataSearch]);
  const [isMembershipsLoading, setIsMembershipsLoading] = useState(false);
  const [selectedBulkSmsCustomers, setSelectedBulkSmsCustomers] = useState<string[]>([]);
  const [showBulkSmsModal, setShowBulkSmsModal] = useState(false);
  const [bulkSmsMessage, setBulkSmsMessage] = useState('');
  const [bulkSmsTemplateId, setBulkSmsTemplateId] = useState('promotional_v1');
  const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', mobile: '', email: '', tier: 'VIP', duration: '12' });
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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
  const [isUpdatingGoals, setIsUpdatingGoals] = useState(false);

  // WhatsApp Connect State
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [isConnectingWa, setIsConnectingWa] = useState(false);
  const [smsAuthKey, setSmsAuthKey] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [smsProvider, setSmsProvider] = useState('msg91');
  const [isConnectingSms, setIsConnectingSms] = useState(false);

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
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [endSessionData, setEndSessionData] = useState<{ session: any, cost: number, duration?: string, amountReceived: string, paymentMode: 'now' | 'credit', dueDate: string } | null>(null);

  // Happy Hour States
  const [selectedTable, setSelectedTable] = useState('');
  const [discountPercent, setDiscountPercent] = useState('40');
  const [applyToFood, setApplyToFood] = useState(false);
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);

  // Privacy Mode State
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('privacy_mode');
    if (saved === 'true') setTimeout(() => setIsPrivacyMode(true), 0);
  }, []);

  const togglePrivacy = () => {
    const newVal = !isPrivacyMode;
    setIsPrivacyMode(newVal);
    localStorage.setItem('privacy_mode', String(newVal));
  };

  // Report Date Filter State
  const getLocalDateStr = (d = new Date()) => {
    const dCopy = new Date(d.getTime());
    const year = dCopy.getFullYear();
    const month = String(dCopy.getMonth() + 1).padStart(2, '0');
    const day = String(dCopy.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [currentDay, setCurrentDay] = useState(getLocalDateStr());
  const [reportDateRange, setReportDateRange] = useState({ start: currentDay, end: currentDay });

  // Manual Booking State (Additive)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isClosingBooking, setIsClosingBooking] = useState(false);
  const [bookingTable, setBookingTable] = useState('');
  const [bookingCustomer, setBookingCustomer] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingDate, setBookingDate] = useState(getLocalDateStr());
  const [bookingStartTime, setBookingStartTime] = useState('');
  const [bookingDuration, setBookingDuration] = useState('60');
  const [bookingGame, setBookingGame] = useState('pool');
  const [bookingPlayers, setBookingPlayers] = useState('1');
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

  const [isReportsLoading, setIsReportsLoading] = useState(false);

  // Deduplication ref for active fetches to avoid redundant network calls
  const activeFetch = useRef<{ url: string, promise: Promise<any> } | null>(null);

  const fetchDashboardData = useCallback(async (targetStartDate: string, targetEndDate: string, isBackground = false) => {
    try {
      if (!isBackground) {
         if (targetStartDate === currentDay && targetEndDate === currentDay) setLoading(true);
         else setIsReportsLoading(true);
      }

      let url = businessId ? `/api/dashboard-data?b=${businessId}` : '/api/dashboard-data';
      url += (url.includes('?') ? '&' : '?') + `startDate=${targetStartDate}&endDate=${targetEndDate}`;

      // Deduplicate identical in-flight requests
      if (activeFetch.current && activeFetch.current.url === url) {
         await activeFetch.current.promise;
         return;
      }

      const fetchPromise = fetch(url, { cache: 'no-store' });
      activeFetch.current = { url, promise: fetchPromise };
      const res = await fetchPromise;

      if (res.status === 401) {
        setIsAuthorized(false);
        setLoading(false);
        setIsReportsLoading(false);
        return;
      }

      if (res.ok) {
        const json = await res.json();
        
        // If this fetch was for the current day, update the main dashboard data
        if (targetStartDate === currentDay && targetEndDate === currentDay) {
          setData(json);
          if (json.businessId) setBusinessId(json.businessId);
          setIsAuthorized(true);
          if (json.has_logged_in === false) {
            setShowCelebration(prev => !prev ? true : prev);
          }
        }
        
        // Update reports explicitly
        if (targetStartDate === reportDateRange.start && targetEndDate === reportDateRange.end) {
          setReportsData(json);
        }
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
      if (!isBackground) toast.error('Network error. Unable to fetch dashboard data.');
    } finally {
      const activeUrl = activeFetch.current?.url;
      if (activeUrl && activeUrl.includes(`startDate=${targetStartDate}&endDate=${targetEndDate}`)) {
         activeFetch.current = null;
      }
      if (!isBackground) {
         setLoading(false);
         setIsReportsLoading(false);
      }
    }
  }, [businessId, currentDay, reportDateRange.start, reportDateRange.end]);

  const fetchData = useCallback(async (pinToUse?: string, isBackground = false) => {
    return fetchDashboardData(currentDay, currentDay, isBackground);
  }, [fetchDashboardData, currentDay]);

  // Initial load check
  useEffect(() => {
    if (!isAuthorized) {
      fetchDashboardData(currentDay, currentDay).finally(() => setIsInitialLoading(false));
    } else {
      setTimeout(() => setIsInitialLoading(false), 0);
    }
  }, [isAuthorized, currentDay, fetchDashboardData]);

  // React to explicit report date changes
  const lastReportDates = useRef({ start: reportDateRange.start, end: reportDateRange.end });
  useEffect(() => {
    if (!isAuthorized) return;
    if (lastReportDates.current.start !== reportDateRange.start || lastReportDates.current.end !== reportDateRange.end) {
      lastReportDates.current = { start: reportDateRange.start, end: reportDateRange.end };
      setReportsData(null); // Clear stale data instantly
      fetchDashboardData(reportDateRange.start, reportDateRange.end);
    }
  }, [reportDateRange.start, reportDateRange.end, isAuthorized, fetchDashboardData]);

  useEffect(() => {
    if (data && !telegramLoadedRef.current) {
      telegramLoadedRef.current = true;
      if (data.pricingRules?.globalSettings) {
        setTimeout(() => setTelegramOwners(data.pricingRules.globalSettings.authorized_telegram_owners || []), 0);
        if (data.pricingRules.globalSettings.smart_reminder_interval_minutes !== undefined) {
          setTimeout(() => setReminderInterval(String(data.pricingRules.globalSettings.smart_reminder_interval_minutes)), 0);
        }
      }
    }
  }, [data]);

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

  const overdueDepsRef = useRef({ data, dismissedReminders, overdueSession });
  useEffect(() => {
    overdueDepsRef.current = { data, dismissedReminders, overdueSession };
  }, [data, dismissedReminders, overdueSession]);

  useEffect(() => {
    if (!isAuthorized) return;
    
    const checkOverdue = () => {
      const currentDeps = overdueDepsRef.current;
      if (!currentDeps.data || !currentDeps.data.activeSessions) return;

      const intervalVal = currentDeps.data.pricingRules?.globalSettings?.smart_reminder_interval_minutes;
      const intervalMins = intervalVal !== undefined ? intervalVal : 60;
      
      if (intervalMins === 0) {
        if (currentDeps.overdueSession) setOverdueSession(null);
        return;
      }
      
      const now = new Date().getTime();
      
      const found = currentDeps.data.activeSessions.find((session: any) => {
        if (session.paused_at) return false;
        if (currentDeps.dismissedReminders.includes(session.id)) return false;
        
        const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        const lastCheckedStr = session.last_checked_at || session.last_activity_at || startFull;
        const lastCheckedAt = new Date(lastCheckedStr).getTime();
        const mins = (now - lastCheckedAt) / 60000;
        
        return mins >= intervalMins;
      });
      
      if (found && (!currentDeps.overdueSession || currentDeps.overdueSession.id !== found.id)) {
        setOverdueSession(found);
      } else if (!found && currentDeps.overdueSession) {
        setOverdueSession(null);
      }
    };
    
    checkOverdue();
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      // Setup Supabase Realtime for targeted state updates (No polling)
      let subscription: any = null;
      if (supabase && businessId) {
        subscription = supabase.channel('dashboard_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `business_id=eq.${businessId}` }, async (payload) => {
             if (payload.eventType === 'DELETE') {
                 setData(prev => {
                    if (!prev) return prev;
                    return { ...prev, activeSessions: prev.activeSessions.filter((x: any) => x.id !== payload.old.id) };
                 });
                 return;
             }
             
             const fullSession = payload.new as any;
             if (!fullSession || !fullSession.id) return;
             
             setData(prev => {
                if (!prev) return prev;
                const newData = { ...prev };
                
                if (payload.eventType === 'INSERT' && fullSession.status === 'ACTIVE') {
                   if (!newData.activeSessions.some((x: any) => x.id === fullSession.id)) {
                       newData.activeSessions = [...newData.activeSessions, fullSession];
                   }
                } else if (payload.eventType === 'UPDATE') {
                   if (fullSession.status === 'COMPLETED') {
                       newData.activeSessions = newData.activeSessions.filter((x: any) => x.id !== fullSession.id);
                       if (!newData.completedSessions.some((x: any) => x.id === fullSession.id)) {
                           newData.completedSessions = [fullSession, ...newData.completedSessions];
                           newData.dailyRevenue += (fullSession.cost || 0);
                       }
                   } else if (fullSession.status === 'ACTIVE') {
                       const idx = newData.activeSessions.findIndex((x: any) => x.id === fullSession.id);
                       if (idx > -1) {
                           newData.activeSessions[idx] = fullSession;
                           newData.activeSessions = [...newData.activeSessions];
                       } else {
                           newData.activeSessions = [...newData.activeSessions, fullSession];
                       }
                   }
                }
                return newData;
             });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `business_id=eq.${businessId}` }, async (payload) => {
             if (payload.eventType === 'DELETE') {
                 setData(prev => {
                    if (!prev) return prev;
                    return { ...prev, bookings: (prev.bookings || []).filter((x: any) => x.id !== payload.old.id) };
                 });
                 return;
             }

             const fullBooking = payload.new as any;
             if (!fullBooking || !fullBooking.id) return;

             setData(prev => {
                if (!prev) return prev;
                const newData = { ...prev };
                if (!newData.bookings) newData.bookings = [];
                
                if (payload.eventType === 'INSERT') {
                   if (!newData.bookings.some((x: any) => x.id === fullBooking.id)) {
                       newData.bookings = [...newData.bookings, fullBooking];
                   }
                } else if (payload.eventType === 'UPDATE') {
                   const idx = newData.bookings.findIndex((x: any) => x.id === fullBooking.id);
                   if (idx > -1) {
                       newData.bookings[idx] = fullBooking;
                       newData.bookings = [...newData.bookings];
                   } else {
                       newData.bookings = [...newData.bookings, fullBooking];
                   }
                }
                return newData;
             });
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${businessId}` }, (payload) => {
             const updatedBusiness = payload.new as any;
             setData(prev => {
                if (!prev) return prev;
                return { 
                  ...prev, 
                  goals: updatedBusiness.goals || prev.goals,
                  whatsapp_config: updatedBusiness.whatsapp_config || prev.whatsapp_config,
                  sms_config: updatedBusiness.sms_config || prev.sms_config,
                  businessName: updatedBusiness.business_name || prev.businessName
                };
             });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${businessId}` }, (payload) => {
             setData(prev => {
                if (!prev) return prev;
                const newData = { ...prev };
                if (!newData.dbCustomers) newData.dbCustomers = [];
                
                if (payload.eventType === 'DELETE') {
                   newData.dbCustomers = newData.dbCustomers.filter((x: any) => x.id !== payload.old.id);
                } else if (payload.eventType === 'INSERT') {
                   if (!newData.dbCustomers.some((x: any) => x.id === payload.new.id)) {
                       newData.dbCustomers = [...newData.dbCustomers, payload.new];
                   }
                } else if (payload.eventType === 'UPDATE') {
                   const idx = newData.dbCustomers.findIndex((x: any) => x.id === payload.new.id);
                   if (idx > -1) {
                       newData.dbCustomers[idx] = payload.new;
                       newData.dbCustomers = [...newData.dbCustomers];
                   } else {
                       newData.dbCustomers = [...newData.dbCustomers, payload.new];
                   }
                }
                return newData;
             });
          })
          .subscribe();
      }
      
      return () => {
        if (subscription && supabase) supabase.removeChannel(subscription);
      };
    }
  }, [isAuthorized, businessId]);

  const handleIntervention = async (action: string, sessionId: string, amountRecovered?: number, transferTableId?: string, paymentMethod?: string, dueDate?: string) => {
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
        body: JSON.stringify({ action, session_id: sessionId, business_id: businessId, amount_recovered: amountRecovered, transfer_table_id: transferTableId, payment_method: paymentMethod, due_date: dueDate })
      });
      if (res.ok) {
        if (action === 'confirm_playing') {
          setOverdueSession(null);
        }
        // fetchData removed; Realtime updates sessions
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
        // fetchData removed
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
        setData(prev => prev ? {
          ...prev, 
          bookings: prev.bookings?.map(b => b.id === bookingId ? { ...b, status } : b)
        } : prev);
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
        body: JSON.stringify({ 
          table_id: manualTable, 
          game_type: manualGame, 
          num_players: Number(manualPlayers), 
          customer_name: manualCustomer, 
          business_id: businessId, 
          notes: manualNotes, 
          member_id: manualCustomerId,
          start_time: manualStartTime ? new Date(manualStartTime).toISOString() : undefined
        })
      });
      if (res.ok) {
        const result = await res.json();
        setData(prev => {
          if (!prev) return prev;
          const exists = prev.activeSessions.some(s => s.id === result.id);
          return {
            ...prev,
            activeSessions: exists ? prev.activeSessions.map(s => s.id === result.id ? result : s) : [...prev.activeSessions, result]
          };
        });
        toast.success('✓ Session created successfully.');
        setIsClosingManual(true);
        setTimeout(() => {
          setIsManualModalOpen(false);
          setSelectedQkhataMember(null);
          setShowQkhataPopover(false);
          setQkhataSearch('');
          setIsClosingManual(false);
          setManualTable('');
          setManualCustomer('');
          setManualCustomerId(null);
          setManualNotes('');
          setManualStartTime('');
          setManualPlayers('1');
        }, 250);
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
        setData(prev => prev ? {
          ...prev,
          pricingRules: newRules !== undefined ? newRules : prev.pricingRules,
          tables: newTables !== undefined ? newTables : prev.tables
        } : prev);
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
                    Table <strong className="text-text-primary font-mono">{assignedTable?.name || booking.table_id} ({booking.table_id})</strong> is reserved for <strong className="text-text-primary">{getDisplayName(booking.customer_name, (booking as any).member_id) || 'Guest'}</strong> at <strong className="text-accent font-mono">{formatTimeReadable(booking.start_time, true, booking.booking_date)}</strong>.
                  </p>
                  {isOccupied && (
                    <p className="text-xs font-bold text-danger mt-2 flex items-center gap-1.5 bg-danger/10 px-2.5 py-1 rounded border border-danger/30 w-fit">
                      Warning: Table {booking.table_id} is currently occupied! A reserved booking is waiting to start.
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
    setBookingError('');
    if (!bookingTable || !bookingDate || !bookingStartTime || !businessId || !bookingGame) {
      setBookingError('Please fill in all required fields (Table, Date, Time, Game Type).');
      return;
    }
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
          game_type: bookingGame,
          num_players: Number(bookingPlayers)
        })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setData(prev => {
          if (!prev) return prev;
          const bookings = prev.bookings || [];
          const exists = bookings.some(b => b.id === result.booking.id);
          return {
            ...prev,
            bookings: exists ? bookings.map(b => b.id === result.booking.id ? result.booking : b) : [...bookings, result.booking]
          };
        });
        toast.success('✓ Manual booking created.');
        setIsClosingBooking(true);
        setTimeout(() => {
          setIsBookingModalOpen(false);
          setIsClosingBooking(false);
          setBookingTable('');
          setBookingCustomer('');
          setBookingStartTime('');
          setBookingDate(getLocalDateStr());
          setBookingDuration('60');
          setBookingPlayers('1');
        }, 200);
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
    if (isCreatingMember) return;
    setIsCreatingMember(true);
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
    } finally {
      setIsCreatingMember(false);
    }
  };

  const handleDeleteMembership = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the customer profile for ${name}? Historical data will not be deleted.`)) return;
    try {
      const res = await fetch('/api/memberships', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast.success(`✓ Customer profile for ${name} deleted.`);
        fetchMemberships();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete membership.");
      }
    } catch (err: any) {
      toast.error("We couldn't delete the membership. Please try again.");
    }
  };


  useEffect(() => {
    if (isAuthorized) {
      setTimeout(() => fetchMemberships(), 0);
    }
  }, [isAuthorized]);

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
        // fetchData removed
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

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    setEnteredPin('');
    
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    }
    
    // Hard redirect to clear all frontend state and go to landing page
    window.location.replace('/');
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
        // fetchData removed; relying on session realtime update
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
        // fetchData removed
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
        // Optimistic update for promo
        setData(prev => prev ? {
          ...prev,
          activePromotions: [{ id: 'temp-promo', name: promoTitle, discount_percent: Number(promoDiscount), end_time: new Date(Date.now() + Number(promoDurationHours)*3600000).toISOString(), status: 'Active' }]
        } : prev);
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
        setData(prev => prev ? { ...prev, activePromotions: [] } : prev);
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
      const confirm = window.confirm(`Revoke Telegram Access?\n\nThis user will no longer be able to use this business through the Telegram bot.`);
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

    const confirm = window.confirm(`Permanently Delete Owner?\n\nThis will permanently remove this owner from this business and cannot be undone.`);
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
  const isPromoValid = !!(activePromo && new Date(activePromo.end_time).getTime() > now.getTime());

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
          <QpulseWidget onNavigate={(tab) => setSidebarTab(tab as any)} />
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
            <span className="text-xs sm:text-sm font-semibold text-accent mb-0.5 sm:mb-1">+12.4%</span>
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
              <p className="text-[10px] text-success text-right mt-1 font-bold">Daily target achieved!</p>
            )}
          </div>
        </div>

        {/* Active Tables Card */}
        <div 
          onClick={() => setSidebarTab('tables')}
          className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300 cursor-pointer hover:border-accent/50"
        >
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
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{getDisplayName(booking.customer_name, (booking as any).member_id)}</p>
                        {booking.source === 'whatsapp' && <span className="text-[8px] font-bold uppercase tracking-wider text-[#25D366] bg-[#25D366]/10 px-1.5 py-0.5 rounded border border-[#25D366]/20 flex-shrink-0">WhatsApp AI</span>}
                        {booking.source === 'telegram' && <span className="text-[8px] font-bold uppercase tracking-wider text-[#0088cc] bg-[#0088cc]/10 px-1.5 py-0.5 rounded border border-[#0088cc]/20 flex-shrink-0">Telegram AI</span>}
                      </div>
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
  const generateTimeSlots = () => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m of [0, 30]) {
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  };

  const isSlotOccupied = (slot: string) => {
    if (!bookingTable || !bookingDate) return false;
    
    const todayStr = getLocalDateStr();
    const [sh, sm] = slot.split(':').map(Number);
    const slotMins = sh * 60 + sm;
    const slotEndMins = slotMins + (Number(bookingDuration) || 60);

    if (bookingDate === todayStr) {
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      if (sh < currentH || (sh === currentH && sm < currentM)) {
        return true; 
      }
    }

    const bookingsOnDate = data?.bookings?.filter((b: any) => b.booking_date === bookingDate && b.table_id === bookingTable && b.status === 'confirmed') || [];
    
    for (const b of bookingsOnDate) {
      const [bh, bm] = b.start_time.split(':').map(Number);
      const bStartMins = bh * 60 + bm;
      const bEndMins = bStartMins + (b.duration_minutes || 60);
      
      if (slotMins < bEndMins && slotEndMins > bStartMins) {
        return true; 
      }
    }

    if (bookingDate === todayStr) {
       const activeSession = data?.activeSessions?.find((s: any) => s.table_id === bookingTable && s.status === 'ACTIVE');
       if (activeSession) {
          const [ah, am] = (activeSession.start_time || `${new Date().getHours()}:${new Date().getMinutes()}`).split(':').map(Number);
          const aStartMins = ah * 60 + am;
          const aEndMins = aStartMins + 60; 
          if (slotMins < aEndMins && slotEndMins > aStartMins) {
             return true;
          }
       }
    }

    return false;
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
                onClick={() => {
                  const now = new Date();
                  let m = now.getMinutes();
                  let h = now.getHours();
                  if (m > 30) { m = 0; h = (h + 1) % 24; }
                  else if (m > 0) { m = 30; }
                  setBookingDate(getLocalDateStr());
                  setBookingStartTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                  setBookingTable('');
                  setBookingCustomer('');
                  setBookingDuration('60');
                  setBookingPlayers('1');
                  setBookingError('');
                  setIsBookingModalOpen(true);
                }}
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
                  (data.bookings || []).map((booking: any) => {
                    const isOccupied = data.activeSessions?.some((s: any) => s.table_id === booking.table_id && s.status === 'ACTIVE');
                    return (
                    <tr key={booking.id} className="border-b border-border-theme/50 hover:bg-bg-surface transition-all duration-200 group">
                      <td className="p-4 md:p-5">
                        <p className="text-base font-bold text-text-primary">{getDisplayName(booking.customer_name, (booking as any).member_id)}</p>
                        {booking.source === 'whatsapp' && <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full border border-[#25D366]/20">WhatsApp AI</span>}
                        {booking.source === 'telegram' && <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0088cc] bg-[#0088cc]/10 px-2 py-0.5 rounded-full border border-[#0088cc]/20">Telegram AI</span>}
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
                        {booking.status === 'no_show' && <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-orange-500/50 text-orange-600 bg-orange-500/10 uppercase shadow-sm">No Show</span>}
                      </td>
                      <td className="p-4 md:p-5 text-right">
                        {booking.status === 'confirmed' && (
                          <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                            <Tooltip text="Mark as No Show">
                              <button onClick={() => handleUpdateBookingStatus(booking.id, 'no_show')} className="px-4 py-2 text-sm font-bold text-orange-600 border border-orange-500/30 rounded-lg hover:bg-orange-500 hover:text-white transition-colors shadow-sm">No Show</button>
                            </Tooltip>
                            <Tooltip text="Cancel Booking">
                              <button onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')} className="px-4 py-2 text-sm font-bold text-danger border border-danger/30 rounded-lg hover:bg-danger hover:text-white transition-colors shadow-sm">Cancel</button>
                            </Tooltip>
                            <Tooltip text={isOccupied ? 'End current active session on table before starting' : 'Start Session'}>
                              <button 
                                onClick={() => !isOccupied && handleStartBooking(booking.id)} 
                                disabled={isOccupied}
                                className="px-4 py-2 text-sm font-bold text-black bg-accent rounded-lg hover:bg-accent/90 transition-colors shadow-md shadow-accent/20 border border-transparent disabled:opacity-50 disabled:bg-bg-surface disabled:text-text-secondary disabled:border-border-theme disabled:shadow-none"
                              >
                                Start Session
                              </button>
                            </Tooltip>
                          </div>
                        )}
                        {booking.status === 'active' && (
                          <span className="text-xs font-bold text-secondary flex items-center justify-end gap-2">
                            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse"></div> Live
                          </span>
                        )}
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
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Total Revenue</p>
              <p className="text-3xl font-bold text-accent font-mono"><PrivacyText value={reportsData?.dailyRevenue || 0} isPrivacyMode={isPrivacyMode} formatINR={formatINR} /></p>
            </div>
            
            <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Completed Sessions</p>
              <p className="text-3xl font-bold text-text-primary font-mono">{reportsData?.completedSessions?.length || 0}</p>
            </div>
            
            <div className="bg-bg-surface border border-border-theme p-6 rounded-xl flex flex-col justify-center items-center text-center">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Avg Session Value</p>
              <p className="text-3xl font-bold text-text-primary font-mono"><PrivacyText value={reportsData?.completedSessions?.length ? Math.round((reportsData.dailyRevenue || 0) / reportsData.completedSessions.length) : 0} isPrivacyMode={isPrivacyMode} formatINR={formatINR} /></p>
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
                    onRequestEndSession={(session, cost, duration) => setEndSessionData({ session, cost, duration, amountReceived: String(cost), paymentMode: 'now', dueDate: '' })}
                    getDisplayName={getDisplayName}
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
              {!reportsData?.completedSessions || reportsData.completedSessions.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center text-text-secondary text-base">Your session history will appear here once you complete a transaction.</td></tr>
              ) : (
                reportsData.completedSessions.map((session: any) => {
                  const formatDateWithTime = (dateStr: string) => {
                    if (!dateStr || dateStr.includes('undefined')) return '-';
                    try {
                      const d = new Date(dateStr.includes('T') ? (dateStr.includes('+') || dateStr.includes('Z') ? dateStr : `${dateStr}+05:30`) : dateStr);
                      if (isNaN(d.getTime())) return dateStr;
                      const formatter = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true
                      });
                      return formatter.format(d).replace(' am', ' AM').replace(' pm', ' PM');
                    } catch {
                      return dateStr;
                    }
                  };

                  const startFull = session.start_time?.includes('T') ? session.start_time : `${session.date}T${session.start_time}`;
                  const endFull = session.end_time?.includes('T') ? session.end_time : (session.end_time ? `${session.date}T${session.end_time}` : '');
                  
                  const startTimeFormatted = formatDateWithTime(startFull);
                  const endTimeFormatted = formatDateWithTime(endFull);

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
                        <p className="text-sm font-bold text-text-primary">{getDisplayName(session.customer_name, session.member_id)}</p>
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
                        <span className="px-2 py-1 rounded bg-bg-surface border border-border-theme text-xs font-medium text-text-secondary">
                          {session.completed_by || 'System'}
                        </span>
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
            <p className="text-xs text-text-secondary mt-1 italic">Manage your loyal members</p>
          </div>
          <div className="flex gap-3 items-center">
            {selectedBulkSmsCustomers.length > 0 && (
              <button onClick={() => setShowBulkSmsModal(true)} className="px-4 py-2 bg-accent text-black font-bold text-sm rounded-lg hover:bg-accent/90 transition-colors shadow shadow-accent/20">
                Send Bulk SMS ({selectedBulkSmsCustomers.length})
              </button>
            )}
            <button onClick={fetchMemberships} className="p-2 bg-bg-surface border border-border-theme rounded hover:bg-border-theme transition-colors">
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                <th className="p-5 font-bold w-10">
                  <input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedBulkSmsCustomers(memberships.map(m => m.mobile).filter(Boolean));
                    else setSelectedBulkSmsCustomers([]);
                  }} className="w-4 h-4 rounded border-border-theme text-accent focus:ring-accent" />
                </th>
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
                      <input 
                        type="checkbox" 
                        checked={m.mobile ? selectedBulkSmsCustomers.includes(m.mobile) : false}
                        onChange={(e) => {
                          if (!m.mobile) return;
                          if (e.target.checked) setSelectedBulkSmsCustomers([...selectedBulkSmsCustomers, m.mobile]);
                          else setSelectedBulkSmsCustomers(selectedBulkSmsCustomers.filter(phone => phone !== m.mobile));
                        }}
                        className="w-4 h-4 rounded border-border-theme text-accent focus:ring-accent" 
                      />
                    </td>
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
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest border uppercase ${m.status === 'Active' ? 'border-accent/50 text-accent bg-accent/10' : 'border-danger/50 text-danger bg-danger/10'}`}>{m.status}</span>
                        <Tooltip text="Delete Profile">
                          <button 
                            onClick={() => handleDeleteMembership(m.id, m.name)}
                            className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showBulkSmsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowBulkSmsModal(false)}>
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-border-theme flex justify-between items-center bg-bg-primary/50">
              <h3 className="text-xl font-bold text-text-primary">Send Bulk SMS</h3>
              <button onClick={() => setShowBulkSmsModal(false)} className="text-text-secondary hover:text-text-primary">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">DLT Template ID</label>
                <input 
                  type="text" 
                  value={bulkSmsTemplateId} 
                  onChange={e => setBulkSmsTemplateId(e.target.value)} 
                  className="w-full p-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm font-mono" 
                  placeholder="e.g. promo_v1" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">Message Content (Approved Template)</label>
                <textarea 
                  value={bulkSmsMessage} 
                  onChange={e => setBulkSmsMessage(e.target.value)} 
                  className="w-full p-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-sm h-32" 
                  placeholder="Hi {{name}}, enjoy 10% off today!" 
                />
                <p className="text-xs text-text-secondary mt-1">Placeholders: `{"{{"}name{"}}"}`</p>
              </div>
              <div className="bg-accent/10 text-accent p-3 rounded-lg text-sm font-bold text-center">
                Sending to {selectedBulkSmsCustomers.length} customers
              </div>
            </div>
            <div className="p-4 border-t border-border-theme flex justify-end gap-3 bg-bg-surface">
              <button onClick={() => setShowBulkSmsModal(false)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-text-secondary hover:bg-bg-primary transition-colors">Cancel</button>
              <button 
                onClick={async () => {
                  setIsSendingBulkSms(true);
                  const toastId = toast.loading(`Sending ${selectedBulkSmsCustomers.length} messages...`);
                  try {
                    const customersToSend = memberships.filter(m => selectedBulkSmsCustomers.includes(m.mobile)).map(m => ({ phone: m.mobile, name: m.name }));
                    const res = await fetch('/api/sms-bulk-send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ businessId, customers: customersToSend, templateId: bulkSmsTemplateId, messageTemplate: bulkSmsMessage })
                    });
                    const resData = await res.json();
                    if (!res.ok || resData.error) throw new Error(resData.error || 'Failed to send');
                    toast.success(`Sent ${resData.successCount} messages. Failed: ${resData.failureCount}`, { id: toastId });
                    setShowBulkSmsModal(false);
                  } catch (e: any) {
                    toast.error(e.message || 'Error sending bulk SMS', { id: toastId });
                  }
                  setIsSendingBulkSms(false);
                }} 
                disabled={isSendingBulkSms || !bulkSmsMessage || !bulkSmsTemplateId}
                className="px-5 py-2.5 rounded-lg text-sm font-extrabold bg-accent text-black hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {isSendingBulkSms ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
        <h2 className="text-2xl font-bold mb-6">Register New Member</h2>
        <form onSubmit={handleCreateMembership} className="max-w-xl grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Full Name <span className="text-danger">*</span></label>
            <input required type="text" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm" placeholder="John Doe" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Mobile Number <span className="text-danger">*</span></label>
            <input required type="tel" value={newMember.mobile} onChange={e => setNewMember({...newMember, mobile: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm font-mono" placeholder="9876543210" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email (Optional)</label>
            <input type="email" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm" placeholder="john@example.com" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Membership Tier <span className="text-danger">*</span></label>
            <CustomSelect 
              value={newMember.tier} 
              onChange={v => setNewMember({...newMember, tier: v})} 
              className="font-bold text-accent"
              options={[
                {value: "Standard", label: "Standard"},
                {value: "Pro", label: "Pro"},
                {value: "VIP", label: "VIP"},
                {value: "Elite", label: "Elite"}
              ]}
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Months) <span className="text-danger">*</span></label>
            <CustomSelect 
              value={newMember.duration} 
              onChange={v => setNewMember({...newMember, duration: v})} 
              options={[
                {value: "1", label: "1 Month"},
                {value: "3", label: "3 Months"},
                {value: "6", label: "6 Months"},
                {value: "12", label: "12 Months (1 Year)"}
              ]}
            />
          </div>
          <div className="col-span-2 mt-2">
            <button type="submit" disabled={isCreatingMember} className="w-full bg-accent text-white font-bold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isCreatingMember ? 'Registering...' : 'Register Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 mt-4 pb-20">
      <div className="mb-2">
        <h1 className="text-3xl font-black tracking-tight mb-2">Settings</h1>
        <p className="text-text-secondary text-sm">Configure your business profile, pricing rules, and security preferences.</p>
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
                    // fetchData removed
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

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
                      Game Categories &amp; PS5 Support
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
        
                
        <div className="flex flex-col gap-4">
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
                            {!isActive && <span className="text-[14px] opacity-70"></span>}
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
                              <CustomSelect
                                value={currentRule.type || 'fixed'}
                                onChange={v => {
                                  const updated = { ...currentRule, type: v };
                                  const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                  handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                }}
                                options={[
                                  {value: "fixed", label: "Flat Rate (Fixed ₹/hr)"},
                                  {value: "time_based", label: "Schedule / Time Slots (Day & Evening)"}
                                ]}
                                className="py-2.5 min-h-[40px] text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Multiplayer Mode</label>
                              <CustomSelect
                                value={currentRule.multiplayer_mode || 'none'}
                                onChange={v => {
                                  const updated = { ...currentRule, multiplayer_mode: v };
                                  const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                  handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                }}
                                options={[
                                  {value: "none", label: "Disabled (Single rate)"},
                                  {value: "multiply", label: "Multiply Rate by Players"},
                                  {value: "base_plus_extra", label: "Base Rate + Extra per Additional Player"}
                                ]}
                                className="py-2.5 min-h-[40px] text-xs font-bold"
                              />
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
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          Stations & Tables Configuration
        </h2>
        {/* Station Management */}
                  <div className="flex flex-col gap-4 pt-6">
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
                            <Tooltip text="Delete Station">
                              <button
                                type="button"
                                onClick={() => confirmDeleteStation(t)}
                                className="p-1 text-text-secondary hover:text-red-500 transition-colors bg-bg-surface border border-border-theme hover:border-red-500 rounded"
                                aria-label="Delete Station"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </Tooltip>
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
                      <CustomSelect
                        value={newStationType}
                        onChange={v => setNewStationType(v)}
                        options={Object.keys(data?.pricingRules?.rules || { snooker: {}, pool: {}, ps5: {} }).map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))}
                        className="py-2 min-h-[40px] text-xs font-bold capitalize"
                      />
                      <button type="submit" disabled={isUpdatingConfig || !newStationId} className="w-full bg-accent text-black font-extrabold py-2.5 rounded-lg hover:bg-accent/90 transition-colors text-xs uppercase shadow-md shadow-accent/10 min-h-[42px]">
                        {isUpdatingConfig ? 'Adding...' : '+ Create Station'}
                      </button>
                    </form>
                  </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
              <h2 className="text-2xl font-bold mb-6">Launch Promotion</h2>
              <form onSubmit={handleSavePromo} className="max-w-md flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Promotion Title <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={promoTitle}
                    onChange={e => setPromoTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
                    placeholder="e.g. Afternoon Elite"
                    list="promo-suggestions"
                  />
                  <datalist id="promo-suggestions">
                    <option value="Weekend Special" />
                    <option value="Happy Hours" />
                    <option value="Game Night" />
                    <option value="Weekend Gaming Deal" />
                    <option value="Early Bird Offer" />
                    <option value="Student Special" />
                    <option value="Festive Offer" />
                    <option value="Loyalty Reward" />
                    <option value="Evening Special" />
                    <option value="Monthly Membership Offer" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Discount Percent (%) <span className="text-danger">*</span></label>
                  <input 
                    type="number" 
                    required min="1" max="100"
                    value={promoDiscount}
                    onChange={e => setPromoDiscount(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Hours) <span className="text-danger">*</span></label>
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
                <CustomSelect 
                  value={selectedTable}
                  onChange={v => setSelectedTable(v)}
                  placeholder="-- Select Table --"
                  options={data.tables?.map(t => ({value: t.id, label: t.name})) || []}
                  className="font-semibold"
                />
                <input 
                  type="number" 
                  min="1" max="100"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
                  placeholder="Discount %"
                  required
                />
                <button type="submit" disabled={!selectedTable || isUpdatingDiscount} className="w-full bg-accent text-bg-primary font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-lg disabled:opacity-50">
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
              <h2 className="text-2xl font-bold mb-6">Payment Collection</h2>
              <div className="border border-border-theme rounded-xl p-6 bg-bg-surface max-w-xl">
                <h3 className="text-lg font-bold mb-2">Business Payment QR</h3>
                <p className="text-sm text-text-secondary mb-4">Customers can scan this QR to pay your business directly via UPI. (Requires manual confirmation of payment)</p>
                
                {((data as any)?.payment_qr_config)?.enabled && ((data as any)?.payment_qr_config)?.qr_url ? (
                  <div className="mb-6 flex flex-col items-center">
                    <div className="w-48 h-48 bg-white rounded-xl p-2 mb-4 border border-border-theme shadow-sm relative group overflow-hidden">
                      <img src={((data as any)?.payment_qr_config).qr_url} alt="Business QR" className="w-full h-full object-contain rounded-lg" />
                    </div>
                    <div className="flex gap-4">
                      <label className="px-4 py-2 bg-accent/10 text-accent font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-accent/20 transition-colors cursor-pointer border border-accent/20">
                        Replace QR
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !businessId) return;
                          const formData = new FormData();
                          formData.append('business_id', businessId);
                          formData.append('file', file);
                          formData.append('action', 'upload');
                          try {
                            toast.loading('Uploading...');
                            const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                            toast.dismiss();
                            if (res.ok) { toast.success('QR replaced successfully.'); /* fetchData removed for instant UI */ }
                            else { toast.error('Failed to replace QR.'); }
                          } catch { toast.error('Error uploading QR.'); }
                        }} />
                      </label>
                      <button onClick={async () => {
                        if (!businessId) return;
                        if (!confirm('Are you sure you want to remove this QR code?')) return;
                        const formData = new FormData();
                        formData.append('business_id', businessId);
                        formData.append('action', 'remove');
                        try {
                          const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                          if (res.ok) { toast.success('QR removed successfully.'); /* fetchData removed for instant UI */ }
                          else { toast.error('Failed to remove QR.'); }
                        } catch { toast.error('Error removing QR.'); }
                      }} className="px-4 py-2 bg-danger/10 text-danger font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-danger/20 transition-colors border border-danger/20">
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border-theme rounded-xl p-8 text-center bg-bg-primary/50 hover:bg-bg-primary transition-colors">
                    <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <h4 className="text-sm font-bold text-text-primary mb-1">Upload QR Code</h4>
                    <p className="text-xs text-text-secondary mb-4">PNG, JPG up to 5MB</p>
                    <label className="px-6 py-3 bg-accent text-white font-bold text-sm rounded-lg hover-lift hover:bg-accent/90 transition-colors shadow-lg cursor-pointer inline-block">
                      Select File
                      <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !businessId) return;
                        const formData = new FormData();
                        formData.append('business_id', businessId);
                        formData.append('file', file);
                        formData.append('action', 'upload');
                        try {
                          toast.loading('Uploading...', { id: 'upload' });
                          const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                          if (res.ok) { toast.success('QR uploaded successfully.', { id: 'upload' }); /* fetchData removed for instant UI */ }
                          else { toast.error('Failed to upload QR.', { id: 'upload' }); }
                        } catch { toast.error('Error uploading QR.', { id: 'upload' }); }
                      }} />
                    </label>
                  </div>
                )}
              </div>
            </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-8">
              <h2 className="text-2xl font-bold mb-6">Integrations & Insights</h2>
              <div className="border border-border-theme rounded-xl p-6 bg-bg-surface max-w-xl mb-6">
                <h3 className="text-lg font-bold mb-2">Qpulse Insights</h3>
                <p className="text-sm text-text-secondary mb-4">Receive motivational and business insights to stay on top of your game.</p>
                <div className="bg-bg-primary/50 p-4 rounded-xl border border-border-theme">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const enabled = fd.get('enabled') === 'true';
                    const frequency = fd.get('frequency') as string;
                    try {
                      toast.loading('Saving Qpulse settings...', { id: 'qpulse-save' });
                      const res = await fetch('/api/update-business-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          business_id: businessId,
                          qpulse_config: { enabled, frequency, last_shown_date: ((data as any)?.qpulse_config)?.last_shown_date || null }
                        })
                      });
                      if (!res.ok) throw new Error();
                      toast.success('Qpulse settings updated!', { id: 'qpulse-save' });
                      // fetchData removed for instant UI
                    } catch {
                      toast.error('Failed to update Qpulse settings.', { id: 'qpulse-save' });
                    }
                  }}>
                    <div className="flex gap-4 mb-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">Qpulse Status</label>
                        <select name="enabled" defaultValue={((data as any)?.qpulse_config)?.enabled === false ? "false" : "true"} className="w-full bg-bg-surface border border-border-theme p-3 rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors appearance-none font-medium">
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">Frequency</label>
                        <select name="frequency" defaultValue={((data as any)?.qpulse_config)?.frequency || 'Every 3 days'} className="w-full bg-bg-surface border border-border-theme p-3 rounded-lg text-sm text-text-primary outline-none focus:border-accent transition-colors appearance-none font-medium">
                          <option value="Daily">Daily</option>
                          <option value="Every 3 days">Every 3 days</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Off">Off</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="w-full mt-2 bg-accent text-white font-bold py-3 rounded-lg hover-lift hover:bg-accent/90 transition-colors">
                      Save Qpulse
                    </button>
                  </form>
                </div>
              </div>
            </div>

      {/* Change PIN UI */}
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
                Security Settings
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
    </div>
  );

  const renderSupport = () => (
    <div className="max-w-7xl mx-auto flex flex-col gap-12 mt-4 pb-20 px-4 md:px-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight mb-3">Support & Integrations</h1>
        <p className="text-text-secondary text-base max-w-3xl leading-relaxed">Manage your connectivity, communication channels, and get help when you need it. Ensure your automated reminders and billing integrations are correctly configured.</p>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-card border border-border-theme rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] shadow-inner">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-lg">WhatsApp API</h3>
              <p className="text-sm text-text-secondary mt-0.5">Business Messaging</p>
            </div>
          </div>
          {data?.whatsapp_config?.enabled ? <span className="text-success font-black text-[10px] uppercase tracking-wider bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">Active</span> : <span className="text-text-disabled font-black text-[10px] uppercase tracking-wider bg-bg-surface px-3 py-1.5 rounded-full border border-border-theme">Inactive</span>}
        </div>
        
        <div className="bg-bg-card border border-border-theme rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shadow-inner">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-lg">SMS DLT</h3>
              <p className="text-sm text-text-secondary mt-0.5">Transactional SMS</p>
            </div>
          </div>
          {data?.sms_config?.enabled ? <span className="text-success font-black text-[10px] uppercase tracking-wider bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">Active</span> : <span className="text-text-disabled font-black text-[10px] uppercase tracking-wider bg-bg-surface px-3 py-1.5 rounded-full border border-border-theme">Inactive</span>}
        </div>

        <div className="bg-bg-card border border-border-theme rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-lg">Telegram Bot</h3>
              <p className="text-sm text-text-secondary mt-0.5">Smart Reminders</p>
            </div>
          </div>
          {telegramOwners.length > 0 ? <span className="text-success font-black text-[10px] uppercase tracking-wider bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">Active</span> : <span className="text-text-disabled font-black text-[10px] uppercase tracking-wider bg-bg-surface px-3 py-1.5 rounded-full border border-border-theme">Inactive</span>}
        </div>
      </div>

      {/* Horizontal Integration Section */}
      <div className="flex flex-col gap-6 mt-4">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
          Communication Channels
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* WhatsApp Integration Setting */}
          <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all hover:shadow-md">
            <div className="p-8 pb-6 border-b border-border-theme/50 bg-bg-primary/30 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  WhatsApp Business
                </h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">Connect official API to send reminders.</p>
              </div>
              {data?.whatsapp_config?.enabled ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Connected</span>
              ) : (
                <span className="px-3 py-1 bg-bg-surface text-text-secondary border border-border-theme rounded-lg text-[10px] font-black uppercase tracking-widest">Not Connected</span>
              )}
            </div>
            
            <div className="p-8 flex-1 flex flex-col">
              {data?.whatsapp_config?.enabled ? (
                <div className="bg-bg-primary/50 border border-border-theme rounded-xl p-6 flex flex-col items-center text-center h-full justify-center">
                  <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <p className="text-sm font-bold text-text-primary mb-2">WhatsApp is active and running.</p>
                  <p className="text-xs text-text-secondary mb-6">Your customers are receiving updates successfully.</p>
                  <button 
                    onClick={async () => {
                      if (confirm('Are you sure you want to disconnect WhatsApp? You will not be able to send reminders.')) {
                        try {
                          const res = await fetch('/api/update-whatsapp-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) });
                          if (res.ok) toast.success('WhatsApp disconnected.');
                        } catch(e) { toast.error('Failed to disconnect.'); }
                      }
                    }}
                    className="w-full bg-danger/10 text-danger hover:bg-danger/20 font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    Disconnect WhatsApp
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-5 h-full" onSubmit={async (e) => {
                  e.preventDefault();
                  setIsConnectingWa(true);
                  try {
                    const res = await fetch('/api/update-whatsapp-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', phoneId: waPhoneId, token: waToken }) });
                    if (res.ok) { toast.success('WhatsApp connected successfully!'); setWaPhoneId(''); setWaToken(''); }
                    else { toast.error('Failed to connect. Please check credentials.'); }
                  } catch(e) { toast.error('An error occurred.'); }
                  setIsConnectingWa(false);
                }}>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Phone Number ID <span className="text-danger">*</span></label>
                    <input type="text" required value={waPhoneId} onChange={e => setWaPhoneId(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono transition-all" placeholder="e.g. 102345678912345" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest">Permanent Access Token <span className="text-danger">*</span></label>
                      <a href="#" className="text-[10px] text-accent hover:underline font-bold">Setup Guide ↗</a>
                    </div>
                    <input type="password" required value={waToken} onChange={e => setWaToken(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono transition-all" placeholder="EAAGm0..." />
                  </div>
                  <button type="submit" disabled={isConnectingWa} className="w-full mt-2 bg-text-primary text-bg-primary font-black py-4 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-black/10 flex justify-center items-center gap-2 text-sm uppercase tracking-wide">
                    {isConnectingWa ? 'Connecting...' : 'Connect WhatsApp'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* SMS Integration Setting */}
          <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all hover:shadow-md">
            <div className="p-8 pb-6 border-b border-border-theme/50 bg-bg-primary/30 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                  SMS Integration
                </h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">Connect a DLT-compliant SMS provider.</p>
              </div>
              {data?.sms_config?.enabled ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Connected</span>
              ) : (
                <span className="px-3 py-1 bg-bg-surface text-text-secondary border border-border-theme rounded-lg text-[10px] font-black uppercase tracking-widest">Not Connected</span>
              )}
            </div>
            
            <div className="p-8 flex-1 flex flex-col">
              {data?.sms_config?.enabled ? (
                <div className="bg-bg-primary/50 border border-border-theme rounded-xl p-6 flex flex-col items-center text-center h-full justify-center">
                  <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <p className="text-sm font-bold text-text-primary mb-2">SMS Gateway is linked.</p>
                  <p className="text-xs text-text-secondary mb-6 font-mono bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme mt-2">{data.sms_config.provider.toUpperCase()} • {data.sms_config.senderId}</p>
                  <button 
                    onClick={async () => {
                      if (confirm('Are you sure you want to disconnect your SMS provider?')) {
                        try {
                          const res = await fetch('/api/update-sms-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) });
                          if (res.ok) toast.success('SMS provider disconnected.');
                        } catch(e) { toast.error('Failed to disconnect.'); }
                      }
                    }}
                    className="w-full bg-danger/10 text-danger hover:bg-danger/20 font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    Disconnect SMS
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-5 h-full" onSubmit={async (e) => {
                  e.preventDefault();
                  setIsConnectingSms(true);
                  try {
                    const res = await fetch('/api/update-sms-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', provider: smsProvider, authKey: smsAuthKey, senderId: smsSenderId }) });
                    if (res.ok) { toast.success('SMS connected successfully!'); setSmsAuthKey(''); setSmsSenderId(''); }
                    else { toast.error('Failed to connect. Please check credentials.'); }
                  } catch(e) { toast.error('An error occurred.'); }
                  setIsConnectingSms(false);
                }}>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Provider <span className="text-danger">*</span></label>
                    <select value={smsProvider} onChange={e => setSmsProvider(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary transition-all">
                      <option value="msg91">MSG91</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Auth Key <span className="text-danger">*</span></label>
                      <input type="password" required value={smsAuthKey} onChange={e => setSmsAuthKey(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono transition-all" placeholder="e.g. 421376xxxxxx" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Sender ID <span className="text-danger">*</span></label>
                      <input type="text" required maxLength={6} value={smsSenderId} onChange={e => setSmsSenderId(e.target.value.toUpperCase())} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono uppercase transition-all" placeholder="e.g. QCONTL" />
                    </div>
                  </div>
                  <button type="submit" disabled={isConnectingSms} className="w-full mt-2 bg-text-primary text-bg-primary font-black py-4 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-black/10 flex justify-center items-center gap-2 text-sm uppercase tracking-wide">
                    {isConnectingSms ? 'Connecting...' : 'Connect SMS'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Automation UI */}
      <div className="flex flex-col gap-6 mt-4">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <span>🤖</span> Automation & Notifications
        </h2>
        
        <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div className="p-8 border-b border-border-theme/50 bg-bg-primary/30">
            <h3 className="text-xl font-bold">Telegram Smart Reminders</h3>
            <p className="text-sm text-text-secondary mt-1">Configure automated bot alerts and manage owner access securely.</p>
          </div>
          
          <div className="p-8 flex flex-col lg:flex-row gap-12">
            
            {/* Reminder Settings */}
            <form onSubmit={handleUpdateTelegramSettings} className="flex-1 flex flex-col gap-5">
              <h4 className="text-sm font-black uppercase tracking-widest text-text-primary mb-2 flex items-center gap-2 border-b border-border-theme/50 pb-3">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Alert Configuration
              </h4>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Reminder Interval (Minutes)</label>
                <div className="relative">
                  <select value={reminderInterval} onChange={e => setReminderInterval(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 appearance-none transition-all cursor-pointer font-bold">
                    <option value="0">Disabled / No Reminders</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes</option>
                    <option value="120">120 Minutes</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none text-text-secondary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-3 leading-relaxed">How long before an active session is flagged as overdue and a notification is sent to Telegram.</p>
              </div>
              <button type="submit" disabled={isUpdatingTelegram} className="mt-auto px-6 py-4 bg-bg-surface border border-border-theme text-text-primary font-black uppercase tracking-wider text-sm rounded-xl hover:bg-bg-primary hover:border-text-secondary/30 transition-all shadow-sm flex items-center justify-center gap-2">
                {isUpdatingTelegram ? 'Saving Changes...' : 'Save Configuration'}
              </button>
            </form>

            <div className="w-px bg-border-theme/50 hidden lg:block"></div>

            {/* Manage Owners */}
            <div className="flex-[1.5] flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b border-border-theme/50 pb-3">
                <h4 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  Authorized Accounts
                </h4>
              </div>
              
              <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {telegramOwners.map((owner, idx) => {
                  const isRevoked = owner.status === 'revoked';
                  return (
                    <div key={idx} className={`flex justify-between items-center bg-bg-primary p-5 rounded-xl border transition-all hover:shadow-sm ${isRevoked ? 'border-error/20 bg-error/5' : 'border-border-theme hover:border-accent/30'}`}>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-bold flex items-center gap-2.5">
                          {owner.name} 
                          {owner.role === 'PRIMARY_OWNER' && <Tooltip text="Primary Owner"><span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-black uppercase tracking-wider cursor-help">Primary</span></Tooltip>} 
                          {isRevoked ? (
                            <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Revoked</span>
                          ) : (
                            <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Active</span>
                          )}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-text-secondary font-mono">
                          <span>ID: {owner.chatId}</span>
                          {owner.addedAt && <span className="opacity-60">• Added {new Date(owner.addedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRevoked ? (
                          <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-[10px] font-black uppercase tracking-wider text-success bg-success/10 hover:bg-success/20 px-4 py-2.5 rounded-lg transition-colors shadow-sm">
                            Grant
                          </button>
                        ) : (
                          <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-[10px] font-black uppercase tracking-wider text-error bg-error/10 hover:bg-error/20 px-4 py-2.5 rounded-lg transition-colors shadow-sm">
                            Revoke
                          </button>
                        )}
                        <Tooltip text="Permanently Delete">
                          <button
                            onClick={() => handlePermanentDeleteOwner(owner.chatId)}
                            className="p-2.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors bg-bg-surface border border-border-theme hover:border-red-500/30 rounded-lg ml-1 shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
                
                {telegramOwners.length === 0 && (
                  <div className="text-sm text-text-secondary font-medium text-center p-8 border border-dashed border-border-theme rounded-xl bg-bg-surface/50">No authorized Telegram owners yet.</div>
                )}
              </div>

              <div className="bg-bg-primary/50 border border-border-theme p-6 rounded-xl mt-auto shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-text-primary mb-4">Add New Owner</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => handleGenerateTelegramLink('PRIMARY_OWNER')} 
                    disabled={generatingLinkRole === 'PRIMARY_OWNER'}
                    className="flex-1 px-5 py-3.5 bg-bg-surface text-text-primary font-black text-xs uppercase tracking-wider rounded-xl hover:bg-bg-card border border-border-theme transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {generatingLinkRole === 'PRIMARY_OWNER' ? 'Generating...' : 'Link Primary'}
                  </button>
                  <button 
                    onClick={() => handleGenerateTelegramLink('SECONDARY_OWNER')} 
                    disabled={generatingLinkRole === 'SECONDARY_OWNER'}
                    className="flex-1 px-5 py-3.5 bg-blue-500/10 text-blue-500 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {generatingLinkRole === 'SECONDARY_OWNER' ? 'Generating...' : 'Link Secondary'}
                  </button>
                </div>
                
                {telegramInviteLink && (
                  <div className="mt-5 animate-in fade-in slide-in-from-top-2 bg-bg-card p-4 rounded-xl border border-accent/30 shadow-inner">
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Invite Link Generated</p>
                    <div className="flex gap-2">
                      <input type="text" readOnly value={telegramInviteLink} className="w-full text-xs font-mono bg-bg-surface p-3 rounded-lg outline-none text-accent border border-border-theme" />
                      <button 
                        onClick={() => navigator.clipboard.writeText(telegramInviteLink)}
                        className="px-5 py-3 bg-accent text-bg-primary font-black text-xs uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity shadow-md"
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

      {/* Help & Support Section */}
      <div className="flex flex-col gap-6 mt-6">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Help Center
        </h2>
        
        <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden flex flex-col p-8 lg:p-12 relative shadow-sm">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
          
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-black mb-3 tracking-tight">How can we help?</h2>
            <p className="text-text-secondary text-base leading-relaxed">Search our knowledge base or get in touch with our dedicated support team to resolve your issues quickly.</p>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <a href="#" className="p-8 rounded-2xl border border-border-theme bg-bg-surface hover:border-accent hover:shadow-xl hover:shadow-accent/5 transition-all group flex flex-col items-start">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h3 className="font-extrabold text-text-primary text-xl mb-2">Documentation</h3>
              <p className="text-sm text-text-secondary leading-relaxed">Read guides & tutorials on using QControl.</p>
            </a>
            <a href="#" className="p-8 rounded-2xl border border-border-theme bg-bg-surface hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all group flex flex-col items-start">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="font-extrabold text-text-primary text-xl mb-2">API & Hardware</h3>
              <p className="text-sm text-text-secondary leading-relaxed">Setup IoT switches & API integrations.</p>
            </a>
            <a href="#" className="p-8 rounded-2xl border border-border-theme bg-bg-surface hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/5 transition-all group flex flex-col items-start">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="font-extrabold text-text-primary text-xl mb-2">Billing & Pricing</h3>
              <p className="text-sm text-text-secondary leading-relaxed">Questions about subscription & payments.</p>
            </a>
          </div>
  
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h3 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Frequently Asked Questions
              </h3>
              <div className="space-y-4">
                <div className="border border-border-theme rounded-2xl p-6 bg-bg-surface hover:border-text-secondary/30 transition-colors shadow-sm">
                  <h4 className="font-extrabold text-sm text-text-primary mb-2">How do I update pricing?</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">Go to the Settings tab to adjust hourly rates or add promotions. Changes take effect immediately for all new sessions.</p>
                </div>
                <div className="border border-border-theme rounded-2xl p-6 bg-bg-surface hover:border-text-secondary/30 transition-colors shadow-sm">
                  <h4 className="font-extrabold text-sm text-text-primary mb-2">My tables aren't syncing?</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">Check your internet connection. QControl uses Supabase for real-time WebSocket sync. Try refreshing the page if the issue persists.</p>
                </div>
                <div className="border border-border-theme rounded-2xl p-6 bg-bg-surface hover:border-text-secondary/30 transition-colors shadow-sm">
                  <h4 className="font-extrabold text-sm text-text-primary mb-2">How do I export data?</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">Navigate to the Reports tab and click "Export CSV". You can export data for specific date ranges.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-bg-primary/80 p-10 rounded-3xl border border-border-theme flex flex-col shadow-lg backdrop-blur-sm">
              <h3 className="text-2xl font-black text-text-primary mb-2">Need direct help?</h3>
              <p className="text-sm text-text-secondary mb-8">Send us a message and our support team will get back to you within 24 hours.</p>
              
              <form onSubmit={(e) => { e.preventDefault(); alert("Support request sent! Our team will contact you shortly."); }} className="flex flex-col gap-5 flex-1">
                <input type="text" placeholder="Subject" className="w-full px-5 py-4 bg-bg-surface border border-border-theme rounded-xl text-sm focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none transition-all font-medium" required />
                <textarea placeholder="Describe your issue in detail..." rows={6} className="w-full px-5 py-4 bg-bg-surface border border-border-theme rounded-xl text-sm focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none resize-none transition-all font-medium" required></textarea>
                <button type="submit" className="mt-auto py-4 bg-text-primary text-bg-primary font-black uppercase tracking-widest text-sm rounded-xl hover:opacity-90 transition-opacity shadow-xl flex justify-center items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  Submit Ticket
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="flex h-screen bg-bg-primary text-text-primary overflow-hidden font-sans">
      {/* End Session Modal */}
      {endSessionData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setEndSessionData(null)}>
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="bg-danger/10 border-b border-danger/20 p-5">
              <h3 className="text-xl font-bold flex items-center gap-3 text-danger">
                End Session
              </h3>
              <p className="text-sm text-text-secondary mt-1">Finalize bill for {getDisplayName(endSessionData.session.customer_name, endSessionData.session.member_id)}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Table</span>
                <span className="font-mono font-bold text-lg bg-bg-surface px-3 py-1 rounded-lg border border-border-theme">{endSessionData.session.table_id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Duration</span>
                <span className="font-mono font-bold text-lg text-text-primary">{endSessionData.duration}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Total Bill</span>
                <span className="text-xl font-black text-accent">{formatINR(endSessionData.cost)}</span>
              </div>
              
              {/* Payment Mode Toggle (Only for Members) */}
              {(data?.dbCustomers || []).some((c: any) => 
                 (c.name && c.name.trim().toLowerCase() === endSessionData.session.customer_name.trim().toLowerCase()) || 
                 (c.phone && c.phone.trim() === endSessionData.session.customer_name.trim())
              ) && (
                <div className="flex gap-2 p-1 bg-bg-primary rounded-xl mt-4">
                  <button 
                    onClick={() => setEndSessionData({...endSessionData, paymentMode: 'now'})}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${endSessionData.paymentMode === 'now' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Pay Now
                  </button>
                  <button 
                    onClick={() => setEndSessionData({...endSessionData, paymentMode: 'credit'})}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${endSessionData.paymentMode === 'credit' ? 'bg-warning/20 text-warning shadow-sm border border-warning/30' : 'text-text-secondary hover:text-warning/70'}`}
                  >
                    Play on Credit (QKhata)
                  </button>
                </div>
              )}

              {endSessionData.paymentMode === 'now' ? (
                <div>
                  <label className="block text-sm font-bold tracking-widest uppercase text-text-secondary mb-2">Amount Received (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-bold">₹</span>
                    <input 
                      type="number" 
                      value={endSessionData.amountReceived}
                      onChange={(e) => setEndSessionData({...endSessionData, amountReceived: e.target.value})}
                      className="w-full pl-8 pr-4 py-3 bg-bg-primary border border-border-theme rounded-xl focus:border-accent outline-none text-lg font-mono tabular-nums text-text-primary transition-all [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      placeholder={String(endSessionData.cost)}
                    />
                  </div>
                  <p className="text-xs text-text-secondary mt-2">Edit this if the customer is paying a different amount. The remaining balance goes to QKhata.</p>
                </div>
              ) : (
                <div className="p-4 border border-warning/30 bg-warning/5 rounded-xl space-y-3">
                  <div>
                    <label className="block text-sm font-bold tracking-widest uppercase text-warning mb-2">Due Date</label>
                    <input 
                      type="date"
                      value={endSessionData.dueDate}
                      onChange={(e) => setEndSessionData({...endSessionData, dueDate: e.target.value})}
                      className="w-full px-4 py-3 bg-bg-primary border border-warning/30 rounded-xl focus:border-warning outline-none text-sm text-text-primary transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const member = (data?.dbCustomers || []).find((c: any) => c.name.toLowerCase() === endSessionData.session.customer_name.toLowerCase() || c.phone === endSessionData.session.customer_name);
                      let nextCycle = new Date();
                      if (member && member.created_at) {
                        const regDate = new Date(member.created_at);
                        nextCycle = new Date(nextCycle.getFullYear(), nextCycle.getMonth() + 1, regDate.getDate());
                      } else {
                        nextCycle.setMonth(nextCycle.getMonth() + 1);
                      }
                      setEndSessionData({...endSessionData, dueDate: nextCycle.toISOString().split('T')[0]});
                    }}
                    className="text-xs text-warning hover:underline font-semibold"
                  >
                    + Use Next Billing Cycle / Registration Date
                  </button>
                  <p className="text-[10px] text-text-secondary leading-tight mt-1">This will add ₹{endSessionData.cost} to their outstanding QKhata balance.</p>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setEndSessionData(null)}
                  className="flex-1 py-3.5 bg-bg-surface text-text-primary font-bold text-sm uppercase rounded-xl hover:bg-bg-primary transition-colors border border-border-theme"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    const isCredit = endSessionData.paymentMode === 'credit';
                    const amountToRecord = isCredit ? 0 : (endSessionData.amountReceived === '' ? endSessionData.cost : Number(endSessionData.amountReceived));
                    const paymentMethod = isCredit ? 'QKhata' : 'Cash';
                    const dueDate = isCredit && endSessionData.dueDate ? endSessionData.dueDate : undefined;
                    
                    handleIntervention('force_end', endSessionData.session.id, amountToRecord, undefined, paymentMethod, dueDate);
                    setEndSessionData(null);
                    if (overdueSession && overdueSession.id === endSessionData.session.id) {
                      setOverdueSession(null);
                    }
                  }}
                  className={`flex-[2] py-3.5 text-white font-extrabold text-sm uppercase rounded-xl transition-colors shadow-lg ${endSessionData.paymentMode === 'credit' ? 'bg-warning text-black hover:bg-warning/90 shadow-warning/20' : 'bg-danger hover:bg-red-600 shadow-danger/20'}`}
                >
                  {endSessionData.paymentMode === 'credit' ? 'Confirm QKhata' : 'Confirm & End'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overdue Session Modal */}
      {overdueSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setOverdueSession(null)}>
          <div className="bg-bg-card border border-warning/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="bg-warning/10 border-b border-warning/20 p-5">
              <h3 className="text-xl font-bold flex items-center gap-3 text-warning">
                Confirmation Required
              </h3>
              <p className="text-sm text-text-secondary mt-1">This session has been running for a long time.</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border-theme/50 pb-3">
                  <span className="text-sm text-text-secondary font-bold tracking-widest uppercase">Player</span>
                  <span className="text-base font-bold">{getDisplayName(overdueSession.customer_name, overdueSession.member_id)}</span>
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
                    
                    setEndSessionData({ session: overdueSession, cost: res.cost, amountReceived: String(res.cost), paymentMode: 'now', dueDate: '' });
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
            <IconCustomers /> Members
          </button>
          
          <button onClick={() => setSidebarTab('menu')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'menu' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconMenu /> Food & Beverages
          </button>
          
          <button onClick={() => setSidebarTab('qkhata')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'qkhata' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg> 
            QKhata
          </button>

          <button onClick={() => setSidebarTab('messaging')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'messaging' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            Messaging
          </button>

          <button onClick={() => setSidebarTab('payments')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'payments' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> 
            Payments
          </button>
        </nav>

        <div className="p-4 flex flex-col gap-2 border-t border-border-theme/50">
          <button onClick={() => setIsManualModalOpen(true)} className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-white font-bold rounded-lg text-sm transition-colors hover:bg-secondary/90 mb-2 shadow-[0_0_15px_rgba(240,165,0,0.3)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New Session
          </button>

          
          <button onClick={() => setSidebarTab('support')} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'support' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'}`}>
            <IconSupport /> Support
          </button>
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
                    {data?.has_logged_in === false ? `Welcome to Qcontrol, ${data?.ownerName?.split(' ')[0] || ''}` : `Welcome back, ${data?.ownerName?.split(' ')[0] || ''}`}
                  </h2>
                  <p className="text-xs lg:text-sm text-text-secondary mt-1 hidden sm:block">Complete control over your business. Everything you need, all in one place.</p>
                </div>
              ) : (
                <h2 className="text-lg lg:text-xl font-bold text-text-primary capitalize">
                  {sidebarTab === 'qkhata' ? 'QKhata' : sidebarTab === 'menu' ? 'Food & Beverages' : sidebarTab === 'customers' ? 'Members' : sidebarTab}
                </h2>
              )}
              <p className="text-[10px] lg:text-xs text-text-secondary font-mono mt-1 uppercase tracking-widest">
                {toReadableIST(now)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-text-secondary items-center">
              <Tooltip text="Open Google Sheet">
                <button
                  onClick={() => {
                    if (!data?.google_sheet_id) {
                      toast.error('Google Sheet is not configured for this business.');
                      return;
                    }
                    window.open(`https://docs.google.com/spreadsheets/d/${data.google_sheet_id}/edit`, '_blank');
                  }}
                  className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-green-500 transition-colors hover-lift"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </button>
              </Tooltip>
              <Tooltip text="Open Telegram Bot">
                <button
                  onClick={() => {
                    if (telegramOwners.length === 0) {
                      toast.error('Telegram is not connected for this business. Please configure it in settings.');
                      setSidebarTab('settings');
                      return;
                    }
                    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'Qcontr01_bot';
                    window.open(`https://t.me/${botUsername}`, '_blank');
                  }}
                  className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-[#0088cc] transition-colors hover-lift"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </Tooltip>
              <Tooltip text="Quick Scan">
                <button
                  onClick={() => setIsQRModalOpen(true)}
                  className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-accent transition-colors hover-lift"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                </button>
              </Tooltip>
              <Tooltip text="Toggle Privacy Mode">
                <button
                  onClick={togglePrivacy}
                  className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-text-primary transition-colors hover-lift"
                >
                  {isPrivacyMode ? <IconEyeOff /> : <IconEye />}
                </button>
              </Tooltip>
              <Tooltip text="Toggle Theme">
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
                >
                  <svg className="w-5 h-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <svg className="w-5 h-5 block dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </button>
              </Tooltip>
              {businessId && <NotificationBell businessId={businessId} />}
            </div>
            <div className="h-8 w-px bg-border-theme"></div>
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-3 outline-none focus:outline-none hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold border border-accent/30 shadow-inner">
                  {data?.ownerName ? data.ownerName.charAt(0).toUpperCase() : 'O'}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-semibold leading-tight">{data?.ownerName || 'Club Owner'}</p>
                  <p className="text-xs text-text-secondary">Owner</p>
                </div>
                <svg className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              
              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-3 w-48 bg-bg-surface border border-border-theme rounded-xl shadow-2xl overflow-hidden z-50 py-2 origin-top-right animate-in fade-in zoom-in-95 duration-100">
                  <button 
                    onClick={() => {
                      setSidebarTab('settings');
                      setIsProfileDropdownOpen(false);
                    }} 
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors text-left"
                  >
                    <IconSettings />
                    Settings
                  </button>
                  <div className="h-px bg-border-theme my-1"></div>
                  <button 
                    onClick={(e) => {
                      setIsProfileDropdownOpen(false);
                      handleLogout(e);
                    }} 
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <IconLogout />
                    Logout
                  </button>
                </div>
              )}
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
          {sidebarTab === 'menu' && <MenuManagerTab businessId={businessId!} initialMenuItems={data?.menu_items || []} />}
          {sidebarTab === 'qkhata' && <QKhataTab businessId={businessId!} />}
          {sidebarTab === 'payments' && <PaymentsTab businessId={businessId!} />}
          {sidebarTab === 'messaging' && <MessagingTab businessId={businessId!} isWhatsAppConnected={!!data?.whatsapp_config?.enabled} dbCustomers={data?.dbCustomers || []} memberships={memberships || []} />}
        </div>
        
        {/* Footer */}
        <footer className="w-full text-center py-8 mt-auto border-t border-border-theme bg-bg-surface/30">
          <p className="text-text-secondary text-sm font-semibold">© 2026 QControl. Powered by Scan-n-Bill.</p>
          <p className="text-text-secondary text-xs mt-1">Take Control. Drive Growth.</p>
        </footer>
        <AIAssistantWidget />
      </main>
      
      {/* Manual Session Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className={`bg-bg-card border border-border-theme rounded-2xl w-full max-w-[95%] sm:max-w-md my-auto shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar transition-all duration-200 ease-out ${isClosingManual ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 animate-in fade-in zoom-in-95'}`}>
            <button 
              onClick={() => {
                setIsManualModalOpen(false);
                setSelectedQkhataMember(null);
                setShowQkhataPopover(false);
              }}
              className="absolute top-6 right-6 w-10 h-10 bg-bg-surface border border-border-theme rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="p-8 border-b border-border-theme">
              <h2 className="text-2xl font-bold">Manual Session</h2>
              <p className="text-text-secondary mt-1 text-sm">Start a session for walk-ins without QR.</p>
            </div>
            <form onSubmit={handleManualStart} className="p-8 flex flex-col gap-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Customer Name <span className="text-danger">*</span></label>
                  <button 
                    type="button" 
                    onClick={() => setShowQkhataPopover(!showQkhataPopover)}
                    className="flex items-center gap-1.5 px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded text-[10px] font-extrabold uppercase tracking-widest transition-colors border border-accent/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    QKhata
                  </button>
                </div>
                <input type="text" required value={manualCustomer} onChange={e => { setManualCustomer(e.target.value); setSelectedQkhataMember(null); setManualCustomerId(null); }} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" placeholder="Walk-In or Member Name" />

                {showQkhataPopover && (
                  <div className="absolute top-[80px] right-0 w-full sm:w-[340px] bg-bg-card border border-border-theme rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.8)] z-50 overflow-hidden flex flex-col max-h-[350px] animate-in slide-in-from-top-2 fade-in duration-200 ring-1 ring-accent/20">
                    <div className="p-3 border-b border-border-theme bg-bg-primary sticky top-0 z-10">
                      <div className="relative">
                        <svg className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input 
                          type="text" 
                          autoFocus
                          value={qkhataSearch}
                          onChange={e => setQkhataSearch(e.target.value)}
                          placeholder="Search registered member..." 
                          className="w-full pl-9 pr-3 py-2.5 bg-bg-surface border border-border-theme rounded-lg text-sm outline-none focus:border-accent text-text-primary placeholder:text-text-disabled transition-colors"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-2 flex flex-col gap-1 bg-bg-primary/50">
                      {filteredQkhataMembers.length === 0 ? (
                        <div className="py-8 px-4 flex flex-col items-center text-center">
                          <svg className="w-8 h-8 text-text-disabled mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                          <p className="text-xs font-bold text-text-secondary">No members found</p>
                          <p className="text-[10px] text-text-secondary mt-1">Only registered members can use QKhata.</p>
                        </div>
                      ) : (
                        filteredQkhataMembers.map(member => {
                          const bal = Number(member.outstanding_balance || 0);
                          const isOverdue = bal > 5000;
                          const isOutstanding = bal > 0 && bal <= 5000;
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                setManualCustomer(member.name);
                                setManualCustomerId(member.id);
                                setSelectedQkhataMember(member);
                                setShowQkhataPopover(false);
                                setQkhataSearch('');
                              }}
                              className="w-full text-left p-3 rounded-lg bg-bg-primary hover:bg-bg-surface border border-border-theme/50 hover:border-accent/30 transition-all flex justify-between items-center group"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">{member.name}</span>
                                <span className="text-[11px] text-text-secondary font-mono mt-0.5">{member.phone}</span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`text-sm font-bold font-mono ${bal > 0 ? 'text-text-primary' : 'text-text-secondary'}`}>₹{bal.toLocaleString('en-IN')}</span>
                                {bal <= 0 ? (
                                  <span className="text-[9px] uppercase tracking-widest text-success font-extrabold mt-0.5">Available</span>
                                ) : isOverdue ? (
                                  <span className="text-[9px] uppercase tracking-widest text-danger font-extrabold mt-0.5">Overdue</span>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-widest text-warning font-extrabold mt-0.5">Outstanding</span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Table <span className="text-danger">*</span></label>
                <CustomSelect
                  value={manualTable}
                  onChange={v => {
                    setManualTable(v);
                    const allowed = getAvailableGameTypesForTable(v);
                    if (allowed.length > 0 && !allowed.includes(manualGame)) {
                      setManualGame(allowed[0]);
                    }
                  }}
                  placeholder="-- Choose an available table --"
                  options={data.tables?.filter(t => !data.activeSessions.some(s => s.table_id === t.id)).map(t => ({ value: t.id, label: `${t.name} (${t.type})` })) || []}
                  className="min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Game Type (Assigned Sports) <span className="text-danger">*</span></label>
                <CustomSelect 
                  value={manualGame} 
                  onChange={v => setManualGame(v)} 
                  options={getAvailableGameTypesForTable(manualTable).map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))}
                  className="capitalize min-h-[44px]" 
                />
              </div>
              {manualGame === 'ps5' && (
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Number of Players <span className="text-danger">*</span></label>
                  <CustomSelect 
                    value={manualPlayers} 
                    onChange={v => setManualPlayers(v)} 
                    options={[{value: "1", label: "1 Player"}, {value: "2", label: "2 Players"}, {value: "3", label: "3 Players"}, {value: "4", label: "4 Players"}]}
                    className="min-h-[44px]" 
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Custom Start Time (Optional)</label>
                <input type="datetime-local" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" />
                <p className="text-[10px] text-text-secondary mt-1">Leave empty to use current time.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Session Notes (Optional)</label>
                <input type="text" value={manualNotes} onChange={e => setManualNotes(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary" placeholder="Special requests..." />
              </div>

              {selectedQkhataMember && (
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-black shadow-lg shadow-accent/20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-accent">Playing on QKhata</span>
                      <span className="text-sm font-bold text-text-primary">{selectedQkhataMember.name} <span className="text-text-secondary font-mono text-xs font-normal">({selectedQkhataMember.phone})</span></span>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedQkhataMember(null); setManualCustomer(''); setManualCustomerId(null); }} className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              )}
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
          <div className={`bg-bg-card border border-border-theme rounded-2xl w-full max-w-[95%] sm:max-w-md my-auto shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar transition-all duration-200 ease-out ${isClosingBooking ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 animate-in fade-in zoom-in-95'}`}>
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
            <form onSubmit={handleCreateManualBooking} className="p-8 flex flex-col gap-5">
              {bookingError && <div className="text-danger text-sm font-bold bg-danger/10 p-3 rounded-lg border border-danger/20">{bookingError}</div>}
              
              <div className="flex gap-4 w-full">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Select Table <span className="text-danger">*</span></label>
                  <CustomSelect
                    value={bookingTable}
                    onChange={v => {
                      setBookingTable(v);
                      const allowed = getAvailableGameTypesForTable(v);
                      if (allowed.length > 0) setBookingGame(allowed[0]);
                    }}
                    placeholder="-- Choose a table --"
                    options={data?.tables?.map((t: any) => ({ value: t.id, label: `${t.name} (${t.type || t.id})` })) || []}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Date <span className="text-danger">*</span></label>
                  <input type="date" required value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary h-[44px]" />
                </div>
              </div>

              {bookingTable && (
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Select Time <span className="text-danger">*</span></label>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-text-secondary uppercase"><span className="inline-block w-2 h-2 rounded-full bg-accent/20 border border-accent/50 mr-1"></span>Available</span>
                       <span className="text-[10px] font-bold text-text-secondary uppercase"><span className="inline-block w-2 h-2 rounded-full bg-border-theme/50 mr-1"></span>Occupied</span>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {generateTimeSlots().map(slot => {
                      const occupied = isSlotOccupied(slot);
                      const isSelected = bookingStartTime === slot;
                      const [h, m] = slot.split(':').map(Number);
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const h12 = h % 12 || 12;
                      const displayTime = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={occupied}
                          onClick={() => setBookingStartTime(slot)}
                          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold border transition-all duration-200 ${isSelected ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' : occupied ? 'bg-bg-primary/50 text-text-secondary border-border-theme/50 opacity-50 cursor-not-allowed' : 'bg-bg-surface text-text-primary border-border-theme hover:border-accent/50'}`}
                        >
                          {displayTime}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4 w-full">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Customer Name</label>
                  <input type="text" value={bookingCustomer} onChange={e => setBookingCustomer(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary h-[44px]" placeholder="Optional" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration <span className="text-danger">*</span></label>
                  <CustomSelect 
                    value={bookingDuration} 
                    onChange={v => setBookingDuration(v)} 
                    options={[
                      {value: "30", label: "30 Mins"},
                      {value: "60", label: "1 Hour"},
                      {value: "90", label: "1.5 Hours"},
                      {value: "120", label: "2 Hours"}
                    ]}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              {bookingGame === 'ps5' && (
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Number of Players <span className="text-danger">*</span></label>
                  <CustomSelect 
                    value={bookingPlayers} 
                    onChange={v => setBookingPlayers(v)} 
                    options={[{value: "1", label: "1 Player"}, {value: "2", label: "2 Players"}, {value: "3", label: "3 Players"}, {value: "4", label: "4 Players"}]}
                    className="min-h-[44px]" 
                  />
                </div>
              )}
              
              <button type="submit" disabled={isCreatingBooking || !bookingTable || !bookingDate || !bookingStartTime} className="w-full mt-2 bg-accent text-white font-bold py-3.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-lg shadow-accent/20">
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
              <button onClick={() => { setSidebarTab('support'); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold text-sm transition-colors ${sidebarTab === 'support' ? 'bg-accent/10 text-accent' : 'text-text-secondary'}`}>
                <IconSupport /> Support
              </button>
              <div className="my-4 border-t border-border-theme/50"></div>
              <button onClick={() => { setIsManualModalOpen(true); setIsMobileMenuOpen(false); }} className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-white font-bold rounded-lg text-sm mb-2">
                New Session
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-theme rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <IconLogout />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Are you sure you want to log out?</h3>
            <div className="flex gap-3 w-full mt-6">
              <button 
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-3 text-text-secondary font-bold text-sm bg-bg-card border border-border-theme rounded-lg hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout}
                className="flex-1 py-3 bg-danger text-white font-bold text-sm rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-danger/20"
              >
                Logout
              </button>
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
