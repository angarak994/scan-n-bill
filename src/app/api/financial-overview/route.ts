import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { businessManager } from '@/lib/businessManager';
import { getBusinessTimezone, DEFAULT_BUSINESS_TIMEZONE } from '@/lib/sheetsTimezone';

export const dynamic = 'force-dynamic';

function getDateInTimezone(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }
    
    const businessId = sessionCookie.businessId;

    // Fetch business record via cached businessManager
    const business = await businessManager.getBusiness(businessId);
    const timezone = getBusinessTimezone(business) || DEFAULT_BUSINESS_TIMEZONE;

    // Timezone-aware date boundaries
    const now = new Date();
    const todayStr = getDateInTimezone(now, timezone);
    const yesterdayDate = new Date(now.getTime() - 24 * 3600 * 1000);
    const yesterdayStr = getDateInTimezone(yesterdayDate, timezone);
    const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const sevenDaysStr = getDateInTimezone(sevenDaysAgoDate, timezone);
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;

    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const limit = Math.min(2000, Math.max(1, parseInt(url.searchParams.get('limit') || '1000', 10)));

    // 1. Prepare payment & transaction records query with customer and session joins
    let paymentsQuery = supabase
      .from('payments')
      .select(`
        id,
        amount,
        status,
        payment_method,
        reference_id,
        created_at,
        session_id,
        metadata,
        customer_id,
        customers!left(id, name, phone),
        sessions!left(id, customer_name, table_id, cost, amount_paid, payment_status, date, end_time)
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (startDate) {
      paymentsQuery = paymentsQuery.gte('created_at', startDate);
    }
    if (endDate) {
      const endIso = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      paymentsQuery = paymentsQuery.lte('created_at', endIso);
    } else if (!startDate) {
      paymentsQuery = paymentsQuery.limit(limit);
    }

    // 2. Prepare completed sessions query
    let sessionsQuery = supabase
      .from('sessions')
      .select(`
        id,
        cost,
        amount_paid,
        payment_status,
        customer_name,
        table_id,
        end_time,
        created_at,
        date
      `)
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .order('created_at', { ascending: false });

    if (startDate) {
      sessionsQuery = sessionsQuery.gte('date', startDate.split('T')[0]);
    }
    if (endDate) {
      sessionsQuery = sessionsQuery.lte('date', endDate.split('T')[0]);
    } else if (!startDate) {
      sessionsQuery = sessionsQuery.limit(limit);
    }

    // Execute both queries concurrently
    const [
      { data: rawPayments, error: pError },
      { data: rawSessions, error: sError }
    ] = await Promise.all([
      paymentsQuery,
      sessionsQuery
    ]);

    if (pError) {
      console.error('[financial-overview] Payments query error:', pError);
      throw pError;
    }

    if (sError) {
      console.error('[financial-overview] Sessions query error:', sError);
      // Non-fatal: if sessions query has an issue, proceed with payments
    }

    // Set of session IDs already recorded in payments to PREVENT DOUBLE-COUNTING
    const recordedSessionIds = new Set<string>(
      (rawPayments || [])
        .map((p: any) => p.session_id)
        .filter(Boolean)
    );

    // Track total paid per session to accurately calculate unpaid balance for CHARGE records
    const paidBySession = new Map<string, number>();
    for (const p of (rawPayments || [])) {
      if (p.session_id && p.status === 'Paid' && p.metadata?.type !== 'CHARGE') {
        paidBySession.set(p.session_id, (paidBySession.get(p.session_id) || 0) + Number(p.amount || 0));
      }
    }

    // 3. Normalize transactions for display and accounting
    const normalizedPayments: any[] = [];

    for (const p of (rawPayments || [])) {
      const isCharge = p.metadata?.type === 'CHARGE' || (p.payment_method === 'QKhata' && p.status === 'Billed');
      const isRefund = p.status === 'Refunded' || p.metadata?.type === 'ORDER_VOID_REVERSAL';
      
      const custObj: any = Array.isArray(p.customers) ? p.customers[0] : p.customers;
      const sessObj: any = Array.isArray(p.sessions) ? p.sessions[0] : p.sessions;

      const customerName = 
        custObj?.name || 
        sessObj?.customer_name || 
        (p.metadata?.description ? String(p.metadata.description).replace(/^Table time & Food \(|\)$/g, '') : null) || 
        'Walk-in Customer';

      const tableId = sessObj?.table_id || p.metadata?.table_id || null;

      if (isCharge) {
        // Double-entry check: if a session was billed and paid at checkout,
        // we omit the internal pairing charge so the merchant does NOT see a duplicate transaction.
        const alreadyPaid = p.session_id ? (paidBySession.get(p.session_id) || 0) : 0;
        const chargeAmt = Number(p.amount || 0);
        const unpaidBalance = Math.max(0, chargeAmt - alreadyPaid);

        if (unpaidBalance > 0) {
          // This represents an active unpaid bill (credit debt on QKhata)
          normalizedPayments.push({
            id: p.id,
            amount: unpaidBalance,
            original_amount: chargeAmt,
            status: 'Billed',
            payment_method: 'QKhata',
            type: 'charge',
            is_charge: true,
            created_at: p.created_at,
            session_id: p.session_id,
            table_id: tableId,
            customer_name: customerName,
            metadata: p.metadata,
            customers: p.customers || { name: customerName },
            sessions: p.sessions
          });
        }
      } else if (isRefund) {
        normalizedPayments.push({
          id: p.id,
          amount: Number(p.amount || 0),
          status: 'Refunded',
          payment_method: p.payment_method || 'Refund',
          type: 'refund',
          is_charge: false,
          created_at: p.created_at,
          session_id: p.session_id,
          table_id: tableId,
          customer_name: customerName,
          metadata: p.metadata,
          customers: p.customers || { name: customerName },
          sessions: p.sessions
        });
      } else {
        // Genuine payment received (Cash, UPI, Card, Split, etc.)
        normalizedPayments.push({
          id: p.id,
          amount: Number(p.amount || 0),
          status: p.status || 'Paid',
          payment_method: p.payment_method || 'Cash',
          type: 'payment',
          is_charge: false,
          is_split: Boolean(p.metadata?.split),
          created_at: p.created_at,
          session_id: p.session_id,
          table_id: tableId,
          customer_name: customerName,
          metadata: p.metadata,
          customers: p.customers || { name: customerName },
          sessions: p.sessions
        });
      }
    }

    // 4. Append legacy completed sessions that have NO records in payments
    (rawSessions || []).forEach((s: any) => {
      if (recordedSessionIds.has(s.id)) {
        return; // Prevent duplicate
      }

      let dateTimeStr = s.end_time || s.created_at;
      if (!dateTimeStr) {
        dateTimeStr = `${s.date || todayStr}T00:00:00+05:30`;
      }
      try {
        new Date(dateTimeStr).toISOString();
      } catch {
        dateTimeStr = new Date().toISOString();
      }

      const cost = Number(s.cost || 0);
      const paid = s.amount_paid !== undefined && s.amount_paid !== null 
        ? Number(s.amount_paid) 
        : (s.payment_status === 'Paid' ? cost : 0);

      const isPaid = s.payment_status === 'Paid' || (paid >= cost && cost > 0);
      const status = isPaid ? 'Paid' : (s.payment_status || 'Pending');
      const amount = isPaid ? (paid > 0 ? paid : cost) : Math.max(0, cost - paid);

      normalizedPayments.push({
        id: s.id,
        amount: amount,
        status: status,
        payment_method: isPaid ? 'Cash' : 'Pending',
        type: 'session_payment',
        is_charge: !isPaid,
        created_at: dateTimeStr,
        session_id: s.id,
        table_id: s.table_id || null,
        customer_name: s.customer_name || 'Walk-in Customer',
        customers: { name: s.customer_name || 'Walk-in Customer' },
        sessions: { table_id: s.table_id, customer_name: s.customer_name }
      });
    });

    // Sort all transactions by created_at descending
    normalizedPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 5. Timezone-Aware Server-Side Aggregations
    const aggregates = {
      today: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0, cardCollection: 0, otherCollection: 0, transactionCount: 0, byMethod: {} as Record<string, number> },
      yesterday: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0, cardCollection: 0, otherCollection: 0, transactionCount: 0, byMethod: {} as Record<string, number> },
      '7days': { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0, cardCollection: 0, otherCollection: 0, transactionCount: 0, byMethod: {} as Record<string, number> },
      month: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0, cardCollection: 0, otherCollection: 0, transactionCount: 0, byMethod: {} as Record<string, number> },
      all: { totalCollection: 0, pendingAmount: 0, cashCollection: 0, upiCollection: 0, cardCollection: 0, otherCollection: 0, transactionCount: 0, byMethod: {} as Record<string, number> },
    };

    for (const p of normalizedPayments) {
      const recDateStr = getDateInTimezone(new Date(p.created_at), timezone);

      const isToday = recDateStr === todayStr;
      const isYesterday = recDateStr === yesterdayStr;
      const is7Days = recDateStr >= sevenDaysStr && recDateStr <= todayStr;
      const isMonth = recDateStr >= monthStartStr && recDateStr <= todayStr;
      const isAll = true;

      const amt = Number(p.amount) || 0;
      const isCharge = p.is_charge || p.type === 'charge';
      const isRefund = p.status === 'Refunded' || p.type === 'refund';
      const isPaid = p.status === 'Paid' && !isCharge;
      const isPending = p.status === 'Pending' || p.status === 'Billed' || isCharge;
      const method = (p.payment_method || '').toUpperCase();

      const periods: Array<keyof typeof aggregates> = [];
      if (isToday) periods.push('today');
      if (isYesterday) periods.push('yesterday');
      if (is7Days) periods.push('7days');
      if (isMonth) periods.push('month');
      if (isAll) periods.push('all');

      for (const period of periods) {
        const agg = aggregates[period];
        agg.transactionCount += 1;

        if (isPaid) {
          agg.totalCollection += amt;
          
          if (method.includes('UPI') || method.includes('GPAY') || method.includes('PHONEPE') || method.includes('PAYTM')) {
            agg.upiCollection += amt;
            agg.byMethod['UPI'] = (agg.byMethod['UPI'] || 0) + amt;
          } else if (method.includes('CASH')) {
            agg.cashCollection += amt;
            agg.byMethod['Cash'] = (agg.byMethod['Cash'] || 0) + amt;
          } else if (method.includes('CARD')) {
            agg.cardCollection += amt;
            agg.byMethod['Card'] = (agg.byMethod['Card'] || 0) + amt;
          } else {
            agg.otherCollection += amt;
            const normMethod = p.payment_method || 'Other';
            agg.byMethod[normMethod] = (agg.byMethod[normMethod] || 0) + amt;
          }
        } else if (isRefund) {
          // Refunds reduce net collection
          agg.totalCollection = Math.max(0, agg.totalCollection - amt);
          agg.byMethod['Refunds'] = (agg.byMethod['Refunds'] || 0) + amt;
        }

        if (isPending && amt > 0) {
          agg.pendingAmount += amt;
        }
      }
    }

    return NextResponse.json({ 
      payments: normalizedPayments,
      aggregates,
      timezone,
      businessName: business?.business_name,
      periodBoundaries: {
        today: todayStr,
        yesterday: yesterdayStr,
        sevenDays: sevenDaysStr,
        month: monthStartStr
      }
    });

  } catch (err: any) {
    console.error('[financial-overview] Global error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load financial overview' }, { status: 500 });
  }
}
