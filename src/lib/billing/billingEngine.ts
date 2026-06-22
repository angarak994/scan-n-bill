/**
 * Pure function — no side effects, fully unit-testable.
 * @param {string} startTimeIso
 * @param {string} endTimeIso
 * @param {number} hourlyRate
 * @returns {{ durationMinutes: number, cost: number }}
 */
export function calculateBill(startTimeIso: string, endTimeIso: string, hourlyRate: number): { durationMinutes: number, cost: number } {
  const startMs = new Date(startTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const totalSeconds = (endMs - startMs) / 1000;

  // Round UP to the next full minute
  const durationMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

  const durationHours = durationMinutes / 60;
  const rawCost = durationHours * hourlyRate;
  const cost = Math.round(rawCost * 100) / 100; // 2 decimal places

  return { durationMinutes, cost };
}
