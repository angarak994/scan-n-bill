import { supabase } from '@/lib/supabaseClient';
import { getCurrentISTDateStr } from '@/lib/billing';

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
    
    // 1. Check existing confirmed/active bookings for overlap
    const { data: existingBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, start_time, duration_minutes, end_time, status')
      .eq('business_id', businessId)
      .eq('table_id', tableId)
      .eq('booking_date', bookingDate)
      .in('status', ['confirmed', 'active']);

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
  }
};
