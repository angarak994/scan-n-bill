import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';
import { resolveReportRange, ReportPreset, formatINR } from '@/lib/services/reportsDateUtils';
import { getBusinessTimezone, DEFAULT_BUSINESS_TIMEZONE, formatTimeInTimezone, formatDateInTimezone } from '@/lib/sheetsTimezone';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = session.businessId;
    const { searchParams } = new URL(request.url);

    const period = (searchParams.get('period') || 'thisMonth') as ReportPreset;
    const customStart = searchParams.get('startDate') || undefined;
    const customEnd = searchParams.get('endDate') || undefined;
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const methodFilter = searchParams.get('method') || 'all'; // all, UPI, Cash, Card, QKhata
    const statusFilter = searchParams.get('status') || 'all'; // all, Paid, Due, Refunded
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') || '25', 10)));

    // Fetch business for timezone (Cached in memory with 60s TTL)
    const business = await businessManager.getBusiness(businessId);
    const timezone = getBusinessTimezone(business) || DEFAULT_BUSINESS_TIMEZONE;

    // Resolve date boundaries
    const range = resolveReportRange(period, customStart, customEnd, new Date(), timezone);
    const startIso = range.current.startIso;
    const endIso = range.current.endIso;

    // Fetch sessions and payments in parallel
    const [sessionsRes, paymentsRes] = await Promise.all([
      supabase
        .from('sessions')
        .select(`
          id,
          customer_name,
          table_id,
          game_type,
          base_cost,
          food_cost,
          discount_amount,
          cost,
          amount_paid,
          payment_status,
          status,
          end_time,
          created_at,
          duration,
          applied_pricing,
          completed_by
        `)
        .eq('business_id', businessId)
        .eq('status', 'COMPLETED')
        .gte('end_time', startIso)
        .lt('end_time', endIso),

      supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_method,
          status,
          metadata,
          session_id,
          customer_id,
          created_at,
          customers!left(id, name, phone)
        `)
        .eq('business_id', businessId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
    ]);

    const sessions = sessionsRes.data || [];
    const payments = paymentsRes.data || [];

    // Map payments by session_id to identify split methods and direct payments
    const paymentsBySession = new Map<string, any[]>();
    for (const p of payments) {
      if (p.session_id) {
        const arr = paymentsBySession.get(p.session_id) || [];
        arr.push(p);
        paymentsBySession.set(p.session_id, arr);
      }
    }

    const transactions: any[] = [];

    // 1. Session transactions
    for (const s of sessions) {
      const sessPayments = paymentsBySession.get(s.id) || [];
      const splitPays = sessPayments.filter(p => p.metadata?.split === true || (p.status === 'Paid' && p.metadata?.type === 'PAYMENT'));
      
      let effectiveMethod = (s as any).payment_method || 'Cash';
      if (splitPays.length > 1) {
        effectiveMethod = splitPays.map(sp => sp.payment_method).join(' + ');
      } else if (splitPays.length === 1) {
        effectiveMethod = splitPays[0].payment_method;
      }

      const gross = Math.round(Number(s.base_cost) || Number(s.cost) || 0);
      const discount = Math.round(Number(s.discount_amount) || 0);
      const net = Math.round(Number(s.cost) || (gross - discount));
      const isPaid = s.payment_status === 'Paid';
      const statusLabel = isPaid ? 'Paid' : 'Due';

      const shortId = `S-${s.id.slice(0, 4).toUpperCase()}`;
      const timeLabel = formatTimeInTimezone(s.end_time || s.created_at, timezone);
      const dateLabel = formatDateInTimezone(s.end_time || s.created_at, timezone);

      transactions.push({
        id: s.id,
        ref: shortId,
        type: (s.food_cost && Number(s.food_cost) > 0 && Number(s.cost) === Number(s.food_cost)) ? 'F&B' : 'Session',
        time: timeLabel,
        date: dateLabel,
        timestamp: new Date(s.end_time || s.created_at).getTime(),
        customer: s.customer_name || 'Walk-in',
        table: s.table_id,
        game: s.game_type,
        method: effectiveMethod,
        gross,
        discount,
        net,
        status: statusLabel,
        recordTrail: {
          session: s,
          payments: sessPayments
        }
      });
    }

    // 2. Direct QKhata Settlements (payments without session_id)
    const directSettlements = payments.filter(p => !p.session_id && p.status === 'Paid' && p.metadata?.type !== 'CHARGE');
    for (const p of directSettlements) {
      const custObj: any = Array.isArray(p.customers) ? p.customers[0] : p.customers;
      const custName = custObj?.name || 'Member';
      const amt = Math.round(Number(p.amount) || 0);
      const shortId = `P-${p.id.slice(0, 4).toUpperCase()}`;

      transactions.push({
        id: p.id,
        ref: shortId,
        type: 'Settlement',
        time: formatTimeInTimezone(p.created_at, timezone),
        date: formatDateInTimezone(p.created_at, timezone),
        timestamp: new Date(p.created_at).getTime(),
        customer: custName,
        table: '—',
        game: 'QKhata Settlement',
        method: p.payment_method || 'Cash',
        gross: amt,
        discount: 0,
        net: amt,
        status: 'Paid',
        recordTrail: {
          payment: p,
          customer: custObj
        }
      });
    }

    // 3. Refunds
    const refunds = payments.filter(p => p.status === 'Refunded' || p.metadata?.type === 'ORDER_VOID_REVERSAL');
    for (const r of refunds) {
      const custObj: any = Array.isArray(r.customers) ? r.customers[0] : r.customers;
      const custName = custObj?.name || 'Walk-in';
      const amt = Math.round(Number(r.amount) || 0);
      const shortId = `R-${r.id.slice(0, 4).toUpperCase()}`;

      transactions.push({
        id: r.id,
        ref: shortId,
        type: 'Refund',
        time: formatTimeInTimezone(r.created_at, timezone),
        date: formatDateInTimezone(r.created_at, timezone),
        timestamp: new Date(r.created_at).getTime(),
        customer: custName,
        table: r.metadata?.table_id || '—',
        game: r.metadata?.reason || 'Refund',
        method: r.payment_method || 'UPI',
        gross: -amt,
        discount: 0,
        net: -amt,
        status: 'Refunded',
        recordTrail: {
          payment: r
        }
      });
    }

    // Sort by timestamp descending
    transactions.sort((a, b) => b.timestamp - a.timestamp);

    // Apply Search Filter
    let filtered = transactions;
    if (search) {
      filtered = filtered.filter(t => 
        t.customer.toLowerCase().includes(search) || 
        t.ref.toLowerCase().includes(search) ||
        t.table.toLowerCase().includes(search)
      );
    }

    // Apply Method Filter
    if (methodFilter !== 'all') {
      filtered = filtered.filter(t => t.method.toLowerCase().includes(methodFilter.toLowerCase()));
    }

    // Apply Status Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status.toLowerCase() === statusFilter.toLowerCase());
    }

    // Total count and totals for the filtered set
    const totalCount = filtered.length;
    const totalFilteredGross = filtered.reduce((acc, t) => acc + t.gross, 0);
    const totalFilteredNet = filtered.reduce((acc, t) => acc + t.net, 0);

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      transactions: paginated,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      },
      filteredTotals: {
        gross: totalFilteredGross,
        net: totalFilteredNet
      }
    });
  } catch (error: any) {
    console.error('[reports/transactions] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load transactions' },
      { status: 500 }
    );
  }
}
