import { NextResponse } from 'next/server';
import { whatsappRepository } from '@/lib/repositories/whatsappRepository';
import { businessManager } from '@/lib/businessManager';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp';
import { bookingService } from '@/lib/services/bookingService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse('Forbidden', { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (body.object !== 'whatsapp_business_account') {
      return new NextResponse('Not Found', { status: 404 });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = value?.statuses;

    // Handle delivery status updates
    if (statuses && statuses.length > 0) {
      for (const statusObj of statuses) {
        const { id: messageId, status, errors } = statusObj;
        
        let errorMessage = null;
        if (errors && errors.length > 0) {
          errorMessage = errors[0].title || errors[0].message || 'Unknown error';
        }

        // Update the message in the database
        await supabase.from('whatsapp_messages').update({
          status: status,
          error_message: errorMessage
        }).eq('message_id', messageId);
      }
      return NextResponse.json({ ok: true });
    }

    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const message = messages[0];
    const phone = message.from;
    const messageId = message.id;
    const metadata = value?.metadata;
    const phoneNumberId = metadata?.phone_number_id;

    // Smart Routing: Try to identify the business by the number it was sent to
    let detectedBusiness: any = null;
    let overrideToken: string | undefined = undefined;
    let overridePhoneId: string | undefined = undefined;

    if (phoneNumberId) {
      const { data: businesses } = await supabase.from('businesses').select('*');
      if (businesses) {
         detectedBusiness = businesses.find(b => b.whatsapp_config?.enabled && b.whatsapp_config?.phoneId === phoneNumberId);
         if (detectedBusiness) {
            overrideToken = detectedBusiness.whatsapp_config.token;
            overridePhoneId = detectedBusiness.whatsapp_config.phoneId;
         }
      }
    }

    // Idempotency: skip if already processed
    if (await whatsappRepository.isMessageProcessed(messageId)) {
      return NextResponse.json({ ok: true });
    }

    const text = message.type === 'text' ? message.text.body : '';
    const buttonReplyId = message.type === 'interactive' && message.interactive.type === 'button_reply' ? message.interactive.button_reply.id : null;
    const listReplyId = message.type === 'interactive' && message.interactive.type === 'list_reply' ? message.interactive.list_reply.id : null;
    const incomingText = buttonReplyId || listReplyId || text;
    const lowerText = incomingText.toLowerCase();

    // Detect explicit business start
    if (lowerText.startsWith('book_') || lowerText.startsWith('start_biz_')) {
       // Extract slug case-insensitively
       const slug = lowerText.replace('book_', '').replace('start_biz_', '').trim();
       const business = await businessManager.getBusinessBySlug(slug);
       
       if (!business) {
         await sendWhatsAppText(phone, 'Sorry, we could not find that business.', false, overrideToken, overridePhoneId);
         return NextResponse.json({ ok: true });
       }
       
       detectedBusiness = business;
       if (business.whatsapp_config?.enabled) {
          overrideToken = business.whatsapp_config.token;
          overridePhoneId = business.whatsapp_config.phoneId;
       }
       
       const todayStr = getCurrentISTDateStr();
       const { data: existingBookings } = await supabase.from('bookings').select('*').eq('business_id', detectedBusiness.id).eq('customer_phone', phone).gte('booking_date', todayStr).in('status', ['confirmed', 'pending']).order('booking_date', { ascending: true });
       
       if (existingBookings && existingBookings.length > 0) {
         const b = existingBookings[0];
         await whatsappRepository.updateState(phone, detectedBusiness.id!, 'AWAITING_MODIFY', { existing_booking_id: b.id });
         await sendWhatsAppButtons(phone, `Hi! You already have a booking for *${b.game_type.toUpperCase()}* on ${b.booking_date} at ${b.start_time}.\n\nWould you like to cancel it or make a new one?`, [
           { id: `cancel_${b.id}`, title: '❌ Cancel Booking' },
           { id: `new_booking`, title: '📅 New Booking' }
         ], overrideToken, overridePhoneId);
         return NextResponse.json({ ok: true });
       }
       
       await whatsappRepository.updateState(phone, detectedBusiness.id!, 'AWAITING_GAME', { business_name: detectedBusiness.business_name });
       
       await sendWhatsAppButtons(phone, `Hi there! 👋 Welcome to *${detectedBusiness.business_name}* booking system.\n\nWhat would you like to play today?`, [
         { id: 'game_pool', title: '🎱 Pool' },
         { id: 'game_snooker', title: '🔴 Snooker' },
         { id: 'game_ps5', title: '🎮 PS5' }
       ], overrideToken, overridePhoneId);
       
       return NextResponse.json({ ok: true });
    }

    // Get active state
    let state = await whatsappRepository.getState(phone);

    // Direct Messaging Support: If no active state, but we know the business from phoneId, start flow automatically
    if (!state && detectedBusiness) {
       const todayStr = getCurrentISTDateStr();
       const { data: existingBookings } = await supabase.from('bookings').select('*').eq('business_id', detectedBusiness.id).eq('customer_phone', phone).gte('booking_date', todayStr).in('status', ['confirmed', 'pending']).order('booking_date', { ascending: true });
       
       if (existingBookings && existingBookings.length > 0) {
         const b = existingBookings[0];
         await whatsappRepository.updateState(phone, detectedBusiness.id, 'AWAITING_MODIFY', { existing_booking_id: b.id });
         await sendWhatsAppButtons(phone, `Hi! You already have a booking for *${b.game_type.toUpperCase()}* on ${b.booking_date} at ${b.start_time}.\n\nWould you like to cancel it or make a new one?`, [
           { id: `cancel_${b.id}`, title: '❌ Cancel Booking' },
           { id: `new_booking`, title: '📅 New Booking' }
         ], overrideToken, overridePhoneId);
         return NextResponse.json({ ok: true });
       }

       await whatsappRepository.updateState(phone, detectedBusiness.id, 'AWAITING_GAME', { business_name: detectedBusiness.business_name });
       await sendWhatsAppButtons(phone, `Hi there! 👋 Welcome to *${detectedBusiness.business_name}* booking system.\n\nWhat would you like to play today?`, [
         { id: 'game_pool', title: '🎱 Pool' },
         { id: 'game_snooker', title: '🔴 Snooker' },
         { id: 'game_ps5', title: '🎮 PS5' }
       ], overrideToken, overridePhoneId);
       return NextResponse.json({ ok: true });
    }

    if (!state) {
      // Ignore random messages if no active state and no direct business matched
      return NextResponse.json({ ok: true });
    }

    const business = await businessManager.getBusiness(state.business_id);
    if (!business) return NextResponse.json({ ok: true });

    if (business.whatsapp_config?.enabled) {
      overrideToken = business.whatsapp_config.token;
      overridePhoneId = business.whatsapp_config.phoneId;
    }

    let { current_step, context } = state;

    if (current_step === 'AWAITING_MODIFY') {
      if (incomingText.startsWith('cancel_')) {
        const bId = incomingText.replace('cancel_', '');
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bId);
        await sendWhatsAppText(phone, '✅ Your booking has been successfully cancelled.', false, overrideToken, overridePhoneId);
        await whatsappRepository.clearState(phone);
        return NextResponse.json({ ok: true });
      } else if (incomingText === 'new_booking') {
        await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_GAME', { business_name: business.business_name });
        await sendWhatsAppButtons(phone, `What would you like to play?`, [
         { id: 'game_pool', title: '🎱 Pool' },
         { id: 'game_snooker', title: '🔴 Snooker' },
         { id: 'game_ps5', title: '🎮 PS5' }
        ], overrideToken, overridePhoneId);
        return NextResponse.json({ ok: true });
      }
    }
    else if (current_step === 'AWAITING_GAME') {
       if (incomingText.startsWith('game_')) {
          const gameType = incomingText.replace('game_', '');
          context.game_type = gameType;
          
          if (gameType === 'ps5') {
            await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_PLAYERS', context);
            await sendWhatsAppButtons(phone, 'Awesome! How many players will be joining?', [
              { id: 'players_1', title: '👤 1 Player' },
              { id: 'players_2', title: '👥 2 Players' },
              { id: 'players_4', title: '👨‍👩‍👦 3-4 Players' }
            ], overrideToken, overridePhoneId);
          } else {
            context.num_players = 1;
            await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_DATE', context);
            await sendWhatsAppButtons(phone, 'Great! When would you like to book?', [
              { id: 'date_today', title: '📅 Today' },
              { id: 'date_tomorrow', title: '📅 Tomorrow' }
            ], overrideToken, overridePhoneId);
          }
       }
    } 
    else if (current_step === 'AWAITING_PLAYERS') {
       if (incomingText.startsWith('players_')) {
          context.num_players = parseInt(incomingText.replace('players_', ''));
          await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_DATE', context);
          await sendWhatsAppButtons(phone, 'Great! When would you like to book?', [
             { id: 'date_today', title: '📅 Today' },
             { id: 'date_tomorrow', title: '📅 Tomorrow' }
          ], overrideToken, overridePhoneId);
       }
    }
    else if (current_step === 'AWAITING_DATE') {
       if (incomingText.startsWith('date_')) {
          const isToday = incomingText === 'date_today';
          const dateObj = new Date();
          if (!isToday) dateObj.setDate(dateObj.getDate() + 1);
          
          const isoDate = dateObj.toISOString().split('T')[0]; // Safe YYYY-MM-DD
          context.booking_date = isoDate;
          
          // Generate available time slots based on the game type
          const availableTables = (business.tables || []).filter(t => ((t as any).game_type || 'pool').toLowerCase() === context.game_type);
          
          if (availableTables.length === 0) {
            await sendWhatsAppText(phone, 'Sorry, no tables are available for this game type.', false, overrideToken, overridePhoneId);
            await whatsappRepository.clearState(phone);
            return NextResponse.json({ ok: true });
          }

          // Dynamic timeslots using Qcontrol existing logic (14:00 to 21:00)
          const rows = [];
          for (let i = 14; i <= 21; i++) {
             let slotAvailable = false;
             let tableToBook = null;
             
             // Check across all available tables for this time slot
             for (const t of availableTables) {
               const check = await bookingService.checkTableAvailability(business.id!, t.id, context.booking_date, i * 60, 60);
               if (check.available) {
                 slotAvailable = true;
                 tableToBook = t.id;
                 break;
               }
             }

             if (slotAvailable) {
               rows.push({
                 id: `time_${i}:00_${tableToBook}`,
                 title: `${i}:00 - ${i+1}:00`,
                 description: `1 Hour Slot`
               });
             }
          }

          if (rows.length === 0) {
            await sendWhatsAppText(phone, 'Sorry, all tables are fully booked for this date. Please try another date.', false, overrideToken, overridePhoneId);
            await whatsappRepository.clearState(phone);
            return NextResponse.json({ ok: true });
          }

          await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_TIME', context);
          await sendWhatsAppList(phone, `Here are the available slots for ${isToday ? 'Today' : 'Tomorrow'}:`, 'Select Time', [
             { title: 'Available Times', rows }
          ], overrideToken, overridePhoneId);
       }
    }
    else if (current_step === 'AWAITING_TIME') {
       if (incomingText.startsWith('time_')) {
          const parts = incomingText.split('_');
          context.start_time = parts[1];
          context.table_id = parts.slice(2).join('_');
          
          await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_NAME', context);
          await sendWhatsAppText(phone, 'Almost done! Please type your *Name* to confirm the booking.', false, overrideToken, overridePhoneId);
       }
    }
    else if (current_step === 'AWAITING_NAME') {
       const customerName = text.trim();
       if (customerName) {
         context.customer_name = customerName;
         
         const startMins = parseInt(context.start_time.split(':')[0], 10) * 60 + parseInt(context.start_time.split(':')[1], 10);
         const endMins = startMins + 60;
         const endHours = Math.floor(endMins / 60) % 24;
         const endMinutes = endMins % 60;
         const end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
         const formattedStartTime = context.start_time.length === 5 ? `${context.start_time}:00` : context.start_time;

         // Idempotency: Double check availability one last time
         const doubleCheck = await bookingService.checkTableAvailability(state.business_id, context.table_id, context.booking_date, startMins, 60);
         if (!doubleCheck.available) {
             await sendWhatsAppText(phone, `Oops! ${doubleCheck.reason} Please type your booking command to restart.`, false, overrideToken, overridePhoneId);
             await whatsappRepository.clearState(phone);
             return NextResponse.json({ ok: true });
         }

         // 1. Save to DB with source = whatsapp
         const { error } = await supabase.from('bookings').insert({
            business_id: state.business_id,
            table_id: context.table_id,
            customer_name: customerName,
            customer_phone: phone,
            game_type: context.game_type,
            num_players: context.num_players,
            booking_date: context.booking_date,
            start_time: formattedStartTime,
            end_time: end_time,
            duration_minutes: 60,
            status: 'confirmed',
            source: 'whatsapp'
         });

         if (error) {
           await sendWhatsAppText(phone, 'An error occurred while saving your booking. Please try again later.', false, overrideToken, overridePhoneId);
         } else {
           const mapLink = business.address ? `\n📍 Location: https://maps.google.com/?q=${encodeURIComponent(business.address)}` : '';
           const contactMsg = business.contact_number ? `\n\n📞 Need changes? Tap here: https://wa.me/${business.contact_number}` : '';
           
           const msg = `✅ *Booking Confirmed!*\n\n*Name:* ${customerName}\n*Game:* ${context.game_type.toUpperCase()} (${context.num_players || 1} Players)\n*Time:* ${context.booking_date} at ${context.start_time}\n*Location:* ${business.business_name}${mapLink}${contactMsg}`;
           
           await sendWhatsAppText(phone, msg, false, overrideToken, overridePhoneId);
         }
         
         await whatsappRepository.clearState(phone);
       }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ ok: true, error_logged: true });
  }
}
