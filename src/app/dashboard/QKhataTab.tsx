'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function QKhataTab({ businessId }: { businessId: string }) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [settlementAmount, setSettlementAmount] = useState('');
    const [settlementMethod, setSettlementMethod] = useState('Cash');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!businessId) return;
        
        async function fetchData() {
            try {
                const { data } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('business_id', businessId)
                    .order('outstanding_balance', { ascending: false });
                if (data) setCustomers(data);
            } catch (err) {
                console.error("Failed to load QKhata data", err);
            } finally {
                setIsLoading(false);
            }
        }
        
        fetchData();
    }, [businessId]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Ledger...</div>;

    const filteredCustomers = customers.filter((c: any) => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phone && c.phone.includes(searchTerm))
    );

    const totalOutstanding = customers.reduce((sum: number, c: any) => sum + Number(c.outstanding_balance), 0);

    const handleSettle = async () => {
        if (!selectedCustomer || !settlementAmount || isNaN(Number(settlementAmount))) return;
        setIsSubmitting(true);
        try {
            const amount = Number(settlementAmount);
            
            // 1. Create payment
            const { error: paymentError } = await supabase.from('payments').insert([{
                business_id: businessId,
                customer_id: selectedCustomer.id,
                amount: amount,
                payment_method: settlementMethod,
                status: 'Paid'
            }]);

            if (paymentError) throw paymentError;

            // 2. Update customer balance
            const newTotalPaid = Number(selectedCustomer.total_paid) + amount;
            const newOutstanding = Number(selectedCustomer.total_billed) - newTotalPaid;

            const { error: customerError } = await supabase.from('customers').update({
                total_paid: newTotalPaid,
                outstanding_balance: newOutstanding,
                updated_at: new Date().toISOString()
            }).eq('id', selectedCustomer.id);

            if (customerError) throw customerError;

            // Update local state
            setCustomers(customers.map((c: any) => c.id === selectedCustomer.id ? {
                ...c,
                total_paid: newTotalPaid,
                outstanding_balance: newOutstanding
            } : c));

            setSelectedCustomer(null);
            setSettlementAmount('');
        } catch (error) {
            console.error("Error settling balance", error);
            alert("Failed to settle balance. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border-theme bg-bg-primary/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary">Ledger</h3>
                            <p className="text-xs text-text-secondary mt-1 italic">Track outstanding balances</p>
                        </div>
                        <div className="text-sm font-bold text-red-500/90 bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                            ₹{totalOutstanding.toFixed(2)}
                        </div>
                    </div>
                    
                    <div className="p-6 pb-2 relative">
                        <input 
                            type="text" 
                            placeholder="Search by name or phone..." 
                            className="w-full px-4 py-3 pl-10 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary placeholder-text-secondary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg className="w-4 h-4 absolute left-9 top-1/2 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-bg-primary/30 text-[10px] font-bold text-text-secondary uppercase tracking-widest border-y border-border-theme">
                                    <th className="p-5">Customer</th>
                                    <th className="p-5">Phone</th>
                                    <th className="p-5 text-right">Total Billed</th>
                                    <th className="p-5 text-right">Total Paid</th>
                                    <th className="p-5 text-right">Outstanding</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-text-secondary text-sm">
                                            No customers found in the ledger.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers.map((c: any) => (
                                        <tr 
                                            key={c.id} 
                                            onClick={() => setSelectedCustomer(c)}
                                            className="border-b border-border-theme/50 hover:bg-bg-surface/50 cursor-pointer transition-colors"
                                        >
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                                                        {c.name.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <p className="text-sm font-bold">{c.name}</p>
                                                </div>
                                            </td>
                                            <td className="p-5 text-text-secondary text-sm font-mono">{c.phone || '-'}</td>
                                            <td className="p-5 text-text-primary text-sm font-bold font-mono text-right tabular-nums">₹{Number(c.total_billed).toFixed(2)}</td>
                                            <td className="p-5 text-accent text-sm font-bold font-mono text-right tabular-nums">₹{Number(c.total_paid).toFixed(2)}</td>
                                            <td className={`p-5 text-right text-sm font-bold font-mono tabular-nums ${Number(c.outstanding_balance) > 0 ? 'text-red-500/90' : 'text-text-secondary'}`}>
                                                ₹{Number(c.outstanding_balance).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col sticky top-6">
                    <div className="p-6 border-b border-border-theme bg-bg-primary/50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-text-primary">Settle Balance</h3>
                            <p className="text-xs text-text-secondary mt-1 italic">Record customer payments</p>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        {!selectedCustomer ? (
                            <div className="text-center py-12 text-text-secondary bg-bg-primary/50 rounded-lg font-medium border border-border-theme border-dashed flex flex-col items-center justify-center gap-3">
                                <svg className="w-8 h-8 text-border-theme" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                <span className="text-sm">Select a customer from the list<br/>to settle their balance.</span>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="bg-bg-primary/50 p-4 rounded-lg border border-border-theme">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Customer</label>
                                    <div className="font-bold text-sm text-text-primary mt-1">{selectedCustomer.name}</div>
                                </div>
                                
                                <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-red-500/80">Current Outstanding</label>
                                    <div className="font-bold text-red-500/90 text-2xl mt-1 tracking-tight font-mono">
                                        ₹{Number(selectedCustomer.outstanding_balance).toFixed(2)}
                                    </div>
                                </div>

                                <hr className="border-border-theme my-2" />

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">Amount to Pay (₹)</label>
                                    <input 
                                        type="number" 
                                        className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary font-mono tabular-nums"
                                        value={settlementAmount}
                                        onChange={(e) => setSettlementAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">Payment Method</label>
                                    <select 
                                        className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-sm text-text-primary"
                                        value={settlementMethod}
                                        onChange={(e) => setSettlementMethod(e.target.value)}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Card">Card</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex flex-col gap-3">
                                    <button 
                                        onClick={handleSettle}
                                        disabled={isSubmitting || !settlementAmount}
                                        className="w-full bg-accent text-bg-primary font-bold py-3 px-6 rounded hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50 text-sm"
                                    >
                                        {isSubmitting ? 'Processing...' : 'Record Payment'}
                                    </button>
                                    
                                    <button 
                                        onClick={() => setSelectedCustomer(null)}
                                        className="w-full text-text-secondary hover:text-text-primary font-bold py-2 text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
