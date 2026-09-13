'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function QKhataTab({ businessId }: { businessId: string }) {
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
            const { data, error } = await supabase.from('customers').select('*').eq('business_id', businessId).order('outstanding_balance', { ascending: false });

            if (data) {
                setCustomers(data);
                
                // If a customer is currently selected, refresh their specific data locally
                if (selectedCustomer) {
                    const freshCust = data.find(c => c.id === selectedCustomer.id);
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
        fetchData();
        
        // Listen to both customers (balances) and payments (ledger rows)
        const custSub = supabase.channel('qkhata_customers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${businessId}` }, () => {
                fetchData();
            }).subscribe();
            
        const paySub = supabase.channel('qkhata_payments')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `business_id=eq.${businessId}` }, () => {
                if (selectedCustomer) fetchLedgerHistory(selectedCustomer.id);
            }).subscribe();

        return () => {
            supabase.removeChannel(custSub);
            supabase.removeChannel(paySub);
        };
    }, [businessId]);

    const fetchLedgerHistory = async (customerId: string) => {
        setIsLedgerLoading(true);
        try {
            const res = await fetch(`/api/qkhata/ledger?businessId=${businessId}&customerId=${customerId}`);
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
        fetchLedgerHistory(c.id);
        setSettlementAmount('');
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Ledger...</div>;

    const filteredCustomers = customers.filter((c: any) => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone && c.phone.includes(searchTerm))
    );

    const totalOutstanding = customers.reduce((sum: number, c: any) => sum + Number(c.outstanding_balance), 0);

    const handleSettle = async () => {
        if (!selectedCustomer || !settlementAmount || isNaN(Number(settlementAmount))) return;
        setIsSubmitting(true);
        const amount = Number(settlementAmount);
        
        try {
            // Use API or direct supabase. Directly mimicking paymentService architecture for PAYMENT type.
            const paymentRecord = {
                business_id: businessId,
                customer_id: selectedCustomer.id,
                amount: amount,
                payment_method: settlementMethod,
                status: 'Paid',
                metadata: {
                    type: 'PAYMENT',
                    source: 'Dashboard Settlement'
                }
            };
            
            const { error: paymentError } = await supabase.from('payments').insert([paymentRecord]);
            if (paymentError) throw paymentError;

            const newTotalPaid = Number(selectedCustomer.total_paid) + amount;
            const newOutstanding = Number(selectedCustomer.total_billed) - newTotalPaid;

            const { error: customerError } = await supabase.from('customers').update({
                total_paid: newTotalPaid,
                outstanding_balance: newOutstanding,
                updated_at: new Date().toISOString()
            }).eq('id', selectedCustomer.id);

            if (customerError) throw customerError;

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
                            <div className="p-8 text-center text-text-secondary text-sm">No members found.</div>
                        ) : (
                            <ul className="divide-y divide-border-theme/50">
                                {filteredCustomers.map(c => (
                                    <li 
                                        key={c.id} 
                                        onClick={() => handleSelectCustomer(c)}
                                        className={`p-4 cursor-pointer transition-all hover:bg-bg-surface/50 ${selectedCustomer?.id === c.id ? 'bg-bg-surface/80 border-l-4 border-l-accent' : 'border-l-4 border-l-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className={`text-sm font-semibold ${selectedCustomer?.id === c.id ? 'text-accent' : 'text-text-primary'}`}>{c.name}</p>
                                            <p className={`text-sm font-semibold font-mono tabular-nums ${Number(c.outstanding_balance) > 0 ? 'text-red-500/90' : 'text-text-secondary'}`}>
                                                ₹{Number(c.outstanding_balance).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-xs text-text-secondary font-mono">{c.phone || 'No phone'}</p>
                                            {Number(c.outstanding_balance) > 0 && c.phone && (
                                                <button onClick={(e) => handleSendReminder(e, c)} className="text-[10px] text-[#25D366] hover:bg-[#25D366]/10 px-2 py-0.5 rounded transition-colors font-medium">
                                                    WhatsApp Reminder
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

                                {/* Settlement Bar */}
                                <div className="bg-bg-primary/40 p-4 rounded-xl border border-border-theme flex flex-wrap gap-4 items-end">
                                    <div className="flex-1 min-w-[200px]">
                                        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-1.5">Record Payment</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-semibold">₹</span>
                                            <input 
                                                type="number" 
                                                placeholder="0.00"
                                                className="w-full pl-7 pr-3 py-2 bg-bg-card border border-border-theme rounded-md focus:border-accent outline-none text-sm font-mono transition-colors"
                                                value={settlementAmount}
                                                onChange={(e) => setSettlementAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-1.5">Method</label>
                                        <select 
                                            className="w-32 px-3 py-2 bg-bg-card border border-border-theme rounded-md focus:border-accent outline-none text-sm transition-colors"
                                            value={settlementMethod}
                                            onChange={(e) => setSettlementMethod(e.target.value)}
                                        >
                                            <option>Cash</option><option>UPI</option><option>Card</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={handleSettle}
                                        disabled={!settlementAmount || isSubmitting}
                                        className="bg-text-primary text-bg-primary px-6 py-2 rounded-md font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Settle'}
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
                                            <tr className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest border-b border-border-theme">
                                                <th className="p-4 pl-6 lg:pl-8 whitespace-nowrap">Date / Time</th>
                                                <th className="p-4">Description</th>
                                                <th className="p-4 text-right">Credit (Billed)</th>
                                                <th className="p-4 text-right">Debit (Paid)</th>
                                                <th className="p-4 pr-6 lg:pr-8 text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-theme/50">
                                            {ledgerHistory.map((row) => (
                                                <tr key={row.id} className="hover:bg-bg-surface/30 transition-colors group">
                                                    <td className="p-4 pl-6 lg:pl-8">
                                                        <div className="text-sm font-semibold text-text-primary whitespace-nowrap">{row.date}</div>
                                                        <div className="text-xs text-text-secondary font-mono mt-0.5">{row.time}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-sm font-medium text-text-primary">{row.description}</div>
                                                        {row.source && <div className="text-[10px] text-text-secondary uppercase tracking-wider mt-1 border border-border-theme inline-block px-1.5 py-0.5 rounded bg-bg-primary/50">{row.source}</div>}
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
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-bg-primary/10">
                            <div className="w-16 h-16 mb-4 rounded-full bg-bg-surface border border-border-theme flex items-center justify-center">
                                <svg className="w-8 h-8 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            </div>
                            <h3 className="text-lg font-semibold text-text-primary tracking-tight mb-1">Select a Member</h3>
                            <p className="text-sm text-text-secondary max-w-sm">Choose a member from the left panel to view their complete QKhata ledger.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
