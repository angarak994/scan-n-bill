'use client';

import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';

export default function MessagingTab({
    businessId,
    businessName,
    isWhatsAppConnected,
    dbCustomers = [],
    memberships = [],
    onRefresh
}: {
    businessId: string;
    businessName?: string;
    isWhatsAppConnected: boolean;
    dbCustomers?: any[];
    memberships?: any[];
    onRefresh?: () => void;
}) {
    const [customers, setCustomers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
    const [messageTemplate, setMessageTemplate] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Real-Time Confirmation Message State
    const [sentConfirmation, setSentConfirmation] = useState<{
        successCount: number;
        skippedCount: number;
        failureCount: number;
        recipients: any[];
        messagePreview: string;
        timestamp: string;
    } | null>(null);

    // Registered Member Profile Deletion State
    const [memberToDelete, setMemberToDelete] = useState<{ id: string; membership_id: string; name: string; phone: string; tier?: string } | null>(null);
    const [isDeletingMember, setIsDeletingMember] = useState(false);

    // Non-Member Customer Records Deletion State
    const [showCleanupModal, setShowCleanupModal] = useState(false);
    const [isCleaningCustomers, setIsCleaningCustomers] = useState(false);

    // Detect non-member customer records in database causing confusion
    const nonMemberCustomers = useMemo(() => {
        if (!dbCustomers || dbCustomers.length === 0) return [];
        const memberPhones = new Set((memberships || []).map(m => (m.mobile || '').replace(/\D/g, '').slice(-10)).filter(Boolean));
        const memberIds = new Set((memberships || []).map(m => m.id));
        return dbCustomers.filter(c => {
            const p10 = (c.phone || '').replace(/\D/g, '').slice(-10);
            return (!p10 || !memberPhones.has(p10)) && !memberIds.has(c.id);
        });
    }, [dbCustomers, memberships]);

    // STRICT REQUIREMENT: Only Registered Members appear in WhatsApp Messaging
    useEffect(() => {
        const customerByPhone = new Map<string, any>();
        const customerById = new Map<string, any>();
        const customerByName = new Map<string, any>();

        if (dbCustomers && dbCustomers.length > 0) {
            dbCustomers.forEach(c => {
                if (c.id) customerById.set(c.id, c);
                if (c.name) customerByName.set(c.name.trim().toLowerCase(), c);
                if (c.phone && c.phone.trim().length >= 10) {
                    const clean = c.phone.replace(/\D/g, '');
                    customerByPhone.set(clean, c);
                    customerByPhone.set(clean.slice(-10), c);
                }
            });
        }

        const unifiedMembers = new Map<string, any>();

        // ONLY Registered Members from memberships table are loaded into the recipient list
        if (memberships && memberships.length > 0) {
            memberships.forEach(m => {
                if (m.mobile && m.mobile.trim().length >= 10) {
                    const cleanPhone = m.mobile.replace(/\D/g, '');
                    const clean10 = cleanPhone.slice(-10);
                    const matchedCust = customerById.get(m.id) ||
                                        customerByPhone.get(cleanPhone) ||
                                        customerByPhone.get(clean10) ||
                                        (m.name ? customerByName.get(m.name.trim().toLowerCase()) : null);

                    const outstanding = matchedCust ? Number(matchedCust.outstanding_balance || 0) : Number((m as any).outstanding_balance || 0);

                    unifiedMembers.set(cleanPhone, {
                        id: m.id,
                        membership_id: m.id,
                        name: m.name || matchedCust?.name || 'Member',
                        phone: cleanPhone,
                        type: 'Member',
                        tier: m.tier || 'Member',
                        outstanding_balance: outstanding
                    });
                }
            });
        }

        setCustomers(Array.from(unifiedMembers.values()));
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
            toast.error('Please select at least one member.');
            return;
        }
        if (!messageTemplate.trim()) {
            toast.error('Message cannot be empty.');
            return;
        }

        const selectedIds = Array.from(selectedCustomers);
        const customersToSend = customers.filter(c => selectedIds.includes(c.id));

        setIsSending(true);
        const toastId = toast.loading(`Sending real-time WhatsApp message to ${customersToSend.length} members...`);

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

            // Trigger real-time confirmation message display
            setSentConfirmation({
                successCount: result.successCount || 0,
                skippedCount: result.skippedCount || 0,
                failureCount: result.failureCount || 0,
                recipients: customersToSend,
                messagePreview: messageTemplate,
                timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            });

            if (result.successCount > 0) {
                toast.success(`Successfully sent to ${result.successCount} member(s)!`, { id: toastId });
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
        } catch (error: any) {
            console.error('Bulk Send Error', error);
            toast.error(error.message || 'Failed to send messages.', { id: toastId });
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteNonMemberCustomers = async () => {
        try {
            setIsCleaningCustomers(true);
            const res = await fetch('/api/customers?deleteNonMembers=true', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deleteNonMembers: true })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete non-member customers');
            }
            toast.success(data.message || `Deleted non-member customer records.`);
            setShowCleanupModal(false);
            onRefresh?.();
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete customer records');
        } finally {
            setIsCleaningCustomers(false);
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
                        Personalized member updates with real-time delivery confirmation.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {nonMemberCustomers.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowCleanupModal(true)}
                            className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-all flex items-center gap-1.5 min-h-[36px]"
                            title="Delete non-member customer records causing confusion"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete {nonMemberCustomers.length} Customer{nonMemberCustomers.length > 1 ? 's' : ''}
                        </button>
                    )}
                    {isWhatsAppConnected ? (
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            WhatsApp Connected
                        </span>
                    ) : (
                        <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            Not Connected
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
                {/* Left Side: Members List */}
                <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border-theme bg-bg-primary min-h-[350px] lg:min-h-0">
                    <div className="p-3 sm:p-4 border-b border-border-theme flex items-center gap-3 bg-bg-surface shrink-0">
                        <input
                            type="text"
                            placeholder="Search members by name or phone..."
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
                            <div className="text-center p-8 text-text-disabled text-sm">No registered members found with phone numbers.</div>
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
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                                                {customer.tier || 'Member'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {Number(customer.outstanding_balance) > 0 && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-warning bg-warning/10 px-2 py-0.5 rounded font-mono">
                                                ₹{Number(customer.outstanding_balance).toFixed(0)} Due
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMemberToDelete({
                                                    id: customer.id,
                                                    membership_id: customer.membership_id,
                                                    name: customer.name,
                                                    phone: customer.phone,
                                                    tier: customer.tier
                                                });
                                            }}
                                            className="p-1.5 rounded-lg text-text-disabled hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Remove Registered Member Profile"
                                            aria-label={`Remove member profile for ${customer.name}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
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

                {/* Right Side: Message Composer & Real-Time Confirmation */}
                <div className="w-full lg:w-1/2 flex flex-col bg-bg-surface p-4 sm:p-6 min-h-0 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border-theme pb-3 mb-4 sm:mb-6">
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent"></span>
                            Compose WhatsApp Message
                        </h3>
                        <span className="text-xs text-text-secondary font-mono">
                            {selectedCustomers.size} member{selectedCustomers.size === 1 ? '' : 's'} selected
                        </span>
                    </div>

                    {/* Meta Cloud Compliance */}
                    <div className="mb-3 shrink-0">
                        <p className="text-xs text-text-secondary mb-2">
                            <strong>Meta Cloud Compliance:</strong> Dynamic business name is inserted automatically using single asterisks (<code className="text-accent">*Club Name*</code>).
                        </p>
                    </div>

                    {/* Quick Templates */}
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
                        placeholder="Type your WhatsApp message... Use {{name}} for member name, {{outstanding}} for pending balance, and {{club}} for your club name."
                        className="flex-1 min-h-[140px] bg-bg-primary border border-border-theme rounded-xl p-4 text-base sm:text-sm outline-none resize-none input-premium mb-4 font-medium"
                    />

                    {/* Live Preview */}
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
                                        ? messageTemplate
                                            .replace(/\{\{name\}\}/g, selectedCust?.name || 'Member')
                                            .replace(/\{\{outstanding\}\}/g, selectedCust ? Number(selectedCust.outstanding_balance || 0).toFixed(0) : '0')
                                            .replace(/\{\{club\}\}/g, businessName || 'Your Club')
                                            .replace(/\{\{business\}\}/g, businessName || 'Your Club')
                                        : 'Type a message above or select a quick template to see the preview.'}
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
                                    Sending Real-Time Messages...
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

            {/* Real-time Confirmation Modal */}
            {sentConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Real-Time Confirmation">
                    <div className="bg-bg-surface border border-border-theme rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-xl font-black text-text-primary">
                                Messages Delivered in Real-Time
                            </h3>
                            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                                {sentConfirmation.timestamp}
                            </span>
                        </div>
                        <p className="text-xs text-text-secondary mb-4">
                            Your WhatsApp message has been processed and delivered to registered members.
                        </p>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-bg-primary p-3 rounded-xl border border-border-theme text-center">
                                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Delivered</span>
                                <span className="text-xl font-black text-emerald-400 font-mono">{sentConfirmation.successCount}</span>
                            </div>
                            <div className="bg-bg-primary p-3 rounded-xl border border-border-theme text-center">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block tracking-wider">Skipped</span>
                                <span className="text-xl font-black text-text-secondary font-mono">{sentConfirmation.skippedCount}</span>
                            </div>
                            <div className="bg-bg-primary p-3 rounded-xl border border-border-theme text-center">
                                <span className="text-[10px] uppercase font-bold text-red-400 block tracking-wider">Failed</span>
                                <span className="text-xl font-black text-red-400 font-mono">{sentConfirmation.failureCount}</span>
                            </div>
                        </div>

                        {/* Recipient list */}
                        <div className="bg-bg-primary rounded-xl p-3 border border-border-theme mb-5 max-h-36 overflow-y-auto custom-scrollbar">
                            <span className="text-[10px] uppercase font-bold text-text-disabled tracking-widest block mb-2">Recipients ({sentConfirmation.recipients.length})</span>
                            <div className="space-y-1.5">
                                {sentConfirmation.recipients.map((r: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-text-primary flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            {r.name}
                                        </span>
                                        <span className="text-text-secondary font-mono">{r.phone}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setSentConfirmation(null);
                                    setMessageTemplate('');
                                }}
                                className="px-5 py-2.5 rounded-xl bg-accent text-black text-xs font-bold uppercase transition-all shadow-lg hover:bg-accent/90"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Non-Member Customer Records Cleanup Confirmation Modal */}
            {showCleanupModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Delete Non-Member Customers">
                    <div className="bg-bg-surface border border-border-theme rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        
                        <h3 className="text-lg font-black text-text-primary mb-1">
                            Delete Non-Member Customers?
                        </h3>
                        <p className="text-sm text-text-secondary mb-3">
                            Are you sure you want to delete <strong className="text-text-primary">{nonMemberCustomers.length} non-member customer records</strong> that are causing confusion?
                        </p>
                        
                        <div className="bg-bg-primary/80 border border-border-theme rounded-xl p-3.5 mb-5 text-xs text-text-secondary space-y-2">
                            <div className="flex items-start gap-2 text-emerald-400">
                                <span className="shrink-0 font-bold">🛡️</span>
                                <span>All registered member profiles, plans, and active memberships remain safe and untouched.</span>
                            </div>
                            <div className="flex items-start gap-2 text-red-400">
                                <span className="shrink-0 font-bold">⚠️</span>
                                <span>Removes legacy bot inquiry names and non-member customer rows from the database.</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={isCleaningCustomers}
                                onClick={() => setShowCleanupModal(false)}
                                className="px-4 py-2.5 rounded-xl border border-border-theme text-text-secondary hover:text-text-primary text-xs font-bold uppercase transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isCleaningCustomers}
                                onClick={handleDeleteNonMemberCustomers}
                                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isCleaningCustomers ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Deleting...
                                    </>
                                ) : (
                                    `Delete ${nonMemberCustomers.length} Customers`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Profile Deletion Confirmation Modal */}
            {memberToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Remove Member Profile">
                    <div className="bg-bg-surface border border-border-theme rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        
                        <h3 className="text-lg font-black text-text-primary mb-1">
                            Remove Member Profile?
                        </h3>
                        <p className="text-sm text-text-secondary mb-3">
                            Are you sure you want to remove the registered membership profile for <strong className="text-text-primary">{memberToDelete.name}</strong> ({memberToDelete.phone})?
                        </p>
                        
                        <div className="bg-bg-primary/80 border border-border-theme rounded-xl p-3.5 mb-5 text-xs text-text-secondary space-y-2">
                            <div className="flex items-start gap-2 text-red-400">
                                <span className="shrink-0 font-bold">⚠️</span>
                                <span>Removes membership tier discount and active membership status.</span>
                            </div>
                            <div className="flex items-start gap-2 text-emerald-400">
                                <span className="shrink-0 font-bold">🛡️</span>
                                <span>Historical session logs, ledger dues, and transaction records in QKhata are preserved.</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={isDeletingMember}
                                onClick={() => setMemberToDelete(null)}
                                className="px-4 py-2.5 rounded-xl border border-border-theme text-text-secondary hover:text-text-primary text-xs font-bold uppercase transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isDeletingMember}
                                onClick={async () => {
                                    try {
                                        setIsDeletingMember(true);
                                        const res = await fetch('/api/memberships', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: memberToDelete.membership_id })
                                        });
                                        const data = await res.json();
                                        if (!res.ok) {
                                            throw new Error(data.error || 'Failed to remove member');
                                        }
                                        toast.success(data.message || 'Member profile removed successfully.');
                                        
                                        // Update local list: remove deleted member
                                        setCustomers(prev => prev.filter(c => c.membership_id !== memberToDelete.membership_id));
                                        setMemberToDelete(null);
                                        onRefresh?.();
                                    } catch (err: any) {
                                        toast.error(err.message || 'Failed to remove member');
                                    } finally {
                                        setIsDeletingMember(false);
                                    }
                                }}
                                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {isDeletingMember ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Removing...
                                    </>
                                ) : (
                                    'Remove Membership'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
