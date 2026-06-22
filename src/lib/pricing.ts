export type GameType = 'snooker' | 'pool';
export type SessionType = 'AM' | 'PM';

interface PricingInfo {
  session_type: SessionType;
  rate_per_hour: number;
}

const RATES = {
  AM: { snooker: 200, pool: 100 },
  PM: { snooker: 300, pool: 150 },
};

/**
 * Pure function to get pricing based on a specific time and game type.
 * Time is evaluated in IST (Asia/Kolkata).
 * AM: 06:00 to 17:59
 * PM: 18:00 to 05:59
 */
export function getPricing(game_type: GameType, date: Date = new Date()): PricingInfo {
  // Convert date to IST to extract the hour
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false, // 24 hour format (1-24 or 0-23 depending on implementation, node usually 0-23 but 24 can be returned for midnight)
  });
  
  // Intl format can sometimes return "24" instead of "0". We parse it.
  const hourString = formatter.format(date);
  let currentHour = parseInt(hourString, 10);
  if (currentHour === 24) currentHour = 0;

  const isAM = currentHour >= 6 && currentHour < 18;
  const session_type: SessionType = isAM ? 'AM' : 'PM';

  return {
    session_type,
    rate_per_hour: RATES[session_type][game_type],
  };
}
