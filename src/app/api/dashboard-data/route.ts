import { NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { businessManager } from '@/lib/businessManager';

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
    const businessId = searchParams.get('b');
    const pin = searchParams.get('pin');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 });
    }

    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.dashboard_pin && business.dashboard_pin !== pin) {
      return NextResponse.json({ error: 'Unauthorized: Invalid PIN' }, { status: 401 });
    }

    const todayStr = toReadableDate(new Date());
    const sessions = await sessionRepository.findAllToday(todayStr, businessId);

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    const completedSessions = sessions.filter(s => s.status === 'COMPLETED' && s.date === todayStr);

    const dailyRevenue = completedSessions.reduce((acc, session) => acc + (session.cost || 0), 0);
    const pricingRules = business.pricing_rules;

    return NextResponse.json({
      activeSessions,
      completedSessions,
      dailyRevenue,
      todayStr,
      pricingRules
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
