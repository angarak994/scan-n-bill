import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
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
        const { data: allCompleted } = await supabase.from('sessions')
             .select('payment_status, amount_paid, cost, date, start_time, end_time')
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
    }
    
    return NextResponse.json({ kpis });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
