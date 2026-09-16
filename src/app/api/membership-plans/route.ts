import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase
      .from('membership_plans')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .order('created_at', { ascending: false });
      
    if (activeOnly) {
      query = query.eq('status', 'Active');
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, plans: data });
  } catch (error: any) {
    console.error('Membership Plans GET error:', error);
    return NextResponse.json({ error: 'Failed to load membership plans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, price, duration_months, benefits, discount_percent } = await request.json();

    if (!name || price === undefined || !duration_months) {
      return NextResponse.json({ error: 'Name, price, and duration are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('membership_plans')
      .insert([{
        business_id: sessionCookie.businessId,
        name,
        price,
        duration_months,
        benefits: benefits || [],
        discount_percent: discount_percent || 0,
        status: 'Active'
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, plan: data });
  } catch (error: any) {
    console.error('Membership Plans POST error:', error);
    return NextResponse.json({ error: 'Failed to create membership plan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, price, duration_months, benefits, discount_percent, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('membership_plans')
      .update({
        name,
        price,
        duration_months,
        benefits,
        discount_percent,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, plan: data });
  } catch (error: any) {
    console.error('Membership Plans PUT error:', error);
    return NextResponse.json({ error: 'Failed to update membership plan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('membership_plans')
      .delete()
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Membership Plans DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete membership plan' }, { status: 500 });
  }
}
