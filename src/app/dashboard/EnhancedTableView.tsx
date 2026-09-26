import React, { useState, useEffect } from 'react';
import { PrivacyText } from './components';

interface EnhancedTableViewProps {
  tables: any[];
  activeSessions: any[];
  preferences: any;
  pricingRules: any;
  currentDiscounts: any;
  activePromo: any;
  isPromoValid: boolean;
  menuItems: any[];
  businessId: string;
  isPrivacyMode: boolean;
  paymentQrConfig?: any;
  formatINR: (amount: number) => string;
  onIntervention: (action: string, sessionId: string, cost?: number, transferTableId?: string) => void;
  onEndSession: (session: any, cost: number, duration: string) => void;
  onStartSession: (tableId: string, gameType: string) => void;
  onReserveTable: (tableId: string, gameType: string) => void;
  onUpdateTables: (tables: any[]) => Promise<void>;
  calculateBilling: (start: string, end: string, gameType: string, pricingRules: any, players: number, discount: any, pausedSecs: number, lockedRate?: number, lockedRateName?: string) => { cost: number, duration: string, slabs_applied: string };
  parseDateString: (dateStr: string) => number;
  formatTimeReadable: (timeStr: string, includeSecs?: boolean, dateStr?: string) => string;
  getDisplayName: (name: string, memberId?: string) => string;
  getGlobalNow: () => Date;
  subscribeToTimer: (listener: () => void) => () => void;
  useSyncExternalStore: any;
  onRefresh?: () => void;
  layoutToggleNode?: React.ReactNode;
}

export function EnhancedTableView(props: EnhancedTableViewProps) {
  const {
    tables, activeSessions, preferences, pricingRules, currentDiscounts,
    activePromo, isPromoValid, menuItems, businessId, isPrivacyMode,
    formatINR, onIntervention, onEndSession, onStartSession, onReserveTable, onUpdateTables,
    calculateBilling, getDisplayName, getGlobalNow, subscribeToTimer, useSyncExternalStore,
    parseDateString
  } = props;

  const globalNowDate = useSyncExternalStore(subscribeToTimer, getGlobalNow, getGlobalNow);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [addingFoodTableId, setAddingFoodTableId] = useState<string | null>(null);
  const [viewingOrdersSessionId, setViewingOrdersSessionId] = useState<string | null>(null);
  const [ordersSummary, setOrdersSummary] = useState<any[] | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isSubmittingFood, setIsSubmittingFood] = useState(false);

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
  };

  const updateCart = (itemName: string, delta: number) => {
    setCart(prev => {
      const current = prev[itemName] || 0;
      const next = Math.max(0, current + delta);
      const newCart = { ...prev, [itemName]: next };
      if (next === 0) delete newCart[itemName];
      return newCart;
    });
  };

  const submitFoodOrder = async () => {
    if (!addingFoodTableId) return;
    const session = activeSessions.find(s => s.table_id === addingFoodTableId);
    if (!session) return;
    if (Object.keys(cart).length === 0) {
      setAddingFoodTableId(null);
      return;
    }
    
    setIsSubmittingFood(true);
    try {
      const res = await fetch('/api/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          business_id: businessId,
          cart
        })
      });
      if (res.ok) {
        setAddingFoodTableId(null);
        props.onRefresh?.();
      }
    } catch (e) {
      console.error(e);
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
      <div className="flex justify-between items-center bg-bg-card p-4 rounded-xl border border-border-theme flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
           <div className="bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border border-border-theme">
              All Units: {tables.length}
           </div>
           <div className="text-text-secondary text-xs font-bold tracking-widest uppercase">
              <span className="text-accent">{activeSessions.length}</span> Live · <span>{tables.length - activeSessions.length}</span> Available
           </div>
           
           <div className="flex items-center gap-2 border-l border-border-theme pl-4 ml-2 overflow-x-auto">
             {['All', 'Available', 'Active', 'Pool', 'Snooker', 'PS5'].map(f => (
               <button 
                 key={f}
                 onClick={() => setFilter(f)}
                 className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors ${filter === f ? 'bg-bg-primary text-text-primary border border-border-theme shadow-sm' : 'text-text-disabled hover:text-text-primary border border-transparent'}`}
               >
                 {f}
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
            if (filter === 'Available') return !activeSessions.some(s => s.table_id === t.id);
            if (filter === 'Active') return activeSessions.some(s => s.table_id === t.id);
            if (filter === 'PS5') return t.type.toLowerCase().includes('ps5') || t.type.toLowerCase().includes('playstation');
            return t.type.toLowerCase().includes(filter.toLowerCase());
          });

          if (filteredTables.length === 0) {
            return (
              <div className="col-span-full flex flex-col items-center justify-center py-24 text-center bg-bg-card border border-border-theme rounded-xl">
                <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h4 className="text-xl font-bold text-white tracking-widest uppercase">No tables found</h4>
                <p className="text-text-disabled text-sm mt-2 font-medium">Try adjusting your filters or add a new unit from settings.</p>
              </div>
            );
          }

          return filteredTables.map(table => {
          const session = activeSessions.find(s => s.table_id === table.id);
          const isOccupied = !!session;
          const isPaused = session?.paused_at;
          const isPS5 = table.type.toLowerCase().includes('ps5') || table.type.toLowerCase().includes('playstation');

          let liveCost = 0;
          let liveDuration = '';
          
          if (isOccupied) {
            const now = !isPaused ? globalNowDate : new Date(parseDateString(session.paused_at));
            const startFull = session.start_time.includes('T') ? session.start_time : `${session.date}, ${session.start_time}`;
            const endFull = isPaused ? session.paused_at : now.toISOString();
            
            let tableDiscount = currentDiscounts?.[table.id] || undefined;
            if (!tableDiscount && isPromoValid && activePromo) {
              tableDiscount = { percent: activePromo.discount_percent, applyToFood: false };
            }
            try {
              const res = calculateBilling(startFull, endFull, session.game_type, pricingRules, session.num_players || 1, tableDiscount, session.paused_duration_seconds, session.locked_rate, session.locked_rate_name);
              liveCost = res.cost;
              
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
              key={table.id}
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
                              className="bg-bg-surface border border-accent rounded px-2 py-0.5 text-xl font-bold text-white outline-none w-24"
                              autoFocus
                           />
                        ) : (
                           <h4 
                              onDoubleClick={() => startEditing(table.id, table.name)} 
                              className="font-bold text-2xl text-text-primary cursor-text"
                              title="Double click to rename"
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
                     <span className={`text-[9px] font-bold tracking-widest uppercase ${isOccupied ? (isPaused ? 'text-warning' : 'text-accent') : 'text-emerald-500'}`}>{isOccupied ? (isPaused ? 'PAUSED' : 'LIVE') : 'AVAILABLE'}</span>
                  </div>
               </div>

               {/* Body */}
               <div className="flex-1 flex flex-col justify-center relative z-10 mt-1">
                  {isOccupied ? (
                     <div className="bg-bg-primary rounded-xl p-4 border border-[#16231E] flex flex-col gap-2 shadow-inner">
                        <p className="text-[10px] text-accent/70 text-center tracking-widest font-bold">SESSION ELAPSED</p>
                        <p className="text-3xl font-mono text-accent text-center font-black tracking-tight">{isPrivacyMode ? '••:••:••' : liveDuration}</p>
                        
                        <div className="flex justify-between text-[11px] mt-4 text-text-secondary font-medium">
                           <span>Table Fee:</span>
                           <span className="text-text-primary font-mono">{formatINR(liveCost - (session.food_cost || 0))}</span>
                        </div>
                        {(session.food_cost > 0) && (
                        <div 
                           onClick={(e) => { e.stopPropagation(); handleViewOrdersClick(session.id); }}
                           className="flex justify-between text-[11px] text-yellow-500/80 font-medium cursor-pointer hover:text-yellow-400 transition-colors group mt-1"
                        >
                           <span className="flex items-center gap-1">
                             F&B Orders 
                             <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                           </span>
                           <span className="text-yellow-500 font-mono">{formatINR(session.food_cost)}</span>
                        </div>
                        )}
                        <div className="border-t border-[#16231E] my-3"></div>
                        <div className="flex justify-between items-end gap-2">
                           <div className="text-[10px] text-text-disabled flex flex-col leading-tight">
                              <div className="flex items-center gap-1 mb-0.5">
                                 <svg className="w-3 h-3 text-accent shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                                 <span className="truncate max-w-[80px]">Relay auto-switch:</span>
                              </div>
                              <span className="text-accent font-bold ml-4">Armed</span>
                           </div>
                           <div className="flex flex-col items-end shrink-0">
                             <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-0.5">Total</span>
                             <span className="text-lg font-black text-text-primary font-mono leading-none">{isPrivacyMode ? '••••' : formatINR(liveCost)}</span>
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
                        <button onClick={() => handleAddFoodClick(table.id)} className="flex-[1.5] py-2.5 rounded-lg border border-border-theme text-text-primary hover:border-accent hover:text-accent bg-bg-surface hover:bg-bg-primary text-[11px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-all whitespace-nowrap shadow-sm">
                           + Quick Add
                        </button>
                        <button onClick={() => onEndSession(session, liveCost, liveDuration)} className="flex-[1] py-2.5 rounded-lg bg-[#EF4444] text-white hover:bg-red-600 text-[11px] font-bold uppercase tracking-widest flex justify-center items-center gap-2 transition-colors">
                           🔴 BILL
                        </button>
                     </>
                  ) : (
                     <>
                        <button onClick={() => onStartSession(table.id, table.type)} className="flex-[2] py-2.5 rounded-lg bg-accent text-black hover:bg-accent/90 text-sm font-black uppercase tracking-widest flex justify-center items-center gap-2 transition-colors">
                           ▶ START
                        </button>
                        <button onClick={() => onReserveTable(table.id, table.type)} className="flex-[1] py-2.5 rounded-lg bg-bg-surface border border-border-theme text-text-secondary text-[11px] font-bold uppercase tracking-widest transition-colors hover:text-text-primary hover:border-text-secondary">
                           Reserve
                        </button>
                     </>
                  )}
               </div>
            </div>
          )
        })})()}
      </div>

      {addingFoodTableId && (
        <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
          <style>{`
            @keyframes slideInRightDrawer {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-drawer {
              animation: slideInRightDrawer 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setAddingFoodTableId(null)}></div>
          <div className="relative w-full sm:w-[450px] h-screen max-h-[100dvh] bg-bg-card border-l border-border-theme shadow-2xl flex flex-col animate-drawer">
            <div className="p-5 border-b border-border-theme bg-bg-primary flex justify-between items-center">
              <div>
                <h3 className="font-black text-2xl text-text-primary tracking-tight">Quick Add</h3>
                <p className="text-accent text-sm font-bold uppercase tracking-widest mt-1">
                  Table {tables.find(t => t.id === addingFoodTableId)?.name || addingFoodTableId}
                </p>
              </div>
              <button onClick={() => setAddingFoodTableId(null)} className="w-10 h-10 flex items-center justify-center bg-bg-surface rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors border border-border-theme">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {menuItems?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-disabled gap-3">
                  <p className="text-sm font-bold tracking-widest uppercase">No Menu Items</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {menuItems?.map(item => {
                    const qty = cart[item.name] || 0;
                    return (
                      <div key={item.name} className="flex justify-between items-center p-4 bg-bg-surface border border-border-theme rounded-2xl hover:border-accent/50 transition-colors">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-base text-text-primary">{item.name}</span>
                          <span className="text-sm text-accent font-mono font-bold">{formatINR(item.price)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {qty > 0 ? (
                            <div className="flex items-center bg-bg-primary rounded-xl border border-border-theme overflow-hidden">
                              <button onClick={() => updateCart(item.name, -1)} className="w-10 h-10 text-text-primary flex items-center justify-center font-bold hover:bg-bg-primary transition-colors">-</button>
                              <span className="font-bold w-10 text-center text-base text-accent">{qty}</span>
                              <button onClick={() => updateCart(item.name, 1)} className="w-10 h-10 text-black bg-accent flex items-center justify-center font-bold hover:bg-accent/90 transition-colors">+</button>
                            </div>
                          ) : (
                            <button onClick={() => updateCart(item.name, 1)} className="px-6 py-2.5 bg-bg-primary border border-border-theme text-white text-sm font-bold rounded-xl hover:border-accent hover:text-accent transition-colors shadow-sm">ADD</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-border-theme bg-bg-primary flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-text-secondary text-xs font-bold uppercase tracking-widest">Running Total</span>
                <span className="text-2xl font-black text-accent tabular-nums">
                  {formatINR(Object.entries(cart).reduce((sum, [name, qty]) => {
                    const item = menuItems.find(i => i.name === name);
                    return sum + (item?.price || 0) * qty;
                  }, 0))}
                </span>
              </div>
              <button 
                onClick={submitFoodOrder}
                disabled={isSubmittingFood || Object.keys(cart).length === 0}
                className="w-full py-4 bg-accent text-black font-black uppercase tracking-widest text-sm rounded-xl disabled:opacity-50 transition-all hover:bg-accent/90 shadow-[0_4px_20px_rgba(var(--accent-color),0.3)] disabled:shadow-none"
              >
                {isSubmittingFood ? 'ADDING TO BILL...' : 'ADD TO SESSION'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingOrdersSessionId && (
        <div className="fixed inset-0 z-[9999] flex justify-end overflow-hidden">
          <style>{`
            @keyframes slideInRightDrawer {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-drawer {
              animation: slideInRightDrawer 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setViewingOrdersSessionId(null)}></div>
          <div className="relative w-full sm:w-[450px] h-screen max-h-[100dvh] bg-bg-card border-l border-border-theme shadow-2xl flex flex-col animate-drawer">
            <div className="p-5 border-b border-border-theme bg-bg-primary flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl text-text-primary tracking-tight">Order Summary</h3>
                <p className="text-accent text-xs font-bold uppercase tracking-widest mt-1">
                  Session Details
                </p>
              </div>
              <button onClick={() => setViewingOrdersSessionId(null)} className="w-8 h-8 flex items-center justify-center bg-bg-surface rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors border border-border-theme">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {isLoadingOrders ? (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-accent uppercase tracking-widest animate-pulse">Loading orders...</p>
                </div>
              ) : ordersSummary?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-text-disabled gap-3">
                  <p className="text-sm font-bold tracking-widest uppercase">No Orders Found</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {ordersSummary?.map((order, i) => (
                    <div key={i} className="bg-bg-surface border border-border-theme rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-border-theme/50">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Order #{i + 1}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">
                          {new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric' }).format(new Date(order.timestamp))}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {Object.entries(order.cart).map(([name, qty]) => {
                           const price = menuItems?.find(m => m.name === name)?.price || 0;
                           return (
                             <div key={name} className="flex justify-between items-center text-sm">
                               <span className="text-text-primary font-medium">
                                 <span className="text-accent font-bold mr-2">{String(qty)}x</span>{name}
                               </span>
                               <span className="font-mono text-text-secondary">{formatINR(price * (qty as number))}</span>
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
              <div className="p-5 border-t border-border-theme bg-bg-primary">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-xs font-bold uppercase tracking-widest">Total F&B Cost</span>
                  <span className="text-2xl font-black text-yellow-500 tabular-nums">
                    {formatINR(ordersSummary.reduce((sum, o) => sum + o.total, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
