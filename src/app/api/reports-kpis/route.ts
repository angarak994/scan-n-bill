import { NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/repositories/sessionRepository';
import { businessManager } from '@/lib/businessManager';
import { getBusinessTimezone } from '@/lib/sheetsTimezone';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const businessId = session.businessId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
    }

    const [business, sessions] = await Promise.all([
      businessManager.getBusiness(businessId),
      sessionRepository.findAllByDateRange(startDate, endDate, businessId)
    ]);

    const timezone = getBusinessTimezone(business);

    // Keep active sessions strictly excluded from completed revenue until they end.
    // Attribute completed sessions authoritatively to their completion date in the business timezone.
    const completedSessions = (sessions || []).filter(s => {
      if (s.status !== 'COMPLETED') return false;
      if (s.end_time) {
        const localEndDateStr = new Date(s.end_time).toLocaleDateString('en-CA', { timeZone: timezone });
        return localEndDateStr >= startDate && localEndDateStr <= endDate;
      }
      return s.date >= startDate && s.date <= endDate;
    });

    const totalRevenue = completedSessions.reduce((acc, s) => acc + (Number(s.cost) || 0), 0);
    const totalSessions = completedSessions.length;

    let totalMinutes = 0;
    completedSessions.forEach(s => {
      if (s.duration) {
        const mMatch = s.duration.match(/(\d+)m/);
        const hMatch = s.duration.match(/(\d+)h/);
        const mins = (hMatch ? parseInt(hMatch[1], 10) * 60 : 0) + (mMatch ? parseInt(mMatch[1], 10) : 0);
        totalMinutes += mins;
      }
    });
    const avgMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    return NextResponse.json({ kpis: { totalRevenue, totalSessions, avgMinutes } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
