import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logActivityToSheet, syncBookingToSheet } from '@/lib/googleSheets';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';
import { getCurrentISTDateStr } from '@/lib/billing';
import { sendSMS, SMSConfig } from '@/lib/services/smsService';
import { bookingService } from '@/lib/services/bookingService';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_id, table_id, customer_name, customer_phone, booking_date, start_time, duration_minutes, game_type } = body;

    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

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

    const reqStart = startMins;

    // 1 & 2. Validate table availability (Prevent double-booking & active session conflicts)
    const availability = await bookingService.checkTableAvailability(business_id, table_id, booking_date, reqStart, durationNum);
    
    if (!availability.available) {
      return NextResponse.json({ error: availability.reason }, { status: 400 });
    }

    // 3. Insert manual booking into database
    const business = await businessManager.getBusiness(business_id);
    const tableConfig = business?.tables?.find(t => t.id === table_id);
    const enforcedGameType = tableConfig ? ((tableConfig as any).game_type || game_type || 'pool') : (game_type || 'pool');

    if (enforcedGameType === 'ps5') {
      const num_players = Number(body.num_players);
      if (!num_players || num_players < 1 || num_players > 4) {
        return NextResponse.json({ error: 'PS5 bookings must have between 1 and 4 players.' }, { status: 400 });
      }
    }

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
        source: 'manual',
        game_type: enforcedGameType,
        num_players: body.num_players ? Number(body.num_players) : 1
      })
      .select()
      .single();

    if (insertError || !newBooking) {
      console.error('Failed to insert manual booking:', insertError);
      return NextResponse.json({ error: insertError?.message || 'Failed to save booking' }, { status: 500 });
    }

    // 4. Log to Google Sheets (Non-blocking fallback)
    Promise.resolve().then(async () => {
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
    });

    // Send SMS Confirmation if configured
    Promise.resolve().then(async () => {
        try {
            const { data: business } = await supabase.from('businesses').select('sms_config, business_name').eq('id', business_id).single();
            const smsConfig = business?.sms_config as SMSConfig;
            
            if (smsConfig && smsConfig.enabled && customer_phone && customer_phone !== 'Manual / Walk-In') {
                const cleanPhone = customer_phone.replace(/\D/g, '');
                if (cleanPhone.length >= 10) {
                    const smsMessage = `Hi ${nameToSave}, your booking at ${business?.business_name || 'us'} for ${formattedStartTime} is confirmed. See you soon!`;
                    await sendSMS(business_id, cleanPhone, nameToSave, smsMessage, "booking_confirmed_v1", smsConfig);
                }
            }
        } catch (smsError) {
            console.error('Failed to send booking SMS:', smsError);
        }
    });

    return NextResponse.json({ success: true, booking: newBooking }, { status: 200 });
  } catch (error: any) {
    console.error('Create Manual Booking API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
