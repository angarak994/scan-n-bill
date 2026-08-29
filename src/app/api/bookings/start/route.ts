import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logActivityToSheet, logSessionStartToSheet } from '@/lib/googleSheets';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, business_id } = body;

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    if (!booking_id || !business_id) {
      return NextResponse.json({ error: 'Missing booking_id or business_id' }, { status: 400 });
    }

    // 1. Fetch the booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('business_id', business_id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'active' || booking.status === 'completed') {
      return NextResponse.json({ error: `Booking is already ${booking.status}` }, { status: 400 });
    }

    // 2. Check if table is currently occupied
    const todayStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('T')[0];
    
    const { data: activeSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('business_id', business_id)
      .eq('table_id', booking.table_id)
      .eq('status', 'ACTIVE');
      
    if (activeSessions && activeSessions.length > 0) {
      return NextResponse.json({ error: 'Table is currently occupied by an active session' }, { status: 400 });
    }

    // 3. Create active session
    const startTimeLocal = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T');
    
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        business_id: business_id,
        table_id: booking.table_id,
        customer_name: booking.customer_name,
        game_type: booking.game_type || 'pool', // Dynamic inheritance with fallback
        status: 'ACTIVE',
        start_time: startTimeLocal,
        date: todayStr
      })
      .select()
      .single();

    if (sessionError || !session) {
      throw new Error(sessionError?.message || 'Failed to create session');
    }

    // 4. Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'active',
        session_id: session.id
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Failed to update booking status, but session created', updateError);
    }

    // 5. Log to Google Sheets
    try {
      await logSessionStartToSheet(session);
      await logActivityToSheet('BOOKING_STARTED', {
        user: 'System',
        table: booking.table_id,
        details: `Booking ${booking.id} started as Session ${session.id} for ${booking.customer_name}`
      }, business_id);
    } catch (e) {
      console.error('Failed to log to Google Sheets', e);
    }

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error('Start Booking Session API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
