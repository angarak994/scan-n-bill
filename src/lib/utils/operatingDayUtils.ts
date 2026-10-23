/**
 * QControl Operating Day & Timezone Utility
 * 
 * Single authoritative engine for:
 * 1. Configurable business timezone (default Asia/Kolkata, supports DST-observing timezones)
 * 2. Operating hours with full overnight / after-midnight support (e.g. 18:00 to 03:00)
 * 3. Business Operating Day mapping (1:00 AM on Saturday belongs to Friday's business operating day)
 * 4. Overnight slot conversion into unambiguous UTC ISO instants and timestamptz ranges
 * 5. Slot generation across midnight without date drift
 */

export interface OperatingHoursConfig {
  open_time: string; // "10:00" or "18:00" (HH:mm)
  close_time: string; // "03:00" or "23:30" (HH:mm)
  timezone: string; // "Asia/Kolkata", "America/New_York", etc.
  slot_interval_minutes: number; // default 30
  buffer_minutes: number; // default 0
  min_duration_minutes: number; // default 30
  max_duration_minutes: number; // default 360
  advance_booking_days: number; // default 14
  last_booking_lead_minutes: number; // default 15
}

export const DEFAULT_OPERATING_HOURS: OperatingHoursConfig = {
  open_time: '10:00',
  close_time: '03:00', // Open until 3 AM by default to support nightlife clubs
  timezone: 'Asia/Kolkata',
  slot_interval_minutes: 30,
  buffer_minutes: 0,
  min_duration_minutes: 30,
  max_duration_minutes: 360,
  advance_booking_days: 14,
  last_booking_lead_minutes: 15,
};

export interface SlotInstantRange {
  startInstant: Date;
  endInstant: Date;
  startIso: string;
  endIso: string;
  startDisplayTime: string; // "11:30 PM" or "01:00 AM"
  endDisplayTime: string;
  calendarDateStart: string; // "YYYY-MM-DD" in business timezone
  calendarDateEnd: string;
  operatingDay: string; // "YYYY-MM-DD"
}

export interface OperatingHoursSummary {
  isOpenOvernight: boolean;
  openMinutes: number; // minutes from 00:00
  closeMinutes: number; // minutes from 00:00 (may be < openMinutes if overnight)
  totalSpanMinutes: number; // e.g., 18:00 to 03:00 = 9 hours = 540 minutes
  openTimeFormatted: string;
  closeTimeFormatted: string;
}

/**
 * Parses "HH:mm" or "HH:mm:ss" into minutes from midnight (0 - 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  const hours = parts[0] || 0;
  const mins = parts[1] || 0;
  return hours * 60 + mins;
}

/**
 * Converts minutes from midnight into "HH:mm".
 */
export function minutesToTimeString(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Resolves OperatingHoursConfig from a business database record.
 */
export function resolveBusinessConfig(business: any): OperatingHoursConfig {
  const cfg = business?.operating_hours || business?.booking_config || {};
  const tz = business?.timezone || cfg?.timezone || 'Asia/Kolkata';

  return {
    open_time: cfg.open_time || business?.open_time || DEFAULT_OPERATING_HOURS.open_time,
    close_time: cfg.close_time || business?.close_time || DEFAULT_OPERATING_HOURS.close_time,
    timezone: tz,
    slot_interval_minutes: Number(cfg.slot_interval_minutes) || DEFAULT_OPERATING_HOURS.slot_interval_minutes,
    buffer_minutes: Number(cfg.buffer_minutes) || DEFAULT_OPERATING_HOURS.buffer_minutes,
    min_duration_minutes: Number(cfg.min_duration_minutes) || DEFAULT_OPERATING_HOURS.min_duration_minutes,
    max_duration_minutes: Number(cfg.max_duration_minutes) || DEFAULT_OPERATING_HOURS.max_duration_minutes,
    advance_booking_days: Number(cfg.advance_booking_days) || DEFAULT_OPERATING_HOURS.advance_booking_days,
    last_booking_lead_minutes: Number(cfg.last_booking_lead_minutes) || DEFAULT_OPERATING_HOURS.last_booking_lead_minutes,
  };
}

/**
 * Inspects operating hours to determine if they cross midnight.
 */
export function inspectOperatingHours(config: OperatingHoursConfig): OperatingHoursSummary {
  const openMins = timeStringToMinutes(config.open_time);
  const closeMins = timeStringToMinutes(config.close_time);
  const isOpenOvernight = closeMins <= openMins;

  const totalSpanMinutes = isOpenOvernight
    ? (1440 - openMins) + closeMins
    : closeMins - openMins;

  return {
    isOpenOvernight,
    openMinutes: openMins,
    closeMinutes: closeMins,
    totalSpanMinutes,
    openTimeFormatted: formatMinutesTo12Hour(openMins),
    closeTimeFormatted: formatMinutesTo12Hour(closeMins),
  };
}

/**
 * Formats minutes from midnight to "hh:mm A" string (e.g. 60 -> "01:00 AM").
 */
export function formatMinutesTo12Hour(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(norm / 60);
  const m = norm % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Formats "HH:mm" or "HH:mm:ss" string to "hh:mm A" (e.g. "01:00" -> "01:00 AM").
 */
export function formatTimeTo12Hour(timeStr: string): string {
  if (!timeStr) return '';
  return formatMinutesTo12Hour(timeStringToMinutes(timeStr));
}

/**
 * Gets the current date & time parts in a specific IANA timezone safely using Intl.
 */
export function getTimezoneParts(date: Date, timezone: string): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  isoDate: string; // "YYYY-MM-DD"
  timeString: string; // "HH:mm"
  totalMinutes: number; // hour * 60 + minute
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = 1970;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    else if (p.type === 'month') month = parseInt(p.value, 10);
    else if (p.type === 'day') day = parseInt(p.value, 10);
    else if (p.type === 'hour') hour = parseInt(p.value, 10);
    else if (p.type === 'minute') minute = parseInt(p.value, 10);
    else if (p.type === 'second') second = parseInt(p.value, 10);
  }

  // Handle midnight 24:00 edge case in some locales
  if (hour === 24) hour = 0;

  const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const totalMinutes = hour * 60 + minute;

  return { year, month, day, hour, minute, second, isoDate, timeString, totalMinutes };
}

/**
 * Converts a calendar date string ("YYYY-MM-DD") and time string ("HH:mm") in a specific timezone
 * into an unambiguous UTC Date instant.
 * Handles DST shifts automatically.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const parts = timeStr.split(':').map(Number);
  const hour = parts[0] || 0;
  const minute = parts[1] || 0;
  const second = parts[2] || 0;

  // Initial estimate treating local as UTC
  let utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Refine guess with timezone offset difference
  for (let iter = 0; iter < 3; iter++) {
    const tzParts = getTimezoneParts(utcGuess, timezone);
    const tzMinutes = Date.UTC(tzParts.year, tzParts.month - 1, tzParts.day, tzParts.hour, tzParts.minute, tzParts.second);
    const targetMinutes = Date.UTC(year, month - 1, day, hour, minute, second);
    const diff = targetMinutes - tzMinutes;
    if (diff === 0) break;
    utcGuess = new Date(utcGuess.getTime() + diff);
  }

  return utcGuess;
}

/**
 * Calculates the current Business Operating Day string ("YYYY-MM-DD").
 * 
 * E.g., if operating hours are 18:00 to 03:00, and current time in business timezone
 * is Saturday 01:30 AM, 01:30 AM belongs to Friday's operating day!
 */
export function getCurrentOperatingDay(config: OperatingHoursConfig, now: Date = new Date()): string {
  const parts = getTimezoneParts(now, config.timezone);
  const summary = inspectOperatingHours(config);

  if (summary.isOpenOvernight) {
    // If current time is past midnight but before close_time (e.g. 01:30 AM when closing is 03:00 AM)
    if (parts.totalMinutes < summary.closeMinutes) {
      // Belongs to the previous calendar day
      const prevDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return getTimezoneParts(prevDate, config.timezone).isoDate;
    }
  }

  return parts.isoDate;
}

/**
 * Determines whether a requested time (e.g. "01:00") on an operating day is past midnight.
 */
export function isOvernightSlot(timeStr: string, config: OperatingHoursConfig): boolean {
  const summary = inspectOperatingHours(config);
  if (!summary.isOpenOvernight) return false;
  const mins = timeStringToMinutes(timeStr);
  return mins < summary.closeMinutes;
}

/**
 * Maps an operating day (e.g. "2026-10-23") + slot time (e.g. "01:00") + duration
 * into absolute, unambiguous UTC start and end instants.
 * 
 * CRITICAL RULE: If a slot is after midnight (e.g. "01:00") in an overnight window
 * for operating day "2026-10-23", its calendar day is "2026-10-24".
 * If a slot starts before midnight (e.g. "23:30") and lasts 60m, it ends on "2026-10-24 00:30".
 * The end instant is ALWAYS strictly greater than the start instant.
 */
export function slotToInstants(
  operatingDay: string,
  startTimeStr: string,
  durationMinutes: number,
  config: OperatingHoursConfig
): SlotInstantRange {
  const summary = inspectOperatingHours(config);
  const startMins = timeStringToMinutes(startTimeStr);

  let calendarDateStart = operatingDay;
  if (summary.isOpenOvernight && startMins < summary.closeMinutes) {
    // Slot is after midnight (e.g. 01:00 AM): calendar day is operatingDay + 1 day
    const opDayUtc = new Date(`${operatingDay}T12:00:00Z`);
    const nextDay = new Date(opDayUtc.getTime() + 24 * 60 * 60 * 1000);
    calendarDateStart = nextDay.toISOString().split('T')[0];
  }

  const startInstant = zonedTimeToUtc(calendarDateStart, startTimeStr, config.timezone);
  const endInstant = new Date(startInstant.getTime() + durationMinutes * 60 * 1000);

  const startParts = getTimezoneParts(startInstant, config.timezone);
  const endParts = getTimezoneParts(endInstant, config.timezone);

  return {
    startInstant,
    endInstant,
    startIso: startInstant.toISOString(),
    endIso: endInstant.toISOString(),
    startDisplayTime: formatMinutesTo12Hour(startParts.totalMinutes),
    endDisplayTime: formatMinutesTo12Hour(endParts.totalMinutes),
    calendarDateStart: startParts.isoDate,
    calendarDateEnd: endParts.isoDate,
    operatingDay,
  };
}

/**
 * Validates whether a requested time and duration falls strictly within the operating hours window.
 */
export function isWithinOperatingHours(
  startTimeStr: string,
  durationMinutes: number,
  config: OperatingHoursConfig
): { valid: boolean; reason?: string } {
  const summary = inspectOperatingHours(config);
  const startMins = timeStringToMinutes(startTimeStr);
  const endMins = startMins + durationMinutes;

  if (summary.isOpenOvernight) {
    // Overnight window (e.g. 18:00 to 03:00)
    // Normalized timeline: 18:00 is minute 0, 23:59 is 359, 00:00 is 360, 03:00 is 540.
    const open = summary.openMinutes;
    const close = summary.closeMinutes;

    const normStart = startMins >= open ? startMins - open : startMins + (1440 - open);
    const normEnd = normStart + durationMinutes;
    const maxSpan = summary.totalSpanMinutes;

    if (normStart < 0 || normEnd > maxSpan) {
      return {
        valid: false,
        reason: `Club operates from ${summary.openTimeFormatted} to ${summary.closeTimeFormatted}. Requested time (${formatMinutesTo12Hour(startMins)} for ${durationMinutes}m) extends past closing time.`,
      };
    }
  } else {
    // Standard daytime window (e.g. 10:00 to 23:00)
    if (startMins < summary.openMinutes || endMins > summary.closeMinutes) {
      return {
        valid: false,
        reason: `Club operates from ${summary.openTimeFormatted} to ${summary.closeTimeFormatted}. Please select a time within operating hours.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Generates all candidate slots for a given operating day.
 * Correctly generates overnight slots across midnight (e.g. 18:00, 19:00, ... 00:00, 01:00, 02:00).
 * Skips slots that have already passed if operatingDay is current operating day.
 */
export function generateCandidateSlots(
  operatingDay: string,
  durationMinutes: number,
  config: OperatingHoursConfig,
  now: Date = new Date()
): Array<{ time: string; displayTime: string; isOvernight: boolean }> {
  const summary = inspectOperatingHours(config);
  const interval = config.slot_interval_minutes || 30;
  const currentOpDay = getCurrentOperatingDay(config, now);
  const isTodayOpDay = operatingDay === currentOpDay;

  const candidateSlots: Array<{ time: string; displayTime: string; isOvernight: boolean }> = [];
  const totalSlots = Math.floor((summary.totalSpanMinutes - durationMinutes) / interval);

  for (let i = 0; i <= totalSlots; i++) {
    const offsetMins = i * interval;
    const rawMins = (summary.openMinutes + offsetMins) % 1440;
    const timeStr = minutesToTimeString(rawMins);

    // Validate that slot + duration fits within hours
    const hoursCheck = isWithinOperatingHours(timeStr, durationMinutes, config);
    if (!hoursCheck.valid) continue;

    // Check if slot has already passed in real-time
    if (isTodayOpDay) {
      const instants = slotToInstants(operatingDay, timeStr, durationMinutes, config);
      // Lead buffer: e.g. cannot book 5 minutes before or after it started
      const leadMs = (config.last_booking_lead_minutes || 0) * 60 * 1000;
      if (instants.startInstant.getTime() <= now.getTime() + leadMs) {
        continue;
      }
    }

    candidateSlots.push({
      time: timeStr,
      displayTime: formatTimeTo12Hour(timeStr),
      isOvernight: summary.isOpenOvernight && rawMins < summary.closeMinutes,
    });
  }

  return candidateSlots;
}

/**
 * Checks whether two time ranges overlap.
 * Uses half-open interval comparison: max(s1, s2) < min(e1, e2)
 */
export function doInstantsOverlap(s1: Date, e1: Date, s2: Date, e2: Date, bufferMinutes = 0): boolean {
  const bufMs = bufferMinutes * 60 * 1000;
  const start1 = s1.getTime();
  const end1 = e1.getTime() + bufMs;
  const start2 = s2.getTime();
  const end2 = e2.getTime() + bufMs;

  return Math.max(start1, start2) < Math.min(end1, end2);
}
