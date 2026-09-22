'use client';

import { useState, useEffect, useMemo } from 'react';

export default function PaymentsTab() {
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all'>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Pending'>('all');

    const [aggregates, setAggregates] = useState<any>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/financial-overview`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.payments) {
                        setPayments(json.payments);
                    }
                    if (json.aggregates) {
                        setAggregates(json.aggregates);
                    }
                }
            } catch (err) {
                console.error("Failed to load payments", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, []);

    // Data Processing
    const processedData = useMemo(() => {
        if (!payments) return { filtered: [], totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 };

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const filtered = payments.filter((p: any) => {
            const dateObj = new Date(p.created_at);
            const dateStr = p.created_at.split('T')[0];

            let timeMatch = false;
            switch (timeFilter) {
                case 'today': timeMatch = dateStr === todayStr; break;
                case 'yesterday': timeMatch = dateStr === yesterdayStr; break;
                case '7days': timeMatch = dateObj >= sevenDaysAgo; break;
                case 'month': timeMatch = dateObj >= firstOfMonth; break;
                case 'all': timeMatch = true; break;
            }

            let statusMatch = statusFilter === 'all' || p.status === statusFilter;
            const customerName = (p.customers?.name || 'Unknown').toLowerCase();
            let searchMatch = customerName.includes(searchQuery.toLowerCase());

            return timeMatch && statusMatch && searchMatch;
        });

        const activeAgg = aggregates?.[timeFilter] || { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 };
        return { 
            filtered, 
            totalCollection: activeAgg.totalCollection, 
            pendingAmount: activeAgg.pendingAmount, 
            cashCollection: activeAgg.cashCollection, 
            upiCollection: activeAgg.upiCollection 
        };
    }, [payments, aggregates, timeFilter, searchQuery, statusFilter]);

    if (isLoading) return <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-text-secondary animate-pulse uppercase tracking-widest">Loading Payments...</p>
        </div>
    </div>;

    const { filtered, totalCollection, pendingAmount, cashCollection, upiCollection } = processedData;

    return (
        <div className="mt-4 animate-in fade-in duration-300">
            {/* Header & Global Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Financial Overview</h2>
                    <p className="text-sm text-text-secondary mt-1">Track collections, pending dues, and payment methods.</p>
                </div>
                
                <div className="bg-bg-surface p-1 border border-border-theme rounded-lg flex gap-1 overflow-x-auto max-w-full custom-scrollbar">
                    {[
                        { id: 'today', label: 'Today' },
                        { id: 'yesterday', label: 'Yesterday' },
                        { id: '7days', label: 'Last 7 Days' },
                        { id: 'month', label: 'This Month' },
                        { id: 'all', label: 'All Time' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setTimeFilter(f.id as any)}
                            className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-all ${
                                timeFilter === f.id 
                                ? 'bg-bg-card border border-border-theme text-text-primary shadow-sm' 
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-card/50'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-6">
                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Total Collection</h3>
                        <div className="p-2 bg-success/10 rounded-lg">
                            <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-text-primary tracking-tight font-mono">₹{totalCollection.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
                    </div>
                    <span className="text-[10px] text-text-secondary">Revenue for selected period</span>
                </div>

                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">New Pending Dues</h3>
                        <div className="p-2 bg-warning/10 rounded-lg">
                            <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-warning tracking-tight font-mono">₹{pendingAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits:2})}</span>
                    </div>
                    <span className="text-[10px] text-text-secondary">Unpaid amount from this period</span>
                </div>

                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Payment Split</h3>
                        <div className="p-2 bg-accent/10 rounded-lg">
                            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 justify-center">
                        <div className="flex items-center justify-between text-sm font-mono">
                            <span className="text-xs text-text-secondary font-sans font-bold">UPI</span>
                            <span className="font-bold text-text-primary">₹{upiCollection.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm font-mono">
                            <span className="text-xs text-text-secondary font-sans font-bold">CASH</span>
                            <span className="font-bold text-text-primary">₹{cashCollection.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-bg-card rounded-xl p-5 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Total Transactions</h3>
                        <div className="p-2 bg-text-primary/5 rounded-lg">
                            <svg className="w-4 h-4 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-3xl font-black text-text-primary tracking-tight font-mono">{filtered.length}</span>
                    </div>
                    <span className="text-[10px] text-text-secondary">In selected period</span>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-border-theme bg-bg-primary/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">Transaction History</h3>
                        <p className="text-xs text-text-secondary mt-1">Detailed view of all transactions.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {/* Search Bar */}
                        <div className="relative flex-1 sm:w-64">
                            <svg className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input 
                                type="text"
                                placeholder="Search by name..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-theme rounded-lg text-sm text-text-primary focus:border-accent outline-none transition-colors"
                            />
                        </div>

                        {/* Status Filter */}
                        <select 
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="bg-bg-surface border border-border-theme rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent outline-none font-bold"
                        >
                            <option value="all">All Status</option>
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                                <th className="p-5">Date & Time</th>
                                <th className="p-5">Customer</th>
                                <th className="p-5 text-right">Amount</th>
                                <th className="p-5 text-center">Method</th>
                                <th className="p-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-12 h-12 text-text-disabled mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                            <p className="text-text-secondary text-sm font-bold">No transactions found</p>
                                            <p className="text-text-disabled text-xs mt-1">Try adjusting your filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((p: any) => (
                                    <tr key={p.id} className="border-b border-border-theme/50 hover:bg-bg-surface/50 transition-colors">
                                        <td className="p-5 text-sm text-text-secondary font-mono">
                                            {new Date(p.created_at).toLocaleString('en-IN', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-5 font-bold text-sm text-text-primary">{p.customers?.name || 'Unknown'}</td>
                                        <td className="p-5 text-text-primary text-sm font-bold font-mono text-right tabular-nums">₹{Number(p.amount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                                        <td className="p-5 text-center">
                                            <span className="bg-bg-surface border border-border-theme text-text-secondary text-xs px-3 py-1 rounded font-bold uppercase tracking-wider shadow-sm">
                                                {p.payment_method || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border uppercase shadow-sm ${
                                                p.status === 'Paid' ? 'border-success/50 text-success bg-success/10' : 
                                                p.status === 'Pending' ? 'border-warning/50 text-warning bg-warning/10' : 
                                                'border-error/50 text-error bg-error/10'
                                            }`}>
                                                {p.status}
                                            </span>
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
}
