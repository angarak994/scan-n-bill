import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { handleOptionsResponse, withCorsHeaders } from '@/lib/utils/cors';
import { checkRateLimit, getIpAddress } from '@/lib/utils/rateLimit';

export async function OPTIONS(request: Request) {
  return handleOptionsResponse(request);
}

export async function POST(request: Request) {
  try {
    const ip = getIpAddress(request);
    // Strict rate limit: 10 bookings per hour per IP to prevent spam
    if (!checkRateLimit(`booking_${ip}`, 10, 60 * 60 * 1000)) {
      return withCorsHeaders(
          NextResponse.json({ error: 'Too many booking requests. Please try again later.' }, { status: 429 }),
          request
      );
    }

    const body = await request.json();
    const { business_id, global_customer_id, customer_name, customer_phone, table_id, game_type, booking_date, start_time, duration_minutes } = body;

    if (!business_id || (!customer_name && !global_customer_id) || !booking_date || !start_time) {
      return withCorsHeaders(NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 }), request);
    }
    
    // Strict Input Validation (Prevent Database bloat)
    if (customer_name && customer_name.length > 100) {
       return withCorsHeaders(NextResponse.json({ error: 'Customer name is too long' }, { status: 400 }), request);
    }
    if (duration_minutes && (duration_minutes < 15 || duration_minutes > 720)) {
       return withCorsHeaders(NextResponse.json({ error: 'Duration must be between 15 minutes and 12 hours' }, { status: 400 }), request);
    }
    
    let normalizedPhone = customer_phone;
    if (customer_phone) {
        normalizedPhone = normalizePhone(customer_phone);
        if (!normalizedPhone) {
            return withCorsHeaders(NextResponse.json({ error: 'Customer phone must be exactly 10 digits' }, { status: 400 }), request);
        }
    }

    // Server-side check for double booking on the same table
    const { data: existingBookings, error: checkError } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', business_id)
        .eq('table_id', table_id)
        .eq('booking_date', booking_date)
        .in('status', ['confirmed']);
        
    if (checkError) throw checkError;

    // Strict overlap logic to prevent double bookings
    const hasOverlap = (existingBookings || []).some(b => b.start_time === start_time);
    if (hasOverlap) {
        return withCorsHeaders(NextResponse.json({ error: 'Time slot is already booked' }, { status: 409 }), request);
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
        
    if (insertError) {
        // Handle race conditions where Unique Constraint fails
        if (insertError.code === '23505') {
            return withCorsHeaders(NextResponse.json({ error: 'Time slot is already booked' }, { status: 409 }), request);
        }
        throw insertError;
    }

    return withCorsHeaders(NextResponse.json({ booking: newBooking }, { status: 201 }), request);
  } catch (error: any) {
    return withCorsHeaders(NextResponse.json({ error: error.message }, { status: 500 }), request);
  }
}
