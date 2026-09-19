'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function QKhataTab({ businessId, dbCustomers = [], memberships = [], membershipPlans = [] }: { businessId: string, dbCustomers?: any[], memberships?: any[], membershipPlans?: any[] }) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [ledgerHistory, setLedgerHistory] = useState<any[]>([]);
    const [isLedgerLoading, setIsLedgerLoading] = useState(false);
    
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementMethod, setSettlementMethod] = useState('Cash');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            const customersData = dbCustomers;
            const membersData = memberships;

            if (memberships) {
                const membersList = memberships.map(m => {
                    // Match with a true dbCustomer to get ledger balances if they've played
                    const matchedCustomer = dbCustomers?.find(c => 
                        (c.phone && c.phone === m.mobile) || 
                        (c.name && m.name && c.name.trim().toLowerCase() === m.name.trim().toLowerCase())
                    );
                    
                    return {
                        id: matchedCustomer ? matchedCustomer.id : m.id, // Prefer db customer ID for ledger queries
                        name: m.name,
                        phone: m.mobile,
                        outstanding_balance: matchedCustomer ? (matchedCustomer.outstanding_balance || 0) : 0,
                        total_billed: matchedCustomer ? (matchedCustomer.total_billed || 0) : 0,
                        total_paid: matchedCustomer ? (matchedCustomer.total_paid || 0) : 0,
                        is_customer_record: !!matchedCustomer,
                        tier: m.tier,
                        loyalty_points: m.loyalty_points
                    };
                });
                
                const sorted = membersList.sort((a, b) => Number(b.outstanding_balance) - Number(a.outstanding_balance));
                setCustomers(sorted);
                
                // If a customer is currently selected, refresh their specific data locally
                if (selectedCustomer) {
                    const freshCust = sorted.find(c => c.name === selectedCustomer.name);
                    if (freshCust) setSelectedCustomer(freshCust);
                }
            }
        } catch (err) {
            console.error("Failed to load QKhata data", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!businessId) return;
        
        // Listen to payments (ledger rows)
        const paySub = supabase.channel(`qkhata_payments_${businessId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `business_id=eq.${businessId}` }, () => {
                if (selectedCustomer) fetchLedgerHistory(selectedCustomer);
            }).subscribe();

        return () => {
            supabase.removeChannel(paySub);
        };
    }, [businessId, selectedCustomer]);

    useEffect(() => {
        fetchData();
    }, [dbCustomers, memberships]);

    // Keep selectedCustomer in sync with realtime updates from customers
    useEffect(() => {
        if (selectedCustomer) {
            const updated = customers.find(c => (c.name === selectedCustomer.name) || (c.phone && c.phone === selectedCustomer.phone));
            if (updated && (
                updated.outstanding_balance !== selectedCustomer.outstanding_balance ||
                updated.total_paid !== selectedCustomer.total_paid ||
                updated.total_billed !== selectedCustomer.total_billed ||
                updated.loyalty_points !== selectedCustomer.loyalty_points ||
                updated.id !== selectedCustomer.id ||
                updated.is_customer_record !== selectedCustomer.is_customer_record
            )) {
                setSelectedCustomer(updated);
            }
        }
    }, [customers, selectedCustomer]);

    const fetchLedgerHistory = async (customer: any) => {
        setIsLedgerLoading(true);
        if (customer && customer.is_customer_record === false) {
            setLedgerHistory([]);
            setIsLedgerLoading(false);
            return;
        }
        try {
            const res = await fetch(`/api/qkhata/ledger?businessId=${businessId}&customerId=${customer.id}`);
            const data = await res.json();
            if (data.ledger) {
                setLedgerHistory(data.ledger);
            }
        } catch (error) {
            console.error("Failed to load ledger history", error);
        } finally {
            setIsLedgerLoading(false);
        }
    };

    const handleSelectCustomer = (c: any) => {
        setSelectedCustomer(c);
        fetchLedgerHistory(c);
        setSettlementAmount('');
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Ledger...</div>;

    const filteredCustomers = customers.filter((c: any) => 
        (c.name || 'Unknown').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone && c.phone.includes(searchTerm))
    );

    const totalOutstanding = customers.reduce((sum: number, c: any) => sum + Number(c.outstanding_balance), 0);

    const handleSettle = async () => {
        if (!selectedCustomer || !settlementAmount || isNaN(Number(settlementAmount))) return;
        setIsSubmitting(true);
        const amount = Number(settlementAmount);
        
        try {
            const res = await fetch('/api/qkhata/settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    customerId: selectedCustomer.id,
                    amount,
                    settlementMethod,
                    selectedCustomerName: selectedCustomer.name,
                    selectedCustomerPhone: selectedCustomer.phone,
                    isCustomerRecord: selectedCustomer.is_customer_record
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to settle');
            }

            const data = await res.json();
            
            // If it was a new record auto-created, update local selection to new ID immediately
            if (selectedCustomer.is_customer_record === false && data.customerId) {
                setSelectedCustomer({ ...selectedCustomer, id: data.customerId, is_customer_record: true });
            }

            toast.success('Payment recorded successfully');
            setSettlementAmount('');
            // the realtime channels will automatically refresh the list and the ledger!
            
        } catch (error) {
            console.error("Error settling balance", error);
            toast.error("Failed to settle balance.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendReminder = async (e: React.MouseEvent, customer: any) => {
        e.stopPropagation();
        if (!customer.phone || Number(customer.outstanding_balance) <= 0) return;
        
        const toastId = toast.loading('Sending WhatsApp reminder...');
        try {
            const { data: business } = await supabase.from('businesses').select('business_name').eq('id', businessId).single();
            const res = await fetch('/api/whatsapp-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: customer.phone,
                    amount: customer.outstanding_balance,
                    customerName: customer.name,
                    businessName: business?.business_name || 'Our Business'
                })
            });
            if (!res.ok) throw new Error('Failed to send');
            toast.success('Reminder sent!', { id: toastId });
        } catch (error) {
            console.error('Reminder error:', error);
            toast.error('Failed to send reminder', { id: toastId });
        }
    };

    return (
        <div className="mt-4">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 shrink-0">
                <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Total Outstanding</h3>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    </div>
                    <div className="flex items-end gap-2 sm:gap-3 mb-2">
                        <span className="text-2xl sm:text-4xl font-bold text-red-500/90 tracking-tight font-mono tabular-nums">₹{totalOutstanding.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {/* Main Content Area */}
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden shadow-sm flex flex-col lg:flex-row h-[calc(100vh-240px)] min-h-[600px]">
                
                {/* Left Panel: Customer List */}
                <div className={`w-full lg:w-[350px] shrink-0 h-full ${selectedCustomer ? 'hidden lg:flex' : 'flex'} flex-col border-r border-border-theme bg-bg-primary/20`}>
                    <div className="p-5 border-b border-border-theme shrink-0">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-text-primary tracking-tight">Members</h3>
                            <p className="text-xs text-text-secondary mt-0.5">Select a member to view ledger</p>
                        </div>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search name or phone..." 
                                className="w-full px-4 py-2 pl-9 bg-bg-card border border-border-theme rounded-md focus:border-accent outline-none text-sm text-text-primary placeholder-text-secondary transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredCustomers.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center text-center h-full">
                                <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-theme flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                                <p className="text-text-secondary text-sm font-medium">No registered members found.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border-theme/30 p-2">
                                {filteredCustomers.map(c => (
                                    <li 
                                        key={c.id} 
                                        onClick={() => handleSelectCustomer(c)}
                                        className={`group relative p-4 mb-2 rounded-xl cursor-pointer transition-all duration-300 ${selectedCustomer?.id === c.id ? 'bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 shadow-[0_0_15px_rgba(var(--accent),0.1)]' : 'bg-bg-surface hover:bg-bg-surface/80 border border-border-theme hover:border-accent/30 hover:shadow-lg'}`}
                                    >
                                        {selectedCustomer?.id === c.id && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r-full shadow-[0_0_8px_rgba(var(--accent),0.8)]"></div>
                                        )}
                                        <div className="flex justify-between items-start mb-1.5 pl-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedCustomer?.id === c.id ? 'bg-accent text-white' : 'bg-bg-primary text-text-primary group-hover:bg-accent/20 group-hover:text-accent'} transition-colors`}>
                                                    {c.name.substring(0,2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${selectedCustomer?.id === c.id ? 'text-accent' : 'text-text-primary group-hover:text-accent'} transition-colors`}>{c.name}</p>
                                                    <p className="text-[10px] text-text-secondary font-mono tracking-wider">{c.phone || 'NO PHONE'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <p className={`text-sm font-bold font-mono tabular-nums tracking-tight ${Number(c.outstanding_balance) > 0 ? 'text-red-500/90' : 'text-text-secondary'}`}>
                                                    ₹{Number(c.outstanding_balance).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mt-3 pl-2">
                                            <div className="flex gap-2">
                                                {c.tier && <span className="text-[9px] font-bold tracking-widest uppercase border border-border-theme px-1.5 py-0.5 rounded text-text-secondary bg-bg-primary/50">{membershipPlans?.find((p:any) => String(p.id).toLowerCase() === String(c.tier).toLowerCase())?.name || 'Standard Tier'}</span>}
                                                {c.loyalty_points !== undefined && <span className="text-[9px] font-bold tracking-widest uppercase border border-accent/20 px-1.5 py-0.5 rounded text-accent bg-accent/5">{c.loyalty_points} PTS</span>}
                                            </div>
                                            {Number(c.outstanding_balance) > 0 && c.phone && (
                                                <button onClick={(e) => handleSendReminder(e, c)} className="text-[10px] text-[#25D366] hover:bg-[#25D366] hover:text-white border border-[#25D366]/30 px-2 py-0.5 rounded transition-all font-medium flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm.029 18.88c-1.161 0-2.305-.292-3.318-.844l-3.677.964.984-3.595c-.607-1.052-.927-2.246-.926-3.468.001-3.825 3.113-6.937 6.937-6.937 3.825 0 6.938 3.112 6.938 6.937 0 3.825-3.113 6.938-6.938 6.938z"/></svg>
                                                    Remind
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Right Panel: Detailed Ledger View */}
                <div className={`flex-1 min-w-0 h-full ${!selectedCustomer ? 'hidden lg:flex' : 'flex'} flex-col bg-bg-card`}>
                    {selectedCustomer ? (
                        <>
                            {/* Ledger Header */}
                            <div className="p-6 lg:p-8 border-b border-border-theme shrink-0">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <button onClick={() => setSelectedCustomer(null)} className="lg:hidden text-text-secondary hover:text-text-primary text-sm font-semibold mb-4 flex items-center gap-1 transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                                            Back to Members
                                        </button>
                                        <h2 className="text-2xl font-bold text-text-primary tracking-tight">{selectedCustomer.name}</h2>
                                        <p className="text-sm text-text-secondary font-mono mt-1">{selectedCustomer.phone}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-1">Current Balance</p>
                                        <p className={`text-3xl font-bold font-mono tabular-nums tracking-tight ${Number(selectedCustomer.outstanding_balance) > 0 ? 'text-red-500/90' : 'text-text-primary'}`}>
                                            ₹{Number(selectedCustomer.outstanding_balance).toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Settlement Bar - Premium Floating Style */}
                                <div className="bg-gradient-to-r from-bg-surface to-bg-primary p-5 rounded-2xl border border-border-theme/60 shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex flex-wrap gap-4 items-end relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors duration-700"></div>
                                    
                                    <div className="flex-1 min-w-[200px] relative z-10">
                                        <label className="block text-[10px] font-bold text-accent uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                            Record Payment
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-primary/50 font-bold text-lg">₹</span>
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                className="w-full pl-9 pr-4 py-2.5 bg-bg-card/50 backdrop-blur-md border border-border-theme rounded-xl focus:border-accent/50 focus:ring-1 focus:ring-accent/50 focus:bg-bg-card outline-none text-base font-mono font-bold transition-all placeholder-text-secondary/30"
                                                value={settlementAmount}
                                                onChange={(e) => setSettlementAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="relative z-10">
                                        <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Method</label>
                                        <select 
                                            className="w-32 px-4 py-2.5 bg-bg-card/50 backdrop-blur-md border border-border-theme rounded-xl focus:border-accent/50 focus:ring-1 focus:ring-accent/50 outline-none text-sm font-semibold transition-all appearance-none cursor-pointer"
                                            value={settlementMethod}
                                            onChange={(e) => setSettlementMethod(e.target.value)}
                                        >
                                            <option>Cash</option><option>UPI</option><option>Card</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleSettle}
                                        disabled={!settlementAmount || isSubmitting}
                                        className="relative z-10 bg-accent text-white px-8 py-2.5 rounded-xl font-bold text-sm hover:shadow-[0_0_15px_rgba(var(--accent),0.4)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none transition-all"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Settle Balance'}
                                    </button>
                                </div>
                            </div>

                            {/* Transaction History Table */}
                            <div className="flex-1 overflow-auto custom-scrollbar relative">
                                {isLedgerLoading ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-bg-card/50 backdrop-blur-sm z-20">
                                        <div className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4 text-text-secondary" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                            Loading history...
                                        </div>
                                    </div>
                                ) : ledgerHistory.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-text-secondary p-8">
                                        <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center border border-border-theme mb-3">
                                            <svg className="w-5 h-5 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </div>
                                        <p className="text-sm font-semibold text-text-primary">No transactions found</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse min-w-[600px]">
                                        <thead className="sticky top-0 bg-bg-card/95 backdrop-blur z-10 shadow-sm">
                                            <tr className="text-[10px] font-bold text-text-secondary uppercase tracking-widest border-b border-border-theme bg-bg-surface/50">
                                                <th className="p-4 pl-6 lg:pl-8 whitespace-nowrap">Date / Time</th>
                                                <th className="p-4">Details</th>
                                                <th className="p-4">Session Info</th>
                                                <th className="p-4 text-right text-red-500/80">Credit (Billed)</th>
                                                <th className="p-4 text-right text-[#25D366]/80">Debit (Paid)</th>
                                                <th className="p-4 pr-6 lg:pr-8 text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-theme/30">
                                            {ledgerHistory.map((row) => (
                                                <tr key={row.id} className="hover:bg-bg-surface/40 transition-all group">
                                                    <td className="p-4 pl-6 lg:pl-8">
                                                        <div className="text-sm font-bold text-text-primary whitespace-nowrap">{row.date}</div>
                                                        <div className="text-[10px] text-text-secondary font-mono tracking-widest mt-1 uppercase">{row.time}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-sm font-semibold text-text-primary">{row.description}</div>
                                                        {row.source && <div className={`text-[9px] font-bold tracking-widest uppercase mt-1.5 border inline-block px-1.5 py-0.5 rounded ${row.source === 'system' ? 'border-accent/30 text-accent bg-accent/5' : 'border-border-theme text-text-secondary bg-bg-primary/50'}`}>{row.source}</div>}
                                                    </td>
                                                    <td className="p-4">
                                                        {row.session_id ? (
                                                            <div className="text-xs text-text-secondary">
                                                                <div><span className="font-semibold">ID:</span> {row.session_id.split('-')[0]}</div>
                                                                {row.table_id && <div><span className="font-semibold">Table:</span> {row.table_id}</div>}
                                                                {row.game_type && <div><span className="font-semibold">Game:</span> {row.game_type}</div>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-text-secondary/50">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {row.credit > 0 ? <span className="text-sm font-semibold font-mono text-red-500">₹{row.credit.toFixed(2)}</span> : <span className="text-text-secondary/30">-</span>}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {row.payment > 0 ? <span className="text-sm font-semibold font-mono text-success">₹{row.payment.toFixed(2)}</span> : <span className="text-text-secondary/30">-</span>}
                                                    </td>
                                                    <td className="p-4 pr-6 lg:pr-8 text-right">
                                                        <span className={`text-sm font-semibold font-mono tabular-nums ${row.balance > 0 ? 'text-red-500' : 'text-text-primary'}`}>
                                                            ₹{row.balance.toFixed(2)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-bg-primary/20 to-bg-card relative overflow-hidden">
                            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 mix-blend-overlay"></div>
                            
                            <div className="relative z-10 w-24 h-24 mb-6 rounded-3xl bg-bg-surface border border-white/10 shadow-[0_0_40px_rgba(var(--accent),0.15)] flex items-center justify-center backdrop-blur-sm group hover:scale-105 transition-transform duration-500">
                                <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent rounded-3xl opacity-50"></div>
                                <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            </div>
                            <h3 className="relative z-10 text-2xl font-bold text-text-primary tracking-tight mb-3">QKhata Ledger</h3>
                            <p className="relative z-10 text-sm text-text-secondary max-w-sm leading-relaxed">
                                Select a registered member from the list to view their complete transaction history, outstanding balances, and record payments instantly.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
