import { supabase } from '@/lib/supabaseClient';
import { bookingService } from '@/lib/services/bookingService';
import { clubDiscoveryService } from '@/lib/services/clubDiscoveryService';
import { venuePhotoService } from '@/lib/services/venuePhotoService';
import { googleRatingsService } from '@/lib/services/googleRatingsService';
import { whatsappRepository } from '@/lib/repositories/whatsappRepository';
import { getCurrentISTDateStr } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';
import { getGoogleMapsDirectionsUrl, formatBookingConfirmationWhatsApp } from '@/lib/utils/locationUtils';
import { resolveBusinessConfig, getCurrentOperatingDay, formatTimeTo12Hour, DEFAULT_OPERATING_HOURS } from '@/lib/utils/operatingDayUtils';

export interface IntelligenceInput {
  incomingText: string;
  senderPhone: string;
  businessId: string;
  businessName: string;
  buttonReplyId?: string | null;
  listReplyId?: string | null;
  businessProfile?: any;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
}

export interface IntelligenceOutput {
  replyText: string;
  replyType: 'text' | 'buttons' | 'list';
  buttons?: Array<{ id: string; title: string }>;
  listData?: {
    buttonText: string;
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  };
  images?: Array<{ url: string; caption?: string }>;
  nextStep?: string;
  updatedContext?: Record<string, any>;
  clearState?: boolean;
}

export const qcontrolIntelligence = {
  /**
   * Main entry point to process a customer message intelligently with strict zero-hallucination guarantees.
   */
  async processCustomerMessage(input: IntelligenceInput): Promise<IntelligenceOutput> {
    const { incomingText, senderPhone, businessId, businessName, buttonReplyId, listReplyId, businessProfile } = input;
    const cleanPhone = senderPhone.replace(/\D/g, '');
    const rawText = (buttonReplyId || listReplyId || incomingText || '').trim();
    const lower = rawText.toLowerCase();

    // Handle incoming WhatsApp GPS location pin
    if (input.location) {
      return await this.handleNearbyClubs(input.location.latitude, input.location.longitude, cleanPhone);
    }

    // 1. Fetch current conversation state from repository
    const state = await whatsappRepository.getState(cleanPhone);
    const currentStep = state?.current_step;
    const context = state?.context || {};

    // 2. Fetch business context (with fresh DB values to reflect instant dashboard profile edits)
    const business = businessProfile || await businessManager.getBusiness(businessId, true);
    const bName = business?.business_name || businessName || 'QControl';

    // 2.1 Handle in-progress multi-turn steps before broad intent classification
    if (currentStep === 'AWAITING_PLAYERS' && !rawText.startsWith('action_') && !/^(hi|hello|hey|cancel|exit)\b/i.test(rawText.trim())) {
      const output = await this.handleAwaitingPlayersStep(rawText, cleanPhone, businessId, bName, context, business);
      if (output.clearState) {
        await whatsappRepository.clearState(cleanPhone);
      } else if (output.nextStep) {
        await whatsappRepository.updateState(cleanPhone, businessId, output.nextStep, output.updatedContext || context, 'CLUB');
      }
      return output;
    }

    if (currentStep === 'AWAITING_NAME' && !rawText.startsWith('action_') && !/^(hi|hello|hey|cancel|exit)\b/i.test(rawText.trim())) {
      const customerName = rawText.trim();
      if (customerName) {
        const output = await this.finalizeBookingWithName(customerName, cleanPhone, businessId, bName, context);
        if (output.clearState) {
          await whatsappRepository.clearState(cleanPhone);
        } else if (output.nextStep) {
          await whatsappRepository.updateState(cleanPhone, businessId, output.nextStep, output.updatedContext || context, 'CLUB');
        }
        return output;
      }
    }

    // 3. Handle explicit state-machine button / interactive clicks first
    const interactiveId = buttonReplyId || listReplyId || (rawText.startsWith('action_') || rawText.startsWith('cancel_') || rawText.startsWith('game_') || rawText.startsWith('select_biz_') ? rawText : null);

    if (interactiveId) {
      if (interactiveId.startsWith('select_biz_')) {
        return {
          replyText: `Welcome to *${bName}*! 🎱\n\nHow can we help you today? You can check table availability, book a game, view photos or view our rates:`,
          replyType: 'buttons',
          buttons: [
            { id: 'action_book', title: '📅 Book a Table' },
            { id: 'action_venue_photos', title: '📸 Photos' },
            { id: 'action_pricing', title: '💰 View Rates' }
          ],
          nextStep: 'AWAITING_ACTION',
          updatedContext: { business_name: bName }
        };
      }

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
            { id: 'action_venue_photos', title: '📸 Photos' },
            { id: 'action_my_bookings', title: '📋 My Bookings' }
          ]
        };
      }

      if (interactiveId === 'action_venue_photos') {
        return await this.handleVenuePhotos(businessId, bName, cleanPhone);
      }

      if (interactiveId === 'action_google_rating' || interactiveId === 'action_rating') {
        return await this.handleGoogleRating(businessId, bName, cleanPhone);
      }

      if (interactiveId === 'action_nearby' || interactiveId === 'action_nearby_clubs') {
        return this.handleNearbyPrompt();
      }

      if (interactiveId === 'action_club_info' || interactiveId === 'action_location' || interactiveId === 'action_contact') {
        return await this.handleClubProfileInfo(business, bName, cleanPhone);
      }

      if (interactiveId === 'action_my_bookings') {
        return await this.handleListBookings(cleanPhone, businessId, bName);
      }

      if (interactiveId === 'action_explore_clubs' || interactiveId === 'action_switch_club') {
        return await this.handleGlobalDiscovery('action_explore_clubs', cleanPhone);
      }

      if (interactiveId === 'action_support') {
        return await this.handleCentralSupport();
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
        const addressSnippet = business?.address ? `\n📍 *Address:* ${business.address}` : '';
        return {
          replyText: `*Welcome to ${bName}!* 🎱${addressSnippet}\n\nHi! I'm your virtual club assistant. I can help you check table availability, book a game, view pricing or view club details.\n\nWhat would you like to do?`,
          replyType: 'buttons',
          buttons: [
            { id: 'action_availability', title: '🎱 Check Tables' },
            { id: 'action_pricing', title: '💰 View Pricing' },
            { id: 'action_club_info', title: '📍 Location & Info' }
          ],
          nextStep: 'AWAITING_ACTION',
          updatedContext: { business_name: bName }
        };
      }

      case 'ADDRESS_INQUIRY':
      case 'CONTACT_INQUIRY':
      case 'CLUB_INFO_INQUIRY': {
        return await this.handleClubProfileInfo(business, bName, cleanPhone);
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

      case 'VENUE_PHOTOS': {
        return await this.handleVenuePhotos(businessId, bName, cleanPhone);
      }

      case 'GOOGLE_RATING': {
        return await this.handleGoogleRating(businessId, bName, cleanPhone);
      }

      case 'NEARBY_CLUBS': {
        return this.handleNearbyPrompt();
      }

      case 'UNSUPPORTED_REQUEST': {
        return this.handleUnsupportedRequest(business, bName);
      }

      case 'PLAYER_LIMIT_INQUIRY': {
        return this.handlePlayerLimitInquiry(business, bName, lower);
      }

      case 'LOCATION_DISCOVERY': {
        const area = this.extractAreaFromText(lower);
        return await this.handleClubDiscovery(area, cleanPhone);
      }

      default: {
        // Fallback: check if we are in an in-progress flow
        if (currentStep === 'AWAITING_PLAYERS') {
          return await this.handleAwaitingPlayersStep(rawText, cleanPhone, businessId, bName, context, business);
        }
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
    // 1. Greetings & Deep-Link ingress
    if (/^(hi|hello|hey|namaste|hi bro|kem cho|yo|hola|good morning|good evening)\b/i.test(text) || text.includes('qc_') || text.startsWith('book at')) {
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

    // 6. Player limit inquiry (e.g. "PS5 ke liye kitne players allowed hain?", "how many players allowed")
    if (
      (text.includes('kitne player') || text.includes('kitne log') || text.includes('how many player') || text.includes('max player') || text.includes('maximum player') || text.includes('player limit') || text.includes('allowed hain') || text.includes('allowed hai') || text.includes('kitne log khel')) &&
      (text.includes('allowed') || text.includes('khel sakte') || text.includes('limit') || text.includes('ps5') || text.includes('playstation') || text.includes('pool') || text.includes('snooker') || text.includes('table'))
    ) {
      return 'PLAYER_LIMIT_INQUIRY';
    }

    // 7. Pricing / Membership discount
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

    // 8. Cheapest table
    if (text.includes('cheapest') || text.includes('lowest') || text.includes('sasta') || text.includes('budget')) {
      return 'BOOK_CHEAPEST';
    }

    // 9. Address & Location Inquiry for current club
    if (
      text.includes('address') ||
      text.includes('location') ||
      text.includes('kaha hai') ||
      text.includes('kaha par hai') ||
      text.includes('kaha pe hai') ||
      text.includes('kidhar hai') ||
      text.includes('where is the club') ||
      text.includes('where are you') ||
      text.includes('directions') ||
      text.includes('rasta') ||
      text.includes('map link')
    ) {
      return 'ADDRESS_INQUIRY';
    }

    // 10. Contact / Manager / Staff Inquiry
    if (
      text.includes('contact') ||
      text.includes('phone') ||
      text.includes('number') ||
      text.includes('mobile') ||
      text.includes('manager') ||
      text.includes('owner') ||
      text.includes('staff') ||
      text.includes('human') ||
      text.includes('call') ||
      text.includes('helpdesk') ||
      text.includes('baat karni')
    ) {
      return 'CONTACT_INQUIRY';
    }

    // 11. Club Profile / Info
    if (
      text.includes('about the club') ||
      text.includes('club details') ||
      text.includes('facilities') ||
      text.includes('timing') ||
      text.includes('open kab') ||
      text.includes('opening hours') ||
      text.includes('club info')
    ) {
      return 'CLUB_INFO_INQUIRY';
    }

    // 12. Venue Photos & Ambience Inquiry
    if (
      text.includes('photo') ||
      text.includes('photos') ||
      text.includes('pic') ||
      text.includes('pics') ||
      text.includes('picture') ||
      text.includes('pictures') ||
      text.includes('image') ||
      text.includes('images') ||
      text.includes('ambience') ||
      text.includes('ambiance') ||
      text.includes('gallery') ||
      text.includes('look like') ||
      text.includes('kaisa dikhta') ||
      text.includes('club ki photo')
    ) {
      return 'VENUE_PHOTOS';
    }

    // 13. Google Rating & Reviews Inquiry
    if (
      text.includes('google rating') ||
      text.includes('rating') ||
      text.includes('ratings') ||
      text.includes('review') ||
      text.includes('reviews') ||
      text.includes('feedback') ||
      text.includes('how good') ||
      text.includes('stars')
    ) {
      return 'GOOGLE_RATING';
    }

    // 14. Nearby Clubs Inquiry
    if (
      text.includes('near me') ||
      text.includes('nearby') ||
      text.includes('closest') ||
      text.includes('nearest') ||
      text.includes('around me') ||
      text.includes('close by') ||
      text.includes('paas mein') ||
      text.includes('aas paas') ||
      text.includes('around here')
    ) {
      return 'NEARBY_CLUBS';
    }

    // 15. Area Location discovery
    if (
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

    // 16. Unsupported sports or services (e.g. badminton, cricket, turf, bowling, swimming, etc.)
    const unsupportedSports = [
      'badminton', 'cricket', 'box cricket', 'turf', 'bowling', 'table tennis',
      'tennis', 'swimming', 'swim', 'squash', 'carrom', 'chess', 'gym',
      'arcade', 'foosball', 'pickleball', 'football', 'basketball', 'padel'
    ];
    const isUnsupported = unsupportedSports.some(sport => new RegExp(`\\b${sport}\\b`, 'i').test(text));
    const isSwimmingPool = /\b(swimming pool|swim pool|swimming)\b/i.test(text);
    const mentionsSupported = (
      /\b(snooker|msnooker|mini-snooker|mini snooker|ps5|ps-5|ps 5|playstation|play station|billiards|8-ball|8 ball)\b/i.test(text) ||
      (/\bpool\b/i.test(text) && !isSwimmingPool)
    );
    if (isUnsupported && !mentionsSupported) {
      return 'UNSUPPORTED_REQUEST';
    }

    // 17. Natural availability or booking request (Pool, Snooker, Mini-snooker, PS5/PlayStation)
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
      text.includes('ps5') ||
      text.includes('ps 5') ||
      text.includes('ps-5') ||
      text.includes('playstation') ||
      text.includes('play station') ||
      text.includes('mini-snooker') ||
      text.includes('mini snooker') ||
      text.includes('msnooker') ||
      text.includes('khelna') ||
      text.includes('khelne') ||
      text.includes('gaming') ||
      text.includes('game')
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
    // 1. Detect game type
    let gameType = 'pool';
    if (/\b(mini-snooker|mini snooker|msnooker)\b/i.test(text)) {
      gameType = 'msnooker';
    } else if (/\b(snooker|snuker)\b/i.test(text)) {
      gameType = 'snooker';
    } else if (/\b(ps5|ps 5|ps-5|playstation|play station)\b/i.test(text)) {
      gameType = 'ps5';
    } else if (/\b(pool|billiards?)\b/i.test(text)) {
      gameType = 'pool';
    }

    // 2. Detect duration (supports "for two hours", "2 hrs", "90 mins", "2 ghante", "1 ghanta", "aadha ghanta", etc.)
    let durationMins = 60;
    if (/\b(2|two|do)\s*(hours?|hrs?|ghante|ghanta)\b/i.test(text)) durationMins = 120;
    else if (/\b(3|three|teen)\s*(hours?|hrs?|ghante|ghanta)\b/i.test(text)) durationMins = 180;
    else if (/\b(90|ninety)\s*(mins?|minutes?)\b|\b1\.5\s*hours?\b|\bdedh\s*ghante?\b/i.test(text)) durationMins = 90;
    else if (/\b(30|thirty)\s*(mins?|minutes?)\b|\bhalf\s*(an\s*)?hour\b|\b(adha|aadha)\s*ghanta\b/i.test(text)) durationMins = 30;
    else if (/\b(1|one|ek)\s*(hour|hr|ghanta)\b/i.test(text)) durationMins = 60;

    // 3. Resolve business config & operating day
    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return {
        replyText: `Sorry, we could not find active records for *${businessName}*.`,
        replyType: 'text'
      };
    }
    const bConfig = resolveBusinessConfig(business);

    const todayStr = getCurrentOperatingDay(bConfig);
    let dateStr = todayStr;
    let dateDisplay = 'Today';

    if (text.includes('kal') || text.includes('tomorrow')) {
      const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
      nowIst.setDate(nowIst.getDate() + 1);
      dateStr = nowIst.toISOString().split('T')[0];
      dateDisplay = 'Tomorrow';
    } else if (text.includes('parso') || text.includes('day after tomorrow')) {
      const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
      nowIst.setDate(nowIst.getDate() + 2);
      dateStr = nowIst.toISOString().split('T')[0];
      dateDisplay = 'Day after tomorrow';
    }

    // 4. Detect time (supports 1 AM, 12 AM, 2 AM, midnight, raat 1 baje, 11:30 PM, etc.)
    let reqTime: string | null = null;
    let reqMins = 19 * 60; // 7 PM default

    if (text.includes('midnight') || text.includes('aadha raat') || text.includes('aadhi raat')) {
      reqTime = '00:00';
      reqMins = 0;
    } else {
      const exactTimeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(pm|am|baje|o'?clock)?/i);
      if (exactTimeMatch) {
        let h = parseInt(exactTimeMatch[1], 10);
        const m = exactTimeMatch[2] ? parseInt(exactTimeMatch[2], 10) : 0;
        const suffix = (exactTimeMatch[3] || '').toLowerCase();
        const isNightMention = text.includes('raat') || text.includes('night') || text.includes('der raat') || text.includes('late');

        if (suffix === 'pm') {
          if (h < 12) h += 12;
        } else if (suffix === 'am') {
          if (h === 12) h = 0;
        } else if (suffix === 'baje' || !suffix || suffix.includes('clock')) {
          if (isNightMention && (h === 12 || h === 1 || h === 2 || h === 3)) {
            if (h === 12) h = 0;
            // 1, 2, 3 remain overnight AM hours
          } else if (isNightMention && h >= 7 && h <= 11) {
            h += 12;
          } else if (h >= 1 && h <= 6) {
            h += 12;
          } else if (h >= 7 && h <= 11) {
            h += 12;
          } else if (h === 12) {
            h = 12;
          }
        }

        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          reqTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          reqMins = h * 60 + m;
        }
      } else if (text.includes('evening') || text.includes('shaam')) {
        reqTime = '19:00';
        reqMins = 19 * 60;
      } else if (text.includes('night') || text.includes('raat')) {
        reqTime = '21:00';
        reqMins = 21 * 60;
      } else if (text.includes('afternoon') || text.includes('dopehar')) {
        reqTime = '15:00';
        reqMins = 15 * 60;
      } else if (text.includes('morning') || text.includes('subah')) {
        reqTime = '11:00';
        reqMins = 11 * 60;
      }
    }

    const tables = (business.tables || []).filter((t: any) => {
      const type = ((t as any).game_type || (t as any).type || 'pool').toLowerCase();
      if (gameType === 'snooker') return type === 'snooker' || type === 'msnooker';
      if (gameType === 'msnooker') return type === 'msnooker' || type === 'snooker';
      return type === gameType;
    });

    if (tables.length === 0) {
      return {
        replyText: `Sorry, *${businessName}* currently does not have ${gameType.toUpperCase()} tables registered. Would you like to check other clubs?`,
        replyType: 'buttons',
        buttons: [{ id: 'action_explore_clubs', title: '📍 Other Clubs' }]
      };
    }

    // 5. Player count parsing & validation
    const parsedPlayers = this.parsePlayerCount(text);
    let maxAllowed = 4;
    const configuredMaxes = tables.map((t: any) => t.max_players ? parseInt(t.max_players, 10) : 4).filter((n: number) => !isNaN(n) && n > 0);
    if (configuredMaxes.length > 0) {
      maxAllowed = Math.max(...configuredMaxes);
    }

    // If customer requested PS5 without specifying players, prompt with conversational follow-up
    if (gameType === 'ps5' && parsedPlayers === null) {
      const isHindi = /khelna|chahiye|bhai|baje|kitne|hoga|milega/i.test(text);
      const question = isHindi 
        ? `PS5 के लिए कितने लोग खेलेंगे? 🎮` 
        : `How many players will be playing? 🎮`;

      const playerButtons = [
        { id: 'players_1', title: '👤 1 Player' },
        { id: 'players_2', title: '👥 2 Players' },
        { id: 'players_3', title: '🎮 3 Players' },
        { id: 'players_4', title: '🎮 4 Players' }
      ].slice(0, maxAllowed);

      const pendingCtx = {
        game_type: 'ps5',
        booking_date: dateStr,
        start_time: reqTime,
        duration_minutes: durationMins,
        business_name: businessName
      };
      await whatsappRepository.updateState(customerPhone, businessId, 'AWAITING_PLAYERS', pendingCtx, 'CLUB');

      return {
        replyText: question,
        replyType: 'buttons',
        buttons: playerButtons,
        nextStep: 'AWAITING_PLAYERS',
        updatedContext: pendingCtx
      };
    }

    // If requested player count exceeds maximum configured, explain restriction
    if (parsedPlayers !== null && parsedPlayers > maxAllowed) {
      const pendingCtx = {
        game_type: gameType,
        booking_date: dateStr,
        start_time: reqTime,
        duration_minutes: durationMins,
        business_name: businessName
      };
      await whatsappRepository.updateState(customerPhone, businessId, 'AWAITING_PLAYERS', pendingCtx, 'CLUB');

      return {
        replyText: `Sorry, our ${gameType.toUpperCase()} stations allow a maximum of ${maxAllowed} players at a time. Would you like to continue the booking with ${maxAllowed} players?`,
        replyType: 'buttons',
        buttons: [
          { id: `players_${maxAllowed}`, title: `✅ Yes, ${maxAllowed} Players` },
          { id: 'action_book', title: '🔄 Choose Another Game' }
        ],
        nextStep: 'AWAITING_PLAYERS',
        updatedContext: pendingCtx
      };
    }

    const effectiveNumPlayers = parsedPlayers || 1;

    // 6. Pricing calculation
    const normGame = gameType.toLowerCase();
    const rules: any = business?.pricing_rules?.rules?.[normGame] || {};
    const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;
    const estimatedTotal = Math.round((ratePerHour * durationMins) / 60);

    // If customer specified a time:
    if (reqTime) {
      for (const table of tables) {
        const check = await bookingService.checkTableAvailability(businessId, table.id, dateStr, reqTime, durationMins);
        if (check.available) {
          const durationLabel = durationMins >= 60
            ? `${(durationMins / 60).toFixed(durationMins % 60 === 0 ? 0 : 1)} Hour${durationMins > 60 ? 's' : ''}`
            : `${durationMins} Minutes`;

          const context = {
            game_type: gameType,
            booking_date: dateStr,
            start_time: reqTime,
            table_id: table.id,
            duration_minutes: durationMins,
            num_players: effectiveNumPlayers,
            business_name: businessName
          };

          const formattedDisplay = formatTimeTo12Hour(reqTime);
          const stationLabel = gameType === 'ps5' 
            ? `*PS5 Station ${table.name || table.id}* (${effectiveNumPlayers} Player${effectiveNumPlayers > 1 ? 's' : ''})`
            : `*Table ${table.name || table.id}* (${gameType.toUpperCase()})`;

          return {
            replyText: `Great news! ${stationLabel} is available at *${businessName}* on ${dateDisplay} at *${formattedDisplay}* for ${durationLabel} (Rate: ₹${ratePerHour}/hr, Total: ₹${estimatedTotal}).\n\nPlease type your *Name* to confirm the reservation.`,
            replyType: 'text',
            nextStep: 'AWAITING_NAME',
            updatedContext: context
          };
        }
      }

      // If requested time is not available, find intelligent alternatives
      const smart = await bookingService.getSmartAlternatives(businessId, gameType, dateStr, reqTime, durationMins);
      if (smart.alternatives.length > 0) {
        const alternativeTimes = smart.alternatives.slice(0, 3).map(s => s.displayTime).join(', ');
        const reqDisplay = formatTimeTo12Hour(reqTime);
        return {
          replyText: `*${businessName}* is not available at *${reqDisplay}* for ${durationMins} minutes.\n\nHowever, we found these closest open slots for ${dateDisplay}:\n👉 *${alternativeTimes}*\n\nWhich slot would you prefer?`,
          replyType: 'buttons',
          buttons: smart.alternatives.slice(0, 3).map(s => ({
            id: `time_${s.time}_${s.tableId}`,
            title: `⏰ ${s.displayTime}`
          })),
          nextStep: 'AWAITING_TIME',
          updatedContext: {
            game_type: gameType,
            booking_date: dateStr,
            duration_minutes: durationMins,
            num_players: effectiveNumPlayers,
            business_name: businessName
          }
        };
      }
    }

    // If no specific time requested, show available slots
    const availableSlots = await bookingService.getAvailableSlots(businessId, gameType, dateStr, durationMins);
    if (availableSlots.length === 0) {
      return {
        replyText: `Sorry, all ${gameType.toUpperCase()} tables at *${businessName}* are fully booked for ${dateDisplay}. Would you like to check other dates or partner clubs?`,
        replyType: 'buttons',
        buttons: [
          { id: 'date_tomorrow', title: '📅 Try Tomorrow' },
          { id: 'action_explore_clubs', title: '📍 Other Clubs' }
        ]
      };
    }

    return {
      replyText: `Here are available *${gameType.toUpperCase()}* slots at *${businessName}* for ${dateDisplay} (₹${ratePerHour}/hr):`,
      replyType: 'buttons',
      buttons: availableSlots.slice(0, 3).map(s => ({
        id: `time_${s.time}_${s.tableId}`,
        title: `⏰ ${s.time}`
      })),
      nextStep: 'AWAITING_TIME',
      updatedContext: {
        game_type: gameType,
        booking_date: dateStr,
        duration_minutes: durationMins,
        num_players: effectiveNumPlayers,
        business_name: businessName
      }
    };
  },

  /**
   * Helper to parse requested player counts from digits or colloquial English / Hinglish terms.
   */
  parsePlayerCount(text: string): number | null {
    if (!text) return null;
    const clean = text.trim().toLowerCase();

    // Direct single digit "1", "2", "3", "4", "5", "6", "7", "8"
    if (/^[1-8]$/.test(clean)) {
      return parseInt(clean, 10);
    }

    // Explicit word mappings
    const words: Record<string, number> = {
      'one': 1, 'ek': 1, 'single': 1, 'solo': 1,
      'two': 2, 'do': 2, 'double': 2,
      'three': 3, 'teen': 3, 'tin': 3,
      'four': 4, 'char': 4, 'chaar': 4,
      'five': 5, 'panch': 5, 'paanch': 5,
      'six': 6, 'chhe': 6, 'che': 6,
      'seven': 7, 'saat': 7,
      'eight': 8, 'aath': 8
    };

    for (const [w, n] of Object.entries(words)) {
      if (new RegExp(`\\b${w}\\s*(players?|log|bande|jan|people|person)?\\b`, 'i').test(clean)) {
        if (!new RegExp(`\\b${w}\\s*(hours?|hrs?|ghante|ghanta)\\b`, 'i').test(clean)) {
          return n;
        }
      }
    }

    const digitMatch = clean.match(/\b([1-9]|10)\s*(players?|log|bande|jan|people|person|persons)?\b/i);
    if (digitMatch && digitMatch[1]) {
      const val = parseInt(digitMatch[1], 10);
      const isDurationOrHour = new RegExp(`\\b${val}\\s*(hours?|hrs?|ghante|ghanta|pm|am|baje|o'?clock|mins?|minutes?)\\b`, 'i').test(clean);
      const hasSuffix = Boolean(digitMatch[2]);
      if (hasSuffix || (!isDurationOrHour && val >= 1 && val <= 10)) {
        return val;
      }
    }

    return null;
  },

  /**
   * Politely handles requests for unsupported sports (badminton, cricket, turf, bowling, etc.)
   */
  handleUnsupportedRequest(business?: any, businessName?: string): IntelligenceOutput {
    const bName = business?.business_name || businessName || 'our partnered clubs';
    return {
      replyText: `Sorry, we currently help with pool, snooker, mini-snooker, and PS5 bookings at our partnered venues.\n\nWould you like help with any of these games at *${bName}*?`,
      replyType: 'buttons',
      buttons: [
        { id: 'game_pool', title: '🎱 Pool' },
        { id: 'game_snooker', title: '🔴 Snooker' },
        { id: 'game_ps5', title: '🎮 PS5' }
      ]
    };
  },

  /**
   * Factual inquiry handler for maximum players allowed on consoles and tables.
   */
  handlePlayerLimitInquiry(business: any, businessName: string, text: string): IntelligenceOutput {
    const isPs5 = /\b(ps5|ps-5|ps 5|playstation|play station|console)\b/i.test(text);
    const tables = business?.tables || [];
    const ps5Tables = tables.filter((t: any) => ((t as any).game_type || (t as any).type || '').toLowerCase() === 'ps5');
    
    let maxPlayers = 4;
    if (ps5Tables.length > 0) {
      const configured = ps5Tables.map((t: any) => t.max_players ? parseInt(t.max_players, 10) : 4).filter((n: number) => !isNaN(n) && n > 0);
      if (configured.length > 0) maxPlayers = Math.max(...configured);
    }

    if (isPs5 || !tables.some((t: any) => ((t as any).game_type || (t as any).type || '').toLowerCase() === 'pool')) {
      return {
        replyText: `Our PS5 gaming stations at *${businessName}* support up to *${maxPlayers} players* at a time with dedicated wireless controllers. 🎮\n\nWould you like to book a PS5 session?`,
        replyType: 'buttons',
        buttons: [
          { id: 'game_ps5', title: '🎮 Book PS5' },
          { id: 'action_pricing', title: '💰 View Rates' }
        ]
      };
    }

    return {
      replyText: `At *${businessName}*, our pool and snooker tables accommodate up to 4 players per game, while our PS5 gaming stations support up to *${maxPlayers} players* simultaneously. 🎱🎮\n\nWhich game would you like to book?`,
      replyType: 'buttons',
      buttons: [
        { id: 'game_pool', title: '🎱 Pool' },
        { id: 'game_snooker', title: '🔴 Snooker' },
        { id: 'game_ps5', title: '🎮 PS5' }
      ]
    };
  },

  /**
   * In-flight conversation handler when bot is awaiting player count.
   */
  async handleAwaitingPlayersStep(
    rawText: string,
    cleanPhone: string,
    businessId: string,
    bName: string,
    context: Record<string, any>,
    business?: any
  ): Promise<IntelligenceOutput> {
    let requestedPlayers: number | null = null;
    if (rawText.startsWith('players_')) {
      requestedPlayers = parseInt(rawText.replace('players_', ''), 10) || null;
    } else {
      requestedPlayers = this.parsePlayerCount(rawText) || parseInt(rawText.replace(/\D/g, ''), 10) || null;
    }

    const tables = business?.tables || [];
    const ps5Tables = tables.filter((t: any) => ((t as any).game_type || (t as any).type || '').toLowerCase() === (context.game_type || 'ps5'));
    let maxAllowed = 4;
    if (ps5Tables.length > 0) {
      const configured = ps5Tables.map((t: any) => t.max_players ? parseInt(t.max_players, 10) : 4).filter((n: number) => !isNaN(n) && n > 0);
      if (configured.length > 0) maxAllowed = Math.max(...configured);
    }

    if (requestedPlayers && requestedPlayers > maxAllowed) {
      return {
        replyText: `Sorry, our ${context.game_type ? context.game_type.toUpperCase() : 'PS5'} stations allow a maximum of ${maxAllowed} players at a time. Would you like to continue the booking with ${maxAllowed} players?`,
        replyType: 'buttons',
        buttons: [
          { id: `players_${maxAllowed}`, title: `✅ Yes, ${maxAllowed} Players` },
          { id: 'action_book', title: '🔄 Choose Another Game' }
        ],
        nextStep: 'AWAITING_PLAYERS',
        updatedContext: context
      };
    }

    if (requestedPlayers && requestedPlayers >= 1 && requestedPlayers <= maxAllowed) {
      context.num_players = requestedPlayers;

      if (context.start_time && context.booking_date) {
        const check = await bookingService.checkTableAvailability(
          businessId,
          context.table_id || ps5Tables[0]?.id || 'PS1',
          context.booking_date,
          context.start_time,
          context.duration_minutes || 60
        );

        if (check.available) {
          const formattedDisplay = formatTimeTo12Hour(context.start_time);
          return {
            replyText: `Great news! *PS5 Station ${context.table_id || ps5Tables[0]?.name || 'PS1'}* is available for *${requestedPlayers} player${requestedPlayers > 1 ? 's' : ''}* at *${bName}* at *${formattedDisplay}*.\n\nPlease type your *Name* to confirm the reservation.`,
            replyType: 'text',
            nextStep: 'AWAITING_NAME',
            updatedContext: context
          };
        }
      }

      return {
        replyText: `When would you like to book at *${bName}*?`,
        replyType: 'buttons',
        buttons: [
          { id: 'date_today', title: '📅 Today' },
          { id: 'date_tomorrow', title: '📅 Tomorrow' }
        ],
        nextStep: 'AWAITING_DATE',
        updatedContext: context
      };
    }

    return {
      replyText: `How many players will be playing? (1 to ${maxAllowed} players allowed) 🎮`,
      replyType: 'buttons',
      buttons: [
        { id: 'players_1', title: '👤 1 Player' },
        { id: 'players_2', title: '👥 2 Players' },
        { id: 'players_3', title: '🎮 3 Players' },
        { id: 'players_4', title: '🎮 4 Players' }
      ].slice(0, maxAllowed),
      nextStep: 'AWAITING_PLAYERS',
      updatedContext: context
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

    const durationMinutes = Number(context.duration_minutes) || 60;

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
      duration_minutes: durationMinutes,
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
    const business = await businessManager.getBusiness(businessId);

    const normGame = gameType.toLowerCase();
    const rules: any = business?.pricing_rules?.rules?.[normGame] || {};
    const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;
    const estimatedTotal = Math.round((ratePerHour * durationMinutes) / 60);
    const clubPhone = business?.public_contact_number || business?.contact_number;

    const confirmationText = formatBookingConfirmationWhatsApp({
      bookingId: booking.id,
      customerName,
      businessName,
      gameType,
      tableId: tableId,
      bookingDate,
      startTime,
      durationMinutes,
      numPlayers,
      ratePerHour,
      estimatedTotal,
      paymentStatus: 'pay_on_arrival',
      status: 'confirmed',
      address: business?.address,
      contactNumber: clubPhone,
      latitude: (business as any)?.latitude,
      longitude: (business as any)?.longitude
    });

    return {
      replyText: confirmationText,
      replyType: 'buttons',
      buttons: [
        { id: 'action_my_bookings', title: '📋 View Bookings' },
        { id: `cancel_${booking.id}`, title: '❌ Cancel Booking' }
      ],
      clearState: true
    };
  },

  /**
   * Generates a comprehensive, verified business profile response using live database values.
   */
  async handleClubProfileInfo(business: any, bName: string, cleanPhone: string): Promise<IntelligenceOutput> {
    const addressStr = business?.address ? `📍 *Address:* ${business.address}` : '📍 *Address:* Address not configured yet';
    const contactStr = business?.contact_number ? `📞 *Contact Number:* +91 ${business.contact_number}` : '📞 *Contact:* Not configured yet';
    const ownerStr = business?.owner_name ? `👤 *Owner / Manager:* ${business.owner_name}` : '';
    const typeStr = business?.business_type ? `🏷️ *Category:* ${business.business_type}` : '🏷️ *Category:* Pool & Billiards Lounge';

    const tables = business?.tables || [];
    const gamesOffered = Array.from(new Set(tables.map((t: any) => ((t.game_type || t.type || 'Pool') as string).toUpperCase()))).join(', ') || 'Pool, Snooker, PS5';

    let msg = `*${bName} — Club Details* 🎱\n\n`;
    msg += `${typeStr}\n`;
    if (ownerStr) msg += `${ownerStr}\n`;
    msg += `${contactStr}\n`;
    msg += `${addressStr}\n`;

    // Fetch Google Rating if configured/cached
    if (business?.id) {
      const ratingData = await googleRatingsService.getRating(business.id);
      if (ratingData.rating !== null) {
        msg += `${googleRatingsService.formatRatingDisplay(ratingData)}\n`;
      }
    }

    if (business?.address) {
      const directionsUrl = getGoogleMapsDirectionsUrl({
        address: business.address,
        businessName: bName,
        latitude: (business as any)?.latitude,
        longitude: (business as any)?.longitude
      });
      msg += `🗺️ *Get Directions:* ${directionsUrl}\n`;
    }

    msg += `🎮 *Available Tables:* ${tables.length} tables (${gamesOffered})\n\n`;
    msg += `Everything is synced live from our club profile. What would you like to do next?`;

    return {
      replyText: msg,
      replyType: 'buttons',
      buttons: [
        { id: 'action_book', title: '📅 Book a Table' },
        { id: 'action_venue_photos', title: '📸 View Photos' },
        { id: 'action_pricing', title: '💰 View Rates' }
      ]
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

    const business = await businessManager.getBusiness(businessId);
    if (business?.address) {
      const directionsUrl = getGoogleMapsDirectionsUrl({
        address: business.address,
        businessName,
        latitude: (business as any)?.latitude,
        longitude: (business as any)?.longitude
      });
      msg += `📍 *Club Location:* ${business.address}\n🗺️ *Get Directions:* ${directionsUrl}\n\n`;
    }

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

    const topRecs = recommendations.slice(0, 3);
    const buttons = topRecs.map(r => {
      let title = r.businessName;
      if (title.length > 17) {
        title = title.substring(0, 14) + '...';
      }
      return {
        id: `select_biz_${r.businessId}`,
        title: `🎱 ${title}`
      };
    });

    return {
      replyText: msg.trim(),
      replyType: 'buttons',
      buttons: buttons.length > 0 ? buttons : [
        { id: 'action_book', title: '📅 Book Now' },
        { id: 'action_pricing', title: '💰 View Rates' }
      ]
    };
  },

  /**
   * Handles global discovery when a user contacts the central WhatsApp number
   * without an active club context or when switching clubs.
   */
  async handleGlobalDiscovery(queryText: string, customerPhone: string): Promise<IntelligenceOutput> {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const cleanQuery = (queryText || '').toLowerCase().trim();

    // 1. Handle Nearby Lounges
    if (cleanQuery === 'action_nearby_clubs' || cleanQuery === 'action_nearby' || cleanQuery.includes('nearby') || cleanQuery.includes('near me') || cleanQuery.includes('closest')) {
      return this.handleNearbyPrompt();
    }

    // 2. Handle Explore Partner Clubs
    if (cleanQuery === 'action_explore_clubs' || cleanQuery.includes('explore partner') || cleanQuery === 'explore' || cleanQuery === 'directory') {
      return await this.handleExplorePartnerClubs(cleanPhone);
    }

    // 3. Handle Book a Table
    if (cleanQuery === 'action_book_table' || cleanQuery === 'action_book' || cleanQuery.includes('book a table') || cleanQuery === 'book table') {
      return await this.handleGlobalBookTable(cleanPhone);
    }

    // 4. Handle View / Manage My Bookings
    if (cleanQuery === 'action_my_bookings' || cleanQuery.includes('my booking') || cleanQuery.includes('manage booking')) {
      return await this.handleGlobalMyBookings(cleanPhone);
    }

    // 5. Handle Find Games and Prices
    if (cleanQuery === 'action_games_prices' || cleanQuery.includes('games and prices') || cleanQuery.includes('rates') || cleanQuery.includes('pricing')) {
      return await this.handleCentralPricingGuide(cleanPhone);
    }

    // 6. Handle Get Directions
    if (cleanQuery === 'action_get_directions' || cleanQuery.includes('direction') || cleanQuery.includes('location') || cleanQuery.includes('maps')) {
      return await this.handleGlobalDirections(cleanPhone);
    }

    // 7. Handle Contact Support
    if (cleanQuery === 'action_support' || cleanQuery.includes('support') || cleanQuery.includes('contact support') || cleanQuery.includes('helpline')) {
      return await this.handleCentralSupport();
    }

    // 8. Handle Cancel Booking Action
    if (cleanQuery.startsWith('cancel_')) {
      const bookingId = queryText.replace('cancel_', '').trim();
      const cancelResult = await bookingService.cancelBooking(bookingId, cleanPhone);
      if (cancelResult.success) {
        return {
          replyText: `✅ Your booking (*QC-${bookingId.substring(0, 6).toUpperCase()}*) has been successfully cancelled and the table is released.\n\nWould you like to explore other partner clubs or book another time?`,
          replyType: 'buttons',
          buttons: [
            { id: 'action_book_table', title: '📅 Book a Table' },
            { id: 'action_explore_clubs', title: '🔍 Explore Clubs' },
            { id: 'action_my_bookings', title: '📋 My Bookings' }
          ],
          clearState: true
        };
      } else {
        return {
          replyText: `Could not cancel booking: ${cancelResult.reason || 'Reservation not found or unauthorized'}.`,
          replyType: 'buttons',
          buttons: [
            { id: 'action_my_bookings', title: '📋 My Bookings' },
            { id: 'action_support', title: '💬 Contact Support' }
          ],
          clearState: true
        };
      }
    }

    // 9. Handle Filters
    if (cleanQuery.startsWith('filter_area_')) {
      const area = cleanQuery.replace('filter_area_', '');
      return await this.handleClubDiscovery(area, cleanPhone);
    }
    if (cleanQuery.startsWith('filter_game_')) {
      const game = cleanQuery.replace('filter_game_', '');
      return await this.handleClubDiscovery('', cleanPhone, game);
    }

    const detectedArea = this.extractAreaFromText(cleanQuery);
    if (detectedArea) {
      return await this.handleClubDiscovery(detectedArea, cleanPhone);
    }

    // 10. Standard Centralized Welcome with interactive options
    return {
      replyText: (
        `Welcome to *QControl*! 🎱\n\n` +
        `Your official centralized discovery and booking assistant for premium billiards, snooker, and gaming clubs.\n\n` +
        `Discover verified partner clubs, check real-time table availability, and manage reservations all in one place.\n\n` +
        `How can we help you today? Please choose an option below:`
      ),
      replyType: 'list',
      listData: {
        buttonText: 'Choose Option',
        sections: [
          {
            title: 'Booking & Discovery',
            rows: [
              {
                id: 'action_nearby_clubs',
                title: '📍 Find Lounges Near Me',
                description: 'Discover closest clubs via GPS location'
              },
              {
                id: 'action_explore_clubs',
                title: '🔍 Explore Partner Clubs',
                description: 'Browse verified clubs, areas & amenities'
              },
              {
                id: 'action_book_table',
                title: '📅 Book a Table',
                description: 'Select a club and reserve a table'
              },
              {
                id: 'action_my_bookings',
                title: '📋 My Bookings',
                description: 'Check or cancel upcoming reservations'
              }
            ]
          },
          {
            title: 'Information & Support',
            rows: [
              {
                id: 'action_games_prices',
                title: '💰 Games & Prices',
                description: 'View pool, snooker & PS5 rates'
              },
              {
                id: 'action_get_directions',
                title: '🗺️ Get Directions',
                description: 'Locate clubs with Google Maps navigation'
              },
              {
                id: 'action_support',
                title: '💬 Contact Support',
                description: 'Talk to QControl concierge or helpline'
              }
            ]
          }
        ]
      }
    };
  },

  /**
   * Explores verified partner clubs across the centralized network with rich metadata.
   */
  async handleExplorePartnerClubs(customerPhone: string): Promise<IntelligenceOutput> {
    const recommendations = await clubDiscoveryService.discoverAndRankClubs({
      dateStr: getCurrentISTDateStr()
    });

    if (recommendations.length === 0) {
      return {
        replyText: `Currently, there are no active clubs registered on the platform. Please check back shortly or contact our support team.`,
        replyType: 'buttons',
        buttons: [{ id: 'action_support', title: '💬 Contact Support' }]
      };
    }

    let directoryText = `*Verified QControl Partner Clubs:* 🎱\n\n`;
    recommendations.slice(0, 5).forEach((c, idx) => {
      const games = c.availableGames.join(', ') || 'Pool, Snooker';
      const rates = Object.entries(c.pricingBreakdown).map(([g, r]) => `${g.toUpperCase()}: ₹${r}/hr`).join(' • ');
      directoryText += `*${idx + 1}. ${c.businessName}*\n`;
      directoryText += `📍 ${c.address}\n`;
      if (c.googleRatingDisplay) {
        directoryText += `${c.googleRatingDisplay}\n`;
      }
      directoryText += `🎮 *Games:* ${games}\n`;
      directoryText += `⏰ *Hours:* ${c.operatingHours}\n`;
      directoryText += `💰 *Rates:* ${rates}\n`;
      if (c.directionsUrl) {
        directoryText += `🗺️ *Directions:* ${c.directionsUrl}\n`;
      }
      directoryText += `\n`;
    });

    directoryText += `💡 Select your club below to check live table availability and book a slot:`;

    const clubRows = recommendations.slice(0, 10).map(c => ({
      id: `select_biz_${c.businessId}`,
      title: c.businessName.length > 24 ? c.businessName.substring(0, 21) + '...' : c.businessName,
      description: `${c.googleRating ? '⭐' + c.googleRating.toFixed(1) + ' • ' : ''}₹${c.ratePerHour}/hr • ${c.address.substring(0, 30)}`
    }));

    return {
      replyText: directoryText.trim(),
      replyType: 'list',
      listData: {
        buttonText: 'Select Club to Book',
        sections: [
          {
            title: 'Verified Partner Clubs',
            rows: clubRows
          }
        ]
      }
    };
  },

  /**
   * Guides the customer to select a club for booking.
   */
  async handleGlobalBookTable(customerPhone: string): Promise<IntelligenceOutput> {
    const recommendations = await clubDiscoveryService.discoverAndRankClubs({
      dateStr: getCurrentISTDateStr()
    });

    if (recommendations.length === 0) {
      return {
        replyText: `Sorry, there are no partner clubs currently available. Please check back soon!`,
        replyType: 'text'
      };
    }

    const clubRows = recommendations.slice(0, 10).map(c => ({
      id: `select_biz_${c.businessId}`,
      title: c.businessName.length > 24 ? c.businessName.substring(0, 21) + '...' : c.businessName,
      description: `${c.address.substring(0, 35)} • From ₹${c.ratePerHour}/hr`
    }));

    return {
      replyText: (
        `*QControl — Select a Partner Club to Book:* 📅\n\n` +
        `Please choose the club where you would like to play. We will check real-time table availability for you:`
      ),
      replyType: 'list',
      listData: {
        buttonText: 'Choose Club',
        sections: [
          {
            title: 'Partner Clubs',
            rows: clubRows
          }
        ]
      }
    };
  },

  /**
   * Displays all active bookings across all partner clubs for a customer phone.
   */
  async handleGlobalMyBookings(customerPhone: string): Promise<IntelligenceOutput> {
    const bookings = await bookingService.getCustomerBookings(customerPhone);

    if (bookings.length === 0) {
      return {
        replyText: (
          `You have no upcoming reservations in the QControl network.\n\n` +
          `Would you like to book a table at one of our partner clubs?`
        ),
        replyType: 'buttons',
        buttons: [
          { id: 'action_book_table', title: '📅 Book a Table' },
          { id: 'action_explore_clubs', title: '🔍 Explore Clubs' }
        ]
      };
    }

    let msg = `*Your Upcoming Reservations:* 📋\n\n`;
    const buttons: Array<{ id: string; title: string }> = [];

    bookings.slice(0, 3).forEach((b, idx) => {
      const clubName = b.businesses?.business_name || 'Partner Club';
      const code = `QC-${b.id.substring(0, 6).toUpperCase()}`;
      msg += `*${idx + 1}. ${code}* — ${clubName}\n`;
      msg += `🎮 *Game:* ${b.game_type?.toUpperCase() || 'POOL'} (Table ${b.table_id})\n`;
      msg += `📅 *Time:* ${b.booking_date} at ${b.start_time.substring(0, 5)} (${b.duration_minutes || 60} mins)\n`;
      if (b.businesses?.address) {
        msg += `📍 *Address:* ${b.businesses.address}\n`;
        const dir = getGoogleMapsDirectionsUrl({ address: b.businesses.address, businessName: clubName });
        if (dir) msg += `🗺️ *Directions:* ${dir}\n`;
      }
      msg += `\n`;

      if (idx === 0) {
        buttons.push({ id: `cancel_${b.id}`, title: `❌ Cancel ${code}` });
      }
    });

    buttons.push({ id: 'action_book_table', title: '📅 New Booking' });
    buttons.push({ id: 'action_explore_clubs', title: '🔍 Partner Clubs' });

    return {
      replyText: msg.trim(),
      replyType: 'buttons',
      buttons
    };
  },

  /**
   * Centralized transparent pricing guide across all games.
   */
  async handleCentralPricingGuide(customerPhone: string): Promise<IntelligenceOutput> {
    return {
      replyText: (
        `*QControl — Transparent Game Pricing Guide:* 💰\n\n` +
        `All partner clubs adhere to transparent, verified rates with fair per-minute billing:\n\n` +
        `🎱 *Pool:* ₹180 – ₹220 / hr\n` +
        `🔴 *Snooker:* ₹280 – ₹350 / hr (English & Tournament tables)\n` +
        `🎮 *PS5:* ₹200 – ₹300 / hr (4K HDR Gaming, 1–4 players)\n\n` +
        `🎖️ *Membership Benefit:* Registered members enjoy 10% to 20% discounts on every session across clubs!\n\n` +
        `Select an option below to book or explore partner clubs:`
      ),
      replyType: 'buttons',
      buttons: [
        { id: 'action_book_table', title: '📅 Book a Table' },
        { id: 'action_explore_clubs', title: '🔍 Explore Clubs' },
        { id: 'action_get_directions', title: '🗺️ Get Directions' }
      ]
    };
  },

  /**
   * Returns directions to partner clubs.
   */
  async handleGlobalDirections(customerPhone: string): Promise<IntelligenceOutput> {
    const recommendations = await clubDiscoveryService.discoverAndRankClubs({
      dateStr: getCurrentISTDateStr()
    });

    if (recommendations.length === 0) {
      return {
        replyText: `No active partner clubs found right now.`,
        replyType: 'buttons',
        buttons: [{ id: 'action_support', title: '💬 Contact Support' }]
      };
    }

    let dirText = `*Find Your Closest QControl Club:* 🗺️\n\n`;
    recommendations.slice(0, 4).forEach((c, idx) => {
      dirText += `*${idx + 1}. ${c.businessName}*\n📍 ${c.address}\n`;
      if (c.directionsUrl) {
        dirText += `🚗 *Google Maps Navigation:* ${c.directionsUrl}\n`;
      }
      dirText += `\n`;
    });

    dirText += `Select a club below to reserve your table:`;

    const clubRows = recommendations.slice(0, 10).map(c => ({
      id: `select_biz_${c.businessId}`,
      title: c.businessName.length > 24 ? c.businessName.substring(0, 21) + '...' : c.businessName,
      description: `📍 ${c.address.substring(0, 40)}`
    }));

    return {
      replyText: dirText.trim(),
      replyType: 'list',
      listData: {
        buttonText: 'Select Club to Navigate',
        sections: [
          {
            title: 'Partner Clubs',
            rows: clubRows
          }
        ]
      }
    };
  },

  /**
   * Official QControl Concierge support info.
   */
  async handleCentralSupport(): Promise<IntelligenceOutput> {
    return {
      replyText: (
        `*QControl Concierge & Support* 💬\n\n` +
        `Need help with a table reservation, venue directions, or corporate event bookings?\n\n` +
        `📞 *Helpline / WhatsApp:* +91 98811 00000\n` +
        `⏱️ *Support Hours:* 10:00 AM – Midnight (All 7 Days)\n` +
        `📧 *Email:* support@qcontrol.app\n` +
        `🌐 *Web Directory:* https://qcontrol.app/portal/clubs\n\n` +
        `How can we assist you today?`
      ),
      replyType: 'buttons',
      buttons: [
        { id: 'action_book_table', title: '📅 Book a Table' },
        { id: 'action_explore_clubs', title: '🔍 Explore Clubs' },
        { id: 'action_my_bookings', title: '📋 My Bookings' }
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
   * Delivers verified venue photos for a business.
   */
  async handleVenuePhotos(businessId: string, bName: string, customerPhone: string): Promise<IntelligenceOutput> {
    const photos = await venuePhotoService.getPhotoUrls(businessId);

    if (!photos || photos.length === 0) {
      return {
        replyText: (
          `📸 *Photos of ${bName}*\n\n` +
          `Venue photos are currently being updated by the club manager, but *${bName}* is an officially verified QControl partner club with tournament-grade tables, professional cloth, and premium ambience! 🎱✨\n\n` +
          `Would you like to check available slots or view our hourly rates?`
        ),
        replyType: 'buttons',
        buttons: [
          { id: 'action_book', title: '📅 Book a Table' },
          { id: 'action_pricing', title: '💰 View Rates' },
          { id: 'action_club_info', title: '📍 Location & Info' }
        ]
      };
    }

    const images = photos.slice(0, 3).map((p, idx) => ({
      url: p.url,
      caption: p.caption || `${bName} — Venue Photo ${idx + 1}`
    }));

    return {
      replyText: `Here are photos of *${bName}*! 🎱📸\n\nEnjoy tournament-standard tables and premium lounge ambience. Tap below to reserve your slot:`,
      replyType: 'buttons',
      images,
      buttons: [
        { id: 'action_book', title: '📅 Book a Table' },
        { id: 'action_pricing', title: '💰 View Rates' },
        { id: 'action_club_info', title: '📍 Location & Info' }
      ]
    };
  },

  /**
   * Displays Google Places rating and review count authoritatively. Never fabricates.
   */
  async handleGoogleRating(businessId: string, bName: string, customerPhone: string): Promise<IntelligenceOutput> {
    const rating = await googleRatingsService.getRating(businessId);
    const ratingDisplay = googleRatingsService.formatRatingDisplay(rating);

    let msg = `⭐ *Customer Ratings & Reviews — ${bName}*\n\n`;
    msg += `${ratingDisplay}\n\n`;

    if (rating.rating && rating.rating >= 4.0) {
      msg += `Top-rated by players for table maintenance, lighting, and hospitality! 🏆\n\n`;
    } else if (rating.rating === null) {
      msg += `Google reviews are currently syncing for this club. Rest assured, this is a verified QControl partner lounge.\n\n`;
    }

    msg += `Ready to play? Choose an option below:`;

    return {
      replyText: msg.trim(),
      replyType: 'buttons',
      buttons: [
        { id: 'action_book', title: '📅 Book a Table' },
        { id: 'action_venue_photos', title: '📸 View Photos' },
        { id: 'action_pricing', title: '💰 View Rates' }
      ]
    };
  },

  /**
   * Discovers partner clubs near customer GPS coordinates using haversine distance.
   * Customer coordinates are used only for calculation and never persisted.
   */
  async handleNearbyClubs(lat: number, lng: number, customerPhone: string, gameType = 'pool'): Promise<IntelligenceOutput> {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    const nearby = await clubDiscoveryService.discoverNearbyClubs(lat, lng, 35, gameType);

    if (nearby.length === 0) {
      return {
        replyText: (
          `📍 *No partner clubs found within 35km of your location.*\n\n` +
          `We are actively partnering with new clubs across the city! Would you like to explore all partner clubs or check a popular area?`
        ),
        replyType: 'buttons',
        buttons: [
          { id: 'action_explore_clubs', title: '🔍 Explore All Clubs' },
          { id: 'area_kothrud', title: '📍 Kothrud' },
          { id: 'action_support', title: '💬 Contact Support' }
        ]
      };
    }

    let msg = `📍 *Pool & Snooker Lounges Near You (Closest First):* 🎱\n\n`;
    nearby.slice(0, 4).forEach((c, idx) => {
      const distStr = c.distanceDisplay ? `🚗 *${c.distanceDisplay}*` : '';
      const ratingStr = c.googleRatingDisplay ? ` • ${c.googleRatingDisplay}` : '';
      msg += `*${idx + 1}. ${c.businessName}* ${distStr}${ratingStr}\n`;
      msg += `📍 ${c.address}\n`;
      msg += `💰 ${c.matchedGameType.toUpperCase()}: ₹${c.ratePerHour}/hr • Available tables: ${c.tablesCount}\n`;
      if (c.directionsUrl) {
        msg += `🗺️ *Directions:* ${c.directionsUrl}\n`;
      }
      msg += `\n`;
    });

    msg += `Tap below to select a club and reserve your table:`;

    const clubRows = nearby.slice(0, 10).map(c => ({
      id: `select_biz_${c.businessId}`,
      title: c.businessName.length > 24 ? c.businessName.substring(0, 21) + '...' : c.businessName,
      description: `${c.distanceDisplay ? c.distanceDisplay + ' • ' : ''}₹${c.ratePerHour}/hr • ${c.address.substring(0, 25)}`
    }));

    return {
      replyText: msg.trim(),
      replyType: 'list',
      listData: {
        buttonText: 'Select Club to Book',
        sections: [
          {
            title: 'Closest Partner Lounges',
            rows: clubRows
          }
        ]
      }
    };
  },

  /**
   * Prompts customer to share their WhatsApp location pin to discover nearby pool lounges.
   */
  handleNearbyPrompt(): IntelligenceOutput {
    return {
      replyText: (
        `📍 *Find Pool & Snooker Lounges Near You*\n\n` +
        `To instantly calculate distances and find the closest available tables:\n\n` +
        `1️⃣ Tap the *Attachment (📎 or +)* icon in WhatsApp\n` +
        `2️⃣ Tap *Location* 📍 and choose *Send Your Current Location*\n\n` +
        `_Note: Your coordinates are used only to calculate distance and are never stored._\n\n` +
        `Or tap below to explore clubs by popular areas:`
      ),
      replyType: 'buttons',
      buttons: [
        { id: 'filter_area_kothrud', title: '📍 Kothrud' },
        { id: 'filter_area_baner', title: '📍 Baner' },
        { id: 'action_explore_clubs', title: '🔍 All Clubs' }
      ]
    };
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
