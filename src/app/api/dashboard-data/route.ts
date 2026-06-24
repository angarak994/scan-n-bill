import { NextResponse } from 'next/server';
import { sessionRepository } from '@/lib/repositories/sessionRepository';

function toReadableDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric'
  });
  return formatter.format(date);
}

export async function GET() {
  try {
    const todayStr = toReadableDate(new Date());
    const sessions = await sessionRepository.findAllToday(todayStr);

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');
    const completedSessions = sessions.filter(s => s.status === 'COMPLETED' && s.date === todayStr);

    const dailyRevenue = completedSessions.reduce((acc, session) => acc + (session.cost || 0), 0);

    return NextResponse.json({
      activeSessions,
      completedSessions,
      dailyRevenue,
      todayStr
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
