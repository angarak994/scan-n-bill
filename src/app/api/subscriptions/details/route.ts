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

    // Fetch subscription details
    const { data: subData, error: subError } = await supabaseAdmin
      .from('business_subscriptions')
      .select(`
        id,
        status,
        current_period_end,
        current_period_start,
        cancel_at_period_end,
        subscription_plans (
          id,
          name,
          monthly_price,
          features
        )
      `)
      .eq('business_id', businessId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subError);
      return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 });
    }

    // Fetch current table count to compare with usage
    const { count: tableCount, error: tableError } = await supabaseAdmin
      .from('tables')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (tableError) {
      console.error('Error fetching table count:', tableError);
    }

    return NextResponse.json({
      subscription: subData || null,
      usage: {
        tables: tableCount || 0
      }
    });

  } catch (error: any) {
    console.error('Subscription details error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
