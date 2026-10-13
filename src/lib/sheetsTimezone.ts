/**
 * Timezone and monthly date partition utilities for QControl Google Sheets Integration.
 * 
 * Rules:
 * - Authoritative business timezone (default: 'Asia/Kolkata')
 * - Format: consistent 'YYYY-MM' month key internally
 * - Sheet names: 'Sessions_YYYY_MM' and 'Orders_YYYY_MM'
 * - Canonical month for sessions is determined by authoritative session start_time.
 * - Sessions crossing midnight or month boundaries stay canonical to start_time (no duplication).
 */

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kolkata';

/**
 * Extracts business timezone from business record or returns default.
 */
export function getBusinessTimezone(business?: any): string {
  if (!business) return DEFAULT_BUSINESS_TIMEZONE;
  const tz = business.pricing_rules?.globalSettings?.timezone 
    || business.pricing_rules?.timezone 
    || DEFAULT_BUSINESS_TIMEZONE;
  return tz;
}

/**
 * Generates consistent YYYY-MM month key based on date and timezone.
 */
export function getMonthKey(dateInput: Date | string | number, timezone: string = DEFAULT_BUSINESS_TIMEZONE): string {
  try {
    const date = typeof dateInput === 'string' || typeof dateInput === 'number' 
      ? new Date(dateInput) 
      : dateInput;

    if (!date || isNaN(date.getTime())) {
      // Fallback to current date in given timezone
      const now = new Date();
      return getMonthKey(now, timezone);
    }

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit'
    });
    
    // en-CA formats as YYYY-MM-DD
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '1970';
    const month = parts.find(p => p.type === 'month')?.value || '01';

    return `${year}-${month}`;
  } catch (err) {
    console.error('Error generating month key:', err);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Generates monthly Sessions sheet title compliant with Google Sheets rules (max 100 chars, no illegal chars).
 * Example: 'Sessions_2026_10'
 */
export function getSessionsSheetTitle(monthKey: string): string {
  const sanitized = monthKey.replace(/[^0-9]/g, '_');
  return `Sessions_${sanitized}`;
}

/**
 * Generates monthly Orders sheet title.
 * Example: 'Orders_2026_10'
 */
export function getOrdersSheetTitle(monthKey: string): string {
  const sanitized = monthKey.replace(/[^0-9]/g, '_');
  return `Orders_${sanitized}`;
}

/**
 * Formats date into readable format in business timezone (e.g. '12 Oct 2026').
 */
export function formatDateInTimezone(dateInput: Date | string | number | null | undefined, timezone: string = DEFAULT_BUSINESS_TIMEZONE): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats time into readable 12-hour format in business timezone (e.g. '07:30 PM').
 */
export function formatTimeInTimezone(dateInput: Date | string | number | null | undefined, timezone: string = DEFAULT_BUSINESS_TIMEZONE): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d).replace(' am', ' AM').replace(' pm', ' PM');
  } catch {
    return String(dateInput);
  }
}
