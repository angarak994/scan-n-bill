'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

type TimeFilter = 'today' | 'yesterday' | '7days' | 'month' | 'all';
type StatusFilter = 'all' | 'Paid' | 'Pending' | 'Refunded';
type MethodFilter = 'all' | 'Cash' | 'UPI' | 'Card' | 'QKhata';

interface AggregateData {
    totalCollection: number;
    pendingAmount: number;
    cashCollection: number;
    upiCollection: number;
    cardCollection: number;
    otherCollection: number;
    transactionCount: number;
    byMethod: Record<string, number>;
}

export default function PaymentsTab() {
    const [payments, setPayments] = useState<any[]>([]);
    const [aggregates, setAggregates] = useState<Record<string, AggregateData> | null>(null);
    const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
    const [periodBoundaries, setPeriodBoundaries] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    const fetchData = useCallback(async (isManualRefresh = false) => {
        if (isManualRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const res = await fetch('/api/financial-overview', {
                cache: 'no-store'
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `Server returned status ${res.status}`);
            }

            const json = await res.json();
            if (json.payments) {
                setPayments(json.payments);
            }
            if (json.aggregates) {
                setAggregates(json.aggregates);
            }
            if (json.timezone) {
                setTimezone(json.timezone);
            }
            if (json.periodBoundaries) {
                setPeriodBoundaries(json.periodBoundaries);
            }
        } catch (err: any) {
            console.error('[PaymentsTab] Failed to load payments:', err);
            setError(err.message || 'Failed to load financial records. Please try again.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [timeFilter, searchQuery, statusFilter, methodFilter]);

    // Format Date & Time in the authoritative business timezone
    const formatDateTime = useCallback((isoString: string) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleString('en-IN', {
                timeZone: timezone,
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return isoString;
        }
    }, [timezone]);

    // Helper to get 'YYYY-MM-DD' in business timezone
    const getDateStrInTz = useCallback((isoString: string) => {
        try {
            const d = new Date(isoString);
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(d);
        } catch {
            return isoString.split('T')[0];
        }
    }, [timezone]);

    // Data Processing & Filtering
    const processedData = useMemo(() => {
        if (!payments) {
            return {
                filtered: [],
                totalCollection: 0,
                pendingAmount: 0,
                cashCollection: 0,
                upiCollection: 0,
                cardCollection: 0,
                otherCollection: 0,
                totalTransactions: 0
            };
        }

        const boundaries = periodBoundaries || {
            today: new Date().toISOString().split('T')[0],
            yesterday: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            sevenDays: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
            month: `${new Date().toISOString().slice(0, 7)}-01`
        };

        const filtered = payments.filter((p: any) => {
            const recDateStr = getDateStrInTz(p.created_at);

            let timeMatch = false;
            switch (timeFilter) {
                case 'today': 
                    timeMatch = recDateStr === boundaries.today; 
                    break;
                case 'yesterday': 
                    timeMatch = recDateStr === boundaries.yesterday; 
                    break;
                case '7days': 
                    timeMatch = recDateStr >= boundaries.sevenDays && recDateStr <= boundaries.today; 
                    break;
                case 'month': 
                    timeMatch = recDateStr >= boundaries.month && recDateStr <= boundaries.today; 
                    break;
                case 'all': 
                    timeMatch = true; 
                    break;
            }

            let statusMatch = true;
            if (statusFilter === 'Paid') {
                statusMatch = p.status === 'Paid';
            } else if (statusFilter === 'Pending') {
                statusMatch = p.status === 'Pending' || p.status === 'Billed' || p.is_charge;
            } else if (statusFilter === 'Refunded') {
                statusMatch = p.status === 'Refunded';
            }

            let methodMatch = true;
            if (methodFilter !== 'all') {
                const normMethod = (p.payment_method || '').toLowerCase();
                const targetMethod = methodFilter.toLowerCase();
                methodMatch = normMethod.includes(targetMethod);
            }

            const customerName = (p.customer_name || p.customers?.name || '').toLowerCase();
            const tableId = (p.table_id || p.sessions?.table_id || '').toLowerCase();
            const paymentMethod = (p.payment_method || '').toLowerCase();
            const amountStr = String(p.amount || '');
            const txnId = (p.id || '').toLowerCase();
            const searchLower = searchQuery.toLowerCase().trim();

            const searchMatch = !searchLower || 
                customerName.includes(searchLower) ||
                tableId.includes(searchLower) ||
                paymentMethod.includes(searchLower) ||
                amountStr.includes(searchLower) ||
                txnId.includes(searchLower);

            return timeMatch && statusMatch && methodMatch && searchMatch;
        });

        const activeAgg = aggregates?.[timeFilter] || {
            totalCollection: 0,
            pendingAmount: 0,
            cashCollection: 0,
            upiCollection: 0,
            cardCollection: 0,
            otherCollection: 0,
            transactionCount: 0,
            byMethod: {}
        };

        return { 
            filtered, 
            totalCollection: activeAgg.totalCollection, 
            pendingAmount: activeAgg.pendingAmount, 
            cashCollection: activeAgg.cashCollection, 
            upiCollection: activeAgg.upiCollection,
            cardCollection: activeAgg.cardCollection,
            otherCollection: activeAgg.otherCollection,
            totalTransactions: activeAgg.transactionCount
        };
    }, [payments, aggregates, periodBoundaries, timeFilter, searchQuery, statusFilter, methodFilter, getDateStrInTz]);

    const { filtered, totalCollection, pendingAmount, cashCollection, upiCollection, cardCollection, otherCollection, totalTransactions } = processedData;

    // Pagination slice
    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    const paginatedTransactions = filtered.slice(startIndex, startIndex + itemsPerPage);

    const timeFilterLabel = {
        today: 'Today',
        yesterday: 'Yesterday',
        '7days': 'Last 7 Days',
        month: 'This Month',
        all: 'All Time'
    }[timeFilter];

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-9 h-9 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-text-secondary animate-pulse uppercase tracking-widest">
                        Loading Financial Overview...
                    </p>
                </div>
            </div>
        );
    }

    if (error && payments.length === 0) {
        return (
            <div className="mt-4 p-8 bg-bg-card border border-error/30 rounded-xl flex flex-col items-center justify-center min-h-[350px] text-center">
                <div className="w-14 h-14 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-1">Failed to Load Financial Data</h3>
                <p className="text-sm text-text-secondary max-w-md mb-6">{error}</p>
                <button
                    onClick={() => fetchData(false)}
                    className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-black font-black rounded-lg text-sm shadow-md transition-all flex items-center gap-2 min-h-[44px] touch-target"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry Connection
                </button>
            </div>
        );
    }

    return (
        <div className="mt-4 animate-in fade-in duration-300">
            {/* Header & Global Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Financial Overview</h2>
                    <p className="text-sm text-text-secondary mt-1">
                        Track collections, pending dues, and payment methods in real time.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0 no-scrollbar">
                    {/* Time Period Filter */}
                    <div className="bg-bg-surface p-1 border border-border-theme rounded-lg flex gap-1 overflow-x-auto max-w-full">
                        {[
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: '7days', label: 'Last 7 Days' },
                            { id: 'month', label: 'This Month' },
                            { id: 'all', label: 'All Time' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setTimeFilter(f.id as TimeFilter)}
                                className={`px-3.5 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-all touch-target shrink-0 flex items-center justify-center ${
                                    timeFilter === f.id 
                                    ? 'bg-bg-card border border-border-theme text-text-primary shadow-sm' 
                                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card/50'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => fetchData(true)}
                        disabled={isRefreshing}
                        title="Refresh financial data"
                        className="min-w-[40px] min-h-[40px] p-2.5 bg-bg-surface border border-border-theme hover:bg-bg-card rounded-lg text-text-secondary hover:text-text-primary transition-all disabled:opacity-50 touch-target flex items-center justify-center shrink-0"
                    >
                        <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-accent' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6">
                {/* Total Collection */}
                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Total Collection</h3>
                        <div className="p-2 bg-success/10 rounded-lg">
                            <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-text-primary tracking-tight font-mono">
                            ₹{totalCollection.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <span className="text-[10px] text-text-secondary">Revenue for {timeFilterLabel.toLowerCase()}</span>
                </div>

                {/* New Pending Dues */}
                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">New Pending Dues</h3>
                        <div className="p-2 bg-warning/10 rounded-lg">
                            <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-warning tracking-tight font-mono">
                            ₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <span className="text-[10px] text-text-secondary">Unpaid amount from {timeFilterLabel.toLowerCase()}</span>
                </div>

                {/* Payment Split */}
                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Payment Split</h3>
                        <div className="p-2 bg-accent/10 rounded-lg">
                            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1 justify-center">
                        <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
                            <span className="text-[11px] sm:text-xs text-text-secondary font-sans font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                UPI
                            </span>
                            <span className="font-bold text-text-primary">₹{upiCollection.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
                            <span className="text-[11px] sm:text-xs text-text-secondary font-sans font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                CASH
                            </span>
                            <span className="font-bold text-text-primary">₹{cashCollection.toLocaleString('en-IN')}</span>
                        </div>
                        {cardCollection > 0 && (
                            <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
                                <span className="text-[11px] sm:text-xs text-text-secondary font-sans font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                                    CARD
                                </span>
                                <span className="font-bold text-text-primary">₹{cardCollection.toLocaleString('en-IN')}</span>
                            </div>
                        )}
                        {otherCollection > 0 && (
                            <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
                                <span className="text-[11px] sm:text-xs text-text-secondary font-sans font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    OTHER
                                </span>
                                <span className="font-bold text-text-primary">₹{otherCollection.toLocaleString('en-IN')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Total Transactions */}
                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Total Transactions</h3>
                        <div className="p-2 bg-text-primary/5 rounded-lg">
                            <svg className="w-4 h-4 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-text-primary tracking-tight font-mono">{totalTransactions}</span>
                    </div>
                    <span className="text-[10px] text-text-secondary">Transactions in {timeFilterLabel.toLowerCase()}</span>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-border-theme bg-bg-primary/50 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">Transaction History</h3>
                        <p className="text-xs text-text-secondary mt-1">
                            Showing {filtered.length} {filtered.length === 1 ? 'record' : 'records'} for {timeFilterLabel.toLowerCase()}
                            {statusFilter !== 'all' && ` • Status: ${statusFilter}`}
                            {methodFilter !== 'all' && ` • Method: ${methodFilter}`}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        {/* Search Bar */}
                        <div className="relative flex-1 min-w-[200px] sm:w-64">
                            <svg className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input 
                                type="text"
                                placeholder="Search customer, table..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-theme rounded-lg text-sm text-text-primary focus:border-accent outline-none transition-colors"
                            />
                        </div>

                        {/* Status Filter */}
                        <select 
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                            className="bg-bg-surface border border-border-theme rounded-lg px-3 py-2 text-sm text-text-primary outline-none font-bold input-premium"
                        >
                            <option value="all">All Status</option>
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending / Billed</option>
                            <option value="Refunded">Refunded</option>
                        </select>

                        {/* Method Filter */}
                        <select 
                            value={methodFilter}
                            onChange={e => setMethodFilter(e.target.value as MethodFilter)}
                            className="bg-bg-surface border border-border-theme rounded-lg px-3 py-2 text-sm text-text-primary outline-none font-bold input-premium"
                        >
                            <option value="all">All Methods</option>
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="QKhata">QKhata (Credit)</option>
                        </select>
                    </div>
                </div>
                 {/* Mobile Card List (< md) */}
                <div className="md:hidden divide-y divide-border-theme">
                    {paginatedTransactions.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="flex flex-col items-center">
                                <svg className="w-10 h-10 text-text-disabled mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-text-secondary text-sm font-bold">No transactions found</p>
                                <p className="text-text-disabled text-xs mt-1">
                                    {searchQuery || statusFilter !== 'all' || methodFilter !== 'all' 
                                        ? 'Try adjusting your search or filters' 
                                        : `No financial transactions recorded for ${timeFilterLabel.toLowerCase()}`}
                                </p>
                            </div>
                        </div>
                    ) : (
                        paginatedTransactions.map((p: any) => {
                            const isSplit = Boolean(p.is_split || p.metadata?.split);
                            const tableLabel = p.table_id || p.sessions?.table_id;
                            const customerDisplayName = p.customer_name || p.customers?.name || 'Walk-in Customer';

                            return (
                                <div key={p.id} className="p-4 hover:bg-bg-surface/50 transition-colors">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-text-primary truncate">
                                                    {customerDisplayName}
                                                </span>
                                                {tableLabel && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-bg-surface border border-border-theme text-text-secondary">
                                                        {tableLabel}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-text-secondary font-mono mt-0.5 block">
                                                {formatDateTime(p.created_at)}
                                            </span>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-base font-black text-text-primary font-mono tabular-nums block">
                                                ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border mt-1 shadow-sm ${
                                                p.status === 'Paid' 
                                                    ? 'border-success/50 text-success bg-success/10' : 
                                                p.status === 'Pending' 
                                                    ? 'border-warning/50 text-warning bg-warning/10' : 
                                                p.status === 'Billed' 
                                                    ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 
                                                p.status === 'Refunded' 
                                                    ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' :
                                                    'border-error/50 text-error bg-error/10'
                                            }`}>
                                                {p.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border-theme/40">
                                        <span className="text-text-secondary text-[11px]">Payment Method:</span>
                                        <div className="inline-flex items-center gap-1.5 bg-bg-surface border border-border-theme text-text-secondary text-[11px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                            {isSplit && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" title="Split Payment" />
                                            )}
                                            <span>{p.payment_method || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Desktop Table View (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                                <th className="p-5">Date & Time</th>
                                <th className="p-5">Customer & Source</th>
                                <th className="p-5 text-right">Amount</th>
                                <th className="p-5 text-center">Method</th>
                                <th className="p-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-12 h-12 text-text-disabled mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="text-text-secondary text-sm font-bold">No transactions found</p>
                                            <p className="text-text-disabled text-xs mt-1">
                                                {searchQuery || statusFilter !== 'all' || methodFilter !== 'all' 
                                                    ? 'Try adjusting your search or filters' 
                                                    : `No financial transactions recorded for ${timeFilterLabel.toLowerCase()}`}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedTransactions.map((p: any) => {
                                    const isSplit = Boolean(p.is_split || p.metadata?.split);
                                    const tableLabel = p.table_id || p.sessions?.table_id;
                                    const customerDisplayName = p.customer_name || p.customers?.name || 'Walk-in Customer';

                                    return (
                                        <tr key={p.id} className="border-b border-border-theme/50 hover:bg-bg-surface/50 transition-colors">
                                            <td className="p-5 text-sm text-text-secondary font-mono">
                                                {formatDateTime(p.created_at)}
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-text-primary">
                                                        {customerDisplayName}
                                                    </span>
                                                    {tableLabel && (
                                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-bg-surface border border-border-theme text-text-secondary">
                                                            {tableLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-5 text-text-primary text-sm font-bold font-mono text-right tabular-nums">
                                                ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-5 text-center">
                                                <div className="inline-flex items-center gap-1.5 bg-bg-surface border border-border-theme text-text-secondary text-xs px-3 py-1 rounded font-bold uppercase tracking-wider shadow-sm">
                                                    {isSplit && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" title="Split Payment" />
                                                    )}
                                                    <span>{p.payment_method || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border uppercase shadow-sm ${
                                                    p.status === 'Paid' 
                                                        ? 'border-success/50 text-success bg-success/10' : 
                                                    p.status === 'Pending' 
                                                        ? 'border-warning/50 text-warning bg-warning/10' : 
                                                    p.status === 'Billed' 
                                                        ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 
                                                    p.status === 'Refunded' 
                                                        ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' :
                                                        'border-error/50 text-error bg-error/10'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filtered.length > 0 && (
                    <div className="p-4 border-t border-border-theme bg-bg-primary/30 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-text-secondary">
                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                            <span>Showing {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length} transactions</span>
                            <span className="text-text-disabled">|</span>
                            <span>Per page:</span>
                            <select
                                value={itemsPerPage}
                                onChange={e => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-bg-surface border border-border-theme rounded px-2.5 py-1 text-xs text-text-primary outline-none"
                            >
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={safeCurrentPage <= 1}
                                className="min-h-[44px] px-4 py-2 rounded-lg bg-bg-surface border border-border-theme text-text-primary hover:bg-bg-card disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-all touch-target flex items-center justify-center"
                            >
                                Previous
                            </button>
                            <span className="px-3 font-mono text-text-primary font-bold">
                                {safeCurrentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safeCurrentPage >= totalPages}
                                className="min-h-[44px] px-4 py-2 rounded-lg bg-bg-surface border border-border-theme text-text-primary hover:bg-bg-card disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-all touch-target flex items-center justify-center"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
