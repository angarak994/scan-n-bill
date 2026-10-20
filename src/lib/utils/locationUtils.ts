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
export function getGoogleMapsDirectionsUrl(options: GoogleMapsDirectionsOptions): string {
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

/**
 * Formats an authoritative WhatsApp booking confirmation message with verified address and directions link.
 */
export function formatBookingConfirmationWhatsApp(params: {
  bookingId: string;
  customerName: string;
  businessName: string;
  gameType: string;
  bookingDate: string;
  startTime: string;
  durationMinutes?: number;
  numPlayers?: number;
  address?: string | null;
  contactNumber?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const {
    bookingId,
    customerName,
    businessName,
    gameType,
    bookingDate,
    startTime,
    durationMinutes = 60,
    numPlayers = 1,
    address,
    contactNumber,
    latitude,
    longitude
  } = params;

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

  const addressLine = address && address.trim()
    ? `\n📍 *Address:* ${address.trim()}`
    : '';

  const directionsLine = directionsUrl
    ? `\n🗺️ *Get Directions:* ${directionsUrl}`
    : '';

  const contactLine = contactNumber && contactNumber.trim()
    ? `\n📞 *Contact / Support:* +91 ${contactNumber.replace(/\D/g, '').slice(-10)}`
    : '';

  return (
    `✅ *Booking Confirmed!*\n\n` +
    `*Club:* ${businessName}\n` +
    `*Booking ID:* ${bookingCode}\n` +
    `*Name:* ${customerName}\n` +
    `*Game:* ${gameType.toUpperCase()} (${numPlayers} Player${numPlayers > 1 ? 's' : ''})\n` +
    `*Time:* ${bookingDate} at ${startTime} (${durationStr})` +
    `${addressLine}` +
    `${directionsLine}` +
    `${contactLine}\n\n` +
    `See you on the table! 🎱`
  );
}
