export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export function calculateCost(startMs: number, endMs: number, gameType: string): number {
  let totalCost = 0;
  const game = gameType.toLowerCase();
  const rateBefore4 = game === 'snooker' ? 200 : 100;
  const rateAfter4 = game === 'snooker' ? 300 : 150;

  let currentMs = startMs;
  while (currentMs < endMs) {
    const dateIst = new Date(currentMs + IST_OFFSET);
    const currentHourIst = dateIst.getUTCHours();
    
    let isBefore4PM = currentHourIst < 16;
    
    let nextBoundaryIstMs: number;
    if (isBefore4PM) {
      nextBoundaryIstMs = Date.UTC(dateIst.getUTCFullYear(), dateIst.getUTCMonth(), dateIst.getUTCDate(), 16, 0, 0, 0);
    } else {
      nextBoundaryIstMs = Date.UTC(dateIst.getUTCFullYear(), dateIst.getUTCMonth(), dateIst.getUTCDate() + 1, 0, 0, 0, 0);
    }
    
    const nextBoundaryMs = nextBoundaryIstMs - IST_OFFSET;
    const chunkEndMs = Math.min(endMs, nextBoundaryMs);
    const durationHours = (chunkEndMs - currentMs) / (1000 * 60 * 60);
    const rate = isBefore4PM ? rateBefore4 : rateAfter4;

    totalCost += durationHours * rate;
    currentMs = chunkEndMs;
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

  const rawCost = calculateCost(startMs, endMs, gameType);
  const cost = Math.round(rawCost / 10) * 10;

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
