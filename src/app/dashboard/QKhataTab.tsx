'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

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

    const handleSendReminder = async (e: React.MouseEvent, customer: any) => {
        e.stopPropagation();
        if (!customer.phone || Number(customer.outstanding_balance) <= 0) return;
        
        const toastId = toast.loading('Sending reminder...');
        try {
            // Get business name
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
            toast.success('Reminder sent via WhatsApp!', { id: toastId });
        } catch (error) {
            console.error('Reminder error:', error);
            toast.error('Failed to send WhatsApp reminder', { id: toastId });
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
                                                <div className="flex items-center justify-end gap-3">
                                                    <span>₹{Number(c.outstanding_balance).toFixed(2)}</span>
                                                    {Number(c.outstanding_balance) > 0 && c.phone && (
                                                        <button 
                                                            onClick={(e) => handleSendReminder(e, c)}
                                                            className="px-2 py-1 bg-[#25D366]/10 text-[#25D366] rounded hover:bg-[#25D366]/20 transition-colors shadow-sm flex items-center gap-1 border border-[#25D366]/20"
                                                            title="Send WhatsApp Reminder"
                                                        >
                                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                        </button>
                                                    )}
                                                </div>
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
