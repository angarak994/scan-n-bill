import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { getBusinessEntitlement } from '@/lib/entitlements';

export async function GET(req: Request) {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const businessId = sessionCookie.businessId;

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
        return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    const entitlement = await getBusinessEntitlement(businessId);
    if (!entitlement.hasAccess || !entitlement.features.has_qkhata) {
        return NextResponse.json({ error: 'Upgrade required to access QKhata ledger.' }, { status: 403 });
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

            const isChargeEvent = isCharge || (!isCharge && !isPayment && p.payment_method === 'QKhata');
            const isPaymentEvent = isPayment || (!isCharge && !isPayment && p.payment_method !== 'QKhata');

            let eventType: 'CHARGE' | 'PAYMENT' = isChargeEvent ? 'CHARGE' : 'PAYMENT';
            let title = '';
            let subtitle = '';

            if (isChargeEvent) {
                credit = amount;
                runningBalance += amount;
                title = p.sessions 
                    ? `${p.sessions.game_type || 'Session'} at ${p.sessions.table_id}`
                    : 'Session Charge';
                subtitle = 'Session Billed';
            } else if (isPaymentEvent) {
                payment = amount;
                runningBalance -= amount;
                const method = p.payment_method || 'Cash';
                title = `Payment Received (${method})`;
                subtitle = p.session_id 
                    ? (p.sessions ? `Settled for ${p.sessions.game_type || 'Session'} ${p.sessions.table_id}` : 'Session Settlement')
                    : (p.metadata?.source || 'QKhata Settlement');
            }

            return {
                id: p.id,
                date: new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                time: new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                description: title,
                subtitle,
                event_type: eventType,
                payment_method: p.payment_method,
                source: p.metadata?.source || p.payment_method,
                credit,
                payment,
                balance: runningBalance,
                session_id: p.session_id,
                table_id: p.sessions?.table_id,
                game_type: p.sessions?.game_type
            };
        });

        // Reverse to show newest first on UI
        ledger.reverse();

        return NextResponse.json({ 
            ledger,
            currentBalance: runningBalance
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
