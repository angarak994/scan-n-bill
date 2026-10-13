'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/lib/i18n';

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  table_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  source: string;
  session_id?: string;
}

interface BookingsTabProps {
  businessId?: string | null;
  bookings?: Booking[];
  tables?: any[];
  onRefresh?: () => void;
}

export default function BookingsTab({ businessId, bookings = [], tables: propTables = [], onRefresh }: BookingsTabProps) {
  const { language } = useLanguage();
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings);
  const [isLoading, setIsLoading] = useState(false);
  const [tables, setTables] = useState<any[]>(propTables);

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
    <div className="mt-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{t(language, 'bookings')}</h2>
          <p className="text-sm text-text-secondary mt-1">{t(language, 'schedule_booking')}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-accent hover:bg-accent-hover text-bg-surface font-bold py-2 px-6 rounded-lg btn-premium flex items-center gap-2 shadow-lg shadow-accent/20"
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
            <span className="bg-accent/20 text-accent font-mono font-bold text-xs px-3 py-1.5 rounded-lg border border-accent/30">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={handleClearSelection}
              className="text-xs text-text-secondary hover:text-text-primary font-bold underline transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mark Confirmed */}
            <button
              disabled={isPerformingBulk}
              onClick={() => executeBulkAction('status_update', 'confirmed')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-success/15 hover:bg-success/25 text-success border border-success/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              Mark Confirmed
            </button>

            {/* Mark Completed */}
            <button
              disabled={isPerformingBulk}
              onClick={() => executeBulkAction('status_update', 'completed')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Mark Completed
            </button>

            {/* Mark No-Show */}
            <button
              disabled={isPerformingBulk}
              onClick={() => executeBulkAction('status_update', 'no_show')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Mark No-Show
            </button>

            {/* Cancel (Destructive - Confirmation) */}
            <button
              disabled={isPerformingBulk}
              onClick={() => setConfirmModal({
                open: true,
                action: 'cancel',
                title: 'Cancel Selected Bookings',
                message: `Are you sure you want to cancel ${selectedIds.size} selected booking(s)? This will mark them as cancelled.`,
                isDestructive: false
              })}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel Bookings
            </button>

            {/* Delete (Destructive - Confirmation) */}
            <button
              disabled={isPerformingBulk}
              onClick={() => setConfirmModal({
                open: true,
                action: 'delete',
                title: 'Delete Selected Bookings',
                message: `Are you sure you want to permanently delete ${selectedIds.size} booking(s)? This action cannot be reversed.`,
                isDestructive: true
              })}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 transition-all flex items-center gap-1.5"
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
          <div className="overflow-x-auto">
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
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-text-secondary">
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
                          {b.customer_name}
                          <div className="text-xs text-text-secondary font-normal font-mono">{b.customer_phone || 'No phone'}</div>
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
                  className="flex-1 py-2.5 bg-bg-surface text-text-secondary hover:text-text-primary font-bold text-xs uppercase rounded-xl border border-border-theme transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPerformingBulk}
                  onClick={() => executeBulkAction(confirmModal.action, confirmModal.targetStatus)}
                  className={`flex-1 py-2.5 font-bold text-xs uppercase rounded-xl text-white transition-all shadow-md ${
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

      {/* New Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-card border border-border-theme rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-theme flex justify-between items-center bg-bg-surface">
              <h3 className="text-lg font-bold text-text-primary">{t(language, 'schedule_booking')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'customer_name')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.customer_name} 
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
                  className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none input-premium" 
                  placeholder="e.g. John Doe" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'phone_number')} (Optional)</label>
                <input 
                  type="tel" 
                  value={formData.customer_phone} 
                  onChange={e => setFormData({...formData, customer_phone: e.target.value})}
                  className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none input-premium" 
                  placeholder="10 digit number" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'table')}</label>
                  <select 
                    value={formData.table_id} 
                    onChange={e => setFormData({...formData, table_id: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none font-mono input-premium"
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
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary outline-none input-premium"
                  >
                    <option value={30}>30 mins</option>
                    <option value={60}>1 Hour</option>
                    <option value={90}>1.5 Hours</option>
                    <option value={120}>2 Hours</option>
                    <option value={180}>3 Hours</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'booking_date')}</label>
                  <input 
                    type="date" 
                    required
                    value={formData.booking_date} 
                    onChange={e => setFormData({...formData, booking_date: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary focus:border-accent outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">{t(language, 'booking_time')}</label>
                  <input 
                    type="time" 
                    required
                    value={formData.start_time} 
                    onChange={e => setFormData({...formData, start_time: e.target.value})}
                    className="w-full bg-bg-surface border border-border-theme rounded-lg px-4 py-2 text-text-primary focus:border-accent outline-none" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border-theme mt-6">
                <button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent-hover text-bg-surface font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
                >
                  {t(language, 'confirm_booking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
