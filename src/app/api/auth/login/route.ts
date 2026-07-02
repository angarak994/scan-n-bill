import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Service role client

export async function POST(request: Request) {
  try {
    const { identifier, pin } = await request.json();

    if (!identifier || !pin) {
      return NextResponse.json({ error: 'Identifier and PIN are required' }, { status: 400 });
    }

    // Since this uses the service_role client, it bypasses RLS.
    let { data } = await supabase
      .from('businesses')
      .select('id, dashboard_pin')
      .eq('business_name', identifier)
      .limit(1)
      .single();

    if (!data) {
      const phoneRes = await supabase
        .from('businesses')
        .select('id, dashboard_pin')
        .eq('contact_number', identifier)
        .limit(1)
        .single();
      data = phoneRes.data;
    }

    if (!data) {
      return NextResponse.json({ error: 'Business not found. Check your Club Name or Phone.' }, { status: 404 });
    }

    if (data.dashboard_pin !== pin) {
      return NextResponse.json({ error: 'Incorrect Admin PIN.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, businessId: data.id, pin: data.dashboard_pin });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during login.' }, { status: 500 });
  }
}
