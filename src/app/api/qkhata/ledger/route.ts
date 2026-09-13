import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const customerId = searchParams.get('customerId');

    if (!businessId || !customerId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    try {
        // Fetch payments for this customer
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select(`
                *,
                sessions (
                    table_id,
                    game_type
                )
            `)
            .eq('business_id', businessId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: true }); // Ascending to compute running balance

        if (paymentsError) throw paymentsError;

        let runningBalance = 0;
        
        const ledger = payments.map((p) => {
            const isCharge = p.metadata?.type === 'CHARGE';
            const isPayment = p.metadata?.type === 'PAYMENT';
            
            // Legacy handling
            const amount = Number(p.amount);
            let credit = 0;
            let payment = 0;

            if (isCharge || (!isCharge && !isPayment && p.payment_method === 'QKhata')) {
                credit = amount;
                runningBalance += amount;
            } else if (isPayment || (!isCharge && !isPayment && p.payment_method !== 'QKhata')) {
                payment = amount;
                runningBalance -= amount;
            }

            let description = p.metadata?.source || 'System';
            if (p.sessions) {
                description = `${p.sessions.game_type || 'Session'} at ${p.sessions.table_id}`;
            }

            return {
                id: p.id,
                date: new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                time: new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                description,
                source: p.metadata?.source || p.payment_method,
                credit,
                payment,
                balance: runningBalance,
                session_id: p.session_id
            };
        });

        // Reverse to show newest first on UI
        ledger.reverse();

        return NextResponse.json({ ledger });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
