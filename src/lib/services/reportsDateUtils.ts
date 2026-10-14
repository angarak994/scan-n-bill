/**
 * Date boundary and comparison window resolution for QControl Reports & KPIs.
 * 
 * Rules:
 * - Half-open intervals: [start, end)
 * - Authoritative business timezone: Asia/Kolkata (UTC+05:30)
 * - Exact comparison windows:
 *   - "today" -> compared to yesterday (same elapsed time)
 *   - "yesterday" -> compared to day before yesterday (full 24h)
 *   - "last7" -> preceding 7 days
 *   - "last30" -> preceding 30 days
 *   - "thisMonth" -> 1st of month to now, compared to 1st of previous month to same elapsed duration
 *   - "previousMonth" -> full previous month, compared to full month prior
 *   - "custom" -> [start, end), compared to preceding interval of equal length
 *   - "allTime" -> [epoch, now), comparison is null
 */

export type ReportPreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'previousMonth' | 'allTime' | 'custom';
export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface DateWindow {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  label: string;
}

export interface ResolvedReportRange {
  preset: ReportPreset;
  timezone: string;
  asOf: string;
  current: DateWindow;
  comparison: DateWindow | null;
  granularity: Granularity;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Returns year, month (1-12), day (1-31), hour, minute in the target timezone
 */
export function getZonedDateParts(date: Date, timezone: string = 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10), // 1-indexed
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
  };
}

/**
 * Constructs a Date object representing the given year/month/day/hour/min/sec in Asia/Kolkata
 */
export function createDateInTimezone(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0, timezone = 'Asia/Kolkata'): Date {
  if (timezone === 'Asia/Kolkata') {
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms) - IST_OFFSET_MS;
    return new Date(utcMs);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoCandidate = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}Z`;
  const tempDate = new Date(isoCandidate);
  const diff = tempDate.getTime() - new Date(tempDate.toLocaleString('en-US', { timeZone: timezone })).getTime();
  return new Date(tempDate.getTime() + diff);
}

/**
 * Format date in English (Indian locale)
 */
export function formatDateLabel(d: Date, timezone: string = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

export function formatDateTimeLabel(d: Date, timezone: string = 'Asia/Kolkata'): string {
  const dateStr = formatDateLabel(d, timezone);
  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d).toLowerCase();
  return `${dateStr}, ${timeStr}`;
}

/**
 * Resolves standard report boundaries and their comparison windows
 */
export function resolveReportRange(
  preset: ReportPreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date(),
  timezone: string = 'Asia/Kolkata'
): ResolvedReportRange {
  const parts = getZonedDateParts(now, timezone);
  const todayStart = createDateInTimezone(parts.year, parts.month, parts.day, 0, 0, 0, 0, timezone);
  const todayEnd = createDateInTimezone(parts.year, parts.month, parts.day + 1, 0, 0, 0, 0, timezone);

  let currentStart: Date;
  let currentEnd: Date;
  let compStart: Date | null = null;
  let compEnd: Date | null = null;
  let compLabel = '';
  let granularity: Granularity = 'daily';

  switch (preset) {
    case 'today': {
      currentStart = todayStart;
      currentEnd = todayEnd;
      // Compare to yesterday
      compStart = createDateInTimezone(parts.year, parts.month, parts.day - 1, 0, 0, 0, 0, timezone);
      compEnd = todayStart;
      compLabel = 'vs yesterday';
      granularity = 'hourly';
      break;
    }
    case 'yesterday': {
      currentStart = createDateInTimezone(parts.year, parts.month, parts.day - 1, 0, 0, 0, 0, timezone);
      currentEnd = todayStart;
      // Compare to day before yesterday
      compStart = createDateInTimezone(parts.year, parts.month, parts.day - 2, 0, 0, 0, 0, timezone);
      compEnd = currentStart;
      compLabel = 'vs previous day';
      granularity = 'hourly';
      break;
    }
    case 'last7': {
      currentStart = createDateInTimezone(parts.year, parts.month, parts.day - 6, 0, 0, 0, 0, timezone);
      currentEnd = todayEnd;
      const lengthMs = currentEnd.getTime() - currentStart.getTime();
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - lengthMs);
      compLabel = `vs previous 7 days`;
      granularity = 'daily';
      break;
    }
    case 'last30': {
      currentStart = createDateInTimezone(parts.year, parts.month, parts.day - 29, 0, 0, 0, 0, timezone);
      currentEnd = todayEnd;
      const lengthMs = currentEnd.getTime() - currentStart.getTime();
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - lengthMs);
      compLabel = `vs previous 30 days`;
      granularity = 'daily';
      break;
    }
    case 'thisMonth': {
      // 1st of month to today end (or current time)
      currentStart = createDateInTimezone(parts.year, parts.month, 1, 0, 0, 0, 0, timezone);
      currentEnd = todayEnd;
      
      // Comparison: same elapsed days of previous month
      const prevYear = parts.month === 1 ? parts.year - 1 : parts.year;
      const prevMonth = parts.month === 1 ? 12 : parts.month - 1;
      
      compStart = createDateInTimezone(prevYear, prevMonth, 1, 0, 0, 0, 0, timezone);
      // Days in previous month
      const daysInPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      const compElapsedDays = Math.min(parts.day, daysInPrevMonth);
      compEnd = createDateInTimezone(prevYear, prevMonth, compElapsedDays + 1, 0, 0, 0, 0, timezone);
      
      const prevMonthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(prevYear, prevMonth - 1, 1));
      compLabel = `vs 1–${compElapsedDays} ${prevMonthName}`;
      granularity = 'daily';
      break;
    }
    case 'previousMonth': {
      const prevYear = parts.month === 1 ? parts.year - 1 : parts.year;
      const prevMonth = parts.month === 1 ? 12 : parts.month - 1;
      currentStart = createDateInTimezone(prevYear, prevMonth, 1, 0, 0, 0, 0, timezone);
      
      // Current month 1st is the end boundary of previous month
      currentEnd = createDateInTimezone(parts.year, parts.month, 1, 0, 0, 0, 0, timezone);
      
      // Month prior to previous month
      const priorYear = prevMonth === 1 ? prevYear - 1 : prevYear;
      const priorMonth = prevMonth === 1 ? 12 : prevMonth - 1;
      compStart = createDateInTimezone(priorYear, priorMonth, 1, 0, 0, 0, 0, timezone);
      compEnd = currentStart;
      
      const priorMonthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(priorYear, priorMonth - 1, 1));
      compLabel = `vs ${priorMonthName}`;
      granularity = 'daily';
      break;
    }
    case 'allTime': {
      currentStart = new Date(0); // 1970-01-01
      currentEnd = new Date(now.getTime() + 24 * 3600 * 1000); // Future buffer
      compStart = null;
      compEnd = null;
      compLabel = '';
      granularity = 'monthly';
      break;
    }
    case 'custom': {
      if (!customStart || !customEnd) {
        throw new Error('Both start date and end date are required for custom range.');
      }
      const [sY, sM, sD] = customStart.split('-').map(Number);
      const [eY, eM, eD] = customEnd.split('-').map(Number);
      if (!sY || !sM || !sD || !eY || !eM || !eD) {
        throw new Error('Invalid custom date format. Expected YYYY-MM-DD.');
      }

      currentStart = createDateInTimezone(sY, sM, sD, 0, 0, 0, 0, timezone);
      currentEnd = createDateInTimezone(eY, eM, eD + 1, 0, 0, 0, 0, timezone);

      if (currentStart.getTime() >= currentEnd.getTime()) {
        throw new Error('Start date must be earlier than or equal to end date.');
      }

      const diffDays = Math.round((currentEnd.getTime() - currentStart.getTime()) / (24 * 3600 * 1000));
      if (diffDays > 365 * 5) {
        throw new Error('Custom range cannot exceed 5 years.');
      }

      const lengthMs = currentEnd.getTime() - currentStart.getTime();
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - lengthMs);
      compLabel = `vs previous ${diffDays} days`;

      if (diffDays <= 1) granularity = 'hourly';
      else if (diffDays <= 90) granularity = 'daily';
      else if (diffDays <= 365) granularity = 'weekly';
      else granularity = 'monthly';
      break;
    }
    default:
      throw new Error(`Unknown report preset: ${preset}`);
  }

  const asOf = formatDateTimeLabel(now, timezone);

  const currentWindow: DateWindow = {
    start: currentStart,
    end: currentEnd,
    startIso: currentStart.toISOString(),
    endIso: currentEnd.toISOString(),
    label: preset === 'thisMonth' 
      ? `1–${parts.day} ${new Intl.DateTimeFormat('en-US', { month: 'short' }).format(now)}`
      : `${formatDateLabel(currentStart, timezone)} – ${formatDateLabel(new Date(currentEnd.getTime() - 1), timezone)}`
  };

  const comparisonWindow: DateWindow | null = compStart && compEnd ? {
    start: compStart,
    end: compEnd,
    startIso: compStart.toISOString(),
    endIso: compEnd.toISOString(),
    label: compLabel
  } : null;

  return {
    preset,
    timezone,
    asOf,
    current: currentWindow,
    comparison: comparisonWindow,
    granularity
  };
}

/**
 * Format currency in INR (en-IN)
 * Money is integer rounded without decimals
 */
export function formatINR(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const rounded = Math.round(amount);
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString('en-IN');
  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

/**
 * Calculates percentage change and direction
 * Avoids NaN and Infinity
 */
export function calculateDelta(current: number, previous: number | null | undefined): {
  pct: number | null;
  formatted: string;
  direction: 'up' | 'down' | 'flat' | null;
  isPositive: boolean;
} {
  if (previous === null || previous === undefined || previous === 0) {
    if (current > 0 && previous === 0) {
      return { pct: 100, formatted: '+100%', direction: 'up', isPositive: true };
    }
    return { pct: null, formatted: '—', direction: null, isPositive: false };
  }

  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;
  const roundedPct = Math.round(pct * 10) / 10;

  if (roundedPct > 0) {
    return { pct: roundedPct, formatted: `+${roundedPct}%`, direction: 'up', isPositive: true };
  } else if (roundedPct < 0) {
    return { pct: roundedPct, formatted: `${roundedPct}%`, direction: 'down', isPositive: false };
  }
  return { pct: 0, formatted: '0%', direction: 'flat', isPositive: true };
}
