'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function MessagingTab({
    businessId,
    businessName,
    isWhatsAppConnected,
    dbCustomers = [],
    memberships = []
}: {
    businessId: string;
    businessName?: string;
    isWhatsAppConnected: boolean;
    dbCustomers?: any[];
    memberships?: any[];
}) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
    const [messageTemplate, setMessageTemplate] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [activeTab, setActiveTab] = useState<'compose' | 'logs'>('compose');

    // Delivery Logs & Dashboard State
    const [deliveryLogs, setDeliveryLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [analytics, setAnalytics] = useState<any>({
        total: 0,
        inbound: 0,
        outbound: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        failureRate: 0
    });
    const [logFilter, setLogFilter] = useState<'all' | 'outbound' | 'inbound' | 'delivered' | 'read' | 'failed'>('all');
    const [logSearch, setLogSearch] = useState('');
    const [retryingId, setRetryingId] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');

    // Fetch delivery logs from server-side authenticated API
    const fetchLogs = useCallback(async () => {
        if (!businessId) return;
        try {
            setIsLoadingLogs(true);
            let url = `/api/messaging/logs?businessId=${businessId}`;
            if (logFilter === 'inbound' || logFilter === 'outbound') {
                url += `&direction=${logFilter}`;
            } else if (logFilter !== 'all') {
                url += `&status=${logFilter}`;
            }
            if (logSearch.trim()) {
                url += `&search=${encodeURIComponent(logSearch.trim())}`;
            }

            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                setDeliveryLogs(json.logs || []);
                if (json.analytics) setAnalytics(json.analytics);
                setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
            }
        } catch (err) {
            console.error('Failed to fetch delivery logs:', err);
        } finally {
            setIsLoadingLogs(false);
        }
    }, [businessId, logFilter, logSearch]);

    // Initial load and Realtime sync
    useEffect(() => {
        fetchLogs();
        if (supabase) {
            const channel = supabase.channel(`whatsapp_messages_${businessId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `business_id=eq.${businessId}` }, () => {
                    fetchLogs();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [businessId, fetchLogs]);

    // Format unified contacts
    useEffect(() => {
        const unifiedContacts = new Map<string, any>();

        if (dbCustomers && dbCustomers.length > 0) {
            dbCustomers.forEach(c => {
                if (c.phone && c.phone.trim().length >= 10) {
                    const cleanPhone = c.phone.replace(/\D/g, '');
                    unifiedContacts.set(cleanPhone, {
                        id: c.id,
                        name: c.name,
                        phone: cleanPhone,
                        type: 'Customer',
                        outstanding_balance: c.outstanding_balance
                    });
                }
            });
        }

        if (memberships && memberships.length > 0) {
            memberships.forEach(m => {
                if (m.mobile && m.mobile.trim().length >= 10) {
                    const cleanPhone = m.mobile.replace(/\D/g, '');
                    unifiedContacts.set(cleanPhone, {
                        id: m.id,
                        name: m.name,
                        phone: cleanPhone,
                        type: 'Member',
                        tier: m.tier
                    });
                }
            });
        }

        setCustomers(Array.from(unifiedContacts.values()));
    }, [dbCustomers, memberships]);

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
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
            toast.error('Please select at least one customer.');
            return;
        }
        if (!messageTemplate.trim()) {
            toast.error('Message cannot be empty.');
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

            if (result.successCount > 0) {
                toast.success(`Successfully sent ${result.successCount} message(s).`, { id: toastId });
            } else if (result.skippedCount > 0 && result.failureCount === 0) {
                toast(`All ${result.skippedCount} member(s) have ₹0 balance. Reminders safely skipped.`, { id: toastId, icon: '🛡️' });
            }
            if (result.skippedCount > 0 && result.successCount > 0) {
                toast(`${result.skippedCount} member(s) with ₹0 balance were safely skipped.`, { icon: '🛡️' });
            }
            if (result.failureCount > 0) {
                const errorStr = result.errors?.map((e: any) => e.error).join(', ') || 'Unknown error';
                toast.error(`Failed to send ${result.failureCount} message(s). Reason: ${errorStr}`, { duration: 8000 });
            }

            setSelectedCustomers(new Set());
            setMessageTemplate('');
            fetchLogs();
        } catch (error: any) {
            console.error('Bulk Send Error', error);
            toast.error(error.message || 'Failed to send messages.', { id: toastId });
        } finally {
            setIsSending(false);
        }
    };

    const handleRetry = async (messageId: string) => {
        setRetryingId(messageId);
        const tId = toast.loading('Retrying WhatsApp delivery...');
        try {
            const res = await fetch('/api/messaging/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId })
            });

            const json = await res.json();
            if (res.ok && json.success) {
                toast.success('Message re-sent successfully!', { id: tId });
                fetchLogs();
            } else {
                toast.error(`Retry failed: ${json.error || 'Provider rejected message'}`, { id: tId });
                fetchLogs();
            }
        } catch (err: any) {
            toast.error(err.message || 'Retry request failed', { id: tId });
        } finally {
            setRetryingId(null);
        }
    };

    return (
        <div className="flex flex-col h-auto lg:h-[calc(100vh-120px)] min-h-[600px] bg-bg-primary text-text-primary rounded-xl border border-border-theme overflow-hidden font-sans shadow-2xl">
            {/* Header */}
            <div className="bg-bg-surface p-4 sm:p-6 border-b border-border-theme flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-accent flex items-center gap-2">
                        <svg className="w-7 h-7 sm:w-8 sm:h-8 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                        </svg>
                        WhatsApp Messaging & Delivery Intelligence
                    </h2>
                    <p className="text-xs sm:text-sm text-text-secondary mt-1">
                        AI booking bot, personalized member updates, and real-time delivery audit trail.
                    </p>
                </div>
                {lastUpdated && (
                    <span className="text-[11px] font-mono text-text-secondary bg-bg-primary px-3 py-1.5 rounded-lg border border-border-theme flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Synced: {lastUpdated}
                    </span>
                )}
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                {/* Left Side: Contacts List */}
                <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border-theme bg-bg-primary min-h-[350px] lg:min-h-0">
                    <div className="p-3 sm:p-4 border-b border-border-theme flex items-center gap-3 bg-bg-surface shrink-0">
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-bg-primary border border-border-theme rounded-xl px-4 py-2.5 text-base sm:text-sm outline-none input-premium min-h-[44px]"
                        />
                        <button
                            onClick={selectAll}
                            className="px-4 py-2.5 bg-bg-card border border-border-theme rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-border-theme transition-colors text-text-secondary hover:text-text-primary whitespace-nowrap min-h-[44px] touch-target flex items-center justify-center"
                        >
                            {selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg-surface p-2 max-h-[400px] lg:max-h-none">
                        {!isWhatsAppConnected && (
                            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between">
                                <div>
                                    <h4 className="text-red-500 font-bold text-sm">WhatsApp Not Connected</h4>
                                    <p className="text-text-secondary text-xs mt-1">You must connect your WhatsApp Business number in Settings before sending messages.</p>
                                </div>
                            </div>
                        )}
                        {filteredCustomers.length === 0 ? (
                            <div className="text-center p-8 text-text-disabled text-sm">No members found with phone numbers.</div>
                        ) : (
                            filteredCustomers.map(customer => (
                                <div
                                    key={customer.id}
                                    onClick={() => toggleCustomer(customer.id)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center min-h-[50px] mb-1.5 touch-target ${selectedCustomers.has(customer.id) ? 'border-accent bg-accent/10 shadow-sm shadow-accent/5' : 'border-border-theme hover:border-accent/40 bg-bg-surface'}`}
                                >
                                    <div>
                                        <h4 className={`font-bold text-sm ${selectedCustomers.has(customer.id) ? 'text-accent' : 'text-text-primary'}`}>{customer.name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-text-secondary font-mono">{customer.phone}</p>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${customer.type.includes('Member') ? 'bg-accent/20 text-accent' : 'bg-bg-primary text-text-secondary border border-border-theme'}`}>
                                                {customer.type}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {Number(customer.outstanding_balance) > 0 && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 px-2 py-0.5 rounded font-mono">
                                                ₹{Number(customer.outstanding_balance).toFixed(0)} Due
                                            </span>
                                        )}
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${selectedCustomers.has(customer.id) ? 'bg-accent border-accent text-bg-primary' : 'border-border-theme'}`}>
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

                {/* Right Side: Message Composer & Delivery Logs */}
                <div className="w-full lg:w-1/2 flex flex-col bg-bg-surface p-4 sm:p-6 min-h-0">
                    <div className="flex border-b border-border-theme mb-4 sm:mb-6">
                        <button
                            onClick={() => setActiveTab('compose')}
                            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors min-h-[44px] touch-target flex items-center ${activeTab === 'compose' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                        >
                            Compose Message
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors min-h-[44px] touch-target flex items-center gap-2 ${activeTab === 'logs' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                        >
                            Delivery Logs
                            {analytics.total > 0 && (
                                <span className="bg-bg-primary border border-border-theme text-[10px] px-2 py-0.5 rounded-full font-mono">
                                    {analytics.total}
                                </span>
                            )}
                        </button>
                    </div>

                    {activeTab === 'compose' ? (
                        <>
                            <div className="mb-3 shrink-0">
                                <p className="text-xs text-text-secondary mb-2">
                                    <strong>Meta Cloud Compliance:</strong> Dynamic business name is inserted automatically using single asterisks (<code className="text-accent">*Club Name*</code>).
                                </p>
                            </div>

                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0 custom-scrollbar">
                                <button
                                    onClick={() => setMessageTemplate("*Welcome back to {{club}}!*\n\nHi {{name}}, we've missed having you at the club! Show this message on your next visit for a special offer on your table time.\n\nReply to check availability or book a game!")}
                                    className="px-3 py-2 bg-bg-primary border border-border-theme rounded-lg text-xs font-semibold whitespace-nowrap hover:border-accent transition-colors min-h-[40px] touch-target flex items-center"
                                >
                                    Welcome Back Promo
                                </button>
                                <button
                                    onClick={() => setMessageTemplate("*Payment reminder — {{club}}*\n\nHi {{name}}, your booking has an outstanding balance of ₹{{outstanding}}.\n\nPlease review and complete the payment using UPI. If you've already paid, please disregard this reminder while we verify your status.")}
                                    className="px-3 py-2 bg-bg-primary border border-warning/30 rounded-lg text-xs font-semibold whitespace-nowrap hover:border-warning text-warning transition-colors min-h-[40px] touch-target flex items-center"
                                >
                                    Payment Reminder
                                </button>
                            </div>

                            <textarea
                                value={messageTemplate}
                                onChange={(e) => setMessageTemplate(e.target.value)}
                                placeholder="Type your WhatsApp message... Use {{name}} for customer name, {{outstanding}} for pending balance, and {{club}} for your club name."
                                className="flex-1 min-h-[140px] bg-bg-primary border border-border-theme rounded-xl p-4 text-base sm:text-sm outline-none resize-none input-premium mb-4 font-medium"
                            />

                            {(() => {
                                const selectedCust = selectedCustomers.size > 0 ? customers.find(c => c.id === Array.from(selectedCustomers)[0]) : null;
                                const isZeroBalance = Number(selectedCust?.outstanding_balance || 0) <= 0;
                                const isPaymentTemplate = messageTemplate.toLowerCase().includes('payment reminder') || messageTemplate.includes('{{outstanding}}');
                                
                                return (
                                    <div className="bg-bg-primary p-4 rounded-xl border border-border-theme mb-4 sm:mb-6 shrink-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-disabled">Message Preview (WhatsApp Formatted)</h4>
                                            {selectedCust && isPaymentTemplate && isZeroBalance && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                    Settled (₹0 balance) — Safely Skipped
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs sm:text-sm text-text-secondary italic whitespace-pre-wrap">
                                            {messageTemplate
                                                .replace(/\{\{name\}\}/g, selectedCust?.name || 'Customer')
                                                .replace(/\{\{outstanding\}\}/g, selectedCust ? Number(selectedCust.outstanding_balance || 0).toFixed(0) : '0')
                                                .replace(/\{\{club\}\}/g, businessName || 'Your Club')
                                                .replace(/\{\{business\}\}/g, businessName || 'Your Club')}
                                        </p>
                                    </div>
                                );
                            })()}

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                                <span className="text-xs font-bold text-text-secondary">
                                    {selectedCustomers.size} recipient(s) selected
                                </span>
                                <button
                                    onClick={handleSendBulk}
                                    disabled={isSending || selectedCustomers.size === 0 || !messageTemplate.trim() || !isWhatsAppConnected}
                                    className="px-6 sm:px-8 py-3.5 bg-accent text-black font-extrabold text-xs sm:text-sm uppercase rounded-xl hover:bg-accent/90 shadow-[0_4px_15px_rgba(var(--accent),0.4)] btn-premium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px] touch-target"
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
                        </>
                    ) : (
                        /* Delivery Logs Dashboard */
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {/* KPI Analytics Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
                                <div className="bg-bg-primary p-2.5 rounded-xl border border-border-theme">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary block">Total</span>
                                    <span className="text-lg font-black text-text-primary font-mono">{analytics.total}</span>
                                </div>
                                <div className="bg-bg-primary p-2.5 rounded-xl border border-border-theme">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">Delivered / Read</span>
                                    <span className="text-lg font-black text-emerald-400 font-mono">{analytics.delivered + analytics.read}</span>
                                </div>
                                <div className="bg-bg-primary p-2.5 rounded-xl border border-border-theme">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">Inbound</span>
                                    <span className="text-lg font-black text-purple-400 font-mono">{analytics.inbound}</span>
                                </div>
                                <div className="bg-bg-primary p-2.5 rounded-xl border border-border-theme">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-red-400 block">Failed</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-black text-red-400 font-mono">{analytics.failed}</span>
                                        {analytics.failureRate > 0 && (
                                            <span className="text-[10px] text-red-400/80 font-mono">({analytics.failureRate}%)</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Search and Filter Controls */}
                            <div className="flex flex-col sm:flex-row gap-2 mb-3 shrink-0">
                                <input
                                    type="text"
                                    placeholder="Search recipient, phone, wamid..."
                                    value={logSearch}
                                    onChange={(e) => setLogSearch(e.target.value)}
                                    className="flex-1 bg-bg-primary border border-border-theme rounded-lg px-3 py-1.5 text-xs outline-none input-premium"
                                />
                                <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                                    {(['all', 'outbound', 'inbound', 'failed'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setLogFilter(f)}
                                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all whitespace-nowrap ${logFilter === f ? 'bg-accent text-black' : 'bg-bg-primary text-text-secondary hover:text-text-primary border border-border-theme'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                    <button
                                        onClick={fetchLogs}
                                        disabled={isLoadingLogs}
                                        className="p-1 px-2 bg-bg-primary border border-border-theme rounded-lg text-text-secondary hover:text-text-primary transition-colors shrink-0"
                                        title="Refresh logs"
                                    >
                                        <svg className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Logs Timeline List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
                                {deliveryLogs.length === 0 ? (
                                    <div className="text-center p-8 bg-bg-primary rounded-xl border border-border-theme">
                                        <svg className="w-10 h-10 text-text-disabled mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                        </svg>
                                        <h4 className="font-bold text-sm text-text-secondary">No message events found</h4>
                                        <p className="text-xs text-text-disabled mt-1 max-w-sm mx-auto">
                                            Incoming customer WhatsApp messages, AI replies, booking confirmations, and bulk reminders will appear here in real time.
                                        </p>
                                    </div>
                                ) : (
                                    deliveryLogs.map(log => {
                                        const isInbound = log.status === 'received';
                                        return (
                                            <div
                                                key={log.id}
                                                className={`p-3.5 rounded-xl border transition-all ${log.status === 'failed' ? 'bg-red-500/5 border-red-500/30' : 'bg-bg-primary border-border-theme'}`}
                                            >
                                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${isInbound ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                            {isInbound ? '📥 Inbound' : '📤 Outbound'}
                                                        </span>
                                                        <h4 className="font-bold text-xs sm:text-sm text-text-primary">
                                                            {log.recipient_name || 'Customer'}{' '}
                                                            <span className="text-text-secondary font-normal font-mono text-[11px]">
                                                                (+{log.recipient_phone})
                                                            </span>
                                                        </h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                                            log.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            log.status === 'read' ? 'bg-blue-500/20 text-blue-400' :
                                                            log.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                                            log.status === 'sent' ? 'bg-accent/20 text-accent' :
                                                            log.status === 'received' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-bg-card text-text-secondary border border-border-theme'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                <p className="text-xs sm:text-sm text-text-secondary italic whitespace-pre-wrap line-clamp-3 bg-bg-surface/50 p-2.5 rounded-lg border border-border-theme/40 mb-2 font-sans">
                                                    {log.content}
                                                </p>

                                                {/* Failure Explanation & Retry Action */}
                                                {log.status === 'failed' && (
                                                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                                                        <div>
                                                            <p className="text-[11px] font-bold text-red-400">
                                                                ⚠️ Message not delivered
                                                            </p>
                                                            <p className="text-[10px] text-text-secondary mt-0.5 font-mono">
                                                                {log.error_message || 'Provider rejected message or recipient was unreachable.'}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRetry(log.id)}
                                                            disabled={retryingId === log.id}
                                                            className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px] uppercase rounded tracking-wider border border-red-500/40 transition-colors shrink-0 disabled:opacity-50"
                                                        >
                                                            {retryingId === log.id ? 'Retrying...' : '🔄 Retry Send'}
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap justify-between items-center text-[10px] text-text-disabled font-mono pt-1 border-t border-border-theme/30">
                                                    <span>{new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                    {log.message_id && (
                                                        <span className="truncate max-w-[200px]" title={log.message_id}>
                                                            ID: {log.message_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
