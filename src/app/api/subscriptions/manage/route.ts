import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = session.businessId;
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (action === 'cancel') {
      // Logic to cancel subscription at period end
      const { error } = await supabaseAdmin
        .from('business_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('business_id', businessId);
      
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Subscription cancelled successfully' });
    }

    if (action === 'reactivate') {
      // Logic to reactivate subscription
      const { error } = await supabaseAdmin
        .from('business_subscriptions')
        .update({ cancel_at_period_end: false })
        .eq('business_id', businessId);
      
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Subscription reactivated successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Subscription manage error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
