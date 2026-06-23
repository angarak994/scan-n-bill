/**
 * Pure function for billing calculation.
 * @param startIso 
 * @param endIso 
 * @param ratePerHour 
 * @returns { duration_hours: number, cost: number }
 */
export function calculateBilling(startIso: string, endIso: string, ratePerHour: number) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const totalSeconds = (endMs - startMs) / 1000;

  // Round UP to the next full minute for fairness, similar to generic logic
  const durationMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

  // Bill in 15-minute chunks
  const billedMinutes = Math.ceil(durationMinutes / 15) * 15;

  const duration_hours = billedMinutes / 60;
  const rawCost = duration_hours * ratePerHour;
  const cost = Math.round(rawCost * 100) / 100; // 2 decimal places

  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  let duration = '';
  if (hours > 0) duration += `${hours} hr `;
  duration += `${mins} min`;

  return { duration_hours, duration: duration.trim(), cost };
}
