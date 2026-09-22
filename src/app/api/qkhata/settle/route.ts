import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const sessionCookie = await getSession();
        if (!sessionCookie || !sessionCookie.businessId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { customerId, amount, settlementMethod, selectedCustomerName, selectedCustomerPhone, isCustomerRecord } = body;
        const businessId = sessionCookie.businessId;

        if (!amount || !settlementMethod) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        let customerIdToUse = customerId;
        
        // Auto-create ledger profile if settling a pure membership record
        if (isCustomerRecord === false) {
            const { data: newCust, error: createErr } = await supabase.from('customers').insert([{
                business_id: businessId,
                name: selectedCustomerName,
                phone: selectedCustomerPhone,
                total_billed: 0,
                total_paid: 0,
                outstanding_balance: 0
            }]).select().single();
            
            if (createErr) throw createErr;
            customerIdToUse = newCust.id;
        }

        // Create payment record
        const paymentRecord = {
            business_id: businessId,
            customer_id: customerIdToUse,
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

        // Fetch current customer to update balances
        const { data: customer, error: fetchErr } = await supabase.from('customers').select('*').eq('id', customerIdToUse).single();
        if (fetchErr) throw fetchErr;

        const newTotalPaid = Number(customer.total_paid || 0) + Number(amount);
        const newOutstanding = Number(customer.outstanding_balance || 0) - Number(amount);

        const { error: customerError } = await supabase.from('customers').update({
            total_paid: newTotalPaid,
            outstanding_balance: newOutstanding,
            updated_at: new Date().toISOString()
        }).eq('id', customerIdToUse);

        if (customerError) throw customerError;

        return NextResponse.json({ ok: true, customerId: customerIdToUse });
    } catch (error: any) {
        console.error('Settlement Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
