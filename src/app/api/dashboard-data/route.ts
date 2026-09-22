import { NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { businessManager } from '@/lib/businessManager';
import { endSession } from '@/lib/sessionManager';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function toReadableDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric'
  });
  return formatter.format(date);
}

import { getBusinessEntitlement } from '@/lib/entitlements';
export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    const { searchParams } = new URL(request.url);
    
    // Secure backend validation via JWT
    const businessId = sessionCookie?.businessId;
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized: No valid session token' }, { status: 401 });
    }

    const business = await businessManager.getBusiness(businessId as string);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const requestedDate = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const getLocalDateStr = (d = new Date()) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayDateStr = getLocalDateStr();
    const startDate = startDateParam || requestedDate || todayDateStr;
    const endDate = endDateParam || requestedDate || todayDateStr;
    const targetDateStr = startDate; // Legacy variable for today Start
    const todayStr = startDate === endDate ? toReadableDate(new Date(startDate)) : `${toReadableDate(new Date(startDate))} - ${toReadableDate(new Date(endDate))}`;

    const localTodayStart = new Date();
    localTodayStart.setHours(0, 0, 0, 0);
    const startOfDayUTC = localTodayStart.toISOString();

    // Auto-expire and auto-activate promotions
    await supabase.rpc('update_expired_promotions');

    const [
      sessions,
      { data: interventions },
      { data: bookings },
      { data: activePromotions },
      { data: dbCustomers },
      { data: memberships }
    ] = await Promise.all([
      sessionRepository.findAllByDateRange(startDate, endDate, businessId as string),
      supabase
        .from('session_interventions')
        .select('amount_recovered, intervention_type, sessions!inner(business_id)')
        .eq('sessions.business_id', businessId)
        .eq('intervention_type', 'force_close')
        .gte('created_at', startOfDayUTC),
      supabase.from('bookings').select('*').eq('business_id', businessId).gte('booking_date', startDate).limit(100),
      supabase
        .from('promotions')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('id, name, phone, outstanding_balance')
        .eq('business_id', businessId)
        .order('outstanding_balance', { ascending: false })
        .limit(100),
      supabase
        .from('memberships')
        .select('id, name, mobile, points')
        .eq('business_id', businessId)
        .limit(100)
    ]);

    let activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    
    // Deduplicate active sessions by table_id (keep newest)
    const activeTableMap = new Map<string, typeof activeSessions[0]>();
    for (const s of activeSessions) {
      const existing = activeTableMap.get(s.table_id);
      if (!existing || new Date(s.start_time).getTime() > new Date(existing.start_time).getTime()) {
        activeTableMap.set(s.table_id, s);
      }
    }
    activeSessions = Array.from(activeTableMap.values());
    // 🚀 SCALABILITY UPGRADE: Fetch KPIs via Database RPC (Server-Side Aggregation)
    let kpis = { totalRevenue: 0, totalSessions: 0, avgMinutes: 0 };
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_kpis', { 
        p_business_id: businessId, 
        p_start_date: startDate, 
        p_end_date: endDate 
    });

    if (!rpcError && rpcData && rpcData.length > 0) {
        kpis.totalRevenue = Number(rpcData[0].total_revenue) || 0;
        kpis.totalSessions = Number(rpcData[0].total_sessions) || 0;
        kpis.avgMinutes = Number(rpcData[0].avg_duration_minutes) || 0;
    } else {
        // Fallback to fetching all for KPI calculation (deprecated/slow path)
        // If the user hasn't run the migration yet, we do it in-memory but DO NOT send it to the frontend!
        const { data: allCompleted } = await supabase.from('sessions')
             .select('*')
             .eq('business_id', businessId)
             .eq('status', 'COMPLETED')
             .gte('date', startDate)
             .lte('date', endDate);
        
        const completedSessions = allCompleted || [];
        kpis.totalSessions = completedSessions.length;
        kpis.totalRevenue = completedSessions.reduce((acc, s) => {
             const paid = s.payment_status === 'Paid' ? ((s.amount_paid && s.amount_paid > 0) ? Number(s.amount_paid) : (s.cost || 0)) : ((s.amount_paid && s.amount_paid > 0) ? Number(s.amount_paid) : 0);
             return acc + paid;
        }, 0);
        let totalMins = 0;
        completedSessions.forEach(s => {
             const st = new Date(`${s.date}T${s.start_time}`);
             const et = new Date(`${s.date}T${s.end_time}`);
             totalMins += (et.getTime() - st.getTime()) / 60000;
        });
        kpis.avgMinutes = kpis.totalSessions > 0 ? Math.round(totalMins / kpis.totalSessions) : 0;
    }

    const pricingRules = business.pricing_rules;

    const manualClosuresToday = interventions?.length || 0;
    const revenueSavedToday = interventions?.reduce((acc, inv) => acc + Number(inv.amount_recovered || 0), 0) || 0;

    const entitlement = await getBusinessEntitlement(businessId as string);

    return NextResponse.json({
      activeSessions,
      kpis,
      todayStr,
      pricingRules,
      tables: business.tables || [],
      activeDiscounts: business.active_discounts || {},
      manualClosuresToday,
      revenueSavedToday,
      bookings: bookings || [],
      activePromotions: activePromotions || [],
      dbCustomers: dbCustomers || [],
      memberships: memberships || [],
      businessId,
      businessName: business.business_name,
      ownerName: business.owner_name,
      has_logged_in: business.has_logged_in,
      goals: business.goals || { daily_revenue: 0, weekly_revenue: 0, monthly_revenue: 0, daily_sessions: 0 },
      google_sheet_id: business.google_sheet_id,
      payment_qr_config: business.payment_qr_config,
      whatsapp_config: business.whatsapp_config ? { enabled: business.whatsapp_config.enabled } : { enabled: false },
      menu_items: business.menu_items || [],
      entitlement: entitlement
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
