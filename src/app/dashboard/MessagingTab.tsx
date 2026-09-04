'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function MessagingTab({ businessId }: { businessId: string }) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
    const [messageTemplate, setMessageTemplate] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (!businessId) return;
        
        async function fetchData() {
            try {
                // Fetch customers with phone numbers
                const { data } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('business_id', businessId)
                    .not('phone', 'is', null)
                    .order('created_at', { ascending: false });
                if (data) {
                    // Filter out invalid/empty phones
                    const validCustomers = data.filter(c => c.phone && c.phone.trim().length > 5);
                    setCustomers(validCustomers);
                }
            } catch (err) {
                console.error("Failed to load customers for messaging", err);
            } finally {
                setIsLoading(false);
            }
        }
        
        fetchData();
    }, [businessId]);

    const filteredCustomers = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
    );

    const toggleCustomer = (id: string) => {
        const newSet = new Set(selectedCustomers);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedCustomers(newSet);
    };

    const selectAll = () => {
        if (selectedCustomers.size === filteredCustomers.length) {
            setSelectedCustomers(new Set());
        } else {
            setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
        }
    };

    const handleSendBulk = async () => {
        if (selectedCustomers.size === 0) {
            toast.error("Please select at least one customer.");
            return;
        }
        if (!messageTemplate.trim()) {
            toast.error("Message cannot be empty.");
            return;
        }

        const selectedIds = Array.from(selectedCustomers);
        const customersToSend = customers.filter(c => selectedIds.includes(c.id));

        setIsSending(true);
        const toastId = toast.loading(`Sending message to ${customersToSend.length} members...`);

        try {
            const res = await fetch('/api/whatsapp-bulk-send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessId,
                    customers: customersToSend.map(c => ({ id: c.id, name: c.name, phone: c.phone, outstanding_balance: c.outstanding_balance })),
                    template: messageTemplate
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to send messages');

            toast.success(`Successfully sent ${result.successCount} messages.`, { id: toastId });
            if (result.failureCount > 0) {
                toast.error(`Failed to send ${result.failureCount} messages.`, { duration: 4000 });
            }

            // Reset after send
            setSelectedCustomers(new Set());
            setMessageTemplate('');
        } catch (error: any) {
            console.error("Bulk Send Error", error);
            toast.error(error.message || "Failed to send messages.", { id: toastId });
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-text-secondary">Loading contacts...</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] bg-bg-primary text-text-primary rounded-xl border border-border-theme overflow-hidden font-sans shadow-2xl">
            <div className="bg-bg-surface p-6 border-b border-border-theme flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-accent flex items-center gap-2">
                        <span className="text-3xl">💬</span> WhatsApp Messaging
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">Send personalized bulk messages, promotions, or reminders to your registered members.</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {/* Left Side: Contacts List */}
                <div className="w-full md:w-1/2 flex flex-col border-r border-border-theme bg-bg-primary min-h-0">
                    <div className="p-4 border-b border-border-theme flex items-center gap-3 bg-bg-surface shrink-0">
                        <input 
                            type="text" 
                            placeholder="Search by name or phone..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-bg-primary border border-border-theme rounded-xl px-4 py-2 text-sm focus:border-accent outline-none transition-colors"
                        />
                        <button 
                            onClick={selectAll}
                            className="px-4 py-2 bg-bg-card border border-border-theme rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-border-theme transition-colors text-text-secondary hover:text-text-primary whitespace-nowrap"
                        >
                            {selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {filteredCustomers.length === 0 ? (
                            <div className="text-center p-8 text-text-disabled">No members found with phone numbers.</div>
                        ) : (
                            filteredCustomers.map(customer => (
                                <div 
                                    key={customer.id} 
                                    onClick={() => toggleCustomer(customer.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${selectedCustomers.has(customer.id) ? 'border-accent bg-accent/10 shadow-sm shadow-accent/5' : 'border-border-theme hover:border-accent/40 bg-bg-surface'}`}
                                >
                                    <div>
                                        <h4 className={`font-bold text-sm ${selectedCustomers.has(customer.id) ? 'text-accent' : 'text-text-primary'}`}>{customer.name}</h4>
                                        <p className="text-xs text-text-secondary mt-0.5">{customer.phone}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {Number(customer.outstanding_balance) > 0 && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 px-2 py-0.5 rounded">
                                                ₹{Number(customer.outstanding_balance).toFixed(0)} Due
                                            </span>
                                        )}
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selectedCustomers.has(customer.id) ? 'bg-accent border-accent text-bg-primary' : 'border-border-theme'}`}>
                                            {selectedCustomers.has(customer.id) && (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Side: Message Composer */}
                <div className="w-full md:w-1/2 flex flex-col bg-bg-surface p-6 min-h-0">
                    <h3 className="font-bold text-sm uppercase tracking-widest text-text-secondary mb-4 shrink-0">Compose Message</h3>
                    
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0">
                        <button onClick={() => setMessageTemplate("Hi {{name}}, we miss you at the club! Show this message on your next visit for 10% off your table time.")} className="px-3 py-1.5 bg-bg-primary border border-border-theme rounded-lg text-xs font-semibold whitespace-nowrap hover:border-accent transition-colors">
                            Welcome Back Promo
                        </button>
                        <button onClick={() => setMessageTemplate("Hi {{name}}, just a quick reminder that your QKhata balance of ₹{{outstanding}} is pending. Please clear it at your earliest convenience.")} className="px-3 py-1.5 bg-bg-primary border border-warning/30 rounded-lg text-xs font-semibold whitespace-nowrap hover:border-warning text-warning transition-colors">
                            Payment Reminder
                        </button>
                    </div>

                    <textarea
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        placeholder="Type your message here... Use {{name}} to insert the customer's name, or {{outstanding}} for their due balance."
                        className="flex-1 min-h-[150px] bg-bg-primary border border-border-theme rounded-xl p-4 text-sm focus:border-accent outline-none resize-none transition-colors mb-4 font-medium"
                    />

                    <div className="bg-bg-primary p-4 rounded-xl border border-border-theme mb-6 shrink-0">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-disabled mb-2">Message Preview</h4>
                        <p className="text-sm text-text-secondary italic whitespace-pre-wrap">
                            {messageTemplate
                                .replace(/\{\{name\}\}/g, selectedCustomers.size > 0 ? (customers.find(c => c.id === Array.from(selectedCustomers)[0])?.name || 'Customer') : 'Customer')
                                .replace(/\{\{outstanding\}\}/g, selectedCustomers.size > 0 ? (Number(customers.find(c => c.id === Array.from(selectedCustomers)[0])?.outstanding_balance || 0).toFixed(0)) : '0')}
                        </p>
                    </div>

                    <div className="flex items-center justify-between shrink-0">
                        <span className="text-xs font-bold text-text-secondary">
                            {selectedCustomers.size} recipient(s) selected
                        </span>
                        <button
                            onClick={handleSendBulk}
                            disabled={isSending || selectedCustomers.size === 0 || !messageTemplate.trim()}
                            className="px-8 py-3.5 bg-accent text-black font-extrabold text-sm uppercase rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSending ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                                    </svg>
                                    Send Messages
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
