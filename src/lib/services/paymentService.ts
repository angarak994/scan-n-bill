import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentPayload {
    businessId: string;
    sessionId?: string;
    customerName: string;
    totalBilled: number;
    amountPaid: number;
    paymentMethod: string;
    paymentStatus: string; // 'Paid', 'Pending', 'Partially Paid', 'Failed'
    dueDate?: string;
    source?: string;
}

export async function createLedgerEntryAndPayment(payload: PaymentPayload) {
    const { businessId, sessionId, customerName, totalBilled, amountPaid, paymentMethod, paymentStatus, dueDate, source } = payload;

    if (!businessId || !customerName) return;

    // 1. Resolve or Create Customer (for Ledger)
    let customerId;
    
    // First, try matching by phone if it's a mobile number (assume 10 digits as simple heuristic or just match exactly)
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, total_billed, total_paid, outstanding_balance')
        .eq('business_id', businessId)
        .or(`name.ilike.${customerName},phone.eq.${customerName}`)
        .limit(1)
        .single();

    if (existingCustomer) {
        customerId = existingCustomer.id;
        // Update outstanding balance
        const newTotalBilled = Number(existingCustomer.total_billed) + totalBilled;
        const newTotalPaid = Number(existingCustomer.total_paid) + amountPaid;
        const newOutstanding = newTotalBilled - newTotalPaid;
        
        await supabase.from('customers').update({
            total_billed: newTotalBilled,
            total_paid: newTotalPaid,
            outstanding_balance: newOutstanding,
            updated_at: new Date().toISOString()
        }).eq('id', customerId);
    } else {
        // Create new customer
        const isPhone = /^\d+$/.test(customerName.replace(/[\s\-\+]/g, ''));
        const newCustomer = {
            id: uuidv4(),
            business_id: businessId,
            name: isPhone ? 'Unknown' : customerName,
            phone: isPhone ? customerName : null,
            total_billed: totalBilled,
            total_paid: amountPaid,
            outstanding_balance: totalBilled - amountPaid
        };
        
        const { error } = await supabase.from('customers').insert([newCustomer]);
        if (!error) {
            customerId = newCustomer.id;
        } else {
            console.error("Failed to create customer for ledger", error);
        }
    }

    // 2. Create Payment Transaction Record
    if (customerId) {
        const paymentRecord = {
            id: uuidv4(),
            business_id: businessId,
            customer_id: customerId,
            session_id: sessionId || null,
            amount: amountPaid,
            payment_method: paymentMethod || 'Cash',
            status: paymentStatus,
            metadata: {
                due_date: dueDate || null,
                source: source || 'System'
            }
        };
        
        await supabase.from('payments').insert([paymentRecord]);
    }
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
