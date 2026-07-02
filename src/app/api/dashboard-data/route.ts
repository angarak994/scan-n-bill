import { NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { businessManager } from '@/lib/businessManager';
import { endSession } from '@/lib/sessionManager';
import { supabase } from '@/lib/supabaseClient';

function toReadableDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric'
  });
  return formatter.format(date);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('b');
    const pin = searchParams.get('pin');

    if (!businessId) {
      // Fallback: Get the first business in the system (useful for single-tenant local testing)
      const { data: firstBusiness } = await supabase.from('businesses').select('id').limit(1).single();
      if (firstBusiness) {
        businessId = firstBusiness.id;
      } else {
        return NextResponse.json({ error: 'Business ID is required and no businesses found' }, { status: 400 });
      }
    }

    const business = await businessManager.getBusiness(businessId as string);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.dashboard_pin && business.dashboard_pin !== pin) {
      return NextResponse.json({ error: 'Unauthorized: Invalid PIN' }, { status: 401 });
    }

    const todayStr = toReadableDate(new Date());
    const sessions = await sessionRepository.findAllToday(todayStr, businessId as string);

    let activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    let completedSessions = sessions.filter(s => s.status === 'COMPLETED' && s.date === todayStr);

    // Auto-cutoff abandoned sessions (older than 12 hours)
    const nowMs = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    let didAutoEnd = false;
    
    for (const s of activeSessions) {
      if (s.start_time) {
        const startMs = new Date(s.start_time).getTime();
        if (nowMs - startMs > TWELVE_HOURS_MS) {
          try {
            await endSession(s.table_id, businessId as string);
            didAutoEnd = true;
          } catch (e) {
            console.error(`Failed to auto-end session ${s.id}`, e);
          }
        }
      }
    }

    if (didAutoEnd) {
      // Re-fetch to get the updated lists
      const freshSessions = await sessionRepository.findAllToday(todayStr, businessId as string);
      activeSessions = freshSessions.filter(s => s.status === 'ACTIVE');
      completedSessions = freshSessions.filter(s => s.status === 'COMPLETED' && s.date === todayStr);
    }

    const dailyRevenue = completedSessions.reduce((acc, session) => acc + (session.cost || 0), 0);
    const pricingRules = business.pricing_rules;

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    const { data: interventions } = await supabase
      .from('session_interventions')
      .select('amount_recovered, intervention_type, sessions!inner(business_id)')
      .eq('sessions.business_id', businessId)
      .eq('intervention_type', 'force_close')
      .gte('created_at', todayStart.toISOString());

    const manualClosuresToday = interventions?.length || 0;
    const todayDateStr = todayStart.toISOString().split('T')[0];
    const { data: bookings } = await supabase.from('bookings').select('*').eq('business_id', businessId).gte('booking_date', todayDateStr);

    const revenueSavedToday = interventions?.reduce((acc, inv) => acc + Number(inv.amount_recovered || 0), 0) || 0;

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
      businessId,
      businessName: business.business_name,
      ownerName: business.owner_name
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
