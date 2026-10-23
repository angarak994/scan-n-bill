import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';
import { eventNotificationService } from '@/lib/services/eventNotificationService';
import {
  OperatingHoursConfig,
  DEFAULT_OPERATING_HOURS,
  resolveBusinessConfig,
  inspectOperatingHours,
  formatTimeTo12Hour,
  formatMinutesTo12Hour,
  slotToInstants,
  isWithinOperatingHours,
  generateCandidateSlots,
  doInstantsOverlap,
  getCurrentOperatingDay,
  timeStringToMinutes,
  minutesToTimeString,
  zonedTimeToUtc,
  getTimezoneParts,
  SlotInstantRange,
} from '@/lib/utils/operatingDayUtils';

export interface BookingCreationParams {
  business_id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string; // Operating Day: "YYYY-MM-DD"
  start_time: string; // "14:00" or "01:00" or "14:00:00"
  duration_minutes: number;
  game_type?: string;
  num_players?: number;
  source?: 'whatsapp' | 'manual' | 'qr' | 'telegram' | 'portal';
  idempotency_key?: string;
}

export interface CustomerHistorySummary {
  customer_id?: string;
  name: string;
  phone: string;
  total_visits: number;
  completed_bookings_count: number;
  outstanding_balance: number;
  membership_name?: string;
  membership_status?: string;
  recent_bookings: Array<{
    id: string;
    booking_date: string;
    start_time: string;
    table_id: string;
    game_type: string;
    status: string;
  }>;
}

export interface AvailabilityCheckOptions {
  cachedBusiness?: any;
  cachedActiveSessions?: any[];
  cachedExistingBookings?: any[];
}

export interface AvailableSlotItem {
  time: string; // "01:00"
  displayTime: string; // "01:00 AM"
  tableId: string;
  tableName: string;
  ratePerHour: number;
  isOvernight: boolean;
}

export const bookingService = {
  /**
   * Resolves a table identifier (e.g. "T1", "Table 1", "P1") to the canonical table
   * object and a comprehensive set of matching aliases to prevent casing and naming mismatches.
   */
  resolveTable(tables: any[], tableIdOrName: string): { canonicalId: string; canonicalName: string; aliases: string[]; table: any } | null {
    if (!tables || tables.length === 0 || !tableIdOrName) return null;
    const norm = String(tableIdOrName).trim().toLowerCase();
    const cleanNorm = norm.replace(/[^a-z0-9]/g, '');

    const matched = tables.find((t: any) => {
      const tid = String(t.id || '').trim().toLowerCase();
      const tname = String(t.name || '').trim().toLowerCase();
      return tid === norm ||
        tname === norm ||
        tid.replace(/[^a-z0-9]/g, '') === cleanNorm ||
        tname.replace(/[^a-z0-9]/g, '') === cleanNorm;
    });

    if (!matched) return null;

    const aliases = Array.from(new Set([
      matched.id,
      matched.name,
      String(matched.id).toLowerCase(),
      String(matched.name).toLowerCase()
    ].filter(Boolean)));

    return {
      canonicalId: matched.id,
      canonicalName: matched.name || matched.id,
      aliases,
      table: matched
    };
  },

  /**
   * Checks if a table is available for a given time slot on a specific operating day.
   * Resolves with { available: true } or { available: false, reason: string }.
   */
  async checkTableAvailability(
    businessId: string,
    tableId: string,
    bookingDate: string,
    startTimeOrMins: number | string,
    durationMins: number = 60,
    options?: AvailabilityCheckOptions
  ): Promise<{ available: boolean; isAvailable: boolean; reason?: string }> {
    // 1. Normalize time string ("HH:mm")
    let timeStr: string;
    if (typeof startTimeOrMins === 'number') {
      timeStr = minutesToTimeString(startTimeOrMins);
    } else {
      const parts = String(startTimeOrMins).trim().split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    // 2. Resolve business and operating configuration
    const business = options?.cachedBusiness || await businessManager.getBusiness(businessId);
    if (!business) {
      return { available: false, isAvailable: false, reason: 'Club not found or inactive.' };
    }

    const config: OperatingHoursConfig = resolveBusinessConfig(business);

    // 3. Resolve table existence and aliases
    const resolved = this.resolveTable(business.tables || [], tableId);
    if (!resolved) {
      return { available: false, isAvailable: false, reason: `Table "${tableId}" does not exist at ${business.business_name}.` };
    }

    const { canonicalId, canonicalName, aliases } = resolved;

    // 4. Operating Hours Check (Fully supports overnight and after-midnight hours e.g. 18:00 to 03:00)
    const hoursCheck = isWithinOperatingHours(timeStr, durationMins, config);
    if (!hoursCheck.valid) {
      return {
        available: false,
        isAvailable: false,
        reason: hoursCheck.reason || `${business.business_name} is closed at this time.`
      };
    }

    // 5. Convert to unambiguous UTC instants
    const slotInstants = slotToInstants(bookingDate, timeStr, durationMins, config);
    const now = new Date();
    const currentOpDay = getCurrentOperatingDay(config, now);

    // 6. Past time validation
    if (bookingDate === currentOpDay) {
      const leadMs = (config.last_booking_lead_minutes || 0) * 60 * 1000;
      if (slotInstants.startInstant.getTime() <= now.getTime() + leadMs) {
        return {
          available: false,
          isAvailable: false,
          reason: 'Requested time slot has already passed for today.'
        };
      }
    } else if (bookingDate < currentOpDay) {
      return {
        available: false,
        isAvailable: false,
        reason: 'Requested operating date has already passed.'
      };
    }

    // 7. Live Active Sessions Check (Never report an occupied table as available)
    let activeSessions: any[] = [];
    if (options?.cachedActiveSessions) {
      activeSessions = options.cachedActiveSessions.filter(s => aliases.includes(s.table_id));
    } else {
      const { data } = await supabase
        .from('sessions')
        .select('id, table_id, start_time, duration')
        .eq('business_id', businessId)
        .in('table_id', aliases)
        .eq('status', 'ACTIVE');
      activeSessions = data || [];
    }

    if (activeSessions.length > 0) {
      for (const session of activeSessions) {
        let sessionStart = session.start_time ? new Date(session.start_time) : now;
        if (isNaN(sessionStart.getTime())) sessionStart = now;

        // A live session occupies the table now and blocks upcoming slots for at least 30 minutes into future
        const occupiedUntil = new Date(Math.max(sessionStart.getTime() + 45 * 60 * 1000, now.getTime() + 30 * 60 * 1000));

        if (doInstantsOverlap(slotInstants.startInstant, slotInstants.endInstant, sessionStart, occupiedUntil, 0)) {
          return {
            available: false,
            isAvailable: false,
            reason: `Table ${canonicalName} is currently occupied by a live playing session.`
          };
        }
      }
    }

    // 8. Existing Reservations Check (confirmed, active, and pending holds)
    let existingBookings: any[] = [];
    if (options?.cachedExistingBookings) {
      existingBookings = options.cachedExistingBookings.filter(b => aliases.includes(b.table_id));
    } else {
      // Calculate adjacent operating days to prevent overnight slot misses
      const opDateObj = new Date(`${bookingDate}T12:00:00Z`);
      const prevDate = new Date(opDateObj.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const nextDate = new Date(opDateObj.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select('id, table_id, booking_date, start_time, duration_minutes, end_time, status')
        .eq('business_id', businessId)
        .in('table_id', aliases)
        .in('booking_date', [prevDate, bookingDate, nextDate])
        .in('status', ['confirmed', 'active', 'pending']);

      if (fetchError) {
        console.error('Error fetching existing bookings for availability check:', fetchError);
        return { available: false, isAvailable: false, reason: 'Failed to verify table availability due to database error.' };
      }
      existingBookings = data || [];
    }

    if (existingBookings.length > 0) {
      for (const b of existingBookings) {
        if (!b.start_time || !b.booking_date) continue;
        const bDuration = Number(b.duration_minutes) || 60;
        const bInstants = slotToInstants(b.booking_date, b.start_time, bDuration, config);

        if (doInstantsOverlap(slotInstants.startInstant, slotInstants.endInstant, bInstants.startInstant, bInstants.endInstant, config.buffer_minutes)) {
          const display = b.start_time.substring(0, 5);
          return {
            available: false,
            isAvailable: false,
            reason: `Table ${canonicalName} is already booked from ${formatTimeTo12Hour(display)} (${bDuration} mins).`
          };
        }
      }
    }

    return { available: true, isAvailable: true };
  },

  /**
   * Generates genuine available slots for a given game type and date.
   * Uses high-speed single batch queries instead of N+1 database roundtrips.
   */
  async getAvailableSlots(
    businessId: string,
    gameType: string,
    dateStr: string,
    durationMins = 60
  ): Promise<AvailableSlotItem[]> {
    const business = await businessManager.getBusiness(businessId);
    if (!business || !business.tables || business.tables.length === 0) return [];

    const config: OperatingHoursConfig = resolveBusinessConfig(business);
    const normGame = (gameType || 'pool').toLowerCase();

    // Match tables for this game type
    const matchingTables = (business.tables || []).filter((t: any) => {
      const type = ((t as any).game_type || (t as any).type || 'pool').toLowerCase();
      if (normGame === 'snooker') return type === 'snooker' || type === 'msnooker';
      return type === normGame;
    });

    if (matchingTables.length === 0) return [];

    // Calculate adjacent operating days for batch query
    const opDateObj = new Date(`${dateStr}T12:00:00Z`);
    const prevDate = new Date(opDateObj.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextDate = new Date(opDateObj.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Single parallel batch fetch for active sessions & reservations
    const [sessionsRes, bookingsRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, table_id, start_time, duration')
        .eq('business_id', businessId)
        .eq('status', 'ACTIVE'),
      supabase
        .from('bookings')
        .select('id, table_id, booking_date, start_time, duration_minutes, end_time, status')
        .eq('business_id', businessId)
        .in('booking_date', [prevDate, dateStr, nextDate])
        .in('status', ['confirmed', 'active', 'pending']),
    ]);

    const activeSessions = sessionsRes.data || [];
    const existingBookings = bookingsRes.data || [];

    // Candidate slots across full operating window (including overnight 00:00, 01:00, 02:00)
    const now = new Date();
    const candidateSlots = generateCandidateSlots(dateStr, durationMins, config, now);

    // Pricing calculation
    const rules: any = business.pricing_rules?.rules?.[normGame] || {};
    const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;

    const availableSlots: AvailableSlotItem[] = [];

    // Evaluate candidate slots in-memory
    for (const slot of candidateSlots) {
      for (const table of matchingTables) {
        const check = await this.checkTableAvailability(
          businessId,
          table.id,
          dateStr,
          slot.time,
          durationMins,
          {
            cachedBusiness: business,
            cachedActiveSessions: activeSessions,
            cachedExistingBookings: existingBookings
          }
        );

        if (check.available) {
          availableSlots.push({
            time: slot.time,
            displayTime: slot.displayTime,
            tableId: table.id,
            tableName: table.name || table.id,
            ratePerHour,
            isOvernight: slot.isOvernight,
          });
          break; // One free table per slot recommendation is sufficient
        }
      }
    }

    return availableSlots;
  },

  /**
   * Generates intelligent alternative slots when a requested time is unavailable or outside hours.
   */
  async getSmartAlternatives(
    businessId: string,
    gameType: string,
    dateStr: string,
    requestedTimeStr: string,
    durationMins = 60
  ): Promise<{
    hasExactSlot: boolean;
    requestedSlot: { time: string; displayTime: string; available: boolean; reason?: string };
    alternatives: Array<AvailableSlotItem & { diffMinutes: number }>;
  }> {
    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return {
        hasExactSlot: false,
        requestedSlot: { time: requestedTimeStr, displayTime: formatTimeTo12Hour(requestedTimeStr), available: false, reason: 'Club not found' },
        alternatives: []
      };
    }

    // Normalize requested time
    const reqMins = timeStringToMinutes(requestedTimeStr);
    const normReqTime = minutesToTimeString(reqMins);
    const reqDisplay = formatMinutesTo12Hour(reqMins);

    // Check exact availability
    const allAvailable = await this.getAvailableSlots(businessId, gameType, dateStr, durationMins);
    const exactMatch = allAvailable.find(s => s.time === normReqTime);

    if (exactMatch) {
      return {
        hasExactSlot: true,
        requestedSlot: { time: normReqTime, displayTime: reqDisplay, available: true },
        alternatives: []
      };
    }

    // Slot is not available: rank nearest available alternatives
    const rankedAlternatives = allAvailable.map(slot => {
      const slotMins = timeStringToMinutes(slot.time);
      // Compute circular or linear difference
      let diff = Math.abs(slotMins - reqMins);
      if (diff > 720) diff = 1440 - diff;
      return { ...slot, diffMinutes: diff };
    }).sort((a, b) => a.diffMinutes - b.diffMinutes);

    return {
      hasExactSlot: false,
      requestedSlot: {
        time: normReqTime,
        displayTime: reqDisplay,
        available: false,
        reason: 'Requested slot is unavailable.'
      },
      alternatives: rankedAlternatives.slice(0, 4) // Top 4 closest slots
    };
  },

  /**
   * Creates a booking with atomic race-condition prevention and instant Realtime notification.
   */
  async createAtomicBooking(params: BookingCreationParams): Promise<{ success: boolean; booking?: any; reason?: string; isDuplicate?: boolean }> {
    const {
      business_id,
      table_id,
      customer_name,
      customer_phone,
      booking_date,
      start_time,
      duration_minutes = 60,
      game_type = 'pool',
      num_players = 1,
      source = 'whatsapp',
      idempotency_key
    } = params;

    // 1. Resolve Business and Configuration
    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return { success: false, reason: 'Business not found.' };
    }

    const config: OperatingHoursConfig = resolveBusinessConfig(business);

    // 2. Resolve Canonical Table
    const resolved = this.resolveTable(business.tables || [], table_id);
    if (!resolved) {
      return { success: false, reason: `Table ${table_id} does not exist for this club.` };
    }

    const canonicalTableId = resolved.canonicalId;
    const aliases = resolved.aliases;

    // 3. Normalize Start Time & Compute Instants
    const parts = start_time.split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const formattedStartTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
    const cleanTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const cleanPhone = (customer_phone || '').replace(/\D/g, '');

    // 4. Validate Operating Hours Window
    const hoursCheck = isWithinOperatingHours(cleanTimeStr, duration_minutes, config);
    if (!hoursCheck.valid) {
      return { success: false, reason: hoursCheck.reason };
    }

    // Unambiguous instants
    const slotInstants = slotToInstants(booking_date, cleanTimeStr, duration_minutes, config);
    const endTzParts = getTimezoneParts(slotInstants.endInstant, config.timezone);
    const end_time = `${endTzParts.timeString}:00`;

    // 5. Idempotency Check (Prevent duplicate webhooks or rapid double-taps)
    if (idempotency_key) {
      try {
        const { data: existingByKey } = await supabase
          .from('bookings')
          .select('*')
          .eq('business_id', business_id)
          .eq('idempotency_key', idempotency_key)
          .maybeSingle();

        if (existingByKey) {
          return { success: true, booking: existingByKey, isDuplicate: true };
        }
      } catch {}
    }

    // Duplicate tap protection within 2 minutes for same customer, date, table, and start time
    if (cleanPhone.length >= 10) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentDup } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', business_id)
        .eq('booking_date', booking_date)
        .eq('start_time', formattedStartTime)
        .eq('customer_phone', cleanPhone)
        .gte('created_at', twoMinutesAgo)
        .in('status', ['confirmed', 'active', 'pending'])
        .limit(1)
        .maybeSingle();

      if (recentDup) {
        return { success: true, booking: recentDup, isDuplicate: true };
      }
    }

    // 6. Pre-check availability on server
    const initialCheck = await this.checkTableAvailability(business_id, canonicalTableId, booking_date, cleanTimeStr, duration_minutes);
    if (!initialCheck.available) {
      return { success: false, reason: initialCheck.reason };
    }

    // 7. Link or create customer record in customers table
    let customerId: string | null = null;
    if (cleanPhone.length >= 10) {
      try {
        const { data: existingCust } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', business_id)
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingCust) {
          customerId = existingCust.id;
        } else {
          const { data: newCust } = await supabase
            .from('customers')
            .insert({
              business_id,
              name: customer_name.trim() || 'Customer',
              phone: cleanPhone,
              outstanding_balance: 0
            })
            .select('id')
            .single();

          if (newCust) customerId = newCust.id;
        }
      } catch (custErr) {
        console.warn('Non-blocking customer ledger link warning:', custErr);
      }
    }

    // 8. Insert booking record
    const insertPayload: any = {
      business_id,
      table_id: canonicalTableId,
      customer_name: customer_name.trim() || 'Customer',
      customer_phone: cleanPhone || customer_phone,
      game_type,
      num_players: Math.max(1, Number(num_players) || 1),
      booking_date,
      start_time: formattedStartTime,
      end_time,
      duration_minutes,
      status: 'confirmed',
      source
    };

    if (customerId) insertPayload.customer_id = customerId;
    if (idempotency_key) insertPayload.idempotency_key = idempotency_key;

    let insertResult = await supabase
      .from('bookings')
      .insert(insertPayload)
      .select()
      .single();

    if (insertResult.error && (insertResult.error.code === 'PGRST204' || insertResult.error.message?.includes('customer_id') || insertResult.error.message?.includes('idempotency_key'))) {
      delete insertPayload.customer_id;
      delete insertPayload.idempotency_key;
      insertResult = await supabase
        .from('bookings')
        .insert(insertPayload)
        .select()
        .single();
    }

    const newBooking = insertResult.data;
    const insertError = insertResult.error;

    if (insertError || !newBooking) {
      console.error('Database insert error during booking creation:', insertError);
      if (insertError?.message?.includes('prevent_overlapping_confirmed_bookings') || insertError?.code === '23P01') {
        return { success: false, reason: 'This table slot was just reserved by another customer a moment ago.' };
      }
      return { success: false, reason: 'Failed to record reservation in database.' };
    }

    // 9. Concurrency collision detection (Race condition arbitration)
    const opDateObj = new Date(`${booking_date}T12:00:00Z`);
    const prevDate = new Date(opDateObj.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextDate = new Date(opDateObj.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, duration_minutes, end_time, created_at')
      .eq('business_id', business_id)
      .in('table_id', aliases)
      .in('booking_date', [prevDate, booking_date, nextDate])
      .in('status', ['confirmed', 'active', 'pending'])
      .neq('id', newBooking.id);

    if (conflicts && conflicts.length > 0) {
      for (const c of conflicts) {
        if (!c.start_time || !c.booking_date) continue;
        const cDuration = Number(c.duration_minutes) || 60;
        const cInstants = slotToInstants(c.booking_date, c.start_time, cDuration, config);

        if (doInstantsOverlap(slotInstants.startInstant, slotInstants.endInstant, cInstants.startInstant, cInstants.endInstant, config.buffer_minutes)) {
          // Collision: Earliest created booking wins; if identical timestamp, lower ID wins
          const cCreatedAt = new Date(c.created_at).getTime();
          const newCreatedAt = new Date(newBooking.created_at).getTime();

          if (cCreatedAt < newCreatedAt || (cCreatedAt === newCreatedAt && c.id < newBooking.id)) {
            await supabase.from('bookings').delete().eq('id', newBooking.id);
            return {
              success: false,
              reason: 'This table slot is already booked and was just reserved by another customer a moment ago. Please select another time.'
            };
          }
        }
      }
    }

    // 10. Trigger Realtime dashboard sync & Telegram owner notifications non-blocking
    eventNotificationService.notifyBookingCreated(newBooking, business).catch(err => {
      console.warn('[BookingService] Non-blocking event notification warning:', err?.message);
    });

    return { success: true, booking: newBooking };
  },

  /**
   * Retrieves active upcoming bookings for a customer.
   */
  async getCustomerBookings(customerPhone: string, businessId?: string): Promise<any[]> {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    let query = supabase
      .from('bookings')
      .select('*, businesses(business_name, address, contact_number, public_contact_number)')
      .or(`customer_phone.eq.${customerPhone},customer_phone.eq.${cleanPhone}`)
      .gte('booking_date', getCurrentISTDateStr())
      .in('status', ['confirmed', 'pending'])
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (businessId) {
      query = query.eq('business_id', businessId);
    }

    const { data } = await query;
    return data || [];
  },

  /**
   * Retrieves comprehensive customer profile & booking history for Dashboard hover cards and mobile sheets.
   */
  async getCustomerProfileAndHistory(businessId: string, phone: string, name?: string): Promise<CustomerHistorySummary | null> {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone && !name) return null;

    try {
      // 1. Fetch customer ledger record
      let customerRecord: any = null;
      if (cleanPhone) {
        const { data: cust } = await supabase
          .from('customers')
          .select('id, name, phone, outstanding_balance, total_billed, total_paid')
          .eq('business_id', businessId)
          .eq('phone', cleanPhone)
          .maybeSingle();
        customerRecord = cust;
      }

      if (!customerRecord && name) {
        const { data: cust } = await supabase
          .from('customers')
          .select('id, name, phone, outstanding_balance, total_billed, total_paid')
          .eq('business_id', businessId)
          .ilike('name', name.trim())
          .limit(1)
          .maybeSingle();
        customerRecord = cust;
      }

      // 2. Fetch membership status if any
      let membership: any = null;
      if (cleanPhone) {
        const { data: mem } = await supabase
          .from('memberships')
          .select('id, name, mobile, plan_name, status, expiry_date')
          .eq('business_id', businessId)
          .eq('mobile', cleanPhone)
          .maybeSingle();
        membership = mem;
      }

      // 3. Fetch past bookings for this customer
      let bookingQuery = supabase
        .from('bookings')
        .select('id, booking_date, start_time, table_id, game_type, status')
        .eq('business_id', businessId)
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(10);

      if (cleanPhone) {
        bookingQuery = bookingQuery.eq('customer_phone', cleanPhone);
      } else if (name) {
        bookingQuery = bookingQuery.ilike('customer_name', name.trim());
      }

      const { data: recentBookings } = await bookingQuery;
      const bookingsList = recentBookings || [];

      // Calculate total visits from completed bookings and sessions
      const completedCount = bookingsList.filter(b => b.status === 'completed' || b.status === 'active').length;

      return {
        customer_id: customerRecord?.id,
        name: customerRecord?.name || name || 'Customer',
        phone: cleanPhone || phone || '',
        total_visits: completedCount,
        completed_bookings_count: completedCount,
        outstanding_balance: Number(customerRecord?.outstanding_balance || 0),
        membership_name: membership?.plan_name || (membership?.status === 'ACTIVE' ? 'Active Member' : undefined),
        membership_status: membership?.status,
        recent_bookings: bookingsList.slice(0, 5)
      };
    } catch (err) {
      console.error('Error fetching customer profile history:', err);
      return null;
    }
  },

  /**
   * Cancels a booking safely with strict state machine validation.
   */
  async cancelBooking(bookingId: string, customerPhone: string, businessId?: string): Promise<{ success: boolean; booking?: any; reason?: string }> {
    const cleanPhone = customerPhone.replace(/\D/g, '');

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { success: false, reason: 'Booking not found.' };
    }

    const bookingPhone = (booking.customer_phone || '').replace(/\D/g, '');
    if (bookingPhone !== cleanPhone && booking.customer_phone !== customerPhone) {
      return { success: false, reason: 'Unauthorized: Phone number does not match booking record.' };
    }

    if (businessId && booking.business_id !== businessId) {
      return { success: false, reason: 'Unauthorized: Booking belongs to a different club.' };
    }

    // State machine check: Cannot cancel active playing sessions or completed sessions
    if (booking.status === 'active') {
      return { success: false, reason: 'Cannot cancel booking because your session is currently active on the table. Please ask club staff to end the session.' };
    }

    if (booking.status === 'completed') {
      return { success: false, reason: 'Cannot cancel a booking that has already been completed.' };
    }

    if (booking.status === 'cancelled') {
      return { success: true, booking, reason: 'Booking is already cancelled.' };
    }

    // Check if session_id is active in sessions table
    if (booking.session_id) {
      const { data: liveSession } = await supabase
        .from('sessions')
        .select('id, status')
        .eq('id', booking.session_id)
        .maybeSingle();

      if (liveSession && liveSession.status === 'ACTIVE') {
        return { success: false, reason: 'Cannot cancel booking: A live playing session is currently running on Table ' + booking.table_id };
      }
    }

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (updateErr) {
      return { success: false, reason: 'Failed to cancel reservation.' };
    }

    // Trigger Realtime dashboard sync & Telegram owner alerts
    businessManager.getBusiness(booking.business_id).then(biz => {
      if (biz) eventNotificationService.notifyBookingCancelled(booking, biz).catch(() => {});
    }).catch(() => {});

    return { success: true, booking };
  },

  /**
   * Reschedules an existing booking to a new date and time atomically.
   */
  async rescheduleBooking(params: {
    bookingId?: string;
    booking_id?: string;
    customerPhone?: string;
    customer_phone?: string;
    newDate?: string;
    new_date?: string;
    newStartTime?: string;
    new_start_time?: string;
    newDurationMinutes?: number;
    new_duration_minutes?: number;
    businessId?: string;
    business_id?: string;
  }): Promise<{ success: boolean; booking?: any; reason?: string }> {
    const bookingId = params.bookingId || params.booking_id;
    const customerPhone = params.customerPhone || params.customer_phone || '';
    const newDate = params.newDate || params.new_date;
    const newStartTime = params.newStartTime || params.new_start_time;
    const newDurationMinutes = params.newDurationMinutes || params.new_duration_minutes;
    const businessId = params.businessId || params.business_id;

    if (!bookingId || !newDate || !newStartTime) {
      return { success: false, reason: 'Missing required rescheduling parameters.' };
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return { success: false, reason: 'Booking not found.' };
    }

    const bookingPhone = (booking.customer_phone || '').replace(/\D/g, '');
    if (bookingPhone !== cleanPhone && booking.customer_phone !== customerPhone) {
      return { success: false, reason: 'Unauthorized: Phone number does not match booking record.' };
    }

    if (businessId && booking.business_id !== businessId) {
      return { success: false, reason: 'Unauthorized: Booking belongs to a different club.' };
    }

    if (booking.status === 'active') {
      return { success: false, reason: 'Cannot reschedule a booking with an active live session.' };
    }

    if (booking.status === 'completed') {
      return { success: false, reason: 'Cannot reschedule an already completed booking.' };
    }

    const duration = newDurationMinutes || booking.duration_minutes || 60;
    const business = await businessManager.getBusiness(booking.business_id);
    if (!business) {
      return { success: false, reason: 'Business not found.' };
    }
    const config = resolveBusinessConfig(business);

    // Verify availability for the requested new slot
    const check = await this.checkTableAvailability(booking.business_id, booking.table_id, newDate, newStartTime, duration);
    if (!check.available) {
      return { success: false, reason: check.reason || 'The requested new slot is not available.' };
    }

    const instants = slotToInstants(newDate, newStartTime, duration, config);
    const endTzParts = getTimezoneParts(instants.endInstant, config.timezone);
    const end_time = `${endTzParts.timeString}:00`;
    const formattedStartTime = newStartTime.length === 5 ? `${newStartTime}:00` : newStartTime;

    // Update booking atomically
    const { data: updatedBooking, error: updateErr } = await supabase
      .from('bookings')
      .update({
        booking_date: newDate,
        start_time: formattedStartTime,
        end_time,
        duration_minutes: duration,
        status: 'confirmed'
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateErr || !updatedBooking) {
      return { success: false, reason: 'Failed to update reservation in database.' };
    }

    // Trigger Realtime dashboard sync & Telegram owner alerts
    eventNotificationService.notifyBookingRescheduled(updatedBooking, business, booking.start_time, formattedStartTime).catch(() => {});

    return { success: true, booking: updatedBooking };
  }
};

export const availabilityService = bookingService;
