import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logActivityToSheet, syncBookingToSheet } from '@/lib/googleSheets';
import { businessManager } from '@/lib/businessManager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { business_id, table_id, customer_name, customer_phone, booking_date, start_time, duration_minutes, game_type } = body;

    if (!business_id || !table_id || !booking_date || !start_time || !duration_minutes) {
      return NextResponse.json({ error: 'Missing required booking parameters' }, { status: 400 });
    }

    const nameToSave = (customer_name && customer_name.trim() !== '') ? customer_name.trim() : 'Walk-In / Guest';
    const durationNum = Number(duration_minutes) || 60;
    const parts = start_time.split(':');
    const startMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const endMins = startMins + durationNum;
    const endHours = Math.floor(endMins / 60) % 24;
    const endMinutes = endMins % 60;
    const end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
    const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;

    // 1. Validate table availability (Prevent double-booking)
    const { data: existingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, start_time, duration_minutes, end_time, status')
      .eq('business_id', business_id)
      .eq('table_id', table_id)
      .eq('booking_date', booking_date)
      .in('status', ['confirmed', 'active']);

    if (fetchError) {
      console.error('Error fetching existing bookings for availability check:', fetchError);
      return NextResponse.json({ error: 'Failed to check table availability' }, { status: 500 });
    }

    const reqStart = startMins;
    const reqEnd = endMins;

    if (existingBookings && existingBookings.length > 0) {
      for (const b of existingBookings) {
        if (!b.start_time) continue;
        const bParts = b.start_time.split(':');
        const bStart = parseInt(bParts[0], 10) * 60 + parseInt(bParts[1], 10);
        const bDuration = Number(b.duration_minutes) || 60;
        const bEnd = bStart + bDuration;

        // Check time slot overlap: max(start1, start2) < min(end1, end2)
        if (Math.max(reqStart, bStart) < Math.min(reqEnd, bEnd)) {
          const slotDisplay = b.start_time.substring(0, 5);
          return NextResponse.json({ 
            error: `Table ${table_id} is already booked from ${slotDisplay} for ${bDuration} minutes.` 
          }, { status: 400 });
        }
      }
    }

    // 2. If booking is for today and spans current time, verify table isn't in an active session
    const todayStr = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).split('T')[0];
    if (booking_date === todayStr) {
      const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
      const nowParts = nowIst.split(':');
      const nowMins = parseInt(nowParts[0], 10) * 60 + parseInt(nowParts[1], 10);

      if (reqStart <= nowMins && reqEnd > nowMins) {
        const { data: activeSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('business_id', business_id)
          .eq('table_id', table_id)
          .eq('status', 'ACTIVE');

        if (activeSessions && activeSessions.length > 0) {
          return NextResponse.json({ 
            error: `Table ${table_id} is currently occupied by a live active session.` 
          }, { status: 400 });
        }
      }
    }

    // 3. Insert manual booking into database
    const business = await businessManager.getBusiness(business_id);
    const tableConfig = business?.tables?.find(t => t.id === table_id);
    const enforcedGameType = tableConfig?.game_type || game_type || 'pool';

    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        business_id: business_id,
        customer_name: nameToSave,
        customer_phone: customer_phone || 'Manual / Walk-In',
        table_id: table_id,
        booking_date: booking_date,
        start_time: formattedStartTime,
        duration_minutes: durationNum,
        end_time: end_time,
        status: 'confirmed',
        source: 'manual'
      })
      .select()
      .single();

    if (insertError || !newBooking) {
      console.error('Failed to insert manual booking:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Failed to save booking' }, { status: 500 });
    }

    // 4. Log to Google Sheets (Non-blocking fallback)
    try {
      await syncBookingToSheet(newBooking, business_id);
      await logActivityToSheet('MANUAL_BOOKING_CREATED', {
        user: 'Owner/Admin',
        table: table_id,
        details: `Manual Booking created for ${nameToSave} on Table ${table_id} at ${formattedStartTime} (${durationNum} mins)`
      }, business_id);
    } catch (sheetError) {
      console.error('Google Sheets Sync Error on Manual Booking:', sheetError);
    }

    return NextResponse.json({ success: true, booking: newBooking }, { status: 200 });
  } catch (error: any) {
    console.error('Create Manual Booking API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
