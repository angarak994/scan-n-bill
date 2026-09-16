import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const dateStr = searchParams.get('date'); // YYYY-MM-DD
    
    if (!businessId) {
        return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
    }

    // Fetch active sessions
    const { data: activeSessions, error: activeError } = await supabase
        .from('sessions')
        .select('table_id, start_time, game_type')
        .eq('business_id', businessId)
        .eq('status', 'ACTIVE');
        
    if (activeError) throw activeError;

    // Fetch future bookings
    let query = supabase
        .from('bookings')
        .select('table_id, booking_date, start_time, duration_minutes, status')
        .eq('business_id', businessId)
        .in('status', ['confirmed']);
        
    if (dateStr) {
        query = query.eq('booking_date', dateStr);
    }
    
    const { data: bookings, error: bookingsError } = await query;
    if (bookingsError) throw bookingsError;

    // We can also fetch the waitlist
    const { data: waitlists, error: waitlistError } = await supabase
        .from('waitlists')
        .select('game_type, party_size')
        .eq('business_id', businessId)
        .eq('status', 'waiting');
        
    if (waitlistError) throw waitlistError;

    return NextResponse.json({ 
        active_sessions: activeSessions || [],
        upcoming_bookings: bookings || [],
        waitlist_count: waitlists?.length || 0,
        waitlist_details: waitlists || []
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
