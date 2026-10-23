import { whatsappRepository } from '@/lib/repositories/whatsappRepository';
import { businessManager } from '@/lib/businessManager';
import { supabase } from '@/lib/supabaseClient';
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList, sendWhatsAppImage, sendWhatsAppTypingIndicator } from '@/lib/whatsapp';
import { bookingService } from '@/lib/services/bookingService';
import { qcontrolIntelligence } from '@/lib/services/qcontrolIntelligence';
import { promptInjectionDefense } from '@/lib/security/promptInjectionDefense';

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

  // Natural typing indicator acknowledgment
  if (messageId) {
    sendWhatsAppTypingIndicator(messageId).catch(() => {});
  }

  // 2. Extract incoming text / interactive selections / GPS location FIRST
  const isLocation = message.type === 'location';
  const locationPayload = isLocation && message.location ? {
    latitude: Number(message.location.latitude),
    longitude: Number(message.location.longitude),
    name: message.location.name,
    address: message.location.address
  } : undefined;

  const text = message.type === 'text' ? (message.text?.body || '') : '';
  const buttonReplyId = message.type === 'interactive' && message.interactive?.type === 'button_reply' ? message.interactive.button_reply.id : null;
  const listReplyId = message.type === 'interactive' && message.interactive?.type === 'list_reply' ? message.interactive.list_reply.id : null;
  const incomingText = buttonReplyId || listReplyId || text || (isLocation ? '[Location Shared]' : '');
  const lower = (incomingText || '').toLowerCase().trim();

  // Security Gate: Sub-millisecond prompt injection & jailbreak defense
  if (text) {
    const securityCheck = promptInjectionDefense.scan(text);
    if (securityCheck.isSuspicious) {
      console.warn(`[Security Alert] Inbound message from ${phone} flagged for ${securityCheck.threatType} (Score: ${securityCheck.riskScore})`);
      await sendWhatsAppText(
        phone,
        securityCheck.deflectionResponse || 'I am QControl’s reservation assistant. How can I assist you with booking a table today?',
        false
      );
      return;
    }
  }

  // 3. Resolve Business Context
  let detectedBusiness: any = null;
  let overrideToken: string | undefined = undefined;
  let overridePhoneId: string | undefined = undefined;

  // Ingress Step A: QR Code / Deep-Link Ingress Detection (Takes highest precedence)
  // Matches QC_<SLUG>, Code: QC_<SLUG>, or "Book at <ClubName>"
  const deepLinkMatch = incomingText.match(/\bQC_([A-Za-z0-9_]+)\b/i) || incomingText.match(/Code:\s*QC_([A-Za-z0-9_]+)/i);
  const bookAtMatch = incomingText.match(/Book at\s+([^(\n\r]+)/i);

  if (deepLinkMatch || bookAtMatch || incomingText.startsWith('select_biz_')) {
    const { data: activeBusinesses } = await supabase.from('businesses').select('*').eq('status', 'ACTIVE');
    const clubs = activeBusinesses || [];

    if (deepLinkMatch) {
      const slugOrId = deepLinkMatch[1].toLowerCase().trim();
      detectedBusiness = clubs.find(b => {
        const clubSlug = ((b.slug || b.business_name) as string).toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return clubSlug === slugOrId ||
          clubSlug.includes(slugOrId) ||
          slugOrId.includes(clubSlug) ||
          b.id.toLowerCase().startsWith(slugOrId) ||
          b.business_name.toLowerCase().includes(slugOrId);
      });
    } else if (bookAtMatch) {
      const targetName = bookAtMatch[1].toLowerCase().trim();
      detectedBusiness = clubs.find(b => b.business_name.toLowerCase().includes(targetName) || targetName.includes(b.business_name.toLowerCase()));
    } else if (incomingText.startsWith('select_biz_')) {
      const selectedId = incomingText.replace('select_biz_', '').trim();
      detectedBusiness = clubs.find(b => b.id === selectedId);
    }

    if (detectedBusiness) {
      // Lock context into the selected business
      await whatsappRepository.updateState(phone, detectedBusiness.id, 'IDLE', {
        business_name: detectedBusiness.business_name,
        switched_at: new Date().toISOString()
      }, 'CLUB');

      if (detectedBusiness.whatsapp_config?.enabled) {
        overrideToken = detectedBusiness.whatsapp_config.token;
        overridePhoneId = detectedBusiness.whatsapp_config.phoneId;
      }
    }
  }

  // Ingress Step B: Dedicated Phone Number ID match (for enterprise clubs with their own Meta WABA)
  if (!detectedBusiness && phoneNumberId) {
    const { data: businesses } = await supabase.from('businesses').select('*').eq('status', 'ACTIVE');
    if (businesses) {
      const matched = businesses.find(b => b.whatsapp_config?.enabled && b.whatsapp_config?.phoneId === phoneNumberId);
      if (matched) {
        detectedBusiness = matched;
        overrideToken = matched.whatsapp_config.token;
        overridePhoneId = matched.whatsapp_config.phoneId;
      }
    }
  }

  // Ingress Step C: Active Conversation Continuity (Respects 30-min TTL)
  if (!detectedBusiness) {
    const state = await whatsappRepository.getState(phone);
    const activeBizId = state?.active_business_id || state?.business_id;

    if (activeBizId && state?.conversation_mode === 'CLUB') {
      const b = await businessManager.getBusiness(activeBizId);
      if (b && b.status === 'ACTIVE') {
        detectedBusiness = b;
        if (b.whatsapp_config?.enabled) {
          overrideToken = b.whatsapp_config.token;
          overridePhoneId = b.whatsapp_config.phoneId;
        }
      }
    }
  }

  // Ingress Step D: Explicit Switch Club Request
  if (incomingText === 'action_switch_club' || incomingText === 'switch_club' || lower.includes('switch club') || lower.includes('change club')) {
    await whatsappRepository.clearState(phone);
    const discoveryRes = await qcontrolIntelligence.handleGlobalDiscovery('', phone);
    
    if (discoveryRes.replyType === 'list' && discoveryRes.listData) {
      await sendWhatsAppList(phone, discoveryRes.replyText, discoveryRes.listData.buttonText, discoveryRes.listData.sections, overrideToken, overridePhoneId);
    } else if (discoveryRes.replyType === 'buttons' && discoveryRes.buttons) {
      await sendWhatsAppButtons(phone, discoveryRes.replyText, discoveryRes.buttons, overrideToken, overridePhoneId);
    } else {
      await sendWhatsAppText(phone, discoveryRes.replyText, false, overrideToken, overridePhoneId);
    }
    return;
  }

  // Ingress Step E: Global Discovery Mode (Zero Strategy C Silent Cross-Tenant Hijack!)
  if (!detectedBusiness) {
    console.log(`[Central QControl] Inbound from ${phone} without club context. Routing to Global Discovery.`);
    let discoveryRes: any;
    if (locationPayload) {
      discoveryRes = await qcontrolIntelligence.handleNearbyClubs(locationPayload.latitude, locationPayload.longitude, phone);
    } else {
      discoveryRes = await qcontrolIntelligence.handleGlobalDiscovery(incomingText, phone);
    }

    // Save global discovery state
    await whatsappRepository.updateState(phone, null, 'GLOBAL_DISCOVERY', { query: incomingText }, 'GLOBAL_DISCOVERY');

    if (discoveryRes.replyType === 'list' && discoveryRes.listData) {
      await sendWhatsAppList(phone, discoveryRes.replyText, discoveryRes.listData.buttonText, discoveryRes.listData.sections, overrideToken, overridePhoneId);
    } else if (discoveryRes.replyType === 'buttons' && discoveryRes.buttons) {
      await sendWhatsAppButtons(phone, discoveryRes.replyText, discoveryRes.buttons, overrideToken, overridePhoneId);
    } else {
      await sendWhatsAppText(phone, discoveryRes.replyText, false, overrideToken, overridePhoneId);
    }
    return;
  }

  const businessId = detectedBusiness.id;
  const businessName = detectedBusiness.business_name;

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
    const now = new Date();
    // Compute date in IST
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffsetMs);
    if (!isToday) {
      istDate.setUTCDate(istDate.getUTCDate() + 1);
    }
    const isoDate = istDate.toISOString().split('T')[0];
    context.booking_date = isoDate;
    const gameType = context.game_type || 'pool';
    const durationMins = Number(context.duration_minutes) || 60;

    const availableSlots = await bookingService.getAvailableSlots(businessId, gameType, isoDate, durationMins);

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

    const durationLabel = durationMins >= 60 ? `${durationMins / 60} Hour` : `${durationMins} Mins`;
    const rows = availableSlots.slice(0, 10).map(s => ({
      id: `time_${s.time}_${s.tableId}`,
      title: `${s.time}`,
      description: `${durationLabel} • ₹${s.ratePerHour}/hr`
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
    listReplyId,
    businessProfile: detectedBusiness,
    location: locationPayload
  });

  // 8. Update conversation state if requested
  if (intelligenceResult.clearState) {
    await whatsappRepository.clearState(phone);
  } else if (intelligenceResult.nextStep) {
    await whatsappRepository.updateState(
      phone,
      businessId,
      intelligenceResult.nextStep,
      intelligenceResult.updatedContext || context,
      'CLUB'
    );
  }

  // 9. Dispatch WhatsApp response
  // If intelligence output includes images (e.g. venue photos)
  if (intelligenceResult.images && intelligenceResult.images.length > 0) {
    for (const img of intelligenceResult.images) {
      await sendWhatsAppImage(
        phone,
        img.url,
        img.caption,
        overrideToken,
        overridePhoneId,
        {
          businessId,
          recipientName: 'Customer',
          content: img.caption || 'Venue Photo'
        }
      );
    }
  }

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
