import { normalizePhone } from '@/lib/utils/phoneValidation';
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { sendSMS, SMSConfig } from './smsService';

export interface SplitPaymentItem {
    method: string;
    amount: number;
}

export interface PaymentPayload {
    businessId: string;
    sessionId?: string;
    customerName: string;
    customerId?: string;
    totalBilled: number;
    amountPaid: number;
    paymentMethod: string;
    paymentStatus: string; // 'Paid', 'Pending', 'Partially Paid', 'Failed'
    dueDate?: string;
    source?: string;
    splitPayments?: SplitPaymentItem[];
}

export async function createLedgerEntryAndPayment(payload: PaymentPayload) {
    const { businessId, sessionId, customerName, customerId: providedCustomerId, totalBilled, amountPaid, paymentMethod, paymentStatus, dueDate, source, splitPayments } = payload;

    if (!businessId) return;
    const finalCustomerName = customerName || 'Walk-in';

    // Guard against duplicate payments for the same session (Idempotency)
    if (sessionId) {
        const { data: existingRecords } = await supabase
            .from('payments')
            .select('id')
            .eq('session_id', sessionId)
            .limit(1);
        if (existingRecords && existingRecords.length > 0) {
            console.warn(`[paymentService] Payment records already exist for session ${sessionId}. Skipping duplicate insertion.`);
            return;
        }
    }

    // Determine actual total amount paid from splitPayments if provided
    let effectiveAmountPaid = amountPaid;
    const validSplits = (splitPayments || []).filter(sp => Number(sp.amount) > 0);
    if (validSplits.length > 0) {
        effectiveAmountPaid = validSplits.reduce((acc, sp) => acc + Number(sp.amount), 0);
    }

    // 1. Resolve or Create Customer (for Ledger)
    let customerId = providedCustomerId;

    try {
        const { data: allCusts } = await supabase
            .from('customers')
            .select('id, name, phone, total_billed, total_paid, outstanding_balance')
            .eq('business_id', businessId);

        const cleanPhone = finalCustomerName !== 'Walk-in' ? finalCustomerName.replace(/[\s\-\+]/g, '') : '';
        const isPhone = /^\d{10}$/.test(cleanPhone);
        const searchName = finalCustomerName.trim().toLowerCase();

        if (customerId) {
            // Verify if customerId exists in customers table
            const exists = (allCusts || []).some(c => c.id === customerId);
            if (!exists) {
                // Check if customerId is a membership ID
                const { data: member } = await supabase
                    .from('memberships')
                    .select('id, name, mobile')
                    .eq('id', customerId)
                    .eq('business_id', businessId)
                    .maybeSingle();

                if (member) {
                    const mPhone = member.mobile?.trim();
                    const mName = member.name?.trim().toLowerCase();
                    const matched = (allCusts || []).find(c => 
                        (mPhone && c.phone && c.phone.trim() === mPhone) ||
                        (mName && c.name && c.name.trim().toLowerCase() === mName)
                    );
                    customerId = matched ? matched.id : undefined;
                } else {
                    customerId = undefined;
                }
            }
        }

        // If still not resolved and not walk-in, match by phone or trimmed name
        if (!customerId && finalCustomerName !== 'Walk-in') {
            const matched = (allCusts || []).find(c =>
                (isPhone && c.phone && c.phone.trim() === cleanPhone) ||
                (c.name && c.name.trim().toLowerCase() === searchName)
            );
            if (matched) {
                customerId = matched.id;
            } else {
                // Check memberships table as well
                const { data: allMems } = await supabase
                    .from('memberships')
                    .select('id, name, mobile')
                    .eq('business_id', businessId);
                const matchedMem = (allMems || []).find(m =>
                    (isPhone && m.mobile && m.mobile.trim() === cleanPhone) ||
                    (m.name && m.name.trim().toLowerCase() === searchName)
                );
                if (matchedMem) {
                    const mPhone = matchedMem.mobile?.trim();
                    const mName = matchedMem.name?.trim().toLowerCase();
                    const custFromMem = (allCusts || []).find(c =>
                        (mPhone && c.phone && c.phone.trim() === mPhone) ||
                        (mName && c.name && c.name.trim().toLowerCase() === mName)
                    );
                    if (custFromMem) {
                        customerId = custFromMem.id;
                    }
                }
            }
        }
    } catch (lookupErr) {
        console.warn('[paymentService] Customer lookup warning:', lookupErr);
    }
    
    if (customerId) {
        // Update outstanding balance atomically
        const { error: ledgerError } = await supabase.rpc('increment_customer_ledger', {
            p_customer_id: customerId,
            p_billed: totalBilled,
            p_paid: effectiveAmountPaid
        });
        if (ledgerError) console.error("Failed to update ledger atomically", ledgerError);
    } else {
        // Create new customer if not walk-in or anonymous
        try {
            const cleanPhone = finalCustomerName.replace(/[\s\-\+]/g, '');
            const isPhone = /^\d+$/.test(cleanPhone) && cleanPhone.length >= 10;
            const newCustomer = {
                id: uuidv4(),
                business_id: businessId,
                name: isPhone ? 'Unknown' : finalCustomerName,
                phone: isPhone ? cleanPhone : null,
                total_billed: totalBilled,
                total_paid: effectiveAmountPaid,
                outstanding_balance: totalBilled - effectiveAmountPaid
            };
            
            const { error: createCustErr } = await supabase.from('customers').insert([newCustomer]);
            if (!createCustErr) {
                customerId = newCustomer.id;
            } else {
                console.error("Failed to create customer for ledger", createCustErr);
            }
        } catch (cErr) {
            console.error("Failed to initialize customer for ledger", cErr);
        }
    }

    // 2. Create Ledger Transaction Records (Double-Entry)
    // Always persist payment records to the payments table even if customerId is null!
    const records = [];
    
    // A. Record the Charge (Credit added to Member Ledger)
    if (totalBilled > 0) {
        const isStoreCredit = paymentStatus === 'Pending' || paymentMethod === 'QKhata' || !!dueDate;
        records.push({
            id: uuidv4(),
            business_id: businessId,
            customer_id: customerId || null,
            session_id: sessionId || null,
            amount: totalBilled,
            payment_method: isStoreCredit ? 'QKhata' : 'Session Bill',
            status: 'Billed',
            metadata: {
                type: 'CHARGE',
                source: source || 'System',
                due_date: dueDate || null,
                settled_instant: effectiveAmountPaid >= totalBilled
            }
        });
    }
    
    // B. Record the Payment(s) (Debt settled)
    if (validSplits.length > 0) {
        // Split payments across multiple payment methods
        for (const split of validSplits) {
            records.push({
                id: uuidv4(),
                business_id: businessId,
                customer_id: customerId || null,
                session_id: sessionId || null,
                amount: Number(split.amount),
                payment_method: split.method || 'Cash',
                status: 'Paid',
                metadata: {
                    type: 'PAYMENT',
                    source: source || 'System',
                    split: true
                }
            });
        }
    } else if (effectiveAmountPaid > 0) {
        // Single payment method
        records.push({
            id: uuidv4(),
            business_id: businessId,
            customer_id: customerId || null,
            session_id: sessionId || null,
            amount: effectiveAmountPaid,
            payment_method: paymentMethod || 'Cash',
            status: paymentStatus,
            metadata: {
                type: 'PAYMENT',
                source: source || 'System'
            }
        });
    }
    
    if (records.length > 0) {
        const { error: insertErr } = await supabase.from('payments').insert(records);
        if (insertErr) {
            console.error("[paymentService] Failed to insert payments:", insertErr);
        }
    }

        // Send SMS Confirmation if configured and paid
        if (paymentStatus === 'Paid' && effectiveAmountPaid > 0) {
            const { data: business } = await supabase.from('businesses').select('sms_config, business_name').eq('id', businessId).single();
            const smsConfig = business?.sms_config as SMSConfig;
            
            // Re-fetch customer phone to be safe
            const { data: cData } = await supabase.from('customers').select('phone').eq('id', customerId).single();
            
            if (smsConfig && smsConfig.enabled && cData?.phone) {
                const cleanPhone = normalizePhone(cData.phone) || '';
                if (cleanPhone.length >= 10) {
                    const smsMessage = `Thank you ${finalCustomerName}, your payment of Rs.${effectiveAmountPaid} at ${business?.business_name || 'our store'} has been received successfully.`;
                    sendSMS(businessId, cleanPhone, finalCustomerName, smsMessage, "payment_success_v1", smsConfig).catch(console.error); // Fire and forget
                }
            }
        }
        
        // Sync to Google Sheets via non-blocking asynchronous queue
        Promise.resolve().then(async () => {
            try {
                const { enqueueSheetsSync } = require('../sheetsSyncQueue');
                if (sessionId) {
                    enqueueSheetsSync('SESSION', sessionId, businessId);
                }
                if (customerId) {
                    enqueueSheetsSync('MEMBER', customerId, businessId);
                }
            } catch(e) {
                console.error('Failed to enqueue sheets sync for payment', e);
            }
        }).catch(e => console.error(e));
}

// ----------------- QPay Gateway Abstraction -----------------

export async function createCheckoutSession(businessId: string, amount: number, currency: string, metadata: any) {
    // Check business config
    const { data: business } = await supabase.from('businesses').select('qpay_config').eq('id', businessId).single();
    if (!business || !business.qpay_config || !business.qpay_config.enabled) {
        throw new Error('Payment gateway is not enabled for this business');
    }

    const provider = business.qpay_config.provider || 'mock';
    
    // Dispatch to provider implementation
    if (provider === 'mock') {
        return createMockCheckoutSession(amount, metadata);
    }
    
    throw new Error(`Provider ${provider} not implemented yet.`);
}

async function createMockCheckoutSession(amount: number, metadata: any) {
    const paymentId = `mock_txn_${Date.now()}`;
    return {
        url: `/mock-checkout?payment_id=${paymentId}&amount=${amount}`,
        paymentId
    };
}

export async function handleWebhookEvent(provider: string, payload: any) {
    // Webhook idempotency and processing
    if (provider === 'mock') {
        // Implement mock webhook processing
        const { paymentId, status, sessionId, businessId } = payload;
        
        // Find payment
        const { data: payment } = await supabase.from('payments').select('*').eq('reference_id', paymentId).single();
        if (payment && payment.status !== 'Paid' && status === 'success') {
            await supabase.from('payments').update({ status: 'Paid' }).eq('id', payment.id);
            // Optionally update session and customer outstanding if this was pending
        }
        return { success: true };
    }
    
    throw new Error(`Provider ${provider} webhook not implemented.`);
}
