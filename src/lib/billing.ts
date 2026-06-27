import { PricingRules, PricingRule } from './pricing';

export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export function parseDateString(dateStr: string): number {
  if (!dateStr) return NaN;
  let cleanStr = dateStr.replace(/^'/, '').trim();
  if (!cleanStr.includes('+') && !cleanStr.includes('Z') && !cleanStr.includes('GMT')) {
    cleanStr = `${cleanStr} +0530`;
  }
  return new Date(cleanStr).getTime();
}

export function getCurrentRate(gameType: string, nowMs: number, pricingRules?: PricingRules): { rate: number, slabName: string } {
  const game = gameType.toLowerCase();
  
  // Default fallback if no pricing rules are defined for this specific game
  if (!pricingRules || !pricingRules[game]) {
    // Return a flat generic fallback rate to ensure the app doesn't crash 
    // if a business forgets to add a pricing rule for a new game type.
    return { rate: 150, slabName: `Standard Rate (Fallback for ${game})` };
  }

  const rule = pricingRules[game];
  if (rule.type === 'fixed') {
    return { rate: rule.rate || 0, slabName: `${game} Flat ₹${rule.rate}/hr` };
  }

  // time_based (or legacy ampm)
  const dateIst = new Date(nowMs + IST_OFFSET);
  const currentHour = dateIst.getUTCHours();
  
  // Custom cutoff hour, default to 16 (4:00 PM) if not specified
  const cutoffHour = rule.cutoff_hour !== undefined ? rule.cutoff_hour : 16;
  const isDay = currentHour < cutoffHour;
  
  // Support both new names (day/evening) and legacy names (am/pm)
  const dayRate = rule.day_rate ?? rule.am_rate ?? 0;
  const eveningRate = rule.evening_rate ?? rule.pm_rate ?? 0;

  const displayCutoff = `${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour === 0 ? 12 : cutoffHour} ${cutoffHour >= 12 ? 'PM' : 'AM'}`;

  if (isDay) {
    return { rate: dayRate, slabName: `${game} Before ${displayCutoff}` };
  }
  return { rate: eveningRate, slabName: `${game} After ${displayCutoff}` };
}

export function calculateCost(startMs: number, endMs: number, gameType: string, pricingRules?: PricingRules): { cost: number, slabsApplied: string } {
  const totalMs = endMs - startMs;
  const durationMinutes = Math.floor(totalMs / 60000);

  // First 5 minutes are completely free (Grace Period logic)
  if (durationMinutes <= 5) {
    return { cost: 0, slabsApplied: 'None (Grace Period)' };
  }

  let totalCost = 0;
  const appliedSlabs = new Set<string>();

  let currentMs = startMs;
  while (currentMs < endMs) {
    const nextMs = currentMs + 60 * 1000;
    const chunkEndMs = Math.min(nextMs, endMs);
    const durationHours = (chunkEndMs - currentMs) / (1000 * 60 * 60);

    const { rate, slabName } = getCurrentRate(gameType, currentMs, pricingRules);
    appliedSlabs.add(slabName);
    
    totalCost += durationHours * rate;
    currentMs = nextMs;
  }
  
  // Apply rounding rules
  const roundingMode = pricingRules?._global?.rounding_mode || 'nearest_5';
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

  return { cost: finalCost, slabsApplied: Array.from(appliedSlabs).join(' + ') || 'None' };
}

/**
 * Pure function for billing calculation.
 */
export function calculateBilling(startString: string, endString: string, gameType: string, pricingRules?: PricingRules) {
  const startMs = parseDateString(startString);
  const endMs = parseDateString(endString);

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const { cost, slabsApplied } = calculateCost(startMs, endMs, gameType, pricingRules);

  const totalSeconds = (endMs - startMs) / 1000;
  const durationMinutes = Math.floor(totalSeconds / 60);

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration: duration.trim() || '0 min', cost, slabs_applied: slabsApplied };
}
