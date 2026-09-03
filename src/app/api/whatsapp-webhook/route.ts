import { NextResponse } from 'next/server';
import { whatsappRepository } from '@/lib/repositories/whatsappRepository';
import { businessManager } from '@/lib/businessManager';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp';

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
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const message = messages[0];
    const phone = message.from;
    const messageId = message.id;

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
         await sendWhatsAppText(phone, 'Sorry, we could not find that business.');
         return NextResponse.json({ ok: true });
       }
       
       await whatsappRepository.updateState(phone, business.id!, 'AWAITING_GAME', { business_name: business.business_name });
       
       await sendWhatsAppButtons(phone, `Hi there! 👋 Welcome to *${business.business_name}* booking system.\n\nWhat would you like to play today?`, [
         { id: 'game_pool', title: '🎱 Pool' },
         { id: 'game_snooker', title: '🔴 Snooker' },
         { id: 'game_ps5', title: '🎮 PS5' }
       ]);
       
       return NextResponse.json({ ok: true });
    }

    // Get active state
    const state = await whatsappRepository.getState(phone);
    if (!state) {
      // Ignore random messages if no active state
      return NextResponse.json({ ok: true });
    }

    const business = await businessManager.getBusiness(state.business_id);
    if (!business) return NextResponse.json({ ok: true });

    let { current_step, context } = state;

    if (current_step === 'AWAITING_GAME') {
       if (incomingText.startsWith('game_')) {
          const gameType = incomingText.replace('game_', '');
          context.game_type = gameType;
          
          if (gameType === 'ps5') {
            await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_PLAYERS', context);
            await sendWhatsAppButtons(phone, 'Awesome! How many players will be joining?', [
              { id: 'players_1', title: '👤 1 Player' },
              { id: 'players_2', title: '👥 2 Players' },
              { id: 'players_4', title: '👨‍👩‍👦 3-4 Players' }
            ]);
          } else {
            context.num_players = 1;
            await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_DATE', context);
            await sendWhatsAppButtons(phone, 'Great! When would you like to book?', [
              { id: 'date_today', title: '📅 Today' },
              { id: 'date_tomorrow', title: '📅 Tomorrow' }
            ]);
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
          ]);
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
            await sendWhatsAppText(phone, 'Sorry, no tables are available for this game type.');
            await whatsappRepository.clearState(phone);
            return NextResponse.json({ ok: true });
          }

          // Mocking timeslots for simplicity (14:00 to 22:00)
          const rows = [];
          for (let i = 14; i <= 21; i++) {
            rows.push({
               id: `time_${i}:00_${availableTables[0].id}`,
               title: `${i}:00 - ${i+1}:00`,
               description: `Table: ${availableTables[0].id}`
            });
          }

          await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_TIME', context);
          await sendWhatsAppList(phone, `Here are the available slots for ${isToday ? 'Today' : 'Tomorrow'}:`, 'Select Time', [
             { title: 'Available Times', rows }
          ]);
       }
    }
    else if (current_step === 'AWAITING_TIME') {
       if (incomingText.startsWith('time_')) {
          const parts = incomingText.split('_');
          context.start_time = parts[1];
          context.table_id = parts.slice(2).join('_');
          
          await whatsappRepository.updateState(phone, state.business_id, 'AWAITING_NAME', context);
          await sendWhatsAppText(phone, 'Almost done! Please type your *Name* to confirm the booking.');
       }
    }
    else if (current_step === 'AWAITING_NAME') {
       const customerName = text.trim();
       if (customerName) {
         context.customer_name = customerName;
         
         // 1. Save to DB
         const { error } = await supabase.from('bookings').insert({
            business_id: state.business_id,
            table_id: context.table_id,
            customer_name: customerName,
            customer_phone: phone,
            game_type: context.game_type,
            num_players: context.num_players,
            booking_date: context.booking_date,
            start_time: context.start_time,
            duration_minutes: 60, // Default 1 hr
            status: 'pending'
         });

         if (error) {
           await sendWhatsAppText(phone, 'An error occurred while saving your booking. Please try again later.');
         } else {
           const mapLink = business.address ? `\n📍 Location: https://maps.google.com/?q=${encodeURIComponent(business.address)}` : '';
           const contactMsg = business.contact_number ? `\n\n📞 Need changes? Tap here: https://wa.me/${business.contact_number}` : '';
           
           const msg = `✅ *Booking Confirmed!*\n\n*Name:* ${customerName}\n*Game:* ${context.game_type.toUpperCase()} (${context.num_players || 1} Players)\n*Time:* ${context.booking_date} at ${context.start_time}\n*Location:* ${business.business_name}${mapLink}${contactMsg}`;
           
           await sendWhatsAppText(phone, msg);
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
