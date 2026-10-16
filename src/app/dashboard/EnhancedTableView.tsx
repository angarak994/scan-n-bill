import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { PrivacyText } from './components';
import { useLanguage } from '@/context/LanguageContext';
import { applySessionDiscounts } from '@/lib/billing';

interface EnhancedTableViewProps {
  tables: any[];
  activeSessions: any[];
  preferences: any;
  pricingRules: any;
  currentDiscounts: any;
  activePromotions: any[];
  menuItems: any[];
  businessId: string;
  isPrivacyMode: boolean;
  paymentQrConfig?: any;
  formatINR: (amount: number) => string;
  onIntervention: (action: string, sessionId: string, cost?: number, transferTableId?: string) => void;
  onEndSession: (session: any, cost: number, duration: string, breakdown?: { baseTableCost: number; foodCost: number; discountAmount: number; discountLabel?: string }) => void;
  onStartSession: (tableId: string, gameType: string) => void;
  onReserveTable: (tableId: string, gameType: string) => void;
  onUpdateTables: (tables: any[]) => Promise<void>;
  calculateBilling: (start: string, end: string, gameType: string, pricingRules: any, players: number, discount: any, pausedSecs: number, lockedRate?: number, lockedRateName?: string, activePromotions?: any[]) => { cost: number, baseCost: number, discountAmount: number, duration: string, slabs_applied: string, breakdown?: any[] };
  parseDateString: (dateStr: string) => number;
  formatTimeReadable: (timeStr: string, includeSecs?: boolean, dateStr?: string) => string;
  getDisplayName: (name: string, memberId?: string) => string;
  getGlobalNow: () => Date;
  subscribeToTimer: (listener: () => void) => () => void;
  useSyncExternalStore: any;
  onRefresh?: () => void;
  layoutToggleNode?: React.ReactNode;
}

interface TableCardItemProps {
  table: any;
  session?: any;
  currentDiscounts: any;
  pricingRules: any;
  activePromotions?: any[];
  isPrivacyMode: boolean;
  t: (key: any, fallback?: string) => string;
  formatINR: (val: number) => string;
  getDisplayName: (name: string, memberId?: string) => string;
  calculateBilling: any;
  parseDateString: any;
  subscribeToTimer: (listener: () => void) => () => void;
  getGlobalNow: () => Date;
  useSyncExternalStore: any;
  editingTableId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  startEditing: (id: string, name: string) => void;
  saveEdit: (id: string) => void;
  setEditingTableId: (id: string | null) => void;
  handleAddFoodClick: (tableId: string) => void;
  handleViewOrdersClick: (sessionId: string) => void;
  onEndSession: (session: any, liveCost: number, liveDuration: string, breakdown?: { baseTableCost: number; foodCost: number; discountAmount: number; discountLabel?: string }) => void;
  onStartSession: (tableId: string, tableType: string) => void;
  onReserveTable: (tableId: string, tableType: string) => void;
}

const TableCardItem = React.memo(function TableCardItem(props: TableCardItemProps) {
  const {
    table, session, currentDiscounts, pricingRules, activePromotions,
    isPrivacyMode, t, formatINR, getDisplayName, calculateBilling,
    parseDateString, subscribeToTimer, getGlobalNow, useSyncExternalStore,
    editingTableId, editName, setEditName, startEditing, saveEdit, setEditingTableId,
    handleAddFoodClick, handleViewOrdersClick, onEndSession, onStartSession, onReserveTable
  } = props;

  const isOccupied = !!session;
  const isPaused = session?.paused_at;
  const isPS5 = table.type.toLowerCase().includes('ps5') || table.type.toLowerCase().includes('playstation') || table.type.toLowerCase().includes('console');

  // ISOLATED TICKING: Only subscribe to the 1-second global timer when this specific table is actively running.
  // Vacant and paused tables do NOT trigger ticking re-renders!
  const now = useSyncExternalStore(
    isOccupied && !isPaused ? subscribeToTimer : () => () => {},
    getGlobalNow,
    getGlobalNow
  );

  let liveCost = 0;
  let liveBaseTableCost = 0;
  let liveDuration = '';
  let liveDiscount = 0;
  let tableDiscount: any = undefined;
  let discountLabel = '';

  if (isOccupied) {
    const effectiveNow = !isPaused ? now : new Date(parseDateString(session.paused_at));
    const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
    const endFull = isPaused ? session.paused_at : effectiveNow.toISOString();
    
    tableDiscount = currentDiscounts?.[table.id] || currentDiscounts?.['all'] || undefined;
    if (tableDiscount && tableDiscount.isActive === false) {
      tableDiscount = undefined;
    }

    try {
      // 1. Calculate table cost with time promos (before manual table discount)
      const res = calculateBilling(startFull, endFull, session.game_type, pricingRules, session.num_players || 1, undefined, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name, activePromotions);
      
      liveBaseTableCost = res.baseCost;
      const rawFoodCost = session.food_cost || 0;

      // 2. Authoritative discount calculation across table and F&B
      const disc = applySessionDiscounts(res.cost, rawFoodCost, tableDiscount);

      const promoDiscount = res.discountAmount || 0;
      liveDiscount = promoDiscount + disc.totalDiscountAmount;
      liveCost = disc.finalTotalCost;
      let effectiveLabel = '';
      if (disc.totalDiscountAmount > 0 && disc.discountAppliedLabel && disc.discountAppliedLabel !== 'None') {
        effectiveLabel = disc.discountAppliedLabel;
      }
      if (promoDiscount > 0) {
        const promoName = res.slabs_applied && res.slabs_applied !== 'None' ? res.slabs_applied : 'Promotional Rate';
        effectiveLabel = effectiveLabel ? `${effectiveLabel} + ${promoName}` : promoName;
      }
      discountLabel = effectiveLabel || (liveDiscount > 0 ? 'Discount' : 'None');
      
      // Calculate exact live ticking duration
      const startMs = new Date(parseDateString(startFull)).getTime();
      const endMs = new Date(parseDateString(endFull)).getTime();
      const totalSecs = Math.max(0, Math.floor((endMs - startMs) / 1000) - (session.paused_duration_seconds || 0));
      
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      liveDuration = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    } catch(e) {}
  }

  return (
    <div 
      className={`flex flex-col bg-bg-card border ${isOccupied ? (isPaused ? 'border-warning/50' : 'border-border-theme') : 'border-border-theme'} rounded-xl p-4 gap-4 min-h-[300px] relative overflow-hidden transition-all duration-300 ${!isOccupied && 'hover:border-border-theme'}`}
    >
       {/* Background Glow */}
       {isOccupied && !isPaused && <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none"></div>}
       
       {/* Header */}
       <div className="flex justify-between items-start z-10">
          <div className="flex flex-col">
             <div className="flex items-center gap-2">
                {editingTableId === table.id ? (
                   <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => saveEdit(table.id)}
                      onKeyDown={e => { if(e.key === 'Enter') saveEdit(table.id); if(e.key === 'Escape') setEditingTableId(null); }}
                      className="bg-bg-surface border border-accent rounded px-2 py-0.5 text-xl font-bold text-text-primary outline-none w-24"
                      autoFocus
                   />
                ) : (
                   <h4 
                      onDoubleClick={() => startEditing(table.id, table.name)} 
                      className="font-bold text-2xl text-text-primary cursor-text"
                      title={t('double_click_rename', 'Double click to rename')}
                   >
                      {table.name}
                   </h4>
                )}
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border border-border-theme text-text-secondary bg-bg-surface">{table.type}</span>
             </div>
             {!isOccupied && <p className="text-[11px] text-text-disabled mt-1 uppercase tracking-widest">Standard Slate</p>}
             {isOccupied && <p className="text-[13px] text-text-primary mt-1 font-semibold truncate max-w-[150px]">{getDisplayName(session.customer_name, session.member_id)}</p>}
          </div>
          <div className="flex items-center gap-1.5 bg-bg-surface px-2 py-1 rounded-full border border-border-theme shrink-0">
             <div className={`w-1.5 h-1.5 rounded-full ${isOccupied ? (isPaused ? 'bg-warning' : 'bg-accent shadow-[0_0_8px_rgba(var(--accent-color),0.8)] animate-pulse') : 'bg-emerald-500'}`}></div>
             <span className={`text-[9px] font-bold tracking-widest uppercase ${isOccupied ? (isPaused ? t('paused', 'PAUSED') : t('live', 'LIVE')) : t('available', 'AVAILABLE')}`}>{isOccupied ? (isPaused ? t('paused', 'PAUSED') : t('live', 'LIVE')) : t('available', 'AVAILABLE')}</span>
          </div>
       </div>

       {/* Body */}
       <div className="flex-1 flex flex-col justify-center relative z-10 mt-1">
          {isOccupied ? (
             <div className="bg-bg-primary rounded-xl p-4 border border-border-theme flex flex-col gap-2 shadow-inner">
                <p className="text-[10px] text-accent/70 text-center tracking-widest font-bold">{t('session_elapsed', 'SESSION ELAPSED')}</p>
                <p className="text-4xl font-mono text-accent text-center font-black tracking-tight">{isPrivacyMode ? '••:••:••' : liveDuration}</p>
                
                <div className="flex justify-between text-[13px] mt-4 text-text-secondary font-medium">
                   <span>{t('table_fee', 'Table Fee')}:</span>
                   <span className="text-text-primary font-mono">{formatINR(liveBaseTableCost)}</span>
                </div>
                {(session.food_cost > 0) && (
                <div 
                   onClick={(e) => { e.stopPropagation(); handleViewOrdersClick(session.id); }}
                   className="flex justify-between text-[13px] text-yellow-500/80 font-medium cursor-pointer hover:text-yellow-400 transition-colors group mt-1"
                >
                   <span className="flex items-center gap-1">
                     {t('food_cost', 'F&B Orders')} 
                     <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                   </span>
                   <span className="text-yellow-500 font-mono">{formatINR(session.food_cost)}</span>
                </div>
                )}
                {(liveDiscount > 0) && (
                <div className="flex justify-between text-[13px] text-success/90 font-medium mt-1 relative group cursor-pointer transition-colors hover:text-success">
                   <span className="flex items-center gap-1">
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                     {t('discount', 'Discount')}
                   </span>
                   <span className="text-success font-mono font-bold">- {formatINR(liveDiscount)}</span>
                   
                   {/* Discount Tooltip */}
                   <div className="absolute left-0 bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 translate-y-2 group-hover:translate-y-0">
                     <div className="bg-bg-primary border border-border-theme text-text-primary px-3 py-2 rounded-xl shadow-2xl shadow-black/20 whitespace-nowrap">
                       <p className="font-black text-[13px] text-success tracking-tight mb-1">{discountLabel ? `${discountLabel} Applied` : `${formatINR(liveDiscount)} OFF Applied`}</p>
                       <p className="text-text-secondary text-[11px] font-medium">Applies to: <span className="text-text-primary">{tableDiscount?.applyToFood ? 'Table Fee + F&B' : 'Table Fee only'}</span></p>
                       {tableDiscount?.minBillAmount ? (
                         <p className="text-text-secondary text-[10px] mt-0.5">Min Bill: <span className="text-text-primary font-mono font-bold">{formatINR(tableDiscount.minBillAmount)}</span></p>
                       ) : null}
                     </div>
                   </div>
                </div>
                )}
                <div className="border-t border-border-theme my-3"></div>
                <div className="flex justify-between items-end gap-2">
                   <div className="text-[11px] flex flex-col leading-tight">
                      <div className="flex items-center gap-1 mb-1 text-text-disabled">
                         <svg className="w-3.5 h-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                         <span className="font-semibold text-[10px]">IoT Smart Relay</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4">
                        <div className="w-1.5 h-1.5 bg-text-disabled/40 rounded-full"></div>
                        <span className="text-text-disabled/80 font-bold tracking-widest uppercase text-[9px]">Not Configured</span>
                      </div>
                   </div>
                   <div className="flex flex-col items-end shrink-0">
                     <span className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">{t('total_cost', 'Total')}</span>
                     <span className="text-2xl font-black text-text-primary font-mono leading-none">{isPrivacyMode ? '••••' : formatINR(liveCost)}</span>
                   </div>
                </div>
             </div>
          ) : (
             isPS5 ? (
                 <div className="w-full h-32 bg-gradient-to-r from-blue-900 to-violet-900 rounded-xl flex items-center justify-center border border-indigo-500/50 relative overflow-hidden group shadow-inner">
                     <div className="absolute inset-x-4 inset-y-2 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg border border-indigo-400 shadow-[inset_0_4px_20px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:scale-105 flex flex-col items-center justify-between py-2">
                         {/* TV Screen */}
                         <div className="w-3/4 h-2.5 bg-black rounded border border-gray-700 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex justify-center overflow-hidden">
                            <div className="w-1/2 h-full bg-blue-500/30 animate-pulse"></div>
                         </div>
                         
                         {/* Coffee Table with Controllers */}
                         <div className="w-1/2 h-7 bg-[#2A2750] rounded border border-[#3A3760] relative flex items-center justify-center gap-3">
                             {/* Controller 1 (Red glow) */}
                             <div className="w-3.5 h-2.5 bg-white rounded-full flex justify-between px-0.5 items-center shadow-[0_0_6px_rgba(239,68,68,0.7)]">
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                             </div>
                             {/* Controller 2 (Blue glow) */}
                             <div className="w-3.5 h-2.5 bg-white rounded-full flex justify-between px-0.5 items-center shadow-[0_0_6px_rgba(59,130,246,0.7)]">
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                                <div className="w-1 h-1 bg-black rounded-full"></div>
                             </div>
                         </div>
                         
                         {/* Couch */}
                         <div className="w-2/3 h-6 bg-[#1F2937] rounded-t-lg rounded-b-sm border-t border-gray-600 flex justify-between px-1">
                            <div className="w-1/3 h-full border-r border-gray-700"></div>
                            <div className="w-1/3 h-full border-r border-gray-700"></div>
                            <div className="w-1/3 h-full"></div>
                         </div>
                     </div>
                 </div>
             ) : (
                 <div className="w-full h-32 bg-emerald-900 rounded-xl flex items-center justify-center border border-emerald-700 relative overflow-hidden group shadow-inner">
                     <div className="absolute inset-x-4 inset-y-3 bg-emerald-600 rounded-lg border border-emerald-400 shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)] transition-transform duration-500 group-hover:scale-105">
                         <div className="absolute w-2 h-2 rounded-full bg-white left-[20%] top-1/2 -translate-y-1/2 shadow-[0_2px_4px_rgba(0,0,0,0.5)]"></div>
                         <div className="absolute w-2 h-2 rounded-full bg-[#EF4444] right-[30%] top-[45%] shadow-[0_2px_4px_rgba(0,0,0,0.5)]"></div>
                         <div className="absolute w-2 h-2 rounded-full bg-[#EAB308] right-[27%] top-[55%] shadow-[0_2px_4px_rgba(0,0,0,0.5)]"></div>
                         
                         {/* Pockets */}
                         <div className="absolute w-2.5 h-2.5 rounded-full bg-black -top-1 -left-1"></div>
                         <div className="absolute w-2.5 h-2.5 rounded-full bg-black -top-1 left-1/2 -translate-x-1/2"></div>
                         <div className="absolute w-2.5 h-2.5 rounded-full bg-black -top-1 -right-1"></div>
                         <div className="absolute w-2.5 h-2.5 rounded-full bg-black -bottom-1 -left-1"></div>
                         <div className="absolute w-2.5 h-2.5 rounded-full bg-black -bottom-1 left-1/2 -translate-x-1/2"></div>
                         <div className="absolute w-2.5 h-2.5 rounded-full bg-black -bottom-1 -right-1"></div>
                     </div>
                 </div>
             )
          )}
       </div>

       {/* Footer Buttons */}
       <div className="flex items-center gap-2 mt-2 z-10">
          {isOccupied ? (
             <>
                <button onClick={() => handleAddFoodClick(table.id)} className="flex-[1.5] min-h-[44px] py-2.5 px-2 rounded-lg border border-border-theme text-text-primary hover:border-accent hover:text-accent bg-bg-surface hover:bg-bg-primary text-[11px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-all whitespace-nowrap shadow-sm touch-target">
                   {t('quick_add', '+ Quick Add')}
                </button>
                <button onClick={() => onEndSession(session, liveCost, liveDuration, { baseTableCost: liveBaseTableCost, foodCost: session.food_cost || 0, discountAmount: liveDiscount, discountLabel })} className="flex-[1] min-h-[44px] py-2.5 px-2 rounded-lg bg-[#EF4444] text-white hover:bg-red-600 text-[11px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-colors touch-target">
                   {t('bill', 'Bill')}
                </button>
             </>
          ) : (
             <>
                <button onClick={() => onStartSession(table.id, table.type)} className="flex-[2] min-h-[44px] py-2.5 px-2 rounded-lg bg-accent text-black hover:bg-accent/90 text-sm font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-colors touch-target">
                   {t('start', 'Start')}
                </button>
                <button onClick={() => onReserveTable(table.id, table.type)} className="flex-[1] min-h-[44px] py-2.5 px-2 rounded-lg bg-bg-surface border border-border-theme text-text-secondary text-[11px] font-bold uppercase tracking-widest transition-colors hover:text-text-primary hover:border-text-secondary touch-target">
                   {t('reserve', 'Reserve')}
                </button>
             </>
          )}
       </div>
    </div>
  );
});

export function EnhancedTableView(props: EnhancedTableViewProps) {
  const {
    tables, activeSessions, preferences, pricingRules, currentDiscounts,
    activePromotions, menuItems, businessId, isPrivacyMode,
    formatINR, onIntervention, onEndSession, onStartSession, onReserveTable, onUpdateTables,
    calculateBilling, getDisplayName, getGlobalNow, subscribeToTimer, useSyncExternalStore,
    parseDateString
  } = props;

  const { t } = useLanguage();
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [addingFoodTableId, setAddingFoodTableId] = useState<string | null>(null);
  const [viewingOrdersSessionId, setViewingOrdersSessionId] = useState<string | null>(null);
  const [ordersSummary, setOrdersSummary] = useState<any[] | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [isSubmittingFood, setIsSubmittingFood] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [selectedFoodCategory, setSelectedFoodCategory] = useState('All');
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  const [filter, setFilter] = useState('All');

  const [tableDensity, setTableDensity] = useState<'compact' | 'comfortable' | 'expanded'>('comfortable');
  useEffect(() => {
    const saved = localStorage.getItem('qcontrol_table_density');
    if (saved) setTableDensity(saved as any);
  }, []);

  const changeDensity = (d: 'compact' | 'comfortable' | 'expanded') => {
    setTableDensity(d);
    localStorage.setItem('qcontrol_table_density', d);
  };

  // Keyboard shortcut listener (Escape to close drawers, Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (addingFoodTableId) setAddingFoodTableId(null);
        if (viewingOrdersSessionId) setViewingOrdersSessionId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addingFoodTableId, viewingOrdersSessionId]);

  // Default fast club options if menu is empty
  const DEFAULT_CLUB_ITEMS = useMemo(() => [
    { id: 'def_water', name: 'Water Bottle', price: 20, category: 'Beverages' },
    { id: 'def_cold_drink', name: 'Cold Drink / Soda', price: 40, category: 'Beverages' },
    { id: 'def_energy_drink', name: 'Energy Drink / Red Bull', price: 120, category: 'Beverages' },
    { id: 'def_chips', name: 'Chips / Snacks', price: 50, category: 'Snacks' }
  ], []);

  // Combined menu items with fallback and custom items
  const allAvailableMenuItems = useMemo(() => {
    const baseItems = menuItems && menuItems.length > 0 ? [...menuItems] : [...DEFAULT_CLUB_ITEMS];
    for (const [name, price] of Object.entries(customPrices)) {
      if (!baseItems.some(i => i.name.toLowerCase() === name.toLowerCase())) {
        baseItems.push({ id: `custom_${name}`, name, price, category: 'Custom' });
      }
    }
    return baseItems;
  }, [menuItems, DEFAULT_CLUB_ITEMS, customPrices]);

  const foodCategories = useMemo(() => {
    const cats = Array.from(new Set(allAvailableMenuItems.map(i => i.category || 'Other').filter(Boolean)));
    return ['All', ...cats];
  }, [allAvailableMenuItems]);

  const filteredMenuItems = useMemo(() => {
    return allAvailableMenuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(foodSearchQuery.toLowerCase());
      const matchesCategory = selectedFoodCategory === 'All' || item.category === selectedFoodCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allAvailableMenuItems, foodSearchQuery, selectedFoodCategory]);

  const totalItemCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const runningTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [name, qty]) => {
      const item = allAvailableMenuItems.find(i => i.name.toLowerCase() === name.toLowerCase());
      const price = item ? Number(item.price) : (Number(customPrices[name]) || 0);
      return sum + price * qty;
    }, 0);
  }, [cart, allAvailableMenuItems, customPrices]);

  // Active table and session resolution
  const activeTableObj = useMemo(() => {
    if (!addingFoodTableId) return null;
    return tables.find(t => 
      String(t.id).trim().toLowerCase() === String(addingFoodTableId).trim().toLowerCase() ||
      String(t.name).trim().toLowerCase() === String(addingFoodTableId).trim().toLowerCase()
    ) || { id: addingFoodTableId, name: addingFoodTableId };
  }, [tables, addingFoodTableId]);

  const activeSessionObj = useMemo(() => {
    if (!addingFoodTableId) return null;
    const targetId = String(addingFoodTableId).trim().toLowerCase();
    const tName = activeTableObj ? String(activeTableObj.name).trim().toLowerCase() : '';
    const tId = activeTableObj ? String(activeTableObj.id).trim().toLowerCase() : '';
    return activeSessions.find(s => {
      const sid = String(s.table_id || '').trim().toLowerCase();
      return sid === targetId || sid === tId || sid === tName;
    }) || null;
  }, [activeSessions, addingFoodTableId, activeTableObj]);

  // Table Edit Handlers
  const startEditing = (tableId: string, currentName: string) => {
    setEditingTableId(tableId);
    setEditName(currentName);
  };

  const saveEdit = async (tableId: string) => {
    if (!editName.trim()) {
      setEditingTableId(null);
      return;
    }
    const table = tables.find(t => t.id === tableId);
    if (!table || table.name === editName) {
      setEditingTableId(null);
      return;
    }
    const newTables = tables.map(t => t.id === tableId ? { ...t, name: editName } : t);
    await onUpdateTables(newTables);
    setEditingTableId(null);
  };

  // Food Handlers
  const handleAddFoodClick = (tableId: string) => {
    setAddingFoodTableId(tableId);
    setCart({});
    setFoodSearchQuery('');
    setSelectedFoodCategory('All');
    setShowCustomItemForm(false);
  };

  const updateCart = (itemName: string, delta: number, explicitPrice?: number) => {
    if (explicitPrice && !customPrices[itemName]) {
      setCustomPrices(prev => ({ ...prev, [itemName]: explicitPrice }));
    }
    setCart(prev => {
      const current = prev[itemName] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev, [itemName]: next };
      if (next === 0) delete newCart[itemName];
      return newCart;
    });
  };

  const handleAddCustomItem = () => {
    const name = customItemName.trim();
    const price = Number(customItemPrice);
    if (!name) {
      toast.error('Enter an item name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    updateCart(name, 1, price);
    setCustomItemName('');
    setCustomItemPrice('');
    setShowCustomItemForm(false);
    toast.success(`Added ${name} (₹${price})`);
  };

  const submitFoodOrder = async () => {
    if (!addingFoodTableId) return;
    
    if (!activeSessionObj) {
      toast.error('No active session found for this table.');
      return;
    }
    if (Object.keys(cart).length === 0) {
      toast.error('Please select at least one item to add.');
      return;
    }
    
    setIsSubmittingFood(true);
    try {
      const res = await fetch('/api/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionObj.id,
          business_id: businessId,
          cart,
          customPrices
        })
      });
      if (res.ok) {
        toast.success(`Items added to ${activeTableObj?.name || activeSessionObj.table_id} bill!`);
        setCart({});
        setAddingFoodTableId(null);
        props.onRefresh?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to add items to session.');
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Network error while adding items.');
    } finally {
      setIsSubmittingFood(false);
    }
  };

  const handleViewOrdersClick = async (sessionId: string) => {
    setViewingOrdersSessionId(sessionId);
    setIsLoadingOrders(true);
    setOrdersSummary(null);
    try {
      const res = await fetch(`/api/get-orders?session_id=${sessionId}&business_id=${businessId}`);
      if (res.ok) {
        const { orders } = await res.json();
        setOrdersSummary(orders);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-entrance">
      {/* Header Panel */}
      <div className="flex justify-between items-center bg-bg-card p-3 sm:p-4 rounded-xl border border-border-theme flex-wrap gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap max-w-full">
           <div className="bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-border-theme shrink-0">
              {t('all_units', 'All Units')}: {tables.length}
           </div>
           <div className="text-text-secondary text-xs font-bold tracking-widest uppercase shrink-0">
              <span className="text-accent">{activeSessions.length}</span> {t('live', 'Live')} · <span>{tables.length - activeSessions.length}</span> {t('available', 'Available')}
           </div>
           
           <div className="flex items-center gap-1.5 sm:gap-2 border-l-0 sm:border-l border-border-theme pl-0 sm:pl-4 ml-0 sm:ml-2 overflow-x-auto max-w-full pb-1 sm:pb-0 no-scrollbar">
             {[
               { id: 'All', label: t('filter', 'All') },
               { id: 'Available', label: t('available', 'Available') },
               { id: 'Active', label: t('live', 'Active') },
               { id: 'Pool', label: 'Pool' },
               { id: 'Snooker', label: 'Snooker' },
               { id: 'PS5', label: 'PS5' }
             ].map(f => (
               <button 
                 key={f.id}
                 onClick={() => setFilter(f.id)}
                 className={`px-3 py-1.5 rounded-md text-[11px] sm:text-[10px] font-bold uppercase tracking-widest transition-colors shrink-0 touch-target ${filter === f.id ? 'bg-bg-primary text-text-primary border border-border-theme shadow-sm' : 'text-text-disabled hover:text-text-primary border border-transparent'}`}
               >
                 {f.label}
               </button>
             ))}
           </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex bg-bg-surface rounded p-1 border border-border-theme">
            <button 
                onClick={() => {
                   if (tableDensity === 'comfortable') changeDensity('expanded');
                   else if (tableDensity === 'expanded') changeDensity('compact');
                   else changeDensity('comfortable');
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-bg-primary text-text-secondary hover:text-text-primary"
                title={`Current size: ${tableDensity}. Click to change.`}
            >
               {tableDensity === 'compact' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>}
               {tableDensity === 'comfortable' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>}
               {tableDensity === 'expanded' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"></path></svg>}
               <span className="w-20 text-left">{tableDensity}</span>
            </button>
          </div>
          {props.layoutToggleNode}
        </div>
      </div>

      <div className={`grid gap-6 ${tableDensity === 'compact' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : tableDensity === 'expanded' ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
        {(() => {
          const filteredTables = tables.filter(t => {
            if (filter === 'All') return true;
            if (filter === 'Available') return !activeSessions.some(s => String(s.table_id || '').trim().toLowerCase() === String(t.id || '').trim().toLowerCase());
            if (filter === 'Active') return activeSessions.some(s => String(s.table_id || '').trim().toLowerCase() === String(t.id || '').trim().toLowerCase());
            if (filter === 'PS5') return t.type.toLowerCase().includes('ps5') || t.type.toLowerCase().includes('playstation') || t.type.toLowerCase().includes('console');
            return t.type.toLowerCase().includes(filter.toLowerCase());
          });

          if (filteredTables.length === 0) {
            return (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-bg-card border border-border-theme rounded-xl">
                <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h4 className="text-xl font-bold text-text-primary tracking-widest uppercase">{t('no_tables_found', 'No tables found')}</h4>
                <p className="text-text-disabled text-sm mt-2 font-medium">{t('no_tables_desc', 'Try adjusting your filters or add a new unit from settings.')}</p>
              </div>
            );
          }

          return filteredTables.map(table => {
            const session = activeSessions.find(s => String(s.table_id || '').trim().toLowerCase() === String(table.id || '').trim().toLowerCase());
            return (
              <TableCardItem
                key={table.id}
                table={table}
                session={session}
                currentDiscounts={currentDiscounts}
                pricingRules={pricingRules}
                activePromotions={activePromotions}
                isPrivacyMode={isPrivacyMode}
                t={t}
                formatINR={formatINR}
                getDisplayName={getDisplayName}
                calculateBilling={calculateBilling}
                parseDateString={parseDateString}
                subscribeToTimer={subscribeToTimer}
                getGlobalNow={getGlobalNow}
                useSyncExternalStore={useSyncExternalStore}
                editingTableId={editingTableId}
                editName={editName}
                setEditName={setEditName}
                startEditing={startEditing}
                saveEdit={saveEdit}
                setEditingTableId={setEditingTableId}
                handleAddFoodClick={handleAddFoodClick}
                handleViewOrdersClick={handleViewOrdersClick}
                onEndSession={onEndSession}
                onStartSession={onStartSession}
                onReserveTable={onReserveTable}
              />
            );
          });
        })()}
      </div>

      {/* Quick Add / Add to Session Portal Drawer */}
      {mounted && addingFoodTableId && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end overflow-hidden" role="dialog" aria-modal="true" aria-label="Quick Add F&B to Session">
          <style>{`
            @keyframes slideInRightDrawer {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-drawer {
              animation: slideInRightDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
            onClick={() => setAddingFoodTableId(null)}
          />

          {/* Persistent Rigid Drawer */}
          <div className="relative w-full sm:w-[480px] h-[100dvh] max-h-[100dvh] bg-bg-card border-l border-border-theme shadow-2xl flex flex-col z-10 animate-drawer overflow-hidden">
            
            {/* 1. Header (Pinned & Rigid) */}
            <div className="p-4 sm:p-5 border-b border-border-theme bg-bg-primary shrink-0 flex flex-col gap-2.5">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <h3 className="font-black text-xl sm:text-2xl text-text-primary tracking-tight truncate">
                      {t('quick_add', 'Quick Add')}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-accent/15 text-accent border border-accent/30 uppercase tracking-wider">
                      {activeTableObj?.name || addingFoodTableId}
                    </span>
                  </div>
                  {activeSessionObj && (
                    <p className="text-xs text-text-secondary mt-1 truncate">
                      <span className="font-bold text-text-primary">{activeSessionObj.customer_name}</span> · <span className="capitalize">{activeSessionObj.game_type || 'Game'}</span>
                    </p>
                  )}
                </div>

                <button 
                  onClick={() => setAddingFoodTableId(null)}
                  className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-bg-surface rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors border border-border-theme shrink-0 touch-target"
                  aria-label="Close Quick Add"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>

              {/* Fast Table Switcher if multiple tables active */}
              {activeSessions.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar border-t border-border-theme/40">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary shrink-0 mr-1">Switch:</span>
                  {activeSessions.map(s => {
                    const tObj = tables.find(t => 
                      String(t.id).toLowerCase() === String(s.table_id).toLowerCase() || 
                      String(t.name).toLowerCase() === String(s.table_id).toLowerCase()
                    );
                    const tName = tObj?.name || s.table_id;
                    const isSelected = (tObj && tObj.id === addingFoodTableId) || s.table_id === addingFoodTableId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setAddingFoodTableId(tObj?.id || s.table_id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold shrink-0 transition-all ${isSelected ? 'bg-accent text-black shadow-sm font-black' : 'bg-bg-surface text-text-secondary border border-border-theme hover:text-text-primary hover:border-accent/40'}`}
                      >
                        {tName}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Above-the-fold Quick Action Bar (IMMEDIATELY ACCESSIBLE WITHOUT SCROLLING) */}
            <div className="px-4 py-3 bg-bg-surface border-b border-border-theme shrink-0 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary shrink-0">Total:</span>
                <span className="text-lg font-black font-mono text-accent tabular-nums truncate">{formatINR(runningTotal)}</span>
                <span className="text-[11px] font-semibold text-text-disabled shrink-0">
                  ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
                </span>
              </div>
              <button
                type="button"
                onClick={submitFoodOrder}
                disabled={isSubmittingFood || totalItemCount === 0}
                className="px-4 py-2 min-h-[40px] bg-accent text-black font-black uppercase tracking-wider text-xs rounded-xl disabled:opacity-40 transition-all hover:bg-accent/90 shadow-sm flex items-center gap-1.5 touch-target active:scale-95 shrink-0"
              >
                {isSubmittingFood ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                    <span>{t('add_to_session', 'Add to Session')}</span>
                  </>
                )}
              </button>
            </div>

            {/* 3. Search, Quick Filters & Custom Add Bar */}
            <div className="px-4 py-2.5 bg-bg-card border-b border-border-theme shrink-0 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={foodSearchQuery}
                    onChange={e => setFoodSearchQuery(e.target.value)}
                    placeholder="Search menu or snacks..."
                    className="w-full pl-8 pr-3 py-1.5 bg-bg-primary border border-border-theme rounded-lg text-xs text-text-primary placeholder:text-text-disabled outline-none focus:border-accent"
                  />
                  <svg className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  {foodSearchQuery && (
                    <button onClick={() => setFoodSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary text-xs">✕</button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomItemForm(!showCustomItemForm)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shrink-0 transition-colors border ${showCustomItemForm ? 'bg-accent text-black border-accent' : 'bg-bg-surface text-text-primary border-border-theme hover:border-accent/40'}`}
                >
                  + Custom
                </button>
              </div>

              {/* Quick Custom Item Entry Drawer Form */}
              {showCustomItemForm && (
                <div className="p-3 bg-bg-surface border border-accent/30 rounded-xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Quick Custom Charge</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customItemName}
                      onChange={e => setCustomItemName(e.target.value)}
                      placeholder="Item name (e.g. Chai, Cigarette)"
                      className="flex-[2] px-3 py-2 bg-bg-primary border border-border-theme rounded-lg text-xs text-text-primary outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      value={customItemPrice}
                      onChange={e => setCustomItemPrice(e.target.value)}
                      placeholder="₹ Price"
                      className="flex-[1] px-3 py-2 bg-bg-primary border border-border-theme rounded-lg text-xs font-mono font-bold text-text-primary outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="px-3 py-2 bg-accent text-black font-black text-xs rounded-lg uppercase tracking-wider hover:bg-accent/90 shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* Fast 1-Tap Staples Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-disabled shrink-0">Fast:</span>
                {DEFAULT_CLUB_ITEMS.map(staple => (
                  <button
                    key={staple.id}
                    type="button"
                    onClick={() => updateCart(staple.name, 1, staple.price)}
                    className="px-2 py-0.5 rounded-md bg-bg-surface border border-border-theme hover:border-accent/50 text-[11px] font-medium text-text-secondary hover:text-text-primary shrink-0 transition-colors flex items-center gap-1 font-mono"
                  >
                    <span>+</span> {staple.name.split(' ')[0]} <span className="text-accent font-bold">₹{staple.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Scrollable Items List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
              {filteredMenuItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-text-disabled gap-3">
                  <svg className="w-10 h-10 text-text-disabled/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  <p className="text-xs font-bold tracking-widest uppercase text-text-secondary">No matching items</p>
                  <button 
                    type="button" 
                    onClick={() => { setFoodSearchQuery(''); setSelectedFoodCategory('All'); }}
                    className="text-xs text-accent font-bold hover:underline"
                  >
                    Clear search or add custom item above
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredMenuItems.map(item => {
                    const qty = cart[item.name] || 0;
                    return (
                      <div 
                        key={item.name} 
                        className={`flex justify-between items-center p-3.5 sm:p-4 bg-bg-surface border rounded-2xl transition-all ${qty > 0 ? 'border-accent/80 bg-accent/[0.03] shadow-sm' : 'border-border-theme hover:border-border-theme/80'}`}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 pr-3">
                          <span className="font-bold text-sm sm:text-base text-text-primary truncate">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm text-accent font-mono font-black">{formatINR(item.price)}</span>
                            {item.category && item.category !== 'Other' && (
                              <span className="text-[10px] text-text-disabled uppercase tracking-wider font-semibold">· {item.category}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {qty > 0 ? (
                            <div className="flex items-center bg-bg-primary rounded-xl border border-border-theme overflow-hidden shadow-sm">
                              <button 
                                type="button"
                                onClick={() => updateCart(item.name, -1)} 
                                className="w-10 h-10 text-text-primary flex items-center justify-center font-bold text-lg hover:bg-bg-surface transition-colors active:scale-95 touch-target"
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span className="font-black w-9 text-center text-sm font-mono text-accent">{qty}</span>
                              <button 
                                type="button"
                                onClick={() => updateCart(item.name, 1, item.price)} 
                                className="w-10 h-10 text-black bg-accent flex items-center justify-center font-bold text-lg hover:bg-accent/90 transition-colors active:scale-95 touch-target"
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button 
                              type="button"
                              onClick={() => updateCart(item.name, 1, item.price)} 
                              className="px-5 py-2.5 bg-bg-surface border border-border-theme text-text-primary text-xs font-black uppercase tracking-wider rounded-xl hover:border-accent hover:text-accent hover:bg-bg-primary transition-all shadow-sm touch-target active:scale-95 min-h-[40px]"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Persistent Pinned Bottom Action Area */}
            <div className="p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-border-theme bg-bg-primary/95 backdrop-blur-md shrink-0 sticky bottom-0 z-20 flex flex-col gap-3 shadow-[0_-4px_25px_rgba(0,0,0,0.4)]">
              <div className="flex justify-between items-center px-1">
                <div className="flex flex-col">
                  <span className="text-text-secondary text-[11px] font-bold uppercase tracking-widest">{t('running_total', 'Running Total')}</span>
                  <span className="text-xs text-text-disabled font-medium">{totalItemCount} {totalItemCount === 1 ? 'item selected' : 'items selected'}</span>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-accent tabular-nums font-mono">
                  {formatINR(runningTotal)}
                </span>
              </div>
              <button 
                type="button"
                onClick={submitFoodOrder}
                disabled={isSubmittingFood || totalItemCount === 0}
                className="w-full min-h-[48px] py-3.5 px-4 bg-accent text-black font-black uppercase tracking-widest text-sm rounded-xl disabled:opacity-40 transition-all hover:bg-accent/90 shadow-[0_4px_20px_rgba(var(--accent-color),0.3)] disabled:shadow-none flex items-center justify-center gap-2 touch-target active:scale-98"
              >
                {isSubmittingFood ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>{t('loading', 'ADDING TO BILL...')}</span>
                  </>
                ) : totalItemCount === 0 ? (
                  <span>SELECT ITEMS TO ADD</span>
                ) : (
                  <span>{t('add_to_session', 'ADD TO SESSION')} · {formatINR(runningTotal)}</span>
                )}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Order Summary Portal Drawer */}
      {mounted && viewingOrdersSessionId && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end overflow-hidden" role="dialog" aria-modal="true" aria-label="Session Order Summary">
          <style>{`
            @keyframes slideInRightDrawer {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-drawer {
              animation: slideInRightDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setViewingOrdersSessionId(null)} />
          
          <div className="relative w-full sm:w-[460px] h-[100dvh] max-h-[100dvh] bg-bg-card border-l border-border-theme shadow-2xl flex flex-col z-10 animate-drawer overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border-theme bg-bg-primary shrink-0 flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl text-text-primary tracking-tight">Order Summary</h3>
                <p className="text-accent text-xs font-bold uppercase tracking-widest mt-1">
                  Active Session Orders
                </p>
              </div>
              <button 
                onClick={() => setViewingOrdersSessionId(null)} 
                className="w-9 h-9 flex items-center justify-center bg-bg-surface rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors border border-border-theme shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
              {isLoadingOrders ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-accent uppercase tracking-widest animate-pulse">Loading orders...</p>
                </div>
              ) : !ordersSummary || ordersSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-text-disabled gap-3 text-center">
                  <p className="text-sm font-bold tracking-widest uppercase">No Orders Found</p>
                  <p className="text-xs text-text-secondary max-w-xs">Use Quick Add on the table card to add food, drinks, or custom charges.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {ordersSummary.map((order, i) => (
                    <div key={i} className="bg-bg-surface border border-border-theme rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-theme/50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Order #{i + 1}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">
                          {order.timestamp ? new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric' }).format(new Date(order.timestamp)) : ''}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {order.cart && Object.entries(order.cart).map(([name, qty]) => {
                           const price = allAvailableMenuItems.find(m => m.name.toLowerCase() === name.toLowerCase())?.price || 0;
                           return (
                             <div key={name} className="flex justify-between items-center text-sm">
                               <span className="text-text-primary font-medium">
                                 <span className="text-accent font-bold mr-2">{String(qty)}x</span>{name}
                               </span>
                               <span className="font-mono text-text-secondary">{formatINR(price * Number(qty))}</span>
                             </div>
                           );
                        })}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border-theme/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Subtotal</span>
                        <span className="font-mono font-bold text-accent">{formatINR(order.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {!isLoadingOrders && ordersSummary && ordersSummary.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-border-theme bg-bg-primary/95 backdrop-blur-md shrink-0 sticky bottom-0 z-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-xs font-bold uppercase tracking-widest">Total F&B Cost</span>
                  <span className="text-2xl font-black text-accent tabular-nums font-mono">
                    {formatINR(ordersSummary.reduce((sum, o) => sum + (Number(o.total) || 0), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
