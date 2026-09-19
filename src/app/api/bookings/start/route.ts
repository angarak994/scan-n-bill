import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { getCurrentISTDateStr } from '@/lib/billing';

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

    // 2. Start the session using the centralized manager
    // Note: startSession internally checks for active table locks, table occupancy,
    // applies the correct pricing rules, and triggers the Google Sheets sync automatically.
    const { startSession } = require('@/lib/sessionManager');
    let session;
    try {
      session = await startSession(
        booking.table_id,
        booking.game_type as any,
        booking.customer_name,
        business_id,
        booking.num_players || 1,
        (booking as any).member_id
      );
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed to start session' }, { status: err.statusCode || 400 });
    }

    // 3. Update booking status
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

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error('Start Booking Session API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
