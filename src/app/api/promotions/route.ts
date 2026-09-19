import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Auto-expire and auto-activate promotions
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

    const { title, discount_percent, start_date, start_time, duration_days, time_slot_start, time_slot_end } = await request.json();

    if (!title || !discount_percent || !start_date || !start_time || !duration_days) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calculate server-side UTC timestamps based on IST (+05:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const [year, month, day] = start_date.split('-').map(Number);
    const [hour, min] = start_time.split(':').map(Number);
    
    // Construct exact local time in UTC, then shift it back by offset to get true UTC
    const localTimeUtc = new Date(Date.UTC(year, month - 1, day, hour, min, 0));
    const startDateTime = new Date(localTimeUtc.getTime() - istOffset);
    const endDateTime = new Date(startDateTime.getTime() + Number(duration_days) * 24 * 60 * 60 * 1000);

    const now = new Date();
    if (endDateTime <= now) {
      return NextResponse.json({ error: 'Promotion end time cannot be in the past' }, { status: 400 });
    }

    // Check for overlaps with Active or Scheduled promotions
    const { data: overlapping, error: overlapError } = await supabase
      .from('promotions')
      .select('id, name')
      .eq('business_id', sessionCookie.businessId)
      .in('status', ['Active', 'Scheduled'])
      .lt('start_time', endDateTime.toISOString())
      .gt('end_time', startDateTime.toISOString());

    if (overlapError) throw overlapError;

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ 
        error: `Overlaps with an existing promotion: ${overlapping[0].name}. Please cancel it first.` 
      }, { status: 400 });
    }

    // Determine initial status based on strictly server time
    const initialStatus = startDateTime > now ? 'Scheduled' : 'Active';

    const { data, error } = await supabase
      .from('promotions')
      .insert([{
        business_id: sessionCookie.businessId,
        name: title,
        discount_percent: Number(discount_percent),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: initialStatus,
        time_slot_start: time_slot_start || null,
        time_slot_end: time_slot_end || null
      }])
      .select()
      .single();

    if (error) throw error;

    try {
      const { logActivityToSheet } = require('@/lib/googleSheets');
      await logActivityToSheet('PROMOTION_CREATED', {
        user: 'Club Owner',
        details: `${initialStatus === 'Scheduled' ? 'Scheduled' : 'Launched'} ${title} (${discount_percent}% off)`
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

    // Allow updating status, or extending end_time
    const { id, status, end_time, discount_percent, time_slot_start, time_slot_end } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Ensure they only update their own promotion
    const { data: existing, error: fetchErr } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId)
      .single();

    if (fetchErr || !existing) {
       return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    const updates: any = {};
    if (status) updates.status = status;
    if (end_time) updates.end_time = end_time;
    if (discount_percent) updates.discount_percent = discount_percent;
    if (time_slot_start !== undefined) updates.time_slot_start = time_slot_start || null;
    if (time_slot_end !== undefined) updates.time_slot_end = time_slot_end || null;

    // Optional: if resuming a paused promo, we should check for overlaps again if we want to be robust, 
    // but typically paused implies it holds its spot or we allow resume.
    if (status === 'Active' || status === 'Scheduled') {
      const startT = existing.start_time;
      const endT = end_time || existing.end_time;
      const { data: overlapping } = await supabase
        .from('promotions')
        .select('id, name')
        .eq('business_id', sessionCookie.businessId)
        .in('status', ['Active', 'Scheduled'])
        .neq('id', id)
        .lt('start_time', endT)
        .gt('end_time', startT);
        
      if (overlapping && overlapping.length > 0) {
        return NextResponse.json({ 
          error: `Cannot activate. Overlaps with existing promotion: ${overlapping[0].name}` 
        }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('promotions')
      .update(updates)
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
