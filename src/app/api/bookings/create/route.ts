import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { logActivityToSheet, syncBookingToSheet } from '@/lib/googleSheets';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';
import { sendSMS, SMSConfig } from '@/lib/services/smsService';
import { bookingService } from '@/lib/services/bookingService';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { formatBookingConfirmationWhatsApp } from '@/lib/utils/locationUtils';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const business_id = sessionCookie.businessId;
    const { table_id, customer_name, customer_phone, booking_date, start_time, duration_minutes, game_type } = body;
    const idempotency_key = body.idempotency_key || request.headers.get('idempotency-key') || null;

    if (!business_id || !table_id || !booking_date || !start_time || !duration_minutes) {
      return NextResponse.json({ error: 'Missing required booking parameters' }, { status: 400 });
    }

    const nameToSave = (customer_name && customer_name.trim() !== '') ? customer_name.trim() : 'Walk-In / Guest';
    let normalizedPhone = customer_phone;
    if (customer_phone && customer_phone !== 'Manual / Walk-In') {
      normalizedPhone = normalizePhone(customer_phone);
      if (!normalizedPhone) {
        return NextResponse.json({ error: 'Customer phone must be exactly 10 digits' }, { status: 400 });
      }
    }

    const durationNum = Number(duration_minutes) || 60;
    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const tableConfig = business?.tables?.find(t => String(t.id).trim().toLowerCase() === String(table_id).trim().toLowerCase());
    const enforcedGameType = tableConfig ? ((tableConfig as any).game_type || (tableConfig as any).type || game_type || 'pool') : (game_type || 'pool');

    if (enforcedGameType === 'ps5') {
      const num_players = Number(body.num_players);
      if (!num_players || num_players < 1 || num_players > 4) {
        return NextResponse.json({ error: 'PS5 bookings must have between 1 and 4 players.' }, { status: 400 });
      }
    }

    // Step 1: Create atomic booking with database-level race protection and customer linking
    const result = await bookingService.createAtomicBooking({
      business_id,
      table_id: tableConfig?.id || table_id,
      customer_name: nameToSave,
      customer_phone: normalizedPhone || 'Manual / Walk-In',
      booking_date,
      start_time,
      duration_minutes: durationNum,
      game_type: enforcedGameType,
      num_players: body.num_players ? Number(body.num_players) : 1,
      source: 'manual',
      idempotency_key
    });

    if (!result.success || !result.booking) {
      return NextResponse.json({ error: result.reason || 'Failed to create booking' }, { status: 400 });
    }

    const newBooking = result.booking;

    // Step 2: Compute authoritative pricing breakdown for confirmation
    const normGame = enforcedGameType.toLowerCase();
    const rules: any = business?.pricing_rules?.rules?.[normGame] || {};
    const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;
    const estimatedTotal = Math.round((ratePerHour * durationNum) / 60);

    // Step 3: Reliable Background Dispatches (Google Sheets, SMS, WhatsApp)
    // Synchronize to Google Sheets safely
    try {
      await syncBookingToSheet(newBooking, business_id);
      await logActivityToSheet('MANUAL_BOOKING_CREATED', {
        user: 'Owner/Admin',
        table: table_id,
        details: `Manual Booking created for ${nameToSave} on Table ${table_id} at ${start_time} (${durationNum} mins)`
      }, business_id);
    } catch (sheetError) {
      console.error('Google Sheets Sync Warning on Manual Booking:', sheetError);
    }

    // Send SMS Confirmation if configured
    if (normalizedPhone && normalizedPhone !== 'Manual / Walk-In') {
      try {
        const smsConfig = business?.sms_config as SMSConfig;
        if (smsConfig && smsConfig.enabled) {
          const smsMessage = `Hi ${nameToSave}, your booking at ${business.business_name} for Table ${table_id} at ${start_time} is confirmed. See you soon!`;
          await sendSMS(business_id, normalizedPhone, nameToSave, smsMessage, "booking_confirmed_v1", smsConfig);
        }
      } catch (smsError) {
        console.error('Failed to send booking SMS:', smsError);
      }
    }

    // Send WhatsApp Confirmation with directions, rate breakdown, and club contact
    if (normalizedPhone && normalizedPhone !== 'Manual / Walk-In') {
      try {
        const cleanPhone = normalizedPhone.replace(/\D/g, '');
        if (cleanPhone.length >= 10) {
          const bName = business.business_name || 'QControl Club';
          const waConfig = business.whatsapp_config as any;
          const clubPhone = business.public_contact_number || business.contact_number;

          const confirmationMsg = formatBookingConfirmationWhatsApp({
            bookingId: newBooking.id,
            customerName: nameToSave,
            businessName: bName,
            gameType: enforcedGameType,
            tableId: tableConfig?.name || table_id,
            bookingDate: booking_date,
            startTime: start_time.substring(0, 5),
            durationMinutes: durationNum,
            numPlayers: body.num_players ? Number(body.num_players) : 1,
            ratePerHour,
            estimatedTotal,
            paymentStatus: 'pay_on_arrival',
            status: 'confirmed',
            address: business.address,
            contactNumber: clubPhone,
            latitude: (business as any)?.latitude,
            longitude: (business as any)?.longitude
          });

          await sendWhatsAppText(
            cleanPhone,
            confirmationMsg,
            true,
            waConfig?.token,
            waConfig?.phoneId,
            {
              businessId: business_id,
              recipientName: nameToSave,
              content: confirmationMsg
            }
          );
        }
      } catch (waError) {
        console.error('Failed to send booking WhatsApp confirmation:', waError);
      }
    }

    return NextResponse.json({ success: true, booking: newBooking }, { status: 200 });
  } catch (error: any) {
    console.error('Create Manual Booking API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
