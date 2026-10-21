import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logActivityToSheet } from '@/lib/googleSheets';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    const body = await request.json();
    const { booking_id, status } = body;

    if (!booking_id || !status) {
      return NextResponse.json({ error: 'Missing booking_id or status' }, { status: 400 });
    }

    const allowedStatuses = ['cancelled', 'no_show', 'completed', 'confirmed'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status update. Only cancelled, no_show, completed, or confirmed are allowed.' }, { status: 400 });
    }

    // 1. Fetch booking enforcing tenant isolation
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('business_id', businessId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 2. State Machine Transition Guards
    if (booking.status === status) {
      return NextResponse.json({ success: true, status, message: 'Status already set' });
    }

    // Forbid cancelling or marking no-show on already completed bookings
    if (booking.status === 'completed' && (status === 'cancelled' || status === 'no_show')) {
      return NextResponse.json({ error: 'Cannot modify a booking that has already been completed.' }, { status: 422 });
    }

    // Forbid cancelling an active playing session
    if (booking.status === 'active' && status === 'cancelled') {
      if (booking.session_id) {
        const { data: liveSession } = await supabase
          .from('sessions')
          .select('id, status')
          .eq('id', booking.session_id)
          .maybeSingle();

        if (liveSession && liveSession.status === 'ACTIVE') {
          return NextResponse.json({
            error: 'Cannot cancel booking: A live playing session is active for this reservation. Please end the session first.'
          }, { status: 422 });
        }
      }
    }

    // 3. Update status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', booking_id)
      .eq('business_id', businessId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Trigger Realtime dashboard sync
    try {
      await supabase.from('dashboard_syncs').insert({
        business_id: businessId,
        triggered_by: `booking_status_${status}_${booking_id}`
      });
    } catch {}

    // Log to Google Sheets safely
    try {
      await logActivityToSheet(`BOOKING_${status.toUpperCase()}`, {
        user: 'Owner/Admin',
        table: booking.table_id,
        details: `Booking ${booking.id} marked as ${status} for ${booking.customer_name}`
      }, businessId);
    } catch (e) {
      console.warn('Non-blocking Google Sheets log warning:', e);
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error('Update Booking API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
