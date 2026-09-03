import React, { useState, useEffect, useRef } from 'react';
import { calculateBilling, formatTimeReadable } from '@/lib/billing';
export function Tooltip({ text, children }: { text: string, children: React.ReactNode }) {
  return (
    <div className="group relative inline-flex justify-center items-center">
      {children}
      <div className="absolute bottom-full mb-2 hidden group-hover:block px-2 py-1 bg-text-primary text-bg-primary text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-[9999] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-text-primary"></div>
      </div>
    </div>
  );
}

export function CustomSelect({ value, onChange, options, className, placeholder }: { value: string, onChange: (val: string) => void, options: {value: string, label: string}[], className?: string, placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || value;

  return (
    <div className="relative w-full" ref={ref}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className={`flex justify-between items-center w-full text-left bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary px-4 py-3 min-h-[44px] ${className || ''}`}>
        <span className="truncate">{selectedLabel}</span>
        <svg className={`w-4 h-4 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-bg-surface border border-border-theme rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {options.map((opt, i) => (
            <div key={i} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`px-4 py-3 text-sm cursor-pointer hover:bg-bg-primary transition-colors ${value === opt.value ? 'text-accent font-bold bg-accent/5' : 'text-text-primary'}`}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimePicker({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [hh, mm] = (value || '12:00').split(':');
  let hourNum = parseInt(hh || '12');
  const isPm = hourNum >= 12;
  const hour12 = hourNum % 12 || 12;
  const hourStr = hour12.toString().padStart(2, '0');
  
  const updateTime = (h12: string, min: string, pm: boolean) => {
    let h24 = parseInt(h12);
    if (pm && h24 < 12) h24 += 12;
    if (!pm && h24 === 12) h24 = 0;
    onChange(`${h24.toString().padStart(2, '0')}:${min.padStart(2, '0')}`);
  };

  const hourOpts = Array.from({length: 12}, (_, i) => ({ value: (i+1).toString().padStart(2, '0'), label: (i+1).toString().padStart(2, '0') }));
  const minOpts = ['00', '15', '30', '45'].map(m => ({ value: m, label: m }));
  const periodOpts = [{value: 'AM', label: 'AM'}, {value: 'PM', label: 'PM'}];

  return (
    <div className="flex gap-2 w-full">
      <CustomSelect className="flex-1" value={hourStr} onChange={(v) => updateTime(v, mm, isPm)} options={hourOpts} />
      <div className="flex items-center text-text-secondary font-bold">:</div>
      <CustomSelect className="flex-1" value={mm || '00'} onChange={(v) => updateTime(hourStr, v, isPm)} options={minOpts} />
      <CustomSelect className="flex-1 min-w-[80px]" value={isPm ? 'PM' : 'AM'} onChange={(v) => updateTime(hourStr, mm, v === 'PM')} options={periodOpts} />
    </div>
  );
}

export function NotificationBell({ businessId }: { businessId: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  useEffect(() => {
    if (!businessId) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`/api/notifications?b=${businessId}`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [businessId]);
  
  const handleOpen = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Mark all as read visually immediately
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      // Update backend
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'mark_read', business_id: businessId })
        });
      } catch(e) {}
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);
  
  const handleClearAll = async () => {
    setNotifications([]);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all', business_id: businessId })
      });
    } catch(e) {}
  }
  
  return (
    <div className="relative z-50">
      <button onClick={handleOpen} className="relative p-1.5 rounded-full outline-none focus:outline-none text-text-secondary hover:text-text-primary transition-colors hover-lift">
        <svg className={`w-5 h-5 ${unreadCount > 0 && !isOpen ? 'animate-soft-pulse text-warning' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-error rounded-full border-2 border-bg-primary">
            {unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div ref={dropdownRef} className="absolute right-0 mt-2 w-80 bg-bg-surface border border-border-theme rounded-xl shadow-2xl overflow-hidden glass-panel z-[100] transform transition-all origin-top-right animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-border-light flex justify-between items-center bg-bg-primary/50">
            <h3 className="font-bold text-sm">Notifications</h3>
            {notifications.length > 0 && (
              <button onClick={handleClearAll} className="text-[10px] uppercase tracking-widest text-text-secondary hover:text-error transition-colors">Clear All</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-text-secondary text-sm">No new notifications</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`p-4 border-b border-border-light/50 text-sm ${n.is_read ? 'opacity-70' : 'bg-primary/5'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className={`font-bold ${n.type === 'success' ? 'text-success' : n.type === 'warning' ? 'text-warning' : n.type === 'error' ? 'text-error' : 'text-info'}`}>{n.title}</p>
                    <span className="text-[10px] text-text-disabled">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-text-secondary text-xs">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LiveTotalOpenCounter({ activeSessions, pricingRules, currentDiscounts, activePromo }: any) {
  const [totalOpenBill, setTotalOpenBill] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const isPromoValid = activePromo && new Date(activePromo.end_time).getTime() > now.getTime();
      
      const total = activeSessions.reduce((acc: number, session: any) => {
        const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
        try {
          let tableDiscount = currentDiscounts?.[session.table_id] || undefined;
          if (!tableDiscount && isPromoValid && activePromo) {
            tableDiscount = { percent: activePromo.discount_percent, applyToFood: false };
          }
          const endFull = session.paused_at ? session.paused_at : now.toISOString();
          const res = calculateBilling(startFull, endFull, session.game_type, pricingRules, session.num_players || 1, tableDiscount, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
          return acc + res.cost;
        } catch { return acc; }
      }, 0);
      setTotalOpenBill(total);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSessions, pricingRules, currentDiscounts, activePromo]);

  return <span className="font-mono tabular-nums">{totalOpenBill.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).replace('₹', '₹')}</span>;
}

export function LivePromoTimer({ activePromo }: { activePromo: any }) {
  const [timeLeft, setTimeLeft] = useState("00:00:00");

  useEffect(() => {
    if (!activePromo) return;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(activePromo.end_time).getTime();
      if (end > now) {
        const diffSecs = Math.floor((end - now) / 1000);
        const h = Math.floor(diffSecs / 3600);
        const m = Math.floor((diffSecs % 3600) / 60);
        const s = diffSecs % 60;
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft("00:00:00");
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activePromo]);

  return <span className="font-mono tabular-nums">{timeLeft}</span>;
}

export const PrivacyText = ({ value, isPrivacyMode, type = 'currency', formatINR }: { value: number | string, isPrivacyMode: boolean, type?: 'currency' | 'text', formatINR?: (v: number) => string }) => {
  if (isPrivacyMode) return <span className="tracking-widest opacity-80">••••••</span>;
  if (type === 'currency' && typeof value === 'number' && formatINR) return <>{formatINR(value)}</>;
  return <>{value}</>;
};

export function LiveSessionRow({ session, currentDiscounts, isPrivacyMode, isPromoValid, activePromo, pricingRules, handleIntervention, toReadableIST, formatINR, onRequestEndSession }: { session: any, currentDiscounts: any, isPrivacyMode: boolean, isPromoValid: boolean, activePromo: any, pricingRules: any, handleIntervention: any, toReadableIST: any, formatINR: any, onRequestEndSession?: (session: any, liveCost: number) => void }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Only update if the session is ACTIVE and NOT paused
    if (session.status !== 'ACTIVE' || session.paused_at) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [session.status, session.paused_at]);

  const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
  const endFull = session.paused_at ? session.paused_at : now.toISOString();
  
  let liveDuration = '0m';
  let liveCost = 0;
  let liveSlab = 'None';
  let tableDiscount: any = undefined;
  
  try {
    tableDiscount = currentDiscounts?.[session.table_id] || undefined;
    if (!tableDiscount && isPromoValid && activePromo) {
      tableDiscount = { percent: activePromo.discount_percent, applyToFood: false };
    }
    const res = calculateBilling(startFull, endFull, session.game_type, pricingRules, session.num_players || 1, tableDiscount, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
    liveDuration = res.duration.replace(' min', 'm').replace(' hr ', 'h ');
    liveCost = res.cost;
    liveSlab = res.slabs_applied;
  } catch (e) {}

  const intervalVal = pricingRules?.globalSettings?.smart_reminder_interval_minutes;
  const reminderIntervalMinutes = intervalVal !== undefined ? intervalVal : 60;
  
  // If last_checked_at is available use it, else fallback to last_activity_at or startFull
  const lastCheckedStr = session.last_checked_at || session.last_activity_at || startFull;
  const lastCheckedAt = new Date(lastCheckedStr).getTime();
  const minutesSinceLastCheck = (now.getTime() - lastCheckedAt) / 60000;
  
  const isOverdue = reminderIntervalMinutes > 0 && minutesSinceLastCheck >= reminderIntervalMinutes;
  const isCriticallyOverdue = reminderIntervalMinutes > 0 && minutesSinceLastCheck >= (reminderIntervalMinutes + 15);

  let statusUI = (
    <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-accent/50 text-accent bg-accent/10 uppercase shadow-sm">Active</span>
  );
  if (session.paused_at) {
    statusUI = <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-warning/50 text-warning bg-warning/10 uppercase shadow-sm">Paused</span>;
  } else if (isCriticallyOverdue) {
    statusUI = <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-error/50 text-error bg-error/10 uppercase shadow-sm animate-pulse">Confirmation Overdue</span>;
  } else if (isOverdue) {
    statusUI = <span className="px-3 py-1.5 rounded-md text-xs font-bold tracking-widest border border-warning/50 text-warning bg-warning/10 uppercase shadow-sm">Needs Confirmation</span>;
  }

  return (
    <tr className={`border-b border-border-theme/50 hover:bg-bg-surface transition-all duration-200 group`}>
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
        <p className="text-xs text-text-secondary mt-1 tabular-nums">
          {formatTimeReadable(session.start_time, true, session.date)}
        </p>
      </td>
      <td className="p-4 md:p-5">
         {statusUI}
      </td>
      <td className="p-4 md:p-5">
        <div className="flex items-center gap-2">
          <p className="text-base font-bold font-mono text-accent tabular-nums">
            <PrivacyText value={liveCost} isPrivacyMode={isPrivacyMode} formatINR={formatINR} />
          </p>
          {tableDiscount && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest border border-accent/50 text-accent bg-accent/10 shadow-sm animate-pulse">
              -{tableDiscount.percent}%
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-1 truncate max-w-[150px]" title={liveSlab}>{liveSlab}</p>
      </td>
      <td className="p-4 md:p-5 text-right">
         <div className="flex justify-end gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
          {session.paused_at ? (
            <button onClick={() => handleIntervention('resume', session.id)} className="px-4 py-2 text-sm font-bold text-warning border border-warning/30 rounded-lg hover:bg-warning hover:text-black transition-colors shadow-sm">Resume</button>
          ) : (
            <button onClick={() => handleIntervention('pause', session.id)} className="px-4 py-2 text-sm font-bold text-text-primary border border-border-theme rounded-lg hover:bg-bg-surface transition-colors shadow-sm">Pause</button>
          )}
          <button onClick={() => {
            const tid = prompt('Enter table number to transfer to:');
            if (tid) handleIntervention('transfer', session.id, undefined, tid);
          }} className="px-4 py-2 text-sm font-bold text-secondary border border-secondary/30 rounded-lg hover:bg-secondary hover:text-black transition-colors shadow-sm">Transfer</button>
          <button onClick={() => {
            if (onRequestEndSession) {
              onRequestEndSession(session, liveCost);
            } else {
              if (confirm(`End session for ${session.customer_name}? Current bill: ${isPrivacyMode ? '••••••' : formatINR(liveCost)}`)) {
                handleIntervention('force_end', session.id, liveCost);
              }
            }
          }} className="px-4 py-2 text-sm font-bold text-white bg-danger rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-danger/20 border border-transparent">End</button>
         </div>
      </td>
    </tr>
  );
}
