import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const businessId = sessionCookie.businessId;

    // Fetch all QKhata entries for this business
    const { data: qkhataEntries, error: qkError } = await supabase
        .from('qkhata')
        .select(`
            id,
            amount,
            type,
            status,
            payment_method,
            created_at,
            customers!left(name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

    if (qkError) {
        throw qkError;
    }

    // Fetch all completed sessions for this business (table bookings that generated revenue)
    const { data: sessionEntries, error: sessionError } = await supabase
        .from('sessions')
        .select(`
            id,
            cost,
            payment_status,
            payment_method,
            customer_name,
            end_time,
            date
        `)
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED');

    if (sessionError) {
        throw sessionError;
    }

    // Normalize QKhata payments
    const normalizedPayments: any[] = (qkhataEntries || []).map((q: any) => ({
        id: q.id,
        amount: q.amount,
        type: q.type, // 'credit' or 'payment'
        status: q.status,
        payment_method: q.payment_method,
        created_at: q.created_at,
        customers: q.customers
    }));

    // Normalize Session payments and merge them
    (sessionEntries || []).forEach((s: any) => {
        // Construct a created_at timestamp from date and end_time (approximate payment time)
        const dateStr = s.date || new Date().toISOString().split('T')[0];
        const timeStr = s.end_time ? (s.end_time.includes(' ') ? s.end_time.split(' ')[0] : s.end_time) : '00:00:00';
        let dateTimeStr = `${dateStr}T${timeStr}`;
        if (dateTimeStr.length === 16) dateTimeStr += ':00'; // Add seconds if missing
        if (!dateTimeStr.includes('Z')) dateTimeStr += '+05:30'; // IST assumed

        normalizedPayments.push({
            id: s.id,
            amount: s.cost || 0,
            type: 'session_payment',
            status: s.payment_status || 'Paid', // Assuming completed sessions are paid unless marked otherwise
            payment_method: s.payment_method || 'CASH',
            created_at: dateTimeStr,
            customers: { name: s.customer_name || 'Walk-in Customer' }
        });
    });

    // Sort combined array by created_at descending
    normalizedPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Perform Server-Side Aggregations
    const now = new Date();
    // Shift to local timezone implicitly by using ISO substrings for matching
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const aggregates = {
        today: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 },
        yesterday: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 },
        '7days': { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 },
        month: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 },
        all: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0 },
    };

    for (const p of normalizedPayments) {
        const dateObj = new Date(p.created_at);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        const isToday = dateStr === todayStr;
        const isYesterday = dateStr === yesterdayStr;
        const is7Days = dateObj >= sevenDaysAgo;
        const isMonth = dateObj >= firstOfMonth;
        const isAll = true;

        const amt = Number(p.amount);
        const isPaid = p.status === 'Paid';
        const isPending = p.status === 'Pending' || p.type === 'credit';
        const method = (p.payment_method || '').toUpperCase();

        const periods = [];
        if (isToday) periods.push('today');
        if (isYesterday) periods.push('yesterday');
        if (is7Days) periods.push('7days');
        if (isMonth) periods.push('month');
        if (isAll) periods.push('all');

        for (const period of periods) {
            const agg = aggregates[period as keyof typeof aggregates];
            if (isPaid) {
                agg.totalCollection += amt;
                if (method.includes('UPI')) agg.upiCollection += amt;
                else if (method.includes('CASH')) agg.cashCollection += amt;
                else agg.cashCollection += amt; 
            } else if (isPending) {
                agg.pendingAmount += amt;
            }
        }
    }

    return NextResponse.json({ 
        payments: normalizedPayments,
        aggregates
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
