import { supabase } from '@/lib/supabaseClient';
import { bookingService } from '@/lib/services/bookingService';
import { clubDiscoveryService } from '@/lib/services/clubDiscoveryService';
import { whatsappRepository } from '@/lib/repositories/whatsappRepository';
import { getCurrentISTDateStr } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';

export interface IntelligenceInput {
  incomingText: string;
  senderPhone: string;
  businessId: string;
  businessName: string;
  buttonReplyId?: string | null;
  listReplyId?: string | null;
}

export interface IntelligenceOutput {
  replyText: string;
  replyType: 'text' | 'buttons' | 'list';
  buttons?: Array<{ id: string; title: string }>;
  listData?: {
    buttonText: string;
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  };
  nextStep?: string;
  updatedContext?: Record<string, any>;
  clearState?: boolean;
}

export const qcontrolIntelligence = {
  /**
   * Main entry point to process a customer message intelligently with strict zero-hallucination guarantees.
   */
  async processCustomerMessage(input: IntelligenceInput): Promise<IntelligenceOutput> {
    const { incomingText, senderPhone, businessId, businessName, buttonReplyId, listReplyId } = input;
    const cleanPhone = senderPhone.replace(/\D/g, '');
    const rawText = (buttonReplyId || listReplyId || incomingText || '').trim();
    const lower = rawText.toLowerCase();

    // 1. Fetch current conversation state from repository
    const state = await whatsappRepository.getState(cleanPhone);
    const currentStep = state?.current_step;
    const context = state?.context || {};

    // 2. Fetch business context
    const business = await businessManager.getBusiness(businessId);
    const bName = business?.business_name || businessName || 'QControl';

    // 3. Handle explicit state-machine button / interactive clicks first
    if (buttonReplyId || listReplyId) {
      const interactiveId = buttonReplyId || listReplyId;

      if (interactiveId === 'action_availability' || interactiveId === 'action_book') {
        return {
          replyText: `What game would you like to play at *${bName}*?`,
          replyType: 'buttons',
          buttons: [
            { id: 'game_pool', title: '🎱 Pool' },
            { id: 'game_snooker', title: '🔴 Snooker' },
            { id: 'game_ps5', title: '🎮 PS5' }
          ],
          nextStep: 'AWAITING_GAME',
          updatedContext: { business_name: bName }
        };
      }

      if (interactiveId === 'action_pricing') {
        const pricingText = await this.formatPricingGuide(businessId, bName, cleanPhone);
        return {
          replyText: pricingText,
          replyType: 'buttons',
          buttons: [
            { id: 'action_book', title: '📅 Book Now' },
            { id: 'action_my_bookings', title: '📋 My Bookings' }
          ]
        };
      }

      if (interactiveId === 'action_my_bookings') {
        return await this.handleListBookings(cleanPhone, businessId, bName);
      }

      if (interactiveId === 'action_discover_clubs') {
        return await this.handleClubDiscovery('', cleanPhone, 'pool');
      }

      // Handle cancel booking button click
      if (interactiveId?.startsWith('cancel_')) {
        const bId = interactiveId.replace('cancel_', '');
        const cancelResult = await bookingService.cancelBooking(bId, cleanPhone, businessId);
        if (cancelResult.success) {
          return {
            replyText: `✅ Your booking at *${bName}* has been successfully cancelled.\n\nWould you like to reserve another time?`,
            replyType: 'buttons',
            buttons: [
              { id: 'action_book', title: '📅 New Booking' },
              { id: 'action_my_bookings', title: '📋 My Bookings' }
            ],
            clearState: true
          };
        } else {
          return {
            replyText: `Could not cancel booking: ${cancelResult.reason || 'Not found'}.`,
            replyType: 'text',
            clearState: true
          };
        }
      }
    }

    // 4. Intent Classification (supports English, Indian English, and Hinglish)
    const intent = this.detectIntent(lower);

    switch (intent) {
      case 'GREETING': {
        return {
          replyText: `*Welcome to ${bName}!* 🎱\n\nHi! I'm your virtual club assistant. I can help you check table availability, book a game, view pricing or find clubs near you.\n\nWhat would you like to do?`,
          replyType: 'buttons',
          buttons: [
            { id: 'action_availability', title: '🎱 Check Tables' },
            { id: 'action_pricing', title: '💰 View Pricing' },
            { id: 'action_my_bookings', title: '📋 My Bookings' }
          ],
          nextStep: 'AWAITING_ACTION',
          updatedContext: { business_name: bName }
        };
      }

      case 'PAYMENT_INQUIRY': {
        return await this.handlePaymentInquiry(cleanPhone, businessId, bName);
      }

      case 'CANCEL_BOOKING': {
        return await this.handleCancelIntent(cleanPhone, businessId, bName);
      }

      case 'RESCHEDULE_BOOKING': {
        return await this.handleRescheduleIntent(cleanPhone, businessId, bName);
      }

      case 'LIST_BOOKINGS': {
        return await this.handleListBookings(cleanPhone, businessId, bName);
      }

      case 'PRICING_INQUIRY': {
        const pricingText = await this.formatPricingGuide(businessId, bName, cleanPhone);
        return {
          replyText: pricingText,
          replyType: 'buttons',
          buttons: [
            { id: 'action_book', title: '📅 Book Now' },
            { id: 'action_my_bookings', title: '📋 My Bookings' }
          ]
        };
      }

      case 'BOOK_CHEAPEST': {
        return await this.handleCheapestTableRequest(businessId, bName, cleanPhone);
      }

      case 'AVAILABILITY_OR_BOOKING': {
        return await this.handleNaturalBookingRequest(lower, businessId, bName, cleanPhone);
      }

      case 'LOCATION_DISCOVERY': {
        const area = this.extractAreaFromText(lower);
        return await this.handleClubDiscovery(area, cleanPhone);
      }

      default: {
        // Fallback: check if we are in an in-progress flow
        if (currentStep === 'AWAITING_NAME') {
          const customerName = rawText.trim();
          if (customerName) {
            return await this.finalizeBookingWithName(customerName, cleanPhone, businessId, bName, context);
          }
        }

        // Helpful clarifying fallback
        return {
          replyText: `I'd love to help you at *${bName}*!\n\nYou can ask me things like:\n- *"Pool table chahiye aaj 7 baje"*\n- *"What is the snooker rate?"*\n- *"Show my upcoming bookings"*\n- *"Is there any table near me?"*\n\nOr choose an option below:`,
          replyType: 'buttons',
          buttons: [
            { id: 'action_availability', title: '🎱 Check Tables' },
            { id: 'action_pricing', title: '💰 View Pricing' },
            { id: 'action_my_bookings', title: '📋 My Bookings' }
          ]
        };
      }
    }
  },

  /**
   * Deterministic intent classification supporting English and colloquial Hinglish.
   */
  detectIntent(text: string): string {
    // 1. Greetings
    if (/^(hi|hello|hey|namaste|hi bro|kem cho|yo|hola|good morning|good evening)\b/i.test(text)) {
      return 'GREETING';
    }

    // 2. Payment status inquiry
    if (
      text.includes('paid already') ||
      text.includes('already paid') ||
      text.includes('receiving reminders') ||
      text.includes('payment ho gaya') ||
      text.includes('payment kar diya') ||
      text.includes('kyun reminder') ||
      text.includes('paise de diye')
    ) {
      return 'PAYMENT_INQUIRY';
    }

    // 3. Cancel reservation
    if (
      (text.includes('cancel') || text.includes('rad') || text.includes('band')) &&
      (text.includes('booking') || text.includes('reservation') || text.includes('table') || text.includes('slot'))
    ) {
      return 'CANCEL_BOOKING';
    }

    // 4. Reschedule / Move booking
    if (
      text.includes('move') ||
      text.includes('reschedule') ||
      text.includes('shift') ||
      text.includes('kal shift') ||
      text.includes('time change')
    ) {
      return 'RESCHEDULE_BOOKING';
    }

    // 5. Show upcoming bookings
    if (
      text.includes('upcoming') ||
      text.includes('my bookings') ||
      text.includes('show my booking') ||
      text.includes('meri booking') ||
      text.includes('check booking')
    ) {
      return 'LIST_BOOKINGS';
    }

    // 6. Pricing / Membership discount
    if (
      text.includes('membership discount') ||
      text.includes('member discount') ||
      text.includes('price') ||
      text.includes('pricing') ||
      text.includes('rate') ||
      text.includes('kitna') ||
      text.includes('charges') ||
      text.includes('cost')
    ) {
      return 'PRICING_INQUIRY';
    }

    // 7. Cheapest table
    if (text.includes('cheapest') || text.includes('lowest') || text.includes('sasta') || text.includes('budget')) {
      return 'BOOK_CHEAPEST';
    }

    // 8. Location discovery
    if (
      text.includes('near me') ||
      text.includes('paas mein') ||
      text.includes('which club') ||
      text.includes('kothrud') ||
      text.includes('baner') ||
      text.includes('deccan') ||
      text.includes('fc road') ||
      text.includes('viman nagar') ||
      text.includes('wakad')
    ) {
      return 'LOCATION_DISCOVERY';
    }

    // 9. Natural availability or booking request
    if (
      text.includes('chahiye') ||
      text.includes('available') ||
      text.includes('book') ||
      text.includes('reserve') ||
      text.includes('free') ||
      text.includes('khali') ||
      text.includes('slot') ||
      text.includes('pool') ||
      text.includes('snooker') ||
      text.includes('ps5')
    ) {
      return 'AVAILABILITY_OR_BOOKING';
    }

    return 'UNKNOWN';
  },

  /**
   * Handles natural language booking and availability queries like "Pool table chahiye aaj 7 baje".
   */
  async handleNaturalBookingRequest(
    text: string,
    businessId: string,
    businessName: string,
    customerPhone: string
  ): Promise<IntelligenceOutput> {
    // Detect game type
    let gameType = 'pool';
    if (text.includes('snooker')) gameType = 'snooker';
    else if (text.includes('ps5') || text.includes('playstation')) gameType = 'ps5';

    // Detect date
    const todayStr = getCurrentISTDateStr();
    let isTomorrow = text.includes('kal') || text.includes('tomorrow');
    const targetDateObj = new Date();
    if (isTomorrow) targetDateObj.setDate(targetDateObj.getDate() + 1);
    const dateStr = isTomorrow ? targetDateObj.toISOString().split('T')[0] : todayStr;

    // Detect time
    let reqTime: string | null = null;
    let reqMins = 19 * 60; // Default 7 PM

    const timeMatch = text.match(/(\d{1,2})\s*(baje|pm|am|:00)?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const suffix = (timeMatch[2] || '').toLowerCase();

      if (suffix === 'pm' && h < 12) h += 12;
      else if (suffix === 'am' && h === 12) h = 0;
      else if (suffix === 'baje' || !suffix) {
        // In Indian context, 1..6 baje usually means evening 13..18, 7..11 means 19..23
        if (h >= 1 && h <= 6) h += 12;
        else if (h >= 7 && h <= 11) h += 12;
      }

      if (h >= 11 && h <= 23) {
        reqTime = `${String(h).padStart(2, '0')}:00`;
        reqMins = h * 60;
      }
    }

    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return {
        replyText: `Sorry, we could not find active records for *${businessName}*.`,
        replyType: 'text'
      };
    }

    const tables = (business.tables || []).filter((t: any) => {
      const type = ((t as any).game_type || (t as any).type || 'pool').toLowerCase();
      if (gameType === 'snooker') return type === 'snooker' || type === 'msnooker';
      return type === gameType;
    });

    if (tables.length === 0) {
      return {
        replyText: `Sorry, *${businessName}* currently does not have ${gameType.toUpperCase()} tables registered. Would you like to check other clubs?`,
        replyType: 'buttons',
        buttons: [{ id: 'action_discover_clubs', title: '📍 Find Other Clubs' }]
      };
    }

    // If customer asked for a specific time:
    if (reqTime) {
      for (const table of tables) {
        const check = await bookingService.checkTableAvailability(businessId, table.id, dateStr, reqMins, 60);
        if (check.available) {
          // Table is available! Prompt for confirmation
          const context = {
            game_type: gameType,
            booking_date: dateStr,
            start_time: reqTime,
            table_id: table.id,
            num_players: 1,
            business_name: businessName
          };

          return {
            replyText: `Great news! *Table ${table.name || table.id}* (${gameType.toUpperCase()}) is available at *${businessName}* on ${isTomorrow ? 'Tomorrow' : 'Today'} at *${reqTime}*.\n\nPlease type your *Name* to confirm the reservation.`,
            replyType: 'text',
            nextStep: 'AWAITING_NAME',
            updatedContext: context
          };
        }
      }

      // If requested time was not available, find alternative available slots
      const availableSlots = await bookingService.getAvailableSlots(businessId, gameType, dateStr, 60);
      if (availableSlots.length > 0) {
        const alternativeTimes = availableSlots.slice(0, 3).map(s => s.time).join(', ');
        return {
          replyText: `*Table ${tables[0].name || tables[0].id}* is already booked at *${reqTime}*.\n\nHowever, we have these available slots for ${isTomorrow ? 'Tomorrow' : 'Today'}:\n👉 *${alternativeTimes}*\n\nWhich slot would you prefer?`,
          replyType: 'buttons',
          buttons: availableSlots.slice(0, 3).map(s => ({
            id: `time_${s.time}_${s.tableId}`,
            title: `⏰ ${s.time}`
          })),
          nextStep: 'AWAITING_TIME',
          updatedContext: { game_type: gameType, booking_date: dateStr, num_players: 1, business_name: businessName }
        };
      }
    }

    // If no specific time requested, show available slots list
    const availableSlots = await bookingService.getAvailableSlots(businessId, gameType, dateStr, 60);
    if (availableSlots.length === 0) {
      return {
        replyText: `Sorry, all ${gameType.toUpperCase()} tables at *${businessName}* are fully booked for ${isTomorrow ? 'Tomorrow' : 'Today'}. Would you like to check other dates or clubs?`,
        replyType: 'buttons',
        buttons: [
          { id: 'date_tomorrow', title: '📅 Try Tomorrow' },
          { id: 'action_discover_clubs', title: '📍 Find Other Clubs' }
        ]
      };
    }

    return {
      replyText: `Here are available *${gameType.toUpperCase()}* slots at *${businessName}* for ${isTomorrow ? 'Tomorrow' : 'Today'}:`,
      replyType: 'buttons',
      buttons: availableSlots.slice(0, 3).map(s => ({
        id: `time_${s.time}_${s.tableId}`,
        title: `⏰ ${s.time}`
      })),
      nextStep: 'AWAITING_TIME',
      updatedContext: { game_type: gameType, booking_date: dateStr, num_players: 1, business_name: businessName }
    };
  },

  /**
   * Finalizes an atomic booking once customer provides their name.
   */
  async finalizeBookingWithName(
    customerName: string,
    customerPhone: string,
    businessId: string,
    businessName: string,
    context: Record<string, any>
  ): Promise<IntelligenceOutput> {
    const tableId = context.table_id;
    const bookingDate = context.booking_date || getCurrentISTDateStr();
    const startTime = context.start_time || '19:00';
    const gameType = context.game_type || 'pool';
    const numPlayers = Number(context.num_players) || 1;

    if (!tableId) {
      return {
        replyText: `Booking session timed out. Please send *"Hi"* to start a new booking.`,
        replyType: 'text',
        clearState: true
      };
    }

    // Atomic booking with race-condition prevention
    const result = await bookingService.createAtomicBooking({
      business_id: businessId,
      table_id: tableId,
      customer_name: customerName,
      customer_phone: customerPhone,
      booking_date: bookingDate,
      start_time: startTime,
      duration_minutes: 60,
      game_type: gameType,
      num_players: numPlayers,
      source: 'whatsapp'
    });

    if (!result.success) {
      return {
        replyText: `Oops! ${result.reason || 'Could not complete reservation.'}\n\nPlease reply *"Hi"* to select an alternative slot.`,
        replyType: 'text',
        clearState: true
      };
    }

    const booking = result.booking;
    const bookingCode = `QC-${booking.id.substring(0, 6).toUpperCase()}`;

    const business = await businessManager.getBusiness(businessId);
    const mapLink = business?.address ? `\n📍 *Address:* ${business.address}` : '';
    const contactMsg = business?.contact_number ? `\n📞 *Contact:* +91 ${business.contact_number}` : '';

    return {
      replyText: `✅ *Booking Confirmed!*\n\n*Club:* ${businessName}\n*Booking ID:* ${bookingCode}\n*Name:* ${customerName}\n*Game:* ${gameType.toUpperCase()} (${numPlayers} Players)\n*Time:* ${bookingDate} at ${startTime} (1 Hour)${mapLink}${contactMsg}\n\nSee you on the table! 🎱`,
      replyType: 'buttons',
      buttons: [
        { id: 'action_my_bookings', title: '📋 View Bookings' },
        { id: `cancel_${booking.id}`, title: '❌ Cancel Booking' }
      ],
      clearState: true
    };
  },

  /**
   * Handles payment status inquiries authoritatively.
   */
  async handlePaymentInquiry(
    customerPhone: string,
    businessId: string,
    businessName: string
  ): Promise<IntelligenceOutput> {
    const cleanPhone = customerPhone.replace(/\D/g, '');

    // 1. Authoritative lookup in customers table
    const { data: customer } = await supabase
      .from('customers')
      .select('name, outstanding_balance, total_billed, total_paid')
      .eq('business_id', businessId)
      .or(`phone.eq.${customerPhone},phone.eq.${cleanPhone}`)
      .maybeSingle();

    const outstanding = Number(customer?.outstanding_balance || 0);

    if (outstanding <= 0) {
      return {
        replyText: `*Payment verified — ${businessName}* ✅\n\nHi! We've checked our records for your number (*${cleanPhone}*). Your account balance is completely clear (*₹0 due*).\n\nYou can safely disregard any delayed reminders. Thank you for playing with us!`,
        replyType: 'buttons',
        buttons: [{ id: 'action_book', title: '📅 Book a Table' }]
      };
    } else {
      return {
        replyText: `*Payment reminder — ${businessName}*\n\nHi ${customer?.name || 'Customer'}, our verified ledger currently reflects an outstanding balance of *₹${outstanding.toFixed(0)}*.\n\nIf you have already paid this, please share the transaction screenshot or UPI reference ID, and our manager will reconcile it immediately!`,
        replyType: 'buttons',
        buttons: [
          { id: 'action_my_bookings', title: '📋 Check Bookings' },
          { id: 'action_pricing', title: '💰 View Rates' }
        ]
      };
    }
  },

  /**
   * Lists customer's active bookings.
   */
  async handleListBookings(
    customerPhone: string,
    businessId: string,
    businessName: string
  ): Promise<IntelligenceOutput> {
    const bookings = await bookingService.getCustomerBookings(customerPhone, businessId);

    if (bookings.length === 0) {
      return {
        replyText: `You have no upcoming bookings at *${businessName}*.\n\nWould you like to reserve a table now?`,
        replyType: 'buttons',
        buttons: [
          { id: 'action_book', title: '📅 Book a Table' },
          { id: 'action_pricing', title: '💰 View Pricing' }
        ]
      };
    }

    let msg = `*Your Upcoming Bookings at ${businessName}:*\n\n`;
    const buttons: Array<{ id: string; title: string }> = [];

    bookings.slice(0, 3).forEach((b, idx) => {
      const code = `QC-${b.id.substring(0, 6).toUpperCase()}`;
      msg += `*${idx + 1}. ${code}* — ${b.game_type.toUpperCase()}\n📅 Date: ${b.booking_date} at ${b.start_time.substring(0, 5)}\n🏓 Table: ${b.table_id}\n\n`;
      if (idx === 0) {
        buttons.push({ id: `cancel_${b.id}`, title: `❌ Cancel ${code}` });
      }
    });

    buttons.push({ id: 'action_book', title: '📅 New Booking' });

    return {
      replyText: msg.trim(),
      replyType: 'buttons',
      buttons
    };
  },

  /**
   * Handles cancellation intent.
   */
  async handleCancelIntent(
    customerPhone: string,
    businessId: string,
    businessName: string
  ): Promise<IntelligenceOutput> {
    const bookings = await bookingService.getCustomerBookings(customerPhone, businessId);
    if (bookings.length === 0) {
      return {
        replyText: `You don't have any active reservations at *${businessName}* to cancel.`,
        replyType: 'buttons',
        buttons: [{ id: 'action_book', title: '📅 Book a Table' }]
      };
    }

    const b = bookings[0];
    const code = `QC-${b.id.substring(0, 6).toUpperCase()}`;

    return {
      replyText: `Would you like to cancel your upcoming reservation *${code}* on ${b.booking_date} at ${b.start_time.substring(0, 5)}?`,
      replyType: 'buttons',
      buttons: [
        { id: `cancel_${b.id}`, title: '❌ Yes, Cancel Booking' },
        { id: 'action_my_bookings', title: 'Keep Reservation' }
      ]
    };
  },

  /**
   * Handles reschedule intent.
   */
  async handleRescheduleIntent(
    customerPhone: string,
    businessId: string,
    businessName: string
  ): Promise<IntelligenceOutput> {
    const bookings = await bookingService.getCustomerBookings(customerPhone, businessId);
    if (bookings.length === 0) {
      return {
        replyText: `You don't have any active bookings at *${businessName}* to reschedule. Would you like to make a new reservation?`,
        replyType: 'buttons',
        buttons: [{ id: 'action_book', title: '📅 Book a Table' }]
      };
    }

    const b = bookings[0];
    return {
      replyText: `To reschedule your booking *QC-${b.id.substring(0, 6).toUpperCase()}*, please select a new date:`,
      replyType: 'buttons',
      buttons: [
        { id: 'date_tomorrow', title: '📅 Tomorrow' },
        { id: `cancel_${b.id}`, title: '❌ Cancel Booking' }
      ],
      nextStep: 'AWAITING_DATE',
      updatedContext: { existing_booking_id: b.id, game_type: b.game_type, business_name: businessName }
    };
  },

  /**
   * Finds the lowest-priced available table across clubs or within the current club.
   */
  async handleCheapestTableRequest(
    businessId: string,
    businessName: string,
    customerPhone: string
  ): Promise<IntelligenceOutput> {
    const recommendations = await clubDiscoveryService.discoverAndRankClubs({
      gameType: 'pool',
      dateStr: getCurrentISTDateStr()
    });

    if (recommendations.length === 0) {
      return {
        replyText: `Sorry, no available tables were found for today at this moment.`,
        replyType: 'buttons',
        buttons: [{ id: 'date_tomorrow', title: '📅 Try Tomorrow' }]
      };
    }

    const lowest = recommendations[0];
    return {
      replyText: `*Lowest-priced available table:* 🎱\n\n*Club:* ${lowest.businessName}\n*Rate:* *₹${lowest.ratePerHour}/hr*\n*Address:* ${lowest.address}\n*Reason:* ${lowest.recommendationReason}\n\nAvailable slots today: ${lowest.sampleAvailableSlots.join(', ')}.\n\nWould you like to book a slot?`,
      replyType: 'buttons',
      buttons: [
        { id: 'action_book', title: '📅 Book This Table' },
        { id: 'action_discover_clubs', title: '📍 Other Clubs' }
      ]
    };
  },

  /**
   * Location-aware club discovery.
   */
  async handleClubDiscovery(areaQuery: string, customerPhone: string, gameType = 'pool'): Promise<IntelligenceOutput> {
    if (!areaQuery) {
      return {
        replyText: `Which area would you like to play in? (e.g. *Kothrud*, *Baner*, *FC Road*, *Viman Nagar*, or *Wakad*)`,
        replyType: 'buttons',
        buttons: [
          { id: 'area_kothrud', title: '📍 Kothrud' },
          { id: 'area_baner', title: '📍 Baner' },
          { id: 'area_fcroad', title: '📍 FC Road' }
        ]
      };
    }

    const recommendations = await clubDiscoveryService.discoverAndRankClubs({
      locationQuery: areaQuery,
      gameType
    });

    if (recommendations.length === 0) {
      return {
        replyText: `No partner clubs found in *${areaQuery}*. We have active clubs in *Kothrud*, *Baner*, *FC Road*, and *Viman Nagar*. Which area would you like to explore?`,
        replyType: 'buttons',
        buttons: [
          { id: 'area_kothrud', title: '📍 Kothrud' },
          { id: 'area_baner', title: '📍 Baner' },
          { id: 'area_fcroad', title: '📍 FC Road' }
        ]
      };
    }

    let msg = `*Clubs near ${areaQuery.toUpperCase()}:* 🎱\n\n`;
    recommendations.slice(0, 3).forEach((r, idx) => {
      msg += `*${idx + 1}. ${r.businessName}*\n📍 ${r.address}\n💰 ₹${r.ratePerHour}/hr (${r.matchedGameType.toUpperCase()})\n✨ *${r.recommendationReason}*\n⏰ Slots: ${r.sampleAvailableSlots.join(', ') || 'Call club'}\n\n`;
    });

    return {
      replyText: msg.trim(),
      replyType: 'buttons',
      buttons: [
        { id: 'action_book', title: '📅 Book Now' },
        { id: 'action_pricing', title: '💰 View Rates' }
      ]
    };
  },

  /**
   * Formats pricing guide including verified membership discount.
   */
  async formatPricingGuide(businessId: string, businessName: string, customerPhone: string): Promise<string> {
    const business = await businessManager.getBusiness(businessId);
    const cleanPhone = customerPhone.replace(/\D/g, '');

    // Check customer membership status
    const { data: member } = await supabase
      .from('memberships')
      .select('name, tier, status')
      .eq('business_id', businessId)
      .or(`mobile.eq.${customerPhone},mobile.eq.${cleanPhone}`)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    const rules = business?.pricing_rules?.rules || {};
    const poolRate = rules.pool?.rate || 200;
    const snookerRate = rules.snooker?.rate || 300;
    const ps5Rate = rules.ps5?.rate || 250;

    let memberNote = '';
    if (member) {
      memberNote = `\n🎖️ *Member Benefit:* You are registered as a *${member.tier || 'Gold'} Member*! Your 10% discount is automatically applied on every session.\n`;
    } else {
      memberNote = `\n💡 *Tip:* Ask club staff about our Membership Plans for discounts on every session!\n`;
    }

    return `*${businessName} — Pricing Guide:* 💰\n\n🎱 *Pool:* ₹${poolRate}/hr\n🔴 *Snooker:* ₹${snookerRate}/hr\n🎮 *PS5:* ₹${ps5Rate}/hr${memberNote}\nAll rates are calculated dynamically with fair per-minute billing.`;
  },

  /**
   * Helper to extract locality from text.
   */
  extractAreaFromText(text: string): string {
    const areas = ['kothrud', 'baner', 'fc road', 'deccan', 'viman nagar', 'wakad', 'camp', 'pune'];
    for (const a of areas) {
      if (text.includes(a)) return a;
    }
    return '';
  }
};
