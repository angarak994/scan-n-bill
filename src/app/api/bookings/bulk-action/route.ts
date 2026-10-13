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
    const { booking_ids, action, status } = body;

    if (!Array.isArray(booking_ids) || booking_ids.length === 0) {
      return NextResponse.json({ error: 'No bookings selected' }, { status: 400 });
    }

    if (!['status_update', 'cancel', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid bulk action requested' }, { status: 400 });
    }

    // Verify ownership - only fetch bookings belonging to this business
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, status, session_id, customer_name, table_id')
      .in('id', booking_ids)
      .eq('business_id', businessId);

    if (fetchError || !bookings || bookings.length === 0) {
      return NextResponse.json({ error: 'No matching bookings found for this business' }, { status: 404 });
    }

    const validIds = bookings.map(b => b.id);

    // Prevent invalid destructive operations on active sessions
    if (action === 'delete' || action === 'cancel') {
      const activeOrLinked = bookings.filter(b => b.status === 'active' || b.session_id);
      if (activeOrLinked.length > 0) {
        const sessionIds = activeOrLinked.map(b => b.session_id).filter(Boolean);
        if (sessionIds.length > 0) {
          const { data: activeSessions } = await supabase
            .from('sessions')
            .select('id')
            .in('id', sessionIds)
            .eq('status', 'ACTIVE');

          if (activeSessions && activeSessions.length > 0) {
            return NextResponse.json({
              error: `Cannot ${action} bookings that have active playing sessions. Please end the active sessions first.`
            }, { status: 400 });
          }
        } else if (activeOrLinked.some(b => b.status === 'active')) {
          return NextResponse.json({
            error: `Cannot ${action} bookings that are marked active.`
          }, { status: 400 });
        }
      }
    }

    if (action === 'delete') {
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .in('id', validIds)
        .eq('business_id', businessId);

      if (deleteError) throw deleteError;

      return NextResponse.json({ 
        success: true, 
        action: 'delete',
        count: validIds.length,
        message: `Successfully deleted ${validIds.length} bookings.`
      });
    }

    if (action === 'cancel') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .in('id', validIds)
        .eq('business_id', businessId);

      if (updateError) throw updateError;

      return NextResponse.json({ 
        success: true, 
        action: 'cancel',
        count: validIds.length,
        message: `Successfully cancelled ${validIds.length} bookings.`
      });
    }

    if (action === 'status_update') {
      const allowedStatuses = ['confirmed', 'completed', 'no_show', 'cancelled'];
      if (!status || !allowedStatuses.includes(status)) {
        return NextResponse.json({ 
          error: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}` 
        }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ status })
        .in('id', validIds)
        .eq('business_id', businessId);

      if (updateError) throw updateError;

      return NextResponse.json({ 
        success: true, 
        action: 'status_update',
        status,
        count: validIds.length,
        message: `Successfully updated ${validIds.length} bookings to ${status}.`
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });

  } catch (error: any) {
    console.error('Bulk Booking Action Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to perform bulk action' }, { status: 500 });
  }
}
