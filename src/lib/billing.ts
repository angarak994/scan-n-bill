export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export function parseDateString(dateStr: string): number {
  if (!dateStr) return NaN;
  let cleanStr = dateStr.replace(/^'/, '').trim();
  if (!cleanStr.includes('+') && !cleanStr.includes('Z') && !cleanStr.includes('GMT')) {
    cleanStr = `${cleanStr} +0530`;
  }
  return new Date(cleanStr).getTime();
}

export function calculateCost(startMs: number, endMs: number, gameType: string): { cost: number, slabsApplied: string } {
  const totalMs = endMs - startMs;
  // 10-minute completely free grace period
  if (totalMs <= 10 * 60 * 1000) return { cost: 0, slabsApplied: 'None (Grace Period)' };
  
  // Billing begins AFTER 10 minutes. The first 10 minutes are not charged.
  const billedStartMs = startMs + 10 * 60 * 1000;
  
  let totalCost = 0;
  const game = gameType.toLowerCase();
  
  const rateBefore4 = game === 'snooker' ? 200 : 100;
  const rateAfter4 = game === 'snooker' ? 300 : 150;

  const appliedSlabs = new Set<string>();

  let currentMs = billedStartMs;
  while (currentMs < endMs) {
    const nextMs = currentMs + 60 * 1000;
    const chunkEndMs = Math.min(nextMs, endMs);
    const durationHours = (chunkEndMs - currentMs) / (1000 * 60 * 60);

    const slotStartIst = new Date(currentMs + IST_OFFSET);
    const isBefore4PM = slotStartIst.getUTCHours() < 16;
    
    if (isBefore4PM) appliedSlabs.add('Before 4 PM');
    else appliedSlabs.add('After 4 PM');

    const rate = isBefore4PM ? rateBefore4 : rateAfter4;
    totalCost += durationHours * rate;
    
    currentMs = nextMs;
  }
  
  const finalCost = Math.round(totalCost / 10) * 10;
  return { cost: finalCost, slabsApplied: Array.from(appliedSlabs).join(' + ') };
}

/**
 * Pure function for billing calculation.
 * @param startString 
 * @param endString 
 * @param gameType 
 * @returns { duration_hours: number, duration: string, cost: number, slabs_applied: string }
 */
export function calculateBilling(startString: string, endString: string, gameType: string) {
  const startMs = parseDateString(startString);
  const endMs = parseDateString(endString);

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const { cost, slabsApplied } = calculateCost(startMs, endMs, gameType);

  const totalSeconds = (endMs - startMs) / 1000;
  const durationMinutes = Math.floor(totalSeconds / 60);

  const duration_hours = durationMinutes / 60;

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration_hours, duration: duration.trim() || '0 min', cost, slabs_applied: slabsApplied };
}
