import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Auto-expire promotions that have passed end_time
    // Since we are serverless, we can invoke the DB function directly here to ensure the state is fresh
    await supabase.rpc('update_expired_promotions');

    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, promotions: data });
  } catch (error: any) {
    console.error('Promotions GET error:', error);
    return NextResponse.json({ error: 'Failed to load promotions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, discount_percent, duration_hours } = await request.json();

    if (!title || !discount_percent || !duration_hours) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // A business can only have one "Active" promotion at a time.
    // If we are creating a new one, we should expire or pause existing active ones.
    await supabase
      .from('promotions')
      .update({ status: 'Expired' })
      .eq('business_id', sessionCookie.businessId)
      .eq('status', 'Active');

    const start_time = new Date();
    const end_time = new Date();
    end_time.setHours(end_time.getHours() + Number(duration_hours));

    const { data, error } = await supabase
      .from('promotions')
      .insert([{
        business_id: sessionCookie.businessId,
        name: title,
        discount_percent: Number(discount_percent),
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        status: 'Active'
      }])
      .select()
      .single();

    if (error) throw error;

    try {
      const { logActivityToSheet } = require('@/lib/googleSheets');
      await logActivityToSheet('PROMOTION_CREATED', {
        user: 'Club Owner',
        details: `Launched ${title} (${discount_percent}% off)`
      }, sessionCookie.businessId);
    } catch (e) {}

    return NextResponse.json({ success: true, promotion: data });
  } catch (error: any) {
    console.error('Promotions POST error:', error);
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and Status are required' }, { status: 400 });
    }

    // Ensure they only update their own promotion
    const { data: existing, error: fetchErr } = await supabase
      .from('promotions')
      .select('id')
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId)
      .single();

    if (fetchErr || !existing) {
       return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('promotions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, promotion: data });
  } catch (error: any) {
    console.error('Promotions PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 });
  }
}
