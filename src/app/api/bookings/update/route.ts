import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logActivityToSheet } from '@/lib/googleSheets';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { booking_id, business_id, status } = body;

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    if (!booking_id || !business_id || !status) {
      return NextResponse.json({ error: 'Missing booking_id, business_id, or status' }, { status: 400 });
    }

    const allowedStatuses = ['cancelled', 'no_show', 'completed'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status update. Only cancelled, no_show, or completed are allowed here.' }, { status: 400 });
    }

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('business_id', business_id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', booking_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Log to Google Sheets
    try {
      await logActivityToSheet(`BOOKING_${status.toUpperCase()}`, {
        user: 'System',
        table: booking.table_id,
        details: `Booking ${booking.id} marked as ${status} for ${booking.customer_name}`
      }, business_id);
    } catch (e) {
      console.error('Failed to log to Google Sheets', e);
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    console.error('Update Booking API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
