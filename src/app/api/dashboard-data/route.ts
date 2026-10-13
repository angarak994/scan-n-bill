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

    const scope = searchParams.get('scope') || 'all';

    // Fast-path: Scoped Realtime Refresh (avoids refetching 8 tables when only 1 changed)
    if (scope === 'sessions') {
      const sessions = await sessionRepository.findAllByDateRange(startDate, endDate, businessId as string);

      let activeSessions = sessions.filter(s => s.status === 'ACTIVE');
      const activeTableMap = new Map<string, typeof activeSessions[0]>();
      for (const s of activeSessions) {
        const existing = activeTableMap.get(s.table_id);
        if (!existing || new Date(s.start_time).getTime() > new Date(existing.start_time).getTime()) {
          activeTableMap.set(s.table_id, s);
        }
      }
      activeSessions = Array.from(activeTableMap.values());
      
      let completedSessions = sessions.filter(s => {
        if (s.status !== 'COMPLETED') return false;
        const sessionDate = s.date;
        if (s.end_time) {
          const localEndDateStr = new Date(s.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          return localEndDateStr >= startDate && localEndDateStr <= endDate;
        }
        return sessionDate >= startDate && sessionDate <= endDate;
      });

      const dailyRevenue = completedSessions.reduce((acc, session) => {
        const s = session as any;
        return acc + (s.cost || 0);
      }, 0);

      let prevStartDate: string;
      let prevEndDate: string;
      if (startDate === endDate) {
        const d = new Date(startDate);
        d.setDate(d.getDate() - 1);
        prevStartDate = getLocalDateStr(d);
        prevEndDate = prevStartDate;
      } else {
        const startMs = new Date(startDate).getTime();
        const endMs = new Date(endDate).getTime();
        const rangeDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
        const prevEndD = new Date(startMs - 24 * 60 * 60 * 1000);
        const prevStartD = new Date(prevEndD.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
        prevStartDate = getLocalDateStr(prevStartD);
        prevEndDate = getLocalDateStr(prevEndD);
      }

      const [
        { data: prevCompletedSessionsData },
        { data: interventions }
      ] = await Promise.all([
        supabase
          .from('sessions')
          .select('cost, amount_paid, payment_status, status, date')
          .eq('business_id', businessId)
          .eq('status', 'COMPLETED')
          .gte('date', prevStartDate)
          .lte('date', prevEndDate),
        supabase
          .from('session_interventions')
          .select('amount_recovered, intervention_type, sessions!inner(business_id)')
          .eq('sessions.business_id', businessId)
          .eq('intervention_type', 'force_close')
          .gte('created_at', startOfDayUTC)
      ]);

      const previousRevenue = (prevCompletedSessionsData || []).reduce((acc: number, s: any) => {
        return acc + (Number(s.cost) || 0);
      }, 0);

      let growthRate = 0;
      let isPositive = true;
      let trend: 'up' | 'down' | 'flat' = 'flat';

      if (previousRevenue > 0) {
        const diff = dailyRevenue - previousRevenue;
        growthRate = Number(((diff / previousRevenue) * 100).toFixed(1));
        isPositive = growthRate >= 0;
        trend = growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'flat';
      } else if (dailyRevenue > 0) {
        growthRate = 100.0;
        isPositive = true;
        trend = 'up';
      }

      const revenueIntelligence = {
        currentRevenue: dailyRevenue,
        previousRevenue,
        growthPercentage: growthRate,
        formattedGrowth: `${growthRate > 0 ? '+' : ''}${growthRate}%`,
        isPositive,
        trend,
        comparisonLabel: startDate === endDate ? 'vs yesterday' : 'vs prior period',
        revenueDiff: dailyRevenue - previousRevenue
      };

      const kpis = { totalRevenue: dailyRevenue, totalSessions: completedSessions.length };
      const manualClosuresToday = interventions?.length || 0;
      const revenueSavedToday = interventions?.reduce((acc, inv) => acc + Number(inv.amount_recovered || 0), 0) || 0;

      return NextResponse.json({
        activeSessions,
        completedSessions,
        dailyRevenue,
        revenueIntelligence,
        kpis,
        manualClosuresToday,
        revenueSavedToday
      });
    }

    if (scope === 'notifications') {
      const { data: foodOrders } = await supabase
        .from('notifications')
        .select('*')
        .eq('business_id', businessId)
        .in('type', ['order_pending', 'order_accepted'])
        .order('created_at', { ascending: false });
      return NextResponse.json({ foodOrders: foodOrders || [] });
    }

    if (scope === 'bookings') {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', businessId)
        .gte('booking_date', todayDateStr);
      return NextResponse.json({ bookings: bookings || [] });
    }

    if (scope === 'customers') {
      const [{ data: dbCustomers }, { data: memberships }] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name, phone, outstanding_balance')
          .eq('business_id', businessId)
          .order('updated_at', { ascending: false })
          .limit(1000),
        supabase
          .from('memberships')
          .select('id, name, mobile, points')
          .eq('business_id', businessId)
          .limit(1000)
      ]);
      return NextResponse.json({ dbCustomers: dbCustomers || [], memberships: memberships || [] });
    }

    if (scope === 'promotions') {
      const { data: activePromotions } = await supabase
        .from('promotions')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      return NextResponse.json({ activePromotions: activePromotions || [] });
    }

    if (scope === 'tables') {
      return NextResponse.json({ tables: business.tables || [] });
    }

    const [
      sessions,
      { data: interventions },
      { data: bookings },
      { data: activePromotions },
      { data: dbCustomers },
      { data: memberships },
      { data: foodOrders },
      { data: membership_plans }
    ] = await Promise.all([
      sessionRepository.findAllByDateRange(startDate, endDate, businessId as string),
      supabase
        .from('session_interventions')
        .select('amount_recovered, intervention_type, sessions!inner(business_id)')
        .eq('sessions.business_id', businessId)
        .eq('intervention_type', 'force_close')
        .gte('created_at', startOfDayUTC),
      supabase.from('bookings').select('*').eq('business_id', businessId).gte('booking_date', todayDateStr),
      supabase
        .from('promotions')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('customers')
        .select('id, name, phone, outstanding_balance')
        .eq('business_id', businessId)
        .order('updated_at', { ascending: false })
        .limit(1000),
      supabase
        .from('memberships')
        .select('id, name, mobile, points')
        .eq('business_id', businessId)
        .limit(1000),
      supabase
        .from('notifications')
        .select('*')
        .eq('business_id', businessId)
        .in('type', ['order_pending', 'order_accepted'])
        .order('created_at', { ascending: false }),
      supabase
        .from('membership_plans')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
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
    let completedSessions = sessions.filter(s => {
      if (s.status !== 'COMPLETED') return false;
      
      const sessionDate = s.date;
      
      // If end_time exists, check if the session ended within the target date range.
      // This ensures revenue from sessions starting before midnight but ending today counts for today.
      if (s.end_time) {
        // end_time is ISO string (e.g., 2026-09-26T02:00:00.000Z)
        // Convert to local date string matching startDate/endDate format (YYYY-MM-DD)
        const localEndDateStr = new Date(s.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return localEndDateStr >= startDate && localEndDateStr <= endDate;
      }
      
      return sessionDate >= startDate && sessionDate <= endDate;
    });

    const dailyRevenue = completedSessions.reduce((acc, session) => {
      const s = session as any;
      return acc + (s.cost || 0);
    }, 0);

    // Calculate previous period dates for real-time growth intelligence
    let prevStartDate: string;
    let prevEndDate: string;
    if (startDate === endDate) {
      const d = new Date(startDate);
      d.setDate(d.getDate() - 1);
      prevStartDate = getLocalDateStr(d);
      prevEndDate = prevStartDate;
    } else {
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      const rangeDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1);
      const prevEndD = new Date(startMs - 24 * 60 * 60 * 1000);
      const prevStartD = new Date(prevEndD.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
      prevStartDate = getLocalDateStr(prevStartD);
      prevEndDate = getLocalDateStr(prevEndD);
    }

    // Query previous period completed sessions
    const { data: prevCompletedSessionsData } = await supabase
      .from('sessions')
      .select('cost, amount_paid, payment_status, status, date')
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .gte('date', prevStartDate)
      .lte('date', prevEndDate);

    const previousRevenue = (prevCompletedSessionsData || []).reduce((acc: number, s: any) => {
      return acc + (Number(s.cost) || 0);
    }, 0);

    // Calculate real-time exact growth percentage
    let growthRate = 0;
    let isPositive = true;
    let trend: 'up' | 'down' | 'flat' = 'flat';

    if (previousRevenue > 0) {
      const diff = dailyRevenue - previousRevenue;
      growthRate = Number(((diff / previousRevenue) * 100).toFixed(1));
      isPositive = growthRate >= 0;
      trend = growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'flat';
    } else if (dailyRevenue > 0) {
      growthRate = 100.0;
      isPositive = true;
      trend = 'up';
    } else {
      growthRate = 0.0;
      isPositive = true;
      trend = 'flat';
    }

    const revenueIntelligence = {
      currentRevenue: dailyRevenue,
      previousRevenue,
      growthPercentage: growthRate,
      formattedGrowth: `${growthRate > 0 ? '+' : ''}${growthRate}%`,
      isPositive,
      trend,
      comparisonLabel: startDate === endDate ? 'vs yesterday' : 'vs prior period',
      revenueDiff: dailyRevenue - previousRevenue
    };
    
    let kpis = { totalRevenue: dailyRevenue, totalSessions: completedSessions.length };
    const pricingRules = business.pricing_rules;

    const manualClosuresToday = interventions?.length || 0;
    const revenueSavedToday = interventions?.reduce((acc, inv) => acc + Number(inv.amount_recovered || 0), 0) || 0;

    const entitlement = await getBusinessEntitlement(businessId as string);

    return NextResponse.json({
      activeSessions,
      completedSessions,
      dailyRevenue,
      revenueIntelligence,
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
      entitlement: entitlement,
      foodOrders: foodOrders || [],
      membership_plans: membership_plans || []
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
