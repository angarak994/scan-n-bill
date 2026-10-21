/**
 * QControl Location & Directions Utility
 * 
 * Generates verified Google Maps turn-by-turn directions links.
 * When opened, Google Maps automatically defaults the origin to the user's current GPS location.
 */

export interface GoogleMapsDirectionsOptions {
  address?: string | null;
  businessName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Generates a dynamic Google Maps Universal Directions URL.
 * Automatically defaults the origin to the customer's current GPS position.
 */
export function getGoogleMapsDirectionsUrl(options: GoogleMapsDirectionsOptions): string | null {
  const { address, businessName, latitude, longitude } = options;

  let destination = '';

  // 1. If verified GPS coordinates are available
  if (
    latitude !== undefined &&
    latitude !== null &&
    longitude !== undefined &&
    longitude !== null &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude)) &&
    Number(latitude) !== 0 &&
    Number(longitude) !== 0
  ) {
    destination = `${Number(latitude).toFixed(6)},${Number(longitude).toFixed(6)}`;
  }
  // 2. Verified street address saved by the owner
  else if (address && address.trim()) {
    const cleanAddress = address.trim();
    const cleanName = (businessName || '').trim();
    destination = cleanName ? `${cleanName}, ${cleanAddress}` : cleanAddress;
  }

  // Never invent a location: if neither coordinates nor verified address are provided, return null
  if (!destination) {
    return null;
  }

  // Google Maps Universal URL Scheme for Turn-by-Turn Directions
  // Omitting origin tells Google Maps to use the user's live device location
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export interface BookingConfirmationParams {
  bookingId: string;
  customerName: string;
  businessName: string;
  gameType: string;
  tableId?: string | null;
  bookingDate: string;
  startTime: string;
  durationMinutes?: number;
  numPlayers?: number;
  ratePerHour?: number | null;
  estimatedTotal?: number | null;
  paymentStatus?: 'pending' | 'deposit_paid' | 'paid' | 'pay_on_arrival';
  status?: 'confirmed' | 'pending';
  address?: string | null;
  contactNumber?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Formats an authoritative WhatsApp booking confirmation message with verified address,
 * table assignment, authoritative price breakdown, and clear cancellation/rescheduling terms.
 */
export function formatBookingConfirmationWhatsApp(params: BookingConfirmationParams): string {
  const {
    bookingId,
    customerName,
    businessName,
    gameType,
    tableId,
    bookingDate,
    startTime,
    durationMinutes = 60,
    numPlayers = 1,
    ratePerHour,
    estimatedTotal,
    paymentStatus = 'pay_on_arrival',
    status = 'confirmed',
    address,
    contactNumber,
    latitude,
    longitude
  } = params;

  const isConfirmed = status === 'confirmed';
  const headerIcon = isConfirmed ? '✅' : '⏳';
  const headerTitle = isConfirmed ? '*Booking Confirmed!*' : '*Booking Request Received (Pending)*';

  const bookingCode = bookingId.startsWith('QC-')
    ? bookingId
    : `QC-${bookingId.substring(0, 6).toUpperCase()}`;

  const directionsUrl = getGoogleMapsDirectionsUrl({
    address,
    businessName,
    latitude,
    longitude
  });

  const durationStr = durationMinutes >= 60
    ? `${(durationMinutes / 60).toFixed(durationMinutes % 60 === 0 ? 0 : 1)} Hour${durationMinutes > 60 ? 's' : ''}`
    : `${durationMinutes} Minutes`;

  const cleanContact = contactNumber ? contactNumber.replace(/\D/g, '') : '';
  const formattedContact = cleanContact.length >= 10 ? `+91 ${cleanContact.slice(-10)}` : null;

  // Table assignment display
  const tableDisplay = tableId ? `Table ${tableId}` : 'Assigned on arrival';

  // Authoritative Pricing breakdown
  let pricingSection = '';
  if (estimatedTotal !== undefined && estimatedTotal !== null && estimatedTotal > 0) {
    const rateSnippet = ratePerHour ? ` (₹${ratePerHour}/hr)` : '';
    pricingSection = `\n💰 *Price:* ₹${estimatedTotal}${rateSnippet}`;
    if (paymentStatus === 'paid') {
      pricingSection += ` • *Status:* Paid in full`;
    } else if (paymentStatus === 'deposit_paid') {
      pricingSection += ` • *Status:* Deposit received, balance due at club`;
    } else {
      pricingSection += ` • *Payment:* Pay at venue`;
    }
  }

  const addressLine = address && address.trim()
    ? `\n📍 *Address:* ${address.trim()}`
    : '';

  const directionsLine = directionsUrl
    ? `\n🗺️ *Get Directions:* ${directionsUrl}`
    : '';

  const contactLine = formattedContact
    ? `\n📞 *Contact / Support:* ${formattedContact}`
    : '';

  const policySection =
    `\n\nℹ️ *Need to reschedule or cancel?*\n` +
    `Reply *"cancel booking"* or *"reschedule"* here, or contact the club directly at least 1 hour before your slot.`;

  return (
    `${headerIcon} ${headerTitle}\n\n` +
    `*Club:* ${businessName}\n` +
    `*Booking ID:* ${bookingCode}\n` +
    `*Player:* ${customerName}\n` +
    `*Game:* ${gameType.toUpperCase()} (${numPlayers} Player${numPlayers > 1 ? 's' : ''})\n` +
    `*Table:* ${tableDisplay}\n` +
    `*Time:* ${bookingDate} at ${startTime} (${durationStr})` +
    `${pricingSection}` +
    `${addressLine}` +
    `${directionsLine}` +
    `${contactLine}` +
    `${policySection}\n\n` +
    `See you on the table! 🎱`
  );
}
