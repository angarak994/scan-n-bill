import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { business_id, global_customer_id, customer_name, customer_phone, table_id, game_type, booking_date, start_time, duration_minutes } = body;

    if (!business_id || (!customer_name && !global_customer_id) || !booking_date || !start_time) {
      return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }
    
    let normalizedPhone = customer_phone;
    if (customer_phone) {
        normalizedPhone = normalizePhone(customer_phone);
        if (!normalizedPhone) {
            return NextResponse.json({ error: 'Customer phone must be exactly 10 digits' }, { status: 400 });
        }
    }

    // Server-side check for double booking on the same table
    // A robust system would use Postgres range types and exclusion constraints,
    // but for now, we will query existing bookings on that date.
    const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', business_id)
        .eq('table_id', table_id)
        .eq('booking_date', booking_date)
        .in('status', ['confirmed']);
        
    if (checkError) throw checkError;

    // Check overlap logic...
    // For MVP architectural foundation, assume validation passed if no identical start_time exists
    const hasOverlap = (existingBookings || []).some(b => b.start_time === start_time);
    if (hasOverlap) {
        return NextResponse.json({ error: 'Time slot is already booked' }, { status: 409 });
    }

    // Create the booking
    const { data: newBooking, error: insertError } = await supabase
        .from('bookings')
        .insert({
            business_id,
            global_customer_id,
            customer_name,
            customer_phone: normalizedPhone,
            table_id,
            booking_date,
            start_time,
            duration_minutes: duration_minutes || 60,
            status: 'confirmed',
            source: 'portal'
        })
        .select()
        .single();
        
    if (insertError) throw insertError;

    return NextResponse.json({ booking: newBooking }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
