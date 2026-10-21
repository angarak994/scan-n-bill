'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  Phone, 
  Navigation, 
  MapPin, 
  User, 
  MessageSquare, 
  Calendar, 
  Clock, 
  CreditCard, 
  ShieldCheck, 
  X, 
  Wallet, 
  Award, 
  Loader2 
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/lib/i18n';
import { getGoogleMapsDirectionsUrl } from '@/lib/utils/locationUtils';

interface Booking {
  id: string;
  business_id?: string;
  customer_name: string;
  customer_phone: string;
  table_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  source: string;
  session_id?: string;
  club_name?: string | null;
  club_address?: string | null;
  club_contact?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface BookingsTabProps {
  businessId?: string | null;
  businessName?: string | null;
  address?: string | null;
  contactNumber?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bookings?: Booking[];
  tables?: any[];
  onRefresh?: () => void;
}

export default function BookingsTab({ 
  businessId, 
  businessName,
  address,
  contactNumber,
  latitude,
  longitude,
  bookings = [], 
  tables: propTables = [], 
  onRefresh 
}: BookingsTabProps) {
  const { language } = useLanguage();
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings);
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<any[]>(propTables);

  const getDirectionsForBooking = (b?: Booking) => {
    const targetAddress = b?.club_address || address;
    const targetName = b?.club_name || businessName;
    const targetLat = b?.latitude ?? latitude;
    const targetLng = b?.longitude ?? longitude;

    if (!targetAddress && !targetLat && !targetName) return null;

    return getGoogleMapsDirectionsUrl({
      address: targetAddress,
      businessName: targetName,
      latitude: targetLat,
      longitude: targetLng
    });
  };

  // Customer Profile Hover & Sheet State
  const [profileCache, setProfileCache] = useState<Record<string, any>>({});
  const [loadingProfileKey, setLoadingProfileKey] = useState<string | null>(null);
  const [hoveredCustomer, setHoveredCustomer] = useState<{
    booking: Booking;
    position: { top: number; left: number };
  } | null>(null);
  const [activeCustomerSheet, setActiveCustomerSheet] = useState<Booking | null>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  const getCleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  };

  const getPhone10 = (phone?: string) => {
    const clean = getCleanPhone(phone);
    return clean.length >= 10 ? clean.slice(-10) : clean;
  };

  const fetchCustomerProfile = async (phone: string, name: string) => {
    const cacheKey = `${phone || ''}_${name || ''}`;
    if (profileCache[cacheKey]) return profileCache[cacheKey];

    setLoadingProfileKey(cacheKey);
    try {
      const res = await fetch(`/api/bookings/customer-profile?phone=${encodeURIComponent(phone || '')}&name=${encodeURIComponent(name || '')}`);
      if (res.ok) {
        const json = await res.json();
        const profile = json.profile || null;
        setProfileCache(prev => ({ ...prev, [cacheKey]: profile }));
        return profile;
      }
    } catch (err) {
      console.error('Failed to fetch customer profile:', err);
    } finally {
      setLoadingProfileKey(null);
    }
    return null;
  };

  const handleCustomerMouseEnter = (e: React.MouseEvent<HTMLElement>, booking: Booking) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const top = rect.bottom + 8;
    const left = Math.max(16, Math.min(window.innerWidth - 320, rect.left));

    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCustomer({
        booking,
        position: { top, left }
      });
      fetchCustomerProfile(booking.customer_phone, booking.customer_name);
    }, 150);
  };

  const handleCustomerMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredCustomer(null);
    }, 150);
  };

  const handlePopoverMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredCustomer(null);
    }, 150);
  };

  const handleCustomerClick = (booking: Booking) => {
    setActiveCustomerSheet(booking);
    fetchCustomerProfile(booking.customer_phone, booking.customer_name);
  };

  const renderCustomerCardContent = (booking: Booking, isMobile = false) => {
    const cacheKey = `${booking.customer_phone || ''}_${booking.customer_name || ''}`;
    const profile = profileCache[cacheKey];
    const isLoading = loadingProfileKey === cacheKey;
    const phone10 = getPhone10(booking.customer_phone);
    const hasPhone = Boolean(phone10 && phone10.length === 10);
    const balance = profile?.outstanding_balance || 0;
    const isMember = Boolean(profile?.membership_name || profile?.membership_status === 'ACTIVE');

    return (
      <div className="flex flex-col gap-3">
        {/* Header: User avatar + Name & Ref */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-text-primary truncate">{booking.customer_name}</h4>
              <div className="text-xs text-text-secondary font-mono flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-text-disabled" />
                <span>{booking.customer_phone || 'No phone recorded'}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[10px] font-mono font-bold text-text-secondary bg-bg-primary/80 border border-border-theme px-2 py-0.5 rounded">
              #{booking.id.substring(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Quick Contact Actions */}
        {hasPhone && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={`https://wa.me/91${phone10}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 text-xs font-bold transition-colors shadow-sm"
              onClick={e => e.stopPropagation()}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <a
              href={`tel:+91${phone10}`}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-xs font-bold transition-colors shadow-sm"
              onClick={e => e.stopPropagation()}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call</span>
            </a>
          </div>
        )}

        {/* Intelligence Metrics Grid */}
        <div className="border-t border-border-theme/60 pt-3">
          {isLoading && !profile ? (
            <div className="py-4 flex items-center justify-center gap-2 text-xs text-text-secondary">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Loading ledger history...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* Completed Visits */}
              <div className="p-2.5 rounded-lg bg-bg-primary/60 border border-border-theme/40">
                <div className="text-[10px] text-text-secondary font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Calendar className="w-3 h-3 text-text-disabled" />
                  <span>Visits</span>
                </div>
                <div className="text-sm font-bold text-text-primary font-mono">
                  {profile?.completed_bookings_count ?? (profile?.total_visits || 0)} Completed
                </div>
              </div>

              {/* QKhata Ledger Balance */}
              <div className="p-2.5 rounded-lg bg-bg-primary/60 border border-border-theme/40">
                <div className="text-[10px] text-text-secondary font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Wallet className="w-3 h-3 text-text-disabled" />
                  <span>QKhata</span>
                </div>
                <div className={`text-sm font-bold font-mono ${balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {balance > 0 ? `₹${balance} Due` : 'Clear (₹0)'}
                </div>
              </div>

              {/* Membership Status */}
              <div className="col-span-2 p-2.5 rounded-lg bg-bg-primary/60 border border-border-theme/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Award className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Membership</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isMember 
                    ? 'bg-accent/15 text-accent border-accent/30' 
                    : 'bg-bg-surface text-text-secondary border-border-theme'
                }`}>
                  {profile?.membership_name || (isMember ? 'Active Member' : 'Regular Guest')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Selection & Bulk Action States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPerformingBulk, setIsPerformingBulk] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: 'status_update' | 'cancel' | 'delete';
    title: string;
    message: string;
    targetStatus?: string;
    isDestructive?: boolean;
  } | null>(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    table_id: propTables.length > 0 ? propTables[0].id : '',
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '',
    duration_minutes: 60,
  });

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/dashboard-data?scope=tables');
      if (res.ok) {
        const json = await res.json();
        if (json.tables) {
          setTables(json.tables);
          if (json.tables.length > 0) {
            setFormData(prev => ({ ...prev, table_id: prev.table_id || json.tables[0].id }));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch tables", err);
    }
  };

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const json = await res.json();
        if (json.bookings) {
          setLocalBookings(json.bookings);
        }
      }
    } catch (err) {
      console.error("Failed to refresh bookings", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync prop bookings when changed
  useEffect(() => {
     
    setLocalBookings(bookings);
  }, [bookings]);

  // Sync prop tables when provided, avoiding redundant /api/dashboard-data calls
  useEffect(() => {
    if (propTables && propTables.length > 0) {
       
      setTables(propTables);
      setFormData(prev => ({ ...prev, table_id: prev.table_id || propTables[0].id }));
    } else {
      fetchTables();
    }
  }, [propTables]);

  // Filtered Bookings based on status and search query
  const filteredBookings = useMemo(() => {
    return localBookings.filter(b => {
      const matchesStatus = statusFilter === 'all' || b.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        b.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.customer_phone && b.customer_phone.includes(searchQuery)) ||
        b.table_id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [localBookings, statusFilter, searchQuery]);

  // Selection handlers
  const isAllSelected = filteredBookings.length > 0 && filteredBookings.every(b => selectedIds.has(b.id));
  const isPartiallySelected = filteredBookings.some(b => selectedIds.has(b.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Clear visible
      const newSet = new Set(selectedIds);
      filteredBookings.forEach(b => newSet.delete(b.id));
      setSelectedIds(newSet);
    } else {
      // Select all visible
      const newSet = new Set(selectedIds);
      filteredBookings.forEach(b => newSet.add(b.id));
      setSelectedIds(newSet);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Execute Bulk Action
  const executeBulkAction = async (action: 'status_update' | 'cancel' | 'delete', targetStatus?: string) => {
    if (selectedIds.size === 0) return;
    setIsPerformingBulk(true);
    const loadingToast = toast.loading(`Processing ${selectedIds.size} bookings...`);

    try {
      const res = await fetch('/api/bookings/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_ids: Array.from(selectedIds),
          action,
          status: targetStatus
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Successfully processed ${data.count} bookings.`, { id: loadingToast });
        setSelectedIds(new Set());
        setConfirmModal(null);
        await fetchBookings();
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || 'Failed to complete bulk action.', { id: loadingToast });
      }
    } catch (error: any) {
      toast.error('An error occurred during bulk operation.', { id: loadingToast });
    } finally {
      setIsPerformingBulk(false);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Creating booking...');
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           business_id: 'auto-filled-by-server',
           ...formData
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Booking confirmed!', { id: loadingToast });
        setIsModalOpen(false);
        await fetchBookings();
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.error || 'Failed to create booking', { id: loadingToast });
      }
    } catch (error: any) {
      toast.error('An error occurred', { id: loadingToast });
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{t(language, 'bookings')}</h2>
          <p className="text-sm text-text-secondary mt-1">{t(language, 'schedule_booking')}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto min-h-[44px] bg-accent hover:bg-accent-hover text-bg-surface font-bold py-2.5 px-6 rounded-lg btn-premium flex items-center justify-center gap-2 shadow-lg shadow-accent/20 touch-target transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            {t(language, 'new_booking')}
          </button>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 sm:p-4 bg-bg-card border-2 border-accent/40 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-accent/20 text-accent font-mono font-bold text-xs px-3 py-1.5 rounded-lg border border-accent/30 shrink-0">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={handleClearSelection}
              className="text-xs text-text-secondary hover:text-text-primary font-bold underline transition-colors touch-target py-1 px-2"
            >
              Clear All
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mark Confirmed */}
            <button
              disabled={isPerformingBulk}
              onClick={() => executeBulkAction('status_update', 'confirmed')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-success/15 hover:bg-success/25 text-success border border-success/30 transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              Mark Confirmed
            </button>

            {/* Mark Completed */}
            <button
              disabled={isPerformingBulk}
              onClick={() => executeBulkAction('status_update', 'completed')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Mark Completed
            </button>

            {/* Mark No-Show */}
            <button
              disabled={isPerformingBulk}
              onClick={() => executeBulkAction('status_update', 'no_show')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Mark No-Show
            </button>

            {/* Cancel */}
            <button
              disabled={isPerformingBulk}
              onClick={() => setConfirmModal({
                open: true,
                action: 'cancel',
                title: 'Cancel Selected Bookings',
                message: `Are you sure you want to cancel ${selectedIds.size} selected booking(s)? This will mark them as cancelled.`,
                isDestructive: false
              })}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel
            </button>

            {/* Delete */}
            <button
              disabled={isPerformingBulk}
              onClick={() => setConfirmModal({
                open: true,
                action: 'delete',
                title: 'Delete Selected Bookings',
                message: `Are you sure you want to permanently delete ${selectedIds.size} booking(s)? This action cannot be reversed.`,
                isDestructive: true
              })}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col shadow-sm">
        {/* Controls Bar: Search & Status Filter */}
        <div className="p-5 border-b border-border-theme bg-bg-primary/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold text-text-primary">{t(language, 'upcoming_bookings')}</h3>
            <p className="text-xs text-text-secondary mt-0.5">Manage schedule, assign tables, and perform bulk operations.</p>
            {address && address.trim() ? (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-text-secondary">
                <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate max-w-sm sm:max-w-md">{address.trim()}</span>
                {getDirectionsForBooking() && (
                  <a
                    href={getDirectionsForBooking()!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent font-semibold hover:underline shrink-0 ml-1.5"
                    title="Get Directions in Google Maps"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Get Directions</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-text-secondary/70">
                <MapPin className="w-3.5 h-3.5 text-text-disabled shrink-0" />
                <span>Address not configured. Set your club address in Settings &gt; Business Profile to enable Google Maps turn-by-turn directions.</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <svg className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" 
                placeholder="Search name, phone, table..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg-surface border border-border-theme rounded-lg text-xs text-text-primary outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-bg-surface border border-border-theme rounded-lg px-3 py-2 text-xs text-text-primary font-bold outline-none input-premium"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-8 space-y-4">
             {[1,2,3,4].map(i => (
               <div key={i} className="w-full h-16 bg-border-light/50 rounded-lg animate-pulse" />
             ))}
          </div>
        ) : (
          <>
            {/* Mobile Card List (md:hidden) */}
            <div className="md:hidden divide-y divide-border-theme">
              {filteredBookings.length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  {searchQuery || statusFilter !== 'all' ? (
                    <div className="flex flex-col items-center">
                      <svg className="w-10 h-10 text-text-disabled mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      <p className="text-sm font-bold text-text-primary">No bookings match the filters</p>
                      <p className="text-xs text-text-secondary mt-1">Try resetting the status filter or search query</p>
                    </div>
                  ) : (
                    <p className="text-sm">{t(language, 'schedule_booking_empty')}</p>
                  )}
                </div>
              ) : (
                filteredBookings.map((b) => {
                  const isSelected = selectedIds.has(b.id);
                  const statusLower = b.status?.toLowerCase();
                  return (
                    <div
                      key={b.id}
                      className={`p-4 transition-colors flex items-start gap-3 ${
                        isSelected ? 'bg-accent/5' : 'hover:bg-bg-surface/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(b.id)}
                          className="w-5 h-5 rounded border-border-theme bg-bg-surface accent-accent cursor-pointer touch-target"
                          aria-label={`Select booking for ${b.customer_name}`}
                        />
                      </div>
                      {/* Booking Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <button
                            type="button"
                            onClick={() => handleCustomerClick(b)}
                            className="font-bold text-sm text-text-primary truncate text-left hover:text-accent transition-colors flex items-center gap-1.5 focus:outline-none"
                            aria-label={`View profile for ${b.customer_name}`}
                          >
                            <span className="truncate">{b.customer_name}</span>
                            <User className="w-3.5 h-3.5 text-text-disabled shrink-0" />
                          </button>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border shrink-0 ${
                            statusLower === 'confirmed' ? 'border-success/50 text-success bg-success/10' :
                            statusLower === 'active' ? 'border-accent/50 text-accent bg-accent/10' :
                            statusLower === 'completed' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' :
                            statusLower === 'no_show' ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' :
                            'border-error/50 text-error bg-error/10'
                          }`}>
                            {b.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-text-secondary font-mono mb-2">
                          <span>{b.booking_date}</span>
                          <span>•</span>
                          <span className="font-bold text-text-primary">{b.start_time.substring(0, 5)}</span>
                          <span>•</span>
                          <span>{b.duration_minutes}m</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-accent font-mono uppercase bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                              {b.table_id}
                            </span>
                            <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded ${b.source === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-bg-surface text-text-secondary border border-border-theme'}`}>
                              {b.source}
                            </span>
                          </div>
                          {b.customer_phone && (
                            <a
                              href={`tel:${b.customer_phone}`}
                              className="text-xs font-mono text-text-secondary hover:text-accent flex items-center gap-1 touch-target py-1 px-1.5 rounded"
                            >
                              <span className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-text-secondary" />
                                {b.customer_phone}
                              </span>
                            </a>
                          )}
                        </div>

                        {/* Mobile Get Directions Action */}
                        {(() => {
                          const dirUrl = getDirectionsForBooking(b);
                          if (!dirUrl) return null;
                          return (
                            <div className="mt-2.5 pt-2 border-t border-border-theme/40 flex items-center justify-between gap-2 text-xs">
                              <span className="text-[11px] text-text-secondary truncate flex-1">
                                {b.club_address || address || b.club_name || businessName}
                              </span>
                              <a
                                href={dirUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline py-1 px-2 rounded bg-accent/10 border border-accent/20 shrink-0"
                              >
                                <Navigation className="w-3 h-3 text-accent" />
                                <span>Get Directions</span>
                              </a>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                    {/* Select All Checkbox */}
                    <th className="p-5 w-12 text-center">
                      <input 
                        type="checkbox"
                        checked={isAllSelected}
                        ref={input => {
                          if (input) input.indeterminate = isPartiallySelected;
                        }}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-border-theme bg-bg-surface accent-accent cursor-pointer"
                        title={isAllSelected ? "Clear All" : "Select All"}
                      />
                    </th>
                    <th className="p-5">{t(language, 'booking_date')} & {t(language, 'booking_time')}</th>
                    <th className="p-5">{t(language, 'client')}</th>
                    <th className="p-5">{t(language, 'table')}</th>
                    <th className="p-5 text-center">{t(language, 'duration')}</th>
                    <th className="p-5 text-center">Source</th>
                    <th className="p-5 text-center">{t(language, 'status')}</th>
                    <th className="p-5 text-center">Directions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-text-secondary">
                        {searchQuery || statusFilter !== 'all' ? (
                          <div className="flex flex-col items-center">
                            <svg className="w-10 h-10 text-text-disabled mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <p className="text-sm font-bold text-text-primary">No bookings match the filters</p>
                            <p className="text-xs text-text-secondary mt-1">Try resetting the status filter or search query</p>
                          </div>
                        ) : (
                          t(language, 'schedule_booking_empty')
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => {
                      const isSelected = selectedIds.has(b.id);
                      const statusLower = b.status?.toLowerCase();
                      const dirUrl = getDirectionsForBooking(b);
                      return (
                        <tr 
                          key={b.id} 
                          className={`border-b border-border-theme/50 transition-colors ${
                            isSelected ? 'bg-accent/5' : 'hover:bg-bg-surface/50'
                          }`}
                        >
                          {/* Row Checkbox */}
                          <td className="p-5 text-center">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(b.id)}
                              className="w-4 h-4 rounded border-border-theme bg-bg-surface accent-accent cursor-pointer"
                            />
                          </td>
                          <td className="p-5 text-sm text-text-secondary font-mono">
                            {b.booking_date} <span className="font-bold text-text-primary">{b.start_time.substring(0, 5)}</span>
                          </td>
                          <td className="p-5 text-sm font-bold text-text-primary">
                            <div
                              className="inline-flex flex-col cursor-pointer group"
                              onMouseEnter={(e) => handleCustomerMouseEnter(e, b)}
                              onMouseLeave={handleCustomerMouseLeave}
                              onClick={() => handleCustomerClick(b)}
                            >
                              <span className="group-hover:text-accent transition-colors flex items-center gap-1.5">
                                {b.customer_name}
                                <User className="w-3.5 h-3.5 text-text-disabled opacity-0 group-hover:opacity-100 transition-opacity" />
                              </span>
                              <div className="text-xs text-text-secondary font-normal font-mono">{b.customer_phone || 'No phone'}</div>
                            </div>
                          </td>
                          <td className="p-5 text-sm font-bold text-accent font-mono uppercase">{b.table_id}</td>
                          <td className="p-5 text-sm text-center text-text-secondary font-mono">{b.duration_minutes}m</td>
                          <td className="p-5 text-center">
                            <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded ${b.source === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 'bg-accent/10 text-accent'}`}>
                              {b.source}
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border uppercase shadow-sm ${
                              statusLower === 'confirmed' ? 'border-success/50 text-success bg-success/10' : 
                              statusLower === 'active' ? 'border-accent/50 text-accent bg-accent/10' :
                              statusLower === 'completed' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10' :
                              statusLower === 'no_show' ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' :
                              'border-error/50 text-error bg-error/10'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-5 text-center">
                            {dirUrl ? (
                              <a
                                href={dirUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/40 transition-colors shadow-sm"
                                title="Get Directions in Google Maps"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                                <span>Directions</span>
                              </a>
                            ) : (
                              <span className="text-xs text-text-disabled font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal for Destructive Actions */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-5 border-b flex items-center gap-3 ${
              confirmModal.isDestructive ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-warning/10 border-warning/20 text-warning'
            }`}>
              <div className="p-2 rounded-xl bg-bg-surface/50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-base font-bold text-text-primary">{confirmModal.title}</h3>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-text-secondary leading-relaxed">
                {confirmModal.message}
              </p>
              
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={isPerformingBulk}
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 min-h-[44px] py-2.5 bg-bg-surface text-text-secondary hover:text-text-primary font-bold text-xs uppercase rounded-xl border border-border-theme transition-colors touch-target flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPerformingBulk}
                  onClick={() => executeBulkAction(confirmModal.action, confirmModal.targetStatus)}
                  className={`flex-1 min-h-[44px] py-2.5 font-bold text-xs uppercase rounded-xl text-white transition-all shadow-md touch-target flex items-center justify-center ${
                    confirmModal.isDestructive 
                      ? 'bg-danger hover:bg-red-600 shadow-danger/20' 
                      : 'bg-warning text-black hover:bg-yellow-500 shadow-warning/20'
                  }`}
                >
                  {isPerformingBulk ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal / Mobile Sheet */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-bg-card border-t md:border border-border-theme rounded-t-2xl md:rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90dvh] md:max-h-[85vh] animate-sheet-up md:animate-entrance overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 bg-border-theme rounded-full opacity-60" />
            </div>

            <div className="px-5 py-4 border-b border-border-theme flex justify-between items-center bg-bg-surface shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-text-primary">{t(language, 'schedule_booking')}</h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="touch-target w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateBooking} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'customer_name')}</label>
                  <input 
                    type="text" 
                    required
                    value={formData.customer_name} 
                    onChange={e => setFormData({...formData, customer_name: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2.5 text-text-primary outline-none input-premium text-sm" 
                    placeholder="e.g. John Doe" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'phone_number')} (Optional)</label>
                  <input 
                    type="tel" 
                    value={formData.customer_phone} 
                    onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2.5 text-text-primary outline-none input-premium text-sm" 
                    placeholder="10 digit number" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'table')}</label>
                    <select 
                      value={formData.table_id} 
                      onChange={e => setFormData({...formData, table_id: e.target.value})}
                      className="w-full bg-bg-surface border border-border-theme rounded-lg px-3 py-2.5 text-text-primary outline-none font-mono input-premium text-sm"
                    >
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'duration_mins')}</label>
                    <select 
                      value={formData.duration_minutes} 
                      onChange={e => setFormData({...formData, duration_minutes: Number(e.target.value)})}
                      className="w-full bg-bg-surface border border-border-theme rounded-lg px-3 py-2.5 text-text-primary outline-none input-premium text-sm"
                    >
                      <option value={30}>30 mins</option>
                      <option value={60}>1 Hour</option>
                      <option value={90}>1.5 Hours</option>
                      <option value={120}>2 Hours</option>
                      <option value={180}>3 Hours</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'booking_date')}</label>
                    <input 
                      type="date" 
                      required
                      value={formData.booking_date} 
                      onChange={e => setFormData({...formData, booking_date: e.target.value})}
                      className="w-full bg-bg-surface border border-border-theme rounded-lg px-3 py-2.5 text-text-primary focus:border-accent outline-none text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'booking_time')}</label>
                    <input 
                      type="time" 
                      required
                      value={formData.start_time} 
                      onChange={e => setFormData({...formData, start_time: e.target.value})}
                      className="w-full bg-bg-surface border border-border-theme rounded-lg px-3 py-2.5 text-text-primary focus:border-accent outline-none text-sm" 
                    />
                  </div>
                </div>

                {/* Club Location Info */}
                {address && address.trim() ? (
                  <div className="p-3 bg-bg-surface/80 rounded-xl border border-border-theme flex items-start gap-2.5 text-xs">
                    <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-text-primary text-[11px] uppercase tracking-wider">
                        {businessName || 'Club Location'}
                      </div>
                      <div className="text-text-secondary mt-0.5 text-xs">{address.trim()}</div>
                      <div className="text-[11px] text-accent mt-1 flex items-center gap-1 font-medium">
                        <Navigation className="w-3 h-3" />
                        Customer receives Google Maps turn-by-turn directions link automatically
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-bg-surface/80 rounded-xl border border-border-theme/60 flex items-start gap-2.5 text-xs text-text-secondary">
                    <MapPin className="w-4 h-4 text-text-disabled shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-text-primary text-[11px] uppercase tracking-wider">
                        Club Location Not Configured
                      </div>
                      <div className="text-text-secondary mt-0.5 text-xs">
                        Save your club address in Settings &gt; Business Profile to automatically share Google Maps turn-by-turn directions with players.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky Footer Action */}
              <div className="p-4 sm:p-5 border-t border-border-theme bg-bg-surface shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5">
                <button 
                  type="submit" 
                  className="w-full min-h-[44px] bg-accent hover:bg-accent-hover text-bg-surface font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-accent/20 touch-target uppercase tracking-wider text-xs"
                >
                  {t(language, 'confirm_booking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Hover Popover Card */}
      {hoveredCustomer && (
        <div
          className="fixed z-50 w-72 bg-bg-surface border border-border-theme rounded-xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md"
          style={{
            top: `${hoveredCustomer.position.top}px`,
            left: `${hoveredCustomer.position.left}px`
          }}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          {renderCustomerCardContent(hoveredCustomer.booking)}
        </div>
      )}

      {/* Mobile Tap Bottom Sheet / Modal */}
      {activeCustomerSheet && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setActiveCustomerSheet(null)}
        >
          <div 
            className="w-full sm:max-w-md bg-bg-surface border-t sm:border border-border-theme rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-theme/60 pb-3 mb-4">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                Customer Profile
              </span>
              <button 
                onClick={() => setActiveCustomerSheet(null)}
                className="p-1 rounded-lg hover:bg-bg-primary text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderCustomerCardContent(activeCustomerSheet, true)}
          </div>
        </div>
      )}
    </div>
  );
}
