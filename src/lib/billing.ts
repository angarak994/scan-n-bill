import { BusinessPricing, PricingRule } from './pricing';

export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export function parseDateString(dateStr: string): number {
  if (!dateStr) return NaN;
  let cleanStr = dateStr.replace(/^'/, '').trim();
  
  // Safari/iOS strict Date parsing fix: replace ", " with "T"
  if (cleanStr.includes(', ')) {
    cleanStr = cleanStr.replace(', ', 'T');
  }
  // If no timezone is present, append IST
  if (!cleanStr.includes('+') && !cleanStr.includes('Z') && !cleanStr.includes('GMT')) {
    cleanStr = `${cleanStr}+05:30`;
  }
  return new Date(cleanStr).getTime();
}

export function getCurrentISTDateStr(dateMs?: number): string {
  const now = dateMs ? new Date(dateMs) : new Date();
  const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return istDate.toISOString().split('T')[0];
}

export function formatTimeReadable(timeStr?: string, includeToday: boolean = false, bookingDate?: string): string {
  if (!timeStr) return '-';
  try {
    let clean = timeStr;
    if (clean.includes('T') || clean.includes(', ') || clean.includes(' ')) {
      const d = new Date(clean.includes('+') || clean.includes('Z') || clean.includes('GMT') ? clean : `${clean}+05:30`);
      if (!isNaN(d.getTime())) {
        const formatter = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        clean = formatter.format(d).replace(' am', ' AM').replace(' pm', ' PM').toUpperCase();
      }
    } else if (clean.includes(':')) {
      const parts = clean.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        clean = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      }
    }
    if (includeToday) {
      const todayStr = getCurrentISTDateStr();
      const isToday = !bookingDate || bookingDate === todayStr || bookingDate.toLowerCase().includes('today');
      if (isToday) {
        return `Today • ${clean}`;
      }
    }
    return clean;
  } catch {
    return timeStr;
  }
}

export function getCurrentRate(gameType: string | null | undefined, nowMs: number, pricing?: BusinessPricing, numPlayers: number = 1): { rate: number, slabName: string } {
  const game = (gameType || 'pool').trim().toLowerCase();
  
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

export type DiscountType = 'percentage' | 'fixed';

export interface TableDiscountConfig {
  type?: DiscountType; // default 'percentage'
  percent?: number;    // for percentage (1 - 100)
  amount?: number;     // for fixed (₹)
  maxDiscount?: number;// optional max cap for percentage (₹)
  minBillAmount?: number;// optional min bill required (₹)
  applyToFood?: boolean;// default false
  label?: string;      // custom display label
  isActive?: boolean;  // default true
  expiryDate?: string; // ISO string or YYYY-MM-DD
}

/**
 * Authoritative pure discount engine for sessions and tables.
 * Accurately handles percentage (%) and fixed (₹) discounts,
 * minimum bill amount rules, configurable max limits,
 * proportional distribution across table and F&B, and prevents negative totals.
 */
export function applySessionDiscounts(
  tableCost: number,
  foodCost: number = 0,
  discountConfig?: TableDiscountConfig | { percent: number; applyToFood: boolean } | null
): {
  finalTableCost: number;
  finalFoodCost: number;
  tableDiscountAmount: number;
  foodDiscountAmount: number;
  totalDiscountAmount: number;
  finalTotalCost: number;
  discountAppliedLabel: string;
  isEligible: boolean;
  minBillShortfall?: number;
} {
  const safeTableCost = Math.max(0, Math.round(tableCost || 0));
  const safeFoodCost = Math.max(0, Math.round(foodCost || 0));
  const totalBaseCost = safeTableCost + safeFoodCost;

  if (!discountConfig || (discountConfig as any).isActive === false || totalBaseCost <= 0) {
    return {
      finalTableCost: safeTableCost,
      finalFoodCost: safeFoodCost,
      tableDiscountAmount: 0,
      foodDiscountAmount: 0,
      totalDiscountAmount: 0,
      finalTotalCost: totalBaseCost,
      discountAppliedLabel: 'None',
      isEligible: true,
    };
  }

  // Check expiry date if configured
  if ((discountConfig as any).expiryDate) {
    const expTime = new Date((discountConfig as any).expiryDate).getTime();
    if (!isNaN(expTime) && Date.now() > expTime) {
      return {
        finalTableCost: safeTableCost,
        finalFoodCost: safeFoodCost,
        tableDiscountAmount: 0,
        foodDiscountAmount: 0,
        totalDiscountAmount: 0,
        finalTotalCost: totalBaseCost,
        discountAppliedLabel: 'Expired Discount',
        isEligible: false,
      };
    }
  }

  const applyToFood = Boolean(discountConfig.applyToFood);
  const eligibleAmount = applyToFood ? totalBaseCost : safeTableCost;

  // Check minimum bill amount rule
  const minBill = Number((discountConfig as any).minBillAmount) || 0;
  if (minBill > 0 && eligibleAmount < minBill) {
    return {
      finalTableCost: safeTableCost,
      finalFoodCost: safeFoodCost,
      tableDiscountAmount: 0,
      foodDiscountAmount: 0,
      totalDiscountAmount: 0,
      finalTotalCost: totalBaseCost,
      discountAppliedLabel: `Min Bill ₹${minBill} Required`,
      isEligible: false,
      minBillShortfall: minBill - eligibleAmount,
    };
  }

  // Determine type: 'fixed' vs 'percentage'
  const isFixed = (discountConfig as any).type === 'fixed' || 
    (Number((discountConfig as any).amount) > 0 && !(discountConfig as any).percent);

  let rawDiscount = 0;
  let label = '';

  if (isFixed) {
    const fixedAmount = Math.max(0, Number((discountConfig as any).amount) || 0);
    // Never allow fixed discount to exceed eligible bill
    rawDiscount = Math.min(eligibleAmount, fixedAmount);
    label = `Flat ₹${fixedAmount} Off`;
  } else {
    // Percentage discount
    const percent = Math.min(100, Math.max(0, Number(discountConfig.percent) || 0));
    if (percent > 0) {
      let pctDiscount = (eligibleAmount * percent) / 100;
      const maxDiscount = Number((discountConfig as any).maxDiscount);
      if (maxDiscount > 0 && pctDiscount > maxDiscount) {
        pctDiscount = maxDiscount;
        label = `${percent}% Off (Max ₹${maxDiscount})`;
      } else {
        label = `${percent}% Off`;
      }
      rawDiscount = Math.min(eligibleAmount, Math.round(pctDiscount));
    }
  }

  const totalDiscountAmount = Math.max(0, Math.min(eligibleAmount, Math.round(rawDiscount)));

  let tableDiscountAmount = 0;
  let foodDiscountAmount = 0;

  if (applyToFood) {
    if (totalBaseCost > 0) {
      tableDiscountAmount = Math.min(safeTableCost, Math.round((safeTableCost / totalBaseCost) * totalDiscountAmount));
      foodDiscountAmount = Math.min(safeFoodCost, totalDiscountAmount - tableDiscountAmount);
    }
  } else {
    tableDiscountAmount = Math.min(safeTableCost, totalDiscountAmount);
    foodDiscountAmount = 0;
  }

  const finalTableCost = Math.max(0, safeTableCost - tableDiscountAmount);
  const finalFoodCost = Math.max(0, safeFoodCost - foodDiscountAmount);
  const finalTotalCost = finalTableCost + finalFoodCost;

  return {
    finalTableCost,
    finalFoodCost,
    tableDiscountAmount,
    foodDiscountAmount,
    totalDiscountAmount,
    finalTotalCost,
    discountAppliedLabel: label,
    isEligible: true,
  };
}

export function calculateCost(
  startMs: number, 
  endMs: number, 
  gameType: string | null | undefined, 
  pricing?: BusinessPricing, 
  numPlayers: number = 1,
  manualDiscount?: TableDiscountConfig | { percent: number; applyToFood: boolean; },
  pausedDurationSecs: number = 0,
  lockedRate?: number,
  lockedRateName?: string,
  activePromotions: any[] = []
): { cost: number, baseCost: number, discountAmount: number, slabsApplied: string, breakdown?: { startMs: number; endMs: number; rate: number; cost: number; slabName: string }[] } {
  const elapsedMs = Math.max(0, endMs - startMs);
  const pausedMs = Math.max(0, (pausedDurationSecs || 0) * 1000);
  const billableMs = Math.max(0, elapsedMs - pausedMs);
  const durationMinutes = Math.floor(billableMs / 60000);

  // First 5 minutes are completely free (Grace Period logic)
  if (durationMinutes <= 5 && billableMs <= 300000) {
    return { cost: 0, baseCost: 0, discountAmount: 0, slabsApplied: 'None (Grace Period)' };
  }

  let billedDurationMinutes = durationMinutes;

  const billingMode = pricing?.globalSettings?.billing_mode ?? 'per_minute';
  if (billingMode === '15_min_block') {
    billedDurationMinutes = Math.ceil(durationMinutes / 15) * 15;
  }
  
  const enablePeakRules = pricing?.globalSettings?.enable_peak_rules ?? true;

  if (enablePeakRules) {
    // The 10-Minute Trap
    if (billedDurationMinutes >= 50 && billedDurationMinutes <= 60) {
      billedDurationMinutes = 60;
    }
  }

  let unpausedTotalCost = 0;
  let noPromoTotalCost = 0; // For tracking base cost before system promotions
  const appliedSlabs = new Set<string>();
  const breakdown: { startMs: number; endMs: number; rate: number; cost: number; slabName: string }[] = [];

  // Evaluate rates across the exact full elapsed stay [startMs, endMs].
  const evaluationEndMs = Math.max(startMs, endMs);
  
  if (evaluationEndMs > startMs) {
    const elapsedStayHours = (evaluationEndMs - startMs) / 3600000;
    const game = (gameType || 'pool').trim().toLowerCase();
    const rule = pricing?.rules?.[game];

    // Pre-parse and filter active promotions that overlap with this session stay
    const applicablePromos = (activePromotions || []).filter(promo => {
      if (promo.status !== 'Active' && promo.status !== 'Scheduled') return false;
      if (promo.applicable_game_types && promo.applicable_game_types.length > 0) {
        if (!promo.applicable_game_types.includes(gameType?.toLowerCase() || '')) return false;
      }
      return true;
    }).map(promo => {
      const pStart = parseDateString(promo.start_time);
      const pEnd = parseDateString(promo.end_time);
      let slotStartMins: number | null = null;
      let slotEndMins: number | null = null;
      if (promo.time_slot_start && promo.time_slot_end) {
        const [sh, sm] = promo.time_slot_start.split(':').map(Number);
        const [eh, em] = promo.time_slot_end.split(':').map(Number);
        if (!isNaN(sh) && !isNaN(sm)) slotStartMins = sh * 60 + sm;
        if (!isNaN(eh) && !isNaN(em)) slotEndMins = eh * 60 + em;
      }
      return {
        ...promo,
        pStart,
        pEnd,
        slotStartMins,
        slotEndMins
      };
    }).filter(p => evaluationEndMs > p.pStart && startMs < p.pEnd);

    // --- FAST-PATH 1: Locked Rate Session without active promotions ---
    if (applicablePromos.length === 0 && lockedRate !== undefined && lockedRate !== null) {
      const rate = Number(lockedRate);
      const slabName = lockedRateName || 'Dynamic Rate';
      unpausedTotalCost = elapsedStayHours * rate;
      noPromoTotalCost = elapsedStayHours * rate;
      appliedSlabs.add(slabName);
      breakdown.push({ startMs, endMs: evaluationEndMs, rate, cost: unpausedTotalCost, slabName });
    }
    // --- FAST-PATH 2: Fixed Rate Game Rule without active promotions ---
    else if (applicablePromos.length === 0 && (!rule || rule.type === 'fixed')) {
      const cr = getCurrentRate(gameType, startMs, pricing, numPlayers);
      unpausedTotalCost = elapsedStayHours * cr.rate;
      noPromoTotalCost = elapsedStayHours * cr.rate;
      appliedSlabs.add(cr.slabName);
      breakdown.push({ startMs, endMs: evaluationEndMs, rate: cr.rate, cost: unpausedTotalCost, slabName: cr.slabName });
    }
    // --- FAST-PATH 3: Time-Based Game without Cutoff Transition or Promotions ---
    else if (applicablePromos.length === 0 && rule?.type === 'time_based' && elapsedStayHours < 12 &&
      getCurrentRate(gameType, startMs, pricing, numPlayers).rate === getCurrentRate(gameType, evaluationEndMs - 1, pricing, numPlayers).rate
    ) {
      const cr = getCurrentRate(gameType, startMs, pricing, numPlayers);
      unpausedTotalCost = elapsedStayHours * cr.rate;
      noPromoTotalCost = elapsedStayHours * cr.rate;
      appliedSlabs.add(cr.slabName);
      breakdown.push({ startMs, endMs: evaluationEndMs, rate: cr.rate, cost: unpausedTotalCost, slabName: cr.slabName });
    }
    // --- GENERAL PATH: Multi-Slab or Active Promotion Iteration ---
    else {
      let currentMs = startMs;
      while (currentMs < evaluationEndMs) {
        const nextMs = Math.min(currentMs + 60000, evaluationEndMs);
        const chunkHours = (nextMs - currentMs) / 3600000;

        let rate = 0; 
        let slabName = '';
        let isPromoApplied = false;

        // Base rate calculation (no promo)
        let rawBaseRate = 0;
        if (lockedRate !== undefined && lockedRate !== null) {
          rawBaseRate = Number(lockedRate);
        } else {
          rawBaseRate = getCurrentRate(gameType, currentMs, pricing, numPlayers).rate;
        }
        noPromoTotalCost += (chunkHours * rawBaseRate);

        // Check pre-parsed active promotions for this minute
        for (const promo of applicablePromos) {
          if (currentMs >= promo.pStart && currentMs < promo.pEnd) {
            // Check Time Slot (Happy Hour constraint within the promo)
            if (promo.slotStartMins !== null && promo.slotEndMins !== null) {
              const dateIst = new Date(currentMs + IST_OFFSET);
              const currentTotalMins = dateIst.getUTCHours() * 60 + dateIst.getUTCMinutes();
              if (currentTotalMins < promo.slotStartMins || currentTotalMins >= promo.slotEndMins) {
                continue; // Outside daily happy hour window
              }
            }

            // Apply promotion
            if (promo.promo_type === 'fixed_price' && promo.fixed_price !== null) {
              rate = Number(promo.fixed_price);
              slabName = `Promo: ${promo.name} (Fixed Rate)`;
              isPromoApplied = true;
              break;
            } else if (promo.promo_type === 'fixed_amount' && promo.fixed_amount_discount !== null) {
              rate = Math.max(0, rawBaseRate - Number(promo.fixed_amount_discount));
              slabName = `Promo: ${promo.name} (-₹${promo.fixed_amount_discount})`;
              isPromoApplied = true;
              break;
            } else {
              const discountPercent = Number(promo.discount_percent || 0);
              if (discountPercent > 0) {
                rate = rawBaseRate * (1 - (discountPercent / 100));
                slabName = `Promo: ${promo.name} (${discountPercent}% Off)`;
                isPromoApplied = true;
                break;
              }
            }
          }
        }

        if (!isPromoApplied) {
          if (lockedRate !== undefined && lockedRate !== null) {
            rate = Number(lockedRate); slabName = lockedRateName || 'Dynamic Rate';
          } else {
            const cr = getCurrentRate(gameType, currentMs, pricing, numPlayers);
            rate = cr.rate; slabName = cr.slabName;
          }
        }

        appliedSlabs.add(slabName);
        const chunkCost = chunkHours * rate;
        unpausedTotalCost += chunkCost;
        
        if (breakdown.length > 0 && breakdown[breakdown.length - 1].slabName === slabName && breakdown[breakdown.length - 1].rate === rate) {
          breakdown[breakdown.length - 1].endMs = nextMs;
          breakdown[breakdown.length - 1].cost += chunkCost;
        } else {
          breakdown.push({ startMs: currentMs, endMs: nextMs, rate, cost: chunkCost, slabName });
        }
        
        currentMs = nextMs;
      }
    }
  } else {
    // 0 elapsed time
    const cr = lockedRate !== undefined && lockedRate !== null
      ? { rate: Number(lockedRate), slabName: lockedRateName || 'Dynamic Rate' }
      : getCurrentRate(gameType, startMs, pricing, numPlayers);
    appliedSlabs.add(cr.slabName);
  }

  const elapsedHours = (evaluationEndMs - startMs) / 3600000;
  const billedHours = billedDurationMinutes / 60;
  
  let totalCost = 0;
  let baseCost = 0;
  
  if (elapsedHours > 0) {
    totalCost = (unpausedTotalCost / elapsedHours) * billedHours;
    baseCost = (noPromoTotalCost / elapsedHours) * billedHours;
  }

  // Apply rounding rules
  const roundingMode = pricing?.globalSettings?.rounding_mode || 'nearest_5';
  let finalCost = totalCost;

  if (roundingMode === 'nearest_5') {
    finalCost = Math.round(totalCost / 5) * 5;
    baseCost = Math.round(baseCost / 5) * 5;
  } else if (roundingMode === 'up_5') {
    finalCost = Math.ceil(totalCost / 5) * 5;
    baseCost = Math.ceil(baseCost / 5) * 5;
  } else if (roundingMode === 'down_5') {
    finalCost = Math.floor(totalCost / 5) * 5;
    baseCost = Math.floor(baseCost / 5) * 5;
  } else if (roundingMode === 'none') {
    finalCost = Math.round(totalCost);
    baseCost = Math.round(baseCost);
  }

  let discountAmount = Math.max(0, baseCost - finalCost);
  
  // Apply Flat Session Manual Discount (on top of promos)
  if (manualDiscount) {
    const disc = applySessionDiscounts(finalCost, 0, manualDiscount);
    if (disc.totalDiscountAmount > 0) {
      discountAmount += disc.totalDiscountAmount;
      finalCost = disc.finalTableCost;
      appliedSlabs.add(`Manual Discount (${disc.discountAppliedLabel})`);
    }
  }

  return { cost: finalCost, baseCost, discountAmount, slabsApplied: Array.from(appliedSlabs).join(' + ') || 'None', breakdown };
}

/**
 * Pure function for billing calculation.
 */
export function calculateBilling(
  startString: string, 
  endString: string, 
  gameType: string | null | undefined, 
  pricing?: BusinessPricing, 
  numPlayers: number = 1,
  manualDiscount?: TableDiscountConfig | { percent: number; applyToFood: boolean; },
  pausedDurationSecs: number = 0,
  lockedRate?: number,
  lockedRateName?: string,
  activePromotions: any[] = []
) {
  const startMs = parseDateString(startString);
  const endMs = parseDateString(endString);

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const { cost, baseCost, discountAmount, slabsApplied, breakdown } = calculateCost(
    startMs, endMs, gameType, pricing, numPlayers, manualDiscount, pausedDurationSecs, lockedRate, lockedRateName, activePromotions
  );

  const totalSeconds = Math.max(0, (endMs - startMs) / 1000);
  const pausedSeconds = Math.max(0, pausedDurationSecs || 0);
  const billableSeconds = Math.max(0, totalSeconds - pausedSeconds);
  const durationMinutes = Math.floor(billableSeconds / 60);

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration: duration.trim() || '0 min', cost, baseCost, discountAmount, slabs_applied: slabsApplied, breakdown };
}
