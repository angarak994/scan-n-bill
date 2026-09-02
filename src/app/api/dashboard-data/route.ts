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

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('b');

    // Secure backend validation via JWT
    if (!sessionCookie || !sessionCookie.businessId) {
       return NextResponse.json({ error: 'Unauthorized: Invalid or missing session cookie' }, { status: 401 });
    }

    // Optional: enforce that requested businessId matches JWT (if provided)
    if (businessId && businessId !== sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Access denied for this business' }, { status: 403 });
    }
    
    // Fallback to JWT businessId
    businessId = sessionCookie.businessId;

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

    const sessions = await sessionRepository.findAllByDateRange(startDate, endDate, businessId as string);

    let activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    let completedSessions = sessions.filter(s => {
      if (s.status !== 'COMPLETED') return false;
      return s.date >= startDate && s.date <= endDate;
    });

    const dailyRevenue = completedSessions.reduce((acc, session) => acc + (session.cost || 0), 0);
    const pricingRules = business.pricing_rules;

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    const localTodayStart = new Date();
    localTodayStart.setHours(0, 0, 0, 0);
    const startOfDayUTC = localTodayStart.toISOString();

    const { data: interventions } = await supabase
      .from('session_interventions')
      .select('amount_recovered, intervention_type, sessions!inner(business_id)')
      .eq('sessions.business_id', businessId)
      .eq('intervention_type', 'force_close')
      .gte('created_at', startOfDayUTC);

    const manualClosuresToday = interventions?.length || 0;
    const { data: bookings } = await supabase.from('bookings').select('*').eq('business_id', businessId).gte('booking_date', startDate);

    const revenueSavedToday = interventions?.reduce((acc, inv) => acc + Number(inv.amount_recovered || 0), 0) || 0;

    const { data: activePromotions } = await supabase
      .from('promotions')
      .select('*')
      .eq('business_id', businessId)
      .eq('status', 'Active');

    return NextResponse.json({
      activeSessions,
      completedSessions,
      dailyRevenue,
      todayStr,
      pricingRules,
      tables: business.tables || [],
      activeDiscounts: business.active_discounts || {},
      manualClosuresToday,
      revenueSavedToday,
      bookings: bookings || [],
      activePromotions: activePromotions || [],
      businessId,
      businessName: business.business_name,
      ownerName: business.owner_name,
      has_logged_in: business.has_logged_in,
      goals: business.goals || { daily_revenue: 0, weekly_revenue: 0, monthly_revenue: 0, daily_sessions: 0 },
      google_sheet_id: business.google_sheet_id
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
