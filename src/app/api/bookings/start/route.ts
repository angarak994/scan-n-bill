import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    const body = await request.json();
    const { booking_id } = body;

    if (!booking_id) {
      return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 });
    }

    // 1. Fetch the booking scoped strictly to this business
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('business_id', businessId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'active' || booking.status === 'completed') {
      return NextResponse.json({ error: `Booking is already ${booking.status}` }, { status: 400 });
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot start an active session for a cancelled booking.' }, { status: 422 });
    }

    // 2. Start the session using the centralized manager
    const { startSession } = require('@/lib/sessionManager');
    let session;
    try {
      const finalCustomerName = (booking.customer_name && booking.customer_name.trim() !== '') 
        ? booking.customer_name 
        : 'Guest';
        
      session = await startSession(
        booking.table_id,
        booking.game_type as any,
        finalCustomerName,
        businessId,
        booking.num_players || 1,
        (booking as any).member_id
      );
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed to start session' }, { status: err.statusCode || 400 });
    }

    // 3. Update booking status and link session_id
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'active',
        session_id: session.id
      })
      .eq('id', booking.id)
      .eq('business_id', businessId);

    if (updateError) {
      console.error('Failed to update booking status, but session created', updateError);
    }

    // 4. Trigger Realtime dashboard sync so all channels update simultaneously
    try {
      await supabase.from('dashboard_syncs').insert({
        business_id: businessId,
        triggered_by: `booking_start_${session.id}`
      });
    } catch {}

    // Trigger non-blocking unified sync so Sheets row includes linked Booking ID
    try {
      const { enqueueSheetsSync } = require('@/lib/sheetsSyncQueue');
      enqueueSheetsSync('SESSION', session.id, businessId);
    } catch (e) {
      console.warn('Failed to enqueue converted booking session sync', e);
    }

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error('Start Booking Session API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
