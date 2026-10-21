import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';
import { businessManager } from '@/lib/businessManager';

export interface BookingCreationParams {
  business_id: string;
  table_id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  start_time: string; // "14:00" or "14:00:00"
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
   * Checks if a table is available for a given time slot.
   * Resolves with { available: true } or { available: false, reason: string }.
   */
  async checkTableAvailability(
    businessId: string,
    tableId: string,
    bookingDate: string,
    startTimeOrMins: number | string,
    durationMins: number = 60
  ): Promise<{ available: boolean; isAvailable: boolean; reason?: string }> {
    let startMins: number;
    if (typeof startTimeOrMins === 'string') {
      const parts = startTimeOrMins.split(':').map(Number);
      startMins = (parts[0] || 0) * 60 + (parts[1] || 0);
    } else {
      startMins = Number(startTimeOrMins) || 0;
    }
    const endMins = startMins + durationMins;

    // 0. Verify business and table existence
    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return { available: false, isAvailable: false, reason: 'Club not found or inactive.' };
    }

    const resolved = this.resolveTable(business.tables || [], tableId);
    if (!resolved) {
      return { available: false, isAvailable: false, reason: `Table "${tableId}" does not exist at ${business.business_name}.` };
    }

    const { canonicalId, canonicalName, aliases } = resolved;

    // 1. Operating Hours Check (Clubs operate from 10:00 AM to 11:30 PM)
    const CLUB_OPEN_MINS = 10 * 60; // 10:00 AM
    const CLUB_CLOSE_MINS = 23 * 60 + 30; // 11:30 PM
    if (startMins < CLUB_OPEN_MINS || endMins > CLUB_CLOSE_MINS) {
      return {
        available: false,
        isAvailable: false,
        reason: `${business.business_name} operates from 10:00 AM to 11:30 PM. Please select a time within operating hours.`
      };
    }

    // 2. Past time validation for today's bookings
    const todayStr = getCurrentISTDateStr();
    const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const [nowH, nowM] = nowIst.split(':').map(Number);
    const nowMins = nowH * 60 + nowM;

    if (bookingDate === todayStr && startMins < nowMins - 15) {
      return {
        available: false,
        isAvailable: false,
        reason: 'Requested time slot has already passed for today.'
      };
    }

    // 3. Live Active Sessions Check (Never report an occupied table as available)
    if (bookingDate === todayStr) {
      const { data: activeSessions } = await supabase
        .from('sessions')
        .select('id, table_id, start_time, duration')
        .eq('business_id', businessId)
        .in('table_id', aliases)
        .eq('status', 'ACTIVE');

      if (activeSessions && activeSessions.length > 0) {
        for (const session of activeSessions) {
          let sessionStartMins = nowMins;
          if (session.start_time) {
            try {
              const sessionDate = new Date(session.start_time);
              const sessionIst = sessionDate.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
              const [sH, sM] = sessionIst.split(':').map(Number);
              sessionStartMins = sH * 60 + sM;
            } catch {}
          }

          // A live playing session occupies the table currently and blocks upcoming slots
          // for at least 30 minutes into the future unless explicitly ended
          const occupiedUntilMins = Math.max(sessionStartMins + 45, nowMins + 30);

          if (Math.max(startMins, sessionStartMins) < Math.min(endMins, occupiedUntilMins)) {
            return {
              available: false,
              isAvailable: false,
              reason: `Table ${canonicalName} is currently occupied by a live playing session.`
            };
          }
        }
      }
    }

    // 4. Existing Reservations Check (confirmed, active, and pending holds)
    const { data: existingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, table_id, start_time, duration_minutes, end_time, status')
      .eq('business_id', businessId)
      .in('table_id', aliases)
      .eq('booking_date', bookingDate)
      .in('status', ['confirmed', 'active', 'pending']);

    if (fetchError) {
      console.error('Error fetching existing bookings for availability check:', fetchError);
      return { available: false, isAvailable: false, reason: 'Failed to verify table availability due to database error.' };
    }

    if (existingBookings && existingBookings.length > 0) {
      for (const b of existingBookings) {
        if (!b.start_time) continue;
        const bParts = b.start_time.split(':');
        const bStart = parseInt(bParts[0], 10) * 60 + parseInt(bParts[1], 10);
        let bEnd = bStart + (Number(b.duration_minutes) || 60);

        if (b.end_time) {
          const endParts = b.end_time.split(':');
          const calcEnd = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
          if (calcEnd > bStart) bEnd = calcEnd;
        }

        // Check time slot overlap: max(start1, start2) < min(end1, end2)
        if (Math.max(startMins, bStart) < Math.min(endMins, bEnd)) {
          const slotDisplay = b.start_time.substring(0, 5);
          const bDuration = Number(b.duration_minutes) || 60;
          return {
            available: false,
            isAvailable: false,
            reason: `Table ${canonicalName} is already booked from ${slotDisplay} (${bDuration} mins).`
          };
        }
      }
    }

    return { available: true, isAvailable: true };
  },

  /**
   * Generates genuine available slots for a given game type and date.
   */
  async getAvailableSlots(
    businessId: string,
    gameType: string,
    dateStr: string,
    durationMins = 60
  ): Promise<Array<{ time: string; tableId: string; tableName: string; ratePerHour: number }>> {
    const business = await businessManager.getBusiness(businessId);
    if (!business || !business.tables) return [];

    const normGame = (gameType || 'pool').toLowerCase();
    const matchingTables = (business.tables || []).filter((t: any) => {
      const type = ((t as any).game_type || (t as any).type || 'pool').toLowerCase();
      if (normGame === 'snooker') return type === 'snooker' || type === 'msnooker';
      return type === normGame;
    });

    if (matchingTables.length === 0) return [];

    const availableSlots: Array<{ time: string; tableId: string; tableName: string; ratePerHour: number }> = [];

    // Operating hours: 11:00 AM to 11:00 PM (11 to 23)
    const isToday = dateStr === getCurrentISTDateStr();
    const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const currentHour = parseInt(nowIst.split(':')[0], 10);

    // Calculate hourly rate from pricing_rules
    const rules: any = business.pricing_rules?.rules?.[normGame] || {};
    const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;

    for (let h = 11; h <= 22; h++) {
      if (isToday && h <= currentHour) continue; // Skip past hours today

      for (const table of matchingTables) {
        const check = await this.checkTableAvailability(businessId, table.id, dateStr, h * 60, durationMins);
        if (check.available) {
          availableSlots.push({
            time: `${String(h).padStart(2, '0')}:00`,
            tableId: table.id,
            tableName: table.name || table.id,
            ratePerHour
          });
          break; // One table per hour slot is sufficient for recommendation
        }
      }
    }

    return availableSlots;
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

    const parts = start_time.split(':');
    const startMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const endMins = startMins + duration_minutes;
    const endHours = Math.floor(endMins / 60) % 24;
    const endMinutes = endMins % 60;
    const end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
    const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
    const cleanPhone = (customer_phone || '').replace(/\D/g, '');

    // Step 0: Idempotency Check (Prevent duplicate webhooks or rapid double-taps)
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

    // Step 1: Resolve Canonical Table
    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return { success: false, reason: 'Business not found.' };
    }

    const resolved = this.resolveTable(business.tables || [], table_id);
    if (!resolved) {
      return { success: false, reason: `Table ${table_id} does not exist for this club.` };
    }

    const canonicalTableId = resolved.canonicalId;
    const aliases = resolved.aliases;

    // Step 2: Pre-check availability on server
    const initialCheck = await this.checkTableAvailability(business_id, canonicalTableId, booking_date, startMins, duration_minutes);
    if (!initialCheck.available) {
      return { success: false, reason: initialCheck.reason };
    }

    // Step 3: Link or create customer record in customers table
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

    // Step 4: Insert booking
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

    // Step 5: Concurrency collision detection (Race condition guard)
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, start_time, duration_minutes, end_time, created_at')
      .eq('business_id', business_id)
      .in('table_id', aliases)
      .eq('booking_date', booking_date)
      .in('status', ['confirmed', 'active', 'pending'])
      .neq('id', newBooking.id);

    if (conflicts && conflicts.length > 0) {
      for (const c of conflicts) {
        const cParts = c.start_time.split(':');
        const cStart = parseInt(cParts[0], 10) * 60 + parseInt(cParts[1], 10);
        let cEnd = cStart + (Number(c.duration_minutes) || 60);

        if (c.end_time) {
          const endParts = c.end_time.split(':');
          const calcEnd = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
          if (calcEnd > cStart) cEnd = calcEnd;
        }

        if (Math.max(startMins, cStart) < Math.min(endMins, cEnd)) {
          // Collision: Concede to the earlier created booking
          if (
            new Date(c.created_at) < new Date(newBooking.created_at) ||
            (new Date(c.created_at).getTime() === new Date(newBooking.created_at).getTime() && c.id < newBooking.id)
          ) {
            await supabase.from('bookings').delete().eq('id', newBooking.id);
            return {
              success: false,
              reason: 'This table slot is already booked and was just reserved by another customer a moment ago. Please select another time.'
            };
          }
        }
      }
    }

    // Step 6: Trigger Realtime dashboard sync non-blocking
    try {
      await supabase.from('dashboard_syncs').insert({
        business_id,
        triggered_by: `booking_${source}_${newBooking.id}`
      });
    } catch {}

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

    try {
      await supabase.from('dashboard_syncs').insert({
        business_id: booking.business_id,
        triggered_by: `cancel_booking_${bookingId}`
      });
    } catch {}

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
    const parts = newStartTime.split(':');
    const startMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const endMins = startMins + duration;
    const endHours = Math.floor(endMins / 60) % 24;
    const endMinutes = endMins % 60;
    const end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
    const formattedStartTime = newStartTime.length === 5 ? `${newStartTime}:00` : newStartTime;

    // Verify availability for the requested new slot
    const check = await this.checkTableAvailability(booking.business_id, booking.table_id, newDate, startMins, duration);
    if (!check.available) {
      return { success: false, reason: check.reason || 'The requested new slot is not available.' };
    }

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

    // Trigger Realtime dashboard sync
    try {
      await supabase.from('dashboard_syncs').insert({
        business_id: booking.business_id,
        triggered_by: `reschedule_booking_${bookingId}`
      });
    } catch {}

    return { success: true, booking: updatedBooking };
  }
};
