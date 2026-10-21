import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';
import { resolveReportRange, ReportPreset } from '@/lib/services/reportsDateUtils';
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

    const metric = searchParams.get('metric') || 'revenue'; // revenue, collected, pendingDues, discounts, refunds, sessions, fb
    const period = (searchParams.get('period') || 'thisMonth') as ReportPreset;
    const customStart = searchParams.get('startDate') || undefined;
    const customEnd = searchParams.get('endDate') || undefined;

    // Fetch business for timezone (Cached in memory with 60s TTL)
    const business = await businessManager.getBusiness(businessId);
    const timezone = getBusinessTimezone(business) || DEFAULT_BUSINESS_TIMEZONE;

    const range = resolveReportRange(period, customStart, customEnd, new Date(), timezone);
    const startIso = range.current.startIso;
    const endIso = range.current.endIso;

    let rows: any[] = [];
    let totalValue = 0;

    switch (metric) {
      case 'revenue': {
        const { data } = await supabase
          .from('sessions')
          .select('id, customer_name, table_id, game_type, cost, base_cost, discount_amount, food_cost, end_time, payment_status')
          .eq('business_id', businessId)
          .eq('status', 'COMPLETED')
          .gte('end_time', startIso)
          .lt('end_time', endIso)
          .order('end_time', { ascending: false })
          .limit(500);

        rows = (data || []).map(s => {
          const val = Math.round(Number(s.cost) || 0);
          totalValue += val;
          return {
            id: s.id,
            ref: `S-${s.id.slice(0, 4).toUpperCase()}`,
            name: s.customer_name || 'Walk-in',
            details: `${s.game_type} at ${s.table_id}`,
            date: formatDateInTimezone(s.end_time, timezone),
            time: formatTimeInTimezone(s.end_time, timezone),
            amount: val,
            status: s.payment_status || 'Paid'
          };
        });
        break;
      }
      case 'collected': {
        const { data } = await supabase
          .from('payments')
          .select('id, amount, payment_method, status, metadata, session_id, created_at, customers!left(name)')
          .eq('business_id', businessId)
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .order('created_at', { ascending: false })
          .limit(500);

        rows = (data || [])
          .filter(p => p.status === 'Paid' && p.metadata?.type !== 'CHARGE')
          .map(p => {
            const val = Math.round(Number(p.amount) || 0);
            totalValue += val;
            const cust: any = Array.isArray(p.customers) ? p.customers[0] : p.customers;
            return {
              id: p.id,
              ref: `P-${p.id.slice(0, 4).toUpperCase()}`,
              name: cust?.name || (p.session_id ? 'Session Payment' : 'QKhata Settlement'),
              details: p.payment_method || 'Cash',
              date: formatDateInTimezone(p.created_at, timezone),
              time: formatTimeInTimezone(p.created_at, timezone),
              amount: val,
              status: 'Paid'
            };
          });
        break;
      }
      case 'pendingDues': {
        const { data } = await supabase
          .from('customers')
          .select('id, name, phone, outstanding_balance, updated_at')
          .eq('business_id', businessId)
          .gt('outstanding_balance', 0)
          .order('outstanding_balance', { ascending: false })
          .limit(500);

        rows = (data || []).map(c => {
          const val = Math.round(Number(c.outstanding_balance) || 0);
          totalValue += val;
          return {
            id: c.id,
            ref: `C-${c.id.slice(0, 4).toUpperCase()}`,
            name: c.name || 'Member',
            details: c.phone || 'No phone recorded',
            date: formatDateInTimezone(c.updated_at, timezone),
            time: '—',
            amount: val,
            status: 'Due'
          };
        });
        break;
      }
      case 'discounts': {
        const { data } = await supabase
          .from('sessions')
          .select('id, customer_name, table_id, game_type, discount_amount, applied_pricing, end_time')
          .eq('business_id', businessId)
          .eq('status', 'COMPLETED')
          .gt('discount_amount', 0)
          .gte('end_time', startIso)
          .lt('end_time', endIso)
          .order('end_time', { ascending: false })
          .limit(500);

        rows = (data || []).map(s => {
          const val = Math.round(Number(s.discount_amount) || 0);
          totalValue += val;
          return {
            id: s.id,
            ref: `S-${s.id.slice(0, 4).toUpperCase()}`,
            name: s.customer_name || 'Walk-in',
            details: s.applied_pricing || `${s.game_type} at ${s.table_id}`,
            date: formatDateInTimezone(s.end_time, timezone),
            time: formatTimeInTimezone(s.end_time, timezone),
            amount: val,
            status: 'Discount'
          };
        });
        break;
      }
      case 'refunds': {
        const { data } = await supabase
          .from('payments')
          .select('id, amount, payment_method, metadata, created_at, customers!left(name)')
          .eq('business_id', businessId)
          .or('status.eq.Refunded,metadata->>type.eq.ORDER_VOID_REVERSAL')
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .order('created_at', { ascending: false })
          .limit(500);

        rows = (data || []).map(p => {
          const val = Math.round(Number(p.amount) || 0);
          totalValue += val;
          const cust: any = Array.isArray(p.customers) ? p.customers[0] : p.customers;
          return {
            id: p.id,
            ref: `R-${p.id.slice(0, 4).toUpperCase()}`,
            name: cust?.name || 'Customer Refund',
            details: p.metadata?.reason || p.payment_method || 'Refund',
            date: formatDateInTimezone(p.created_at, timezone),
            time: formatTimeInTimezone(p.created_at, timezone),
            amount: -val,
            status: 'Refunded'
          };
        });
        break;
      }
      case 'fb': {
        const { data } = await supabase
          .from('sessions')
          .select('id, customer_name, table_id, food_cost, end_time')
          .eq('business_id', businessId)
          .eq('status', 'COMPLETED')
          .gt('food_cost', 0)
          .gte('end_time', startIso)
          .lt('end_time', endIso)
          .order('end_time', { ascending: false })
          .limit(500);

        rows = (data || []).map(s => {
          const val = Math.round(Number(s.food_cost) || 0);
          totalValue += val;
          return {
            id: s.id,
            ref: `F-${s.id.slice(0, 4).toUpperCase()}`,
            name: s.customer_name || 'Walk-in',
            details: `F&B Orders at ${s.table_id}`,
            date: formatDateInTimezone(s.end_time, timezone),
            time: formatTimeInTimezone(s.end_time, timezone),
            amount: val,
            status: 'Delivered'
          };
        });
        break;
      }
      case 'sessions': {
        const { data } = await supabase
          .from('sessions')
          .select('id, customer_name, table_id, game_type, duration, cost, status, end_time, created_at')
          .eq('business_id', businessId)
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .order('created_at', { ascending: false });

        rows = (data || []).map(s => {
          const isComp = s.status === 'COMPLETED';
          const val = Math.round(Number(s.cost) || 0);
          if (isComp) totalValue += 1;
          return {
            id: s.id,
            ref: `S-${s.id.slice(0, 4).toUpperCase()}`,
            name: s.customer_name || 'Walk-in',
            details: `${s.game_type} (${s.duration || '—'})`,
            date: formatDateInTimezone(s.end_time || s.created_at, timezone),
            time: formatTimeInTimezone(s.end_time || s.created_at, timezone),
            amount: val,
            status: s.status
          };
        });
        break;
      }
      default:
        break;
    }

    return NextResponse.json({
      metric,
      rows,
      totalCount: rows.length,
      totalValue
    });
  } catch (error: any) {
    console.error('[reports/drilldown] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load drill-down data' },
      { status: 500 }
    );
  }
}
