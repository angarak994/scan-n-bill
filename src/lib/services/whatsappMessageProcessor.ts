import { whatsappRepository } from '@/lib/repositories/whatsappRepository';
import { businessManager } from '@/lib/businessManager';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp';
import { bookingService } from '@/lib/services/bookingService';
import { qcontrolIntelligence } from '@/lib/services/qcontrolIntelligence';

export async function processWhatsAppMessage(body: any, correlationId?: string) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const statuses = value?.statuses;

  // 1. Handle delivery status updates (sent -> delivered -> read / failed)
  if (statuses && statuses.length > 0) {
    for (const statusObj of statuses) {
      const { id: messageId, status, errors } = statusObj;

      let errorMessage: string | null = null;
      if (errors && errors.length > 0) {
        errorMessage = errors[0].title || errors[0].message || 'Provider delivery error';
      }

      await whatsappRepository.updateMessageStatus(messageId, status, errorMessage);
    }
    return;
  }

  const messages = value?.messages;
  if (!messages || messages.length === 0) {
    return;
  }

  const message = messages[0];
  const phone = message.from;
  const messageId = message.id;
  const metadata = value?.metadata;
  const phoneNumberId = metadata?.phone_number_id;

  // Idempotency check: skip if duplicate webhook event already processed
  if (await whatsappRepository.isMessageProcessed(messageId)) {
    console.log(`[Idempotency] Message ${messageId} was already processed. Skipping duplicate.`);
    return;
  }

  // 2. Resolve Business Context
  let detectedBusiness: any = null;
  let overrideToken: string | undefined = undefined;
  let overridePhoneId: string | undefined = undefined;

  // Strategy A: Match by WhatsApp Phone Number ID
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

  // Strategy B: Check active conversation state for this phone
  if (!detectedBusiness) {
    const state = await whatsappRepository.getState(phone);
    if (state?.business_id) {
      const b = await businessManager.getBusiness(state.business_id);
      if (b) {
        detectedBusiness = b;
        if (b.whatsapp_config?.enabled) {
          overrideToken = b.whatsapp_config.token;
          overridePhoneId = b.whatsapp_config.phoneId;
        }
      }
    }
  }

  // Strategy C: Resolve primary active club with WhatsApp enabled (e.g. LevelUP)
  if (!detectedBusiness) {
    const { data: businesses } = await supabase.from('businesses').select('*');
    if (businesses && businesses.length > 0) {
      detectedBusiness =
        businesses.find(b => b.status === 'ACTIVE' && b.whatsapp_config?.enabled) ||
        businesses.find(b => b.status === 'ACTIVE') ||
        businesses[0];

      if (detectedBusiness?.whatsapp_config?.enabled) {
        overrideToken = detectedBusiness.whatsapp_config.token;
        overridePhoneId = detectedBusiness.whatsapp_config.phoneId;
      }
    }
  }

  const businessId = detectedBusiness?.id || '011be6ef-dc4b-4489-a955-e83144e0995c';
  const businessName = detectedBusiness?.business_name || 'QControl';

  // 3. Extract incoming text / interactive selections
  const text = message.type === 'text' ? (message.text?.body || '') : '';
  const buttonReplyId = message.type === 'interactive' && message.interactive?.type === 'button_reply' ? message.interactive.button_reply.id : null;
  const listReplyId = message.type === 'interactive' && message.interactive?.type === 'list_reply' ? message.interactive.list_reply.id : null;
  const incomingText = buttonReplyId || listReplyId || text;

  // 4. Log inbound message to whatsapp_messages
  await whatsappRepository.logMessage({
    business_id: businessId,
    message_id: messageId,
    recipient_phone: phone,
    recipient_name: 'Customer',
    content: incomingText || '[Interactive payload]',
    status: 'received',
    error_message: null
  });

  // 5. Record user turn in conversational memory
  await whatsappRepository.recordChatHistory(businessId, phone, 'user', incomingText || '');

  // 6. Check existing state machine flow
  const state = await whatsappRepository.getState(phone);
  const currentStep = state?.current_step;
  const context = state?.context || {};

  // Handle in-flight state machine steps (interactive selections)
  if (currentStep === 'AWAITING_GAME' && incomingText.startsWith('game_')) {
    const gameType = incomingText.replace('game_', '');
    context.game_type = gameType;

    if (gameType === 'ps5') {
      await whatsappRepository.updateState(phone, businessId, 'AWAITING_PLAYERS', context);
      await sendWhatsAppButtons(
        phone,
        'Awesome! How many players will be joining?',
        [
          { id: 'players_1', title: '👤 1 Player' },
          { id: 'players_2', title: '👥 2 Players' },
          { id: 'players_4', title: '👨‍👩‍👦 3-4 Players' }
        ],
        overrideToken,
        overridePhoneId,
        { businessId, recipientName: 'Customer', content: 'PS5 player count prompt' }
      );
      return;
    } else {
      context.num_players = 1;
      await whatsappRepository.updateState(phone, businessId, 'AWAITING_DATE', context);
      await sendWhatsAppButtons(
        phone,
        `Great choice! When would you like to book *${gameType.toUpperCase()}* at *${businessName}*?`,
        [
          { id: 'date_today', title: '📅 Today' },
          { id: 'date_tomorrow', title: '📅 Tomorrow' }
        ],
        overrideToken,
        overridePhoneId,
        { businessId, recipientName: 'Customer', content: 'Booking date prompt' }
      );
      return;
    }
  }

  if (currentStep === 'AWAITING_PLAYERS' && incomingText.startsWith('players_')) {
    context.num_players = parseInt(incomingText.replace('players_', ''), 10) || 1;
    await whatsappRepository.updateState(phone, businessId, 'AWAITING_DATE', context);
    await sendWhatsAppButtons(
      phone,
      `When would you like to book at *${businessName}*?`,
      [
        { id: 'date_today', title: '📅 Today' },
        { id: 'date_tomorrow', title: '📅 Tomorrow' }
      ],
      overrideToken,
      overridePhoneId,
      { businessId, recipientName: 'Customer', content: 'Booking date prompt' }
    );
    return;
  }

  if (currentStep === 'AWAITING_DATE' && (incomingText.startsWith('date_') || incomingText.includes('today') || incomingText.includes('tomorrow'))) {
    const isToday = incomingText.includes('today');
    const dateObj = new Date();
    if (!isToday) dateObj.setDate(dateObj.getDate() + 1);

    const isoDate = dateObj.toISOString().split('T')[0];
    context.booking_date = isoDate;
    const gameType = context.game_type || 'pool';

    const availableSlots = await bookingService.getAvailableSlots(businessId, gameType, isoDate, 60);

    if (availableSlots.length === 0) {
      await sendWhatsAppText(
        phone,
        `Sorry, all *${gameType.toUpperCase()}* tables at *${businessName}* are fully booked for ${isToday ? 'Today' : 'Tomorrow'}. Please select another date.`,
        false,
        overrideToken,
        overridePhoneId,
        { businessId, recipientName: 'Customer', content: 'Fully booked notice' }
      );
      await whatsappRepository.clearState(phone);
      return;
    }

    const rows = availableSlots.slice(0, 10).map(s => ({
      id: `time_${s.time}_${s.tableId}`,
      title: `${s.time}`,
      description: `1 Hour • ₹${s.ratePerHour}/hr`
    }));

    await whatsappRepository.updateState(phone, businessId, 'AWAITING_TIME', context);
    await sendWhatsAppList(
      phone,
      `Available *${gameType.toUpperCase()}* slots at *${businessName}* for ${isToday ? 'Today' : 'Tomorrow'}:`,
      'Select Time',
      [{ title: 'Available Time Slots', rows }],
      overrideToken,
      overridePhoneId,
      { businessId, recipientName: 'Customer', content: 'Available timeslots list' }
    );
    return;
  }

  if (currentStep === 'AWAITING_TIME' && incomingText.startsWith('time_')) {
    const parts = incomingText.split('_');
    context.start_time = parts[1];
    context.table_id = parts.slice(2).join('_');

    await whatsappRepository.updateState(phone, businessId, 'AWAITING_NAME', context);
    await sendWhatsAppText(
      phone,
      `Almost done! Please type your *Name* to confirm your reservation at *${businessName}*.`,
      false,
      overrideToken,
      overridePhoneId,
      { businessId, recipientName: 'Customer', content: 'Prompt for name' }
    );
    return;
  }

  if (currentStep === 'AWAITING_NAME' && text.trim()) {
    const customerName = text.trim();
    const output = await qcontrolIntelligence.finalizeBookingWithName(
      customerName,
      phone,
      businessId,
      businessName,
      context
    );

    if (output.replyType === 'buttons' && output.buttons) {
      await sendWhatsAppButtons(phone, output.replyText, output.buttons, overrideToken, overridePhoneId, {
        businessId,
        recipientName: customerName,
        content: output.replyText
      });
    } else {
      await sendWhatsAppText(phone, output.replyText, false, overrideToken, overridePhoneId, {
        businessId,
        recipientName: customerName,
        content: output.replyText
      });
    }

    await whatsappRepository.clearState(phone);
    await whatsappRepository.recordChatHistory(businessId, phone, 'assistant', output.replyText);
    return;
  }

  // 7. Route through QControl Intelligence Engine (Natural Language Understanding & Action Dispatch)
  const intelligenceResult = await qcontrolIntelligence.processCustomerMessage({
    incomingText,
    senderPhone: phone,
    businessId,
    businessName,
    buttonReplyId,
    listReplyId
  });

  // 8. Update conversation state if requested
  if (intelligenceResult.clearState) {
    await whatsappRepository.clearState(phone);
  } else if (intelligenceResult.nextStep) {
    await whatsappRepository.updateState(
      phone,
      businessId,
      intelligenceResult.nextStep,
      intelligenceResult.updatedContext || context
    );
  }

  // 9. Dispatch WhatsApp response
  if (intelligenceResult.replyType === 'buttons' && intelligenceResult.buttons) {
    await sendWhatsAppButtons(
      phone,
      intelligenceResult.replyText,
      intelligenceResult.buttons,
      overrideToken,
      overridePhoneId,
      {
        businessId,
        recipientName: 'Customer',
        content: intelligenceResult.replyText
      }
    );
  } else if (intelligenceResult.replyType === 'list' && intelligenceResult.listData) {
    await sendWhatsAppList(
      phone,
      intelligenceResult.replyText,
      intelligenceResult.listData.buttonText,
      intelligenceResult.listData.sections,
      overrideToken,
      overridePhoneId,
      {
        businessId,
        recipientName: 'Customer',
        content: intelligenceResult.replyText
      }
    );
  } else {
    await sendWhatsAppText(
      phone,
      intelligenceResult.replyText,
      false,
      overrideToken,
      overridePhoneId,
      {
        businessId,
        recipientName: 'Customer',
        content: intelligenceResult.replyText
      }
    );
  }

  // 10. Record assistant turn in conversational memory
  await whatsappRepository.recordChatHistory(businessId, phone, 'assistant', intelligenceResult.replyText);
}
