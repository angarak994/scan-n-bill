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
 * Pure function to get initial pricing based on a specific time and game type.
 * Time is evaluated in IST (Asia/Kolkata).
 * AM (Before 4 PM): 00:00 to 15:59
 * PM (From 4 PM onwards): 16:00 to 23:59
 */
export function getPricing(game_type: GameType, date: Date = new Date()): PricingInfo {
  // Convert date to IST to extract the hour
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  });
  
  const hourString = formatter.format(date);
  let currentHour = parseInt(hourString, 10);
  if (currentHour === 24) currentHour = 0;

  const isAM = currentHour < 16;
  const session_type: SessionType = isAM ? 'AM' : 'PM';

  return {
    session_type,
    rate_per_hour: RATES[session_type][game_type],
  };
}
