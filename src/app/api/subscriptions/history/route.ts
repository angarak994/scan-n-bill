import { NextResponse } from 'next/server';
import { supabase as supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = session.businessId;

    // Fetch payment logs
    const { data: logs, error } = await supabaseAdmin
      .from('payment_logs')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment history:', error);
      return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
    }

    return NextResponse.json({
      history: logs || []
    });

  } catch (error: any) {
    console.error('Payment history error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
