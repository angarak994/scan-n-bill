'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function PaymentsTab({ businessId }: { businessId: string }) {
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!businessId) return;

        async function fetchData() {
            try {
                const { data } = await supabase
                    .from('payments')
                    .select(`
                        id, amount, payment_method, status, created_at, reference_id,
                        customers ( name )
                    `)
                    .eq('business_id', businessId)
                    .order('created_at', { ascending: false })
                    .limit(100);
                
                if (data) setPayments(data);
            } catch (err) {
                console.error("Failed to load payments", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchData();
    }, [businessId]);

    const today = new Date().toISOString().split('T')[0];
    let todayCollection = 0;
    let pendingAmount = 0;

    payments?.forEach((p: any) => {
        if (p.created_at.startsWith(today) && p.status === 'Paid') {
            todayCollection += Number(p.amount);
        }
        if (p.status === 'Pending') {
            pendingAmount += Number(p.amount);
        }
    });

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Payments...</div>;

    return (
        <div className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
                <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Today's Collection</h3>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex items-end gap-2 sm:gap-3 mb-2">
                        <span className="text-2xl sm:text-4xl font-bold text-text-primary tracking-tight font-mono">₹{todayCollection.toFixed(2)}</span>
                    </div>
                </div>
                <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Pending Payments</h3>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="flex items-end gap-2 sm:gap-3 mb-2">
                        <span className="text-2xl sm:text-4xl font-bold text-error tracking-tight font-mono">₹{pendingAmount.toFixed(2)}</span>
                    </div>
                </div>
                <div className="bg-bg-card rounded-xl p-4 sm:p-6 border border-border-theme flex flex-col hover-lift transition-all duration-300">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <h3 className="text-[10px] sm:text-xs font-semibold text-text-secondary uppercase tracking-widest">Total Transactions</h3>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </div>
                    <div className="flex items-end gap-2 sm:gap-3 mb-2">
                        <span className="text-2xl sm:text-4xl font-bold text-text-primary tracking-tight font-mono">{payments?.length || 0}</span>
                    </div>
                </div>
            </div>

            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border-theme bg-bg-primary/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-text-primary">Transaction History</h3>
                        <p className="text-xs text-text-secondary mt-1 italic">Recent payments and settlements</p>
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
                            {payments?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-text-secondary text-sm">No transactions found</td>
                                </tr>
                            ) : (
                                payments?.map((p: any) => (
                                    <tr key={p.id} className="border-b border-border-theme/50 hover:bg-bg-surface/50 transition-colors">
                                        <td className="p-5 text-sm text-text-secondary font-mono">
                                            {new Date(p.created_at).toLocaleString('en-IN', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="p-5 font-bold text-sm text-text-primary">{p.customers?.name || 'Unknown'}</td>
                                        <td className="p-5 text-text-primary text-sm font-bold font-mono text-right tabular-nums">₹{Number(p.amount).toFixed(2)}</td>
                                        <td className="p-5 text-center">
                                            <span className="bg-bg-surface border border-border-theme text-text-secondary text-xs px-3 py-1 rounded font-bold uppercase tracking-wider shadow-sm">
                                                {p.payment_method}
                                            </span>
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold tracking-widest border uppercase shadow-sm ${
                                                p.status === 'Paid' ? 'border-accent/50 text-accent bg-accent/10' : 
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
