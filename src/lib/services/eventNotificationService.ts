import { supabase } from '@/lib/supabaseClient';
import { TelegramClient } from '@/lib/telegram/telegramClient';
import { formatTimeTo12Hour } from '@/lib/utils/operatingDayUtils';

export interface BookingEventPayload {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone?: string;
  table_id: string;
  booking_date: string;
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  game_type?: string;
  source?: string;
  status?: string;
}

export const eventNotificationService = {
  /**
   * Notifies all authorized Telegram owners when a new booking is recorded.
   */
  async notifyBookingCreated(booking: BookingEventPayload, business: any): Promise<void> {
    if (!business || !booking) return;

    try {
      const gs = business.pricing_rules?.globalSettings as any;
      const owners = (gs?.authorized_telegram_owners || []).filter((o: any) => o.status !== 'revoked' && o.chatId);

      // Trigger Realtime Dashboard Sync
      try {
        await supabase.from('dashboard_syncs').insert({
          business_id: booking.business_id,
          triggered_by: `new_booking_${booking.source || 'system'}_${booking.id}`
        });
      } catch {}

      if (owners.length === 0) return;

      const normGame = (booking.game_type || 'pool').toLowerCase();
      const rules = business.pricing_rules?.rules?.[normGame] || {};
      const ratePerHour = Number(rules.rate || rules.baseRatePerHour || (rules.type === 'time_based' ? rules.evening_rate : 200)) || 200;
      const estimatedTotal = Math.round((ratePerHour * (booking.duration_minutes || 60)) / 60);

      const tableObj = (business.tables || []).find((t: any) => String(t.id).toLowerCase() === String(booking.table_id).toLowerCase());
      const tableName = tableObj?.name || booking.table_id;
      const displayTime = formatTimeTo12Hour(booking.start_time);
      const bookingCode = `QC-${booking.id.substring(0, 6).toUpperCase()}`;

      const msg = `🎱 <b>New Booking Confirmed!</b> (#${bookingCode})

👤 <b>Customer:</b> ${booking.customer_name}
📱 <b>Phone:</b> ${booking.customer_phone || 'Walk-In'}
📅 <b>Date:</b> ${booking.booking_date}
⏰ <b>Time:</b> ${displayTime} (${booking.duration_minutes} mins)
🏓 <b>Table:</b> ${tableName} (${normGame.toUpperCase()})
🌐 <b>Channel:</b> ${(booking.source || 'whatsapp').toUpperCase()}
💰 <b>Est. Revenue:</b> ₹${estimatedTotal}`;

      const inlineKeyboard = [
        [
          { text: '🟢 Start Session', callback_data: `start_from_booking_${booking.id}` },
          { text: '❌ Cancel', callback_data: `cancel_booking_${booking.id}` }
        ]
      ];

      for (const owner of owners) {
        TelegramClient.sendMessage(owner.chatId, msg, { inline_keyboard: inlineKeyboard }).catch(err => {
          console.warn(`[EventNotification] Failed to alert owner ${owner.chatId} for booking ${booking.id}:`, err?.message);
        });
      }
    } catch (err: any) {
      console.warn('[EventNotification] Error notifying owners of new booking:', err?.message);
    }
  },

  /**
   * Notifies authorized owners when a booking is cancelled.
   */
  async notifyBookingCancelled(booking: BookingEventPayload, business: any, reason?: string): Promise<void> {
    if (!business || !booking) return;

    try {
      const gs = business.pricing_rules?.globalSettings as any;
      const owners = (gs?.authorized_telegram_owners || []).filter((o: any) => o.status !== 'revoked' && o.chatId);

      // Trigger Realtime Dashboard Sync
      try {
        await supabase.from('dashboard_syncs').insert({
          business_id: booking.business_id,
          triggered_by: `cancelled_booking_${booking.id}`
        });
      } catch {}

      if (owners.length === 0) return;

      const displayTime = formatTimeTo12Hour(booking.start_time);
      const bookingCode = `QC-${booking.id.substring(0, 6).toUpperCase()}`;

      const msg = `⚠️ <b>Booking Cancelled</b> (#${bookingCode})

👤 <b>Customer:</b> ${booking.customer_name}
📅 <b>Date:</b> ${booking.booking_date}
⏰ <b>Time:</b> ${displayTime}
🏓 <b>Table:</b> ${booking.table_id}
ℹ️ <b>Reason:</b> ${reason || 'Cancelled by customer'}`;

      for (const owner of owners) {
        TelegramClient.sendMessage(owner.chatId, msg).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[EventNotification] Error notifying owners of cancellation:', err?.message);
    }
  },

  /**
   * Notifies authorized owners when a booking is rescheduled.
   */
  async notifyBookingRescheduled(booking: BookingEventPayload, business: any, oldTime: string, newTime: string): Promise<void> {
    if (!business || !booking) return;

    try {
      const gs = business.pricing_rules?.globalSettings as any;
      const owners = (gs?.authorized_telegram_owners || []).filter((o: any) => o.status !== 'revoked' && o.chatId);

      // Trigger Realtime Dashboard Sync
      try {
        await supabase.from('dashboard_syncs').insert({
          business_id: booking.business_id,
          triggered_by: `rescheduled_booking_${booking.id}`
        });
      } catch {}

      if (owners.length === 0) return;

      const oldDisplay = formatTimeTo12Hour(oldTime);
      const newDisplay = formatTimeTo12Hour(newTime);
      const bookingCode = `QC-${booking.id.substring(0, 6).toUpperCase()}`;

      const msg = `🔄 <b>Booking Rescheduled</b> (#${bookingCode})

👤 <b>Customer:</b> ${booking.customer_name}
📅 <b>New Date:</b> ${booking.booking_date}
⏰ <b>Time Changed:</b> ${oldDisplay} ➡️ <b>${newDisplay}</b>
🏓 <b>Table:</b> ${booking.table_id}`;

      for (const owner of owners) {
        TelegramClient.sendMessage(owner.chatId, msg).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[EventNotification] Error notifying owners of reschedule:', err?.message);
    }
  }
};
