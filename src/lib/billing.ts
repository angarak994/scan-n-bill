import { BusinessPricing, PricingRule } from './pricing';

export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export function parseDateString(dateStr: string): number {
  if (!dateStr) return NaN;
  let cleanStr = dateStr.replace(/^'/, '').trim();
  if (!cleanStr.includes('+') && !cleanStr.includes('Z') && !cleanStr.includes('GMT')) {
    cleanStr = `${cleanStr} +0530`;
  }
  return new Date(cleanStr).getTime();
}

export function getCurrentRate(gameType: string, nowMs: number, pricing?: BusinessPricing, numPlayers: number = 1): { rate: number, slabName: string } {
  const game = gameType.toLowerCase();
  
  // Default fallback if no pricing rules are defined for this specific game
  if (!pricing || !pricing.rules || !pricing.rules[game]) {
    // Return a flat generic fallback rate to ensure the app doesn't crash 
    // if a business forgets to add a pricing rule for a new game type.
    return { rate: 150, slabName: `Standard Rate (Fallback for ${game})` };
  }

  const rule = pricing.rules[game];
  
  // Calculate base rate first
  let baseRate = 0;
  let slabName = '';
  
  if (rule.type === 'fixed') {
    baseRate = rule.rate || 0;
    slabName = `${game} Flat ₹${baseRate}/hr`;
  } else {
    // time_based
    const dateIst = new Date(nowMs + IST_OFFSET);
    const currentHour = dateIst.getUTCHours();
    
    const cutoffHour = rule.cutoff_hour !== undefined ? rule.cutoff_hour : 16;
    const openingHour = rule.opening_hour !== undefined ? rule.opening_hour : 6;
    
    const isDay = currentHour >= openingHour && currentHour < cutoffHour;
    
    const dayRate = rule.day_rate ?? rule.am_rate ?? 0;
    const eveningRate = rule.evening_rate ?? rule.pm_rate ?? 0;

    const displayCutoff = `${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour === 0 ? 12 : cutoffHour} ${cutoffHour >= 12 ? 'PM' : 'AM'}`;
    const displayOpening = `${openingHour > 12 ? openingHour - 12 : openingHour === 0 ? 12 : openingHour} ${openingHour >= 12 ? 'PM' : 'AM'}`;

    if (isDay) {
      baseRate = dayRate;
      slabName = `${game} (${displayOpening} to ${displayCutoff})`;
    } else {
      baseRate = eveningRate;
      slabName = `${game} (${displayCutoff} Onwards)`;
    }
  }

  // Legacy support for is_per_person
  const isMultiply = rule.multiplayer_mode === 'multiply' || rule.is_per_person;
  const isBasePlusExtra = rule.multiplayer_mode === 'base_plus_extra';

  if (isMultiply && numPlayers > 1) {
    return { rate: baseRate * numPlayers, slabName: `${slabName} × ${numPlayers} Players` };
  } else if (isBasePlusExtra && numPlayers > 1) {
    const extraRate = rule.extra_per_player || 0;
    const additionalPlayers = numPlayers - 1;
    const totalRate = baseRate + (extraRate * additionalPlayers);
    return { rate: totalRate, slabName: `${slabName} + ₹${extraRate}/extra player` };
  }
  
  return { rate: baseRate, slabName };
}

export function calculateCost(
  startMs: number, 
  endMs: number, 
  gameType: string, 
  pricing?: BusinessPricing, 
  numPlayers: number = 1,
  discount?: { percent: number; applyToFood: boolean },
  pausedDurationSecs: number = 0,
  lockedRate?: number,
  lockedRateName?: string
): { cost: number, baseCost: number, discountAmount: number, slabsApplied: string } {
  let totalMs = endMs - startMs;
  if (pausedDurationSecs > 0) {
    totalMs = Math.max(0, totalMs - (pausedDurationSecs * 1000));
  }
  const durationMinutes = Math.floor(totalMs / 60000);

  // First 5 minutes are completely free (Grace Period logic)
  if (durationMinutes <= 5) {
    return { cost: 0, baseCost: 0, discountAmount: 0, slabsApplied: 'None (Grace Period)' };
  }

  let billedDurationMinutes = durationMinutes;

  const billingMode = pricing?.globalSettings?.billing_mode ?? 'per_minute';
  if (billingMode === '15_min_block') {
    billedDurationMinutes = Math.ceil(durationMinutes / 15) * 15;
  }
  
  const enablePeakRules = pricing?.globalSettings?.enable_peak_rules ?? true; // Default to true based on user request

  if (enablePeakRules) {
    // The 10-Minute Trap: If they play between 50 and 60 minutes, bump them to exactly 60.
    if (billedDurationMinutes >= 50 && billedDurationMinutes <= 60) {
      billedDurationMinutes = 60;
    }
  }

  let totalCost = 0;
  const appliedSlabs = new Set<string>();

  // Truncate endMs to the exact elapsed minute. This eliminates millisecond-level price jumps
  // and completely resolves client vs server race conditions during "End Session" by ensuring
  // 59 seconds of complete stability per minute.
  const effectiveEndMs = startMs + (billedDurationMinutes * 60000);

  let currentMs = startMs;
  while (currentMs < effectiveEndMs) {
    const nextMs = currentMs + 60 * 1000;
    const chunkEndMs = Math.min(nextMs, effectiveEndMs);
    const durationHours = (chunkEndMs - currentMs) / (1000 * 60 * 60);

    let rate = 0; let slabName = '';
    if (lockedRate !== undefined && lockedRate !== null) {
      rate = lockedRate; slabName = lockedRateName || 'Dynamic Rate';
    } else {
      const cr = getCurrentRate(gameType, currentMs, pricing, numPlayers);
      rate = cr.rate; slabName = cr.slabName;
    }
    appliedSlabs.add(slabName);
    
    totalCost += durationHours * rate;
    currentMs = nextMs;
  }
  
  // Apply rounding rules
  const roundingMode = pricing?.globalSettings?.rounding_mode || 'nearest_5';
  let finalCost = totalCost;

  if (roundingMode === 'nearest_5') {
    finalCost = Math.round(totalCost / 5) * 5;
  } else if (roundingMode === 'up_5') {
    finalCost = Math.ceil(totalCost / 5) * 5;
  } else if (roundingMode === 'down_5') {
    finalCost = Math.floor(totalCost / 5) * 5;
  } else if (roundingMode === 'none') {
    finalCost = Math.round(totalCost); // Round to nearest ₹1 to avoid weird decimals
  }

  let baseCost = finalCost;
  let discountAmount = 0;
  
  // Apply Happy Hour Discount on Game Time
  if (discount && discount.percent > 0) {
    finalCost = finalCost * (1 - (discount.percent / 100));
    finalCost = Math.round(finalCost);
    discountAmount = baseCost - finalCost;
  }

  return { cost: finalCost, baseCost, discountAmount, slabsApplied: Array.from(appliedSlabs).join(' + ') || 'None' };
}

/**
 * Pure function for billing calculation.
 */
export function calculateBilling(
  startString: string, 
  endString: string, 
  gameType: string, 
  pricing?: BusinessPricing, 
  numPlayers: number = 1,
  discount?: { percent: number; applyToFood: boolean },
  pausedDurationSecs: number = 0,
  lockedRate?: number,
  lockedRateName?: string
) {
  const startMs = parseDateString(startString);
  const endMs = parseDateString(endString);

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const { cost, baseCost, discountAmount, slabsApplied } = calculateCost(startMs, endMs, gameType, pricing, numPlayers, discount, pausedDurationSecs, lockedRate, lockedRateName);

  let totalSeconds = (endMs - startMs) / 1000;
  if (pausedDurationSecs > 0) {
    totalSeconds = Math.max(0, totalSeconds - pausedDurationSecs);
  }
  const durationMinutes = Math.floor(totalSeconds / 60);

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration: duration.trim() || '0 min', cost, baseCost, discountAmount, slabs_applied: slabsApplied };
}
