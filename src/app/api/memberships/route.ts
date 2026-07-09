import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, memberships: data });
  } catch (error: any) {
    console.error('Memberships GET error:', error);
    return NextResponse.json({ error: 'Failed to load memberships' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, mobile, email, tier, duration_months } = await request.json();

    if (!name || !mobile) {
      return NextResponse.json({ error: 'Name and Mobile are required' }, { status: 400 });
    }

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (parseInt(duration_months) || 12));

    const { data, error } = await supabase
      .from('memberships')
      .insert([{
        business_id: sessionCookie.businessId,
        name,
        mobile,
        email: email || null,
        tier: tier || 'Standard',
        status: 'Active',
        expiry_date: expiryDate.toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, membership: data });
  } catch (error: any) {
    console.error('Memberships POST error:', error);
    return NextResponse.json({ error: 'Failed to create membership' }, { status: 500 });
  }
}
