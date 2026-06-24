export const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export function parseDateString(dateStr: string): number {
  if (!dateStr) return NaN;
  let cleanStr = dateStr.replace(/^'/, '').trim();
  if (!cleanStr.includes('+') && !cleanStr.includes('Z') && !cleanStr.includes('GMT')) {
    cleanStr = `${cleanStr} +0530`;
  }
  return new Date(cleanStr).getTime();
}

export function getCurrentRate(tableId: string, gameType: string, nowMs: number): number {
  const isPlayShireP1 = tableId === 'PlayShire P1';
  const isPlayShireS1 = tableId === 'PlayShire S1';
  const game = gameType.toLowerCase();

  if (isPlayShireP1) return 150;
  if (isPlayShireS1) return 250;

  const dateIst = new Date(nowMs + IST_OFFSET);
  const isBefore4PM = dateIst.getUTCHours() < 16;

  if (isBefore4PM) return game === 'snooker' ? 200 : 100;
  return game === 'snooker' ? 300 : 150;
}

export function calculateCost(startMs: number, endMs: number, gameType: string, tableId: string): { cost: number, slabsApplied: string } {
  const totalMs = endMs - startMs;
  const durationMinutes = Math.floor(totalMs / 60000);

  // First 10 minutes are completely free (Grace Period logic)
  if (durationMinutes <= 10) {
    return { cost: 0, slabsApplied: 'None (Grace Period)' };
  }

  let totalCost = 0;
  const appliedSlabs = new Set<string>();
  const isPlayShireP1 = tableId === 'PlayShire P1';
  const isPlayShireS1 = tableId === 'PlayShire S1';

  let currentMs = startMs;
  while (currentMs < endMs) {
    const nextMs = currentMs + 60 * 1000;
    const chunkEndMs = Math.min(nextMs, endMs);
    const durationHours = (chunkEndMs - currentMs) / (1000 * 60 * 60);

    if (isPlayShireP1 || isPlayShireS1) {
      appliedSlabs.add(isPlayShireP1 ? 'PlayShire Flat ₹150/hr' : 'PlayShire Flat ₹250/hr');
    } else {
      const slotStartIst = new Date(currentMs + IST_OFFSET);
      const isBefore4PM = slotStartIst.getUTCHours() < 16;
      if (isBefore4PM) appliedSlabs.add('BigShot Before 4 PM');
      else appliedSlabs.add('BigShot After 4 PM');
    }

    totalCost += durationHours * getCurrentRate(tableId, gameType, currentMs);
    currentMs = nextMs;
  }
  
  // Strict nearest 10 rounding logic
  const finalCost = Math.round(totalCost / 10) * 10;
  return { cost: finalCost, slabsApplied: Array.from(appliedSlabs).join(' + ') || 'None' };
}

/**
 * Pure function for billing calculation.
 */
export function calculateBilling(startString: string, endString: string, gameType: string, tableId: string) {
  const startMs = parseDateString(startString);
  const endMs = parseDateString(endString);

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const { cost, slabsApplied } = calculateCost(startMs, endMs, gameType, tableId);

  const totalSeconds = (endMs - startMs) / 1000;
  const durationMinutes = Math.floor(totalSeconds / 60);

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration: duration.trim() || '0 min', cost, slabs_applied: slabsApplied };
}
