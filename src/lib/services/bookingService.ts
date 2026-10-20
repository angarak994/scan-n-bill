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
  source?: 'whatsapp' | 'manual' | 'qr' | 'telegram';
}

export const bookingService = {
  /**
   * Checks if a table is available for a given time slot.
   * Resolves with { available: true } or { available: false, reason: string }.
   */
  async checkTableAvailability(
    businessId: string,
    tableId: string,
    bookingDate: string,
    startMins: number,
    durationMins: number
  ): Promise<{ available: boolean; reason?: string }> {
    const endMins = startMins + durationMins;

    // 0. Verify table ownership/existence in business
    const business = await businessManager.getBusiness(businessId);
    if (!business) {
      return { available: false, reason: 'Club not found or inactive.' };
    }

    const tableExists = (business.tables || []).some((t: any) => t.id === tableId);
    if (!tableExists) {
      return { available: false, reason: `Table ${tableId} does not belong to ${business.business_name}.` };
    }
    
    // 1. Check existing confirmed/active bookings for overlap
    const { data: existingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, start_time, duration_minutes, end_time, status')
      .eq('business_id', businessId)
      .eq('table_id', tableId)
      .eq('booking_date', bookingDate)
      .in('status', ['confirmed', 'active', 'pending']);

    if (fetchError) {
      console.error('Error fetching existing bookings for availability check:', fetchError);
      return { available: false, reason: 'Failed to verify table availability due to database error.' };
    }

    if (existingBookings && existingBookings.length > 0) {
      for (const b of existingBookings) {
        if (!b.start_time) continue;
        const bParts = b.start_time.split(':');
        const bStart = parseInt(bParts[0], 10) * 60 + parseInt(bParts[1], 10);
        const bDuration = Number(b.duration_minutes) || 60;
        const bEnd = bStart + bDuration;

        // Check time slot overlap: max(start1, start2) < min(end1, end2)
        if (Math.max(startMins, bStart) < Math.min(endMins, bEnd)) {
          const slotDisplay = b.start_time.substring(0, 5);
          return { available: false, reason: `Table ${tableId} is already booked from ${slotDisplay} for ${bDuration} minutes.` };
        }
      }
    }

    // 2. If booking is for today and spans current time, verify table isn't in an active session
    const todayStr = getCurrentISTDateStr();
    if (bookingDate === todayStr) {
      const nowIst = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
      const nowParts = nowIst.split(':');
      const nowMins = parseInt(nowParts[0], 10) * 60 + parseInt(nowParts[1], 10);

      // Only reject if the requested slot overlaps with CURRENT time (active session)
      if (startMins <= nowMins && endMins > nowMins) {
        const { data: activeSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('business_id', businessId)
          .eq('table_id', tableId)
          .eq('status', 'ACTIVE');

        if (activeSessions && activeSessions.length > 0) {
          return { available: false, reason: `Table ${tableId} is currently occupied by a live active session.` };
        }
      }
    }

    return { available: true };
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
  async createAtomicBooking(params: BookingCreationParams): Promise<{ success: boolean; booking?: any; reason?: string }> {
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
      source = 'whatsapp'
    } = params;

    const parts = start_time.split(':');
    const startMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    const endMins = startMins + duration_minutes;
    const endHours = Math.floor(endMins / 60) % 24;
    const endMinutes = endMins % 60;
    const end_time = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
    const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;

    // Step 1: Pre-check availability
    const initialCheck = await this.checkTableAvailability(business_id, table_id, booking_date, startMins, duration_minutes);
    if (!initialCheck.available) {
      return { success: false, reason: initialCheck.reason };
    }

    // Step 2: Insert booking
    const cleanPhone = (customer_phone || '').replace(/\D/g, '');
    const { data: newBooking, error: insertError } = await supabase
      .from('bookings')
      .insert({
        business_id,
        table_id,
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
      })
      .select()
      .single();

    if (insertError || !newBooking) {
      console.error('Database insert error during booking creation:', insertError);
      return { success: false, reason: 'Failed to record reservation in database.' };
    }

    // Step 3: Concurrency collision detection (Race condition guard)
    // Verify no conflicting booking exists with an earlier or equal created_at timestamp
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, start_time, duration_minutes, created_at')
      .eq('business_id', business_id)
      .eq('table_id', table_id)
      .eq('booking_date', booking_date)
      .in('status', ['confirmed', 'active'])
      .neq('id', newBooking.id);

    if (conflicts && conflicts.length > 0) {
      for (const c of conflicts) {
        const cParts = c.start_time.split(':');
        const cStart = parseInt(cParts[0], 10) * 60 + parseInt(cParts[1], 10);
        const cEnd = cStart + (Number(c.duration_minutes) || 60);

        if (Math.max(startMins, cStart) < Math.min(endMins, cEnd)) {
          // A collision occurred! If the other booking was created earlier, we concede
          if (new Date(c.created_at) <= new Date(newBooking.created_at)) {
            // Delete or cancel our booking to prevent double-booking
            await supabase.from('bookings').delete().eq('id', newBooking.id);
            return {
              success: false,
              reason: 'This table slot was just reserved by another player a moment ago. Please select another table or time.'
            };
          }
        }
      }
    }

    // Step 4: Trigger Realtime dashboard sync so all channels update simultaneously
    try {
      await supabase.from('dashboard_syncs').insert({
        business_id,
        triggered_by: `booking_${source}_${newBooking.id}`
      });
    } catch {
      // Non-blocking
    }

    return { success: true, booking: newBooking };
  },

  /**
   * Retrieves active upcoming bookings for a customer.
   */
  async getCustomerBookings(customerPhone: string, businessId?: string): Promise<any[]> {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    let query = supabase
      .from('bookings')
      .select('*, businesses(business_name, address, contact_number)')
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
   * Cancels a booking safely.
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
      return { success: false, reason: 'Booking belongs to a different club.' };
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
    } catch {
      // Non-blocking
    }

    return { success: true, booking };
  }
};

