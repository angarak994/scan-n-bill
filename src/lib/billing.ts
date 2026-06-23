export const IST_OFFSET = 5.5 * 60 * 60 * 1000;
export const SLOT_DURATION_MS = 15 * 60 * 1000;

export function calculateCost(startMs: number, endMs: number, gameType: string): number {
  if (endMs <= startMs) return 0;
  
  let totalCost = 0;
  const game = gameType.toLowerCase();
  
  const rateBefore4 = game === 'snooker' ? 50 : 25;
  const rateAfter4 = game === 'snooker' ? 75 : 40;

  let currentSlotStartMs = startMs;
  
  while (currentSlotStartMs < endMs) {
    const slotStartIst = new Date(currentSlotStartMs + IST_OFFSET);
    const isBefore4PM = slotStartIst.getUTCHours() < 16;
    
    const slotRate = isBefore4PM ? rateBefore4 : rateAfter4;
    totalCost += slotRate;
    
    currentSlotStartMs += SLOT_DURATION_MS;
  }
  
  return totalCost;
}

/**
 * Pure function for billing calculation.
 * @param startIso 
 * @param endIso 
 * @param gameType 
 * @returns { duration_hours: number, duration: string, cost: number }
 */
export function calculateBilling(startIso: string, endIso: string, gameType: string) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const cost = calculateCost(startMs, endMs, gameType);

  const totalSeconds = (endMs - startMs) / 1000;
  const durationMinutes = Math.floor(totalSeconds / 60);

  const duration_hours = durationMinutes / 60;

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration_hours, duration: duration.trim() || '0 min', cost };
}
