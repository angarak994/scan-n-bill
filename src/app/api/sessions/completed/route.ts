import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const businessId = sessionCookie.businessId;
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tableId = searchParams.get('tableId');
    const paymentStatus = searchParams.get('paymentStatus'); // 'Paid' or 'Pending'

    const safeLimit = Math.min(limit, 100); // Cap max limit at 100
    const offset = (page - 1) * safeLimit;

    let query = supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED')
      .order('date', { ascending: false })
      .order('end_time', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (tableId) query = query.eq('table_id', tableId);
    if (paymentStatus) query = query.eq('payment_status', paymentStatus);

    // Apply pagination bounds
    query = query.range(offset, offset + safeLimit - 1);

    const { data: sessions, count, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      sessions: sessions || [], 
      total: count || 0,
      page,
      limit: safeLimit,
      totalPages: count ? Math.ceil(count / safeLimit) : 0
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
