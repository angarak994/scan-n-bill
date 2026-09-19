import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!businessId || businessId !== sessionCookie.businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('payments')
      .select(`
          id, amount, payment_method, status, created_at, reference_id,
          customers ( name )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ payments: data });
  } catch (err: any) {
    console.error('Payments API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
