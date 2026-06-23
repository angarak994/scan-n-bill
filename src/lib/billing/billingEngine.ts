import { calculateCost } from '../billing';

/**
 * Pure function — no side effects, fully unit-testable.
 * @param {string} startTimeIso
 * @param {string} endTimeIso
 * @param {string} gameType
 * @returns {{ durationMinutes: number, cost: number }}
 */
export function calculateBill(startTimeIso: string, endTimeIso: string, gameType: string): { durationMinutes: number, cost: number } {
  const startMs = new Date(startTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();

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

  return { durationMinutes, cost };
}
