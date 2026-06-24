import { calculateCost } from '../billing';

/**
 * Pure function — no side effects, fully unit-testable.
 * @param {string} startTimeIso
 * @param {string} endTimeIso
 * @param {string} gameType
 * @returns {{ durationMinutes: number, cost: number }}
 */
export function calculateBill(startTimeIso: string, endTimeIso: string, gameType: string, pricingRules?: any): { durationMinutes: number, cost: number } {
  const startMs = new Date(startTimeIso).getTime();
  const endMs = new Date(endTimeIso).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp supplied to billing engine');
  }
  if (endMs < startMs) {
    throw new Error('endTime cannot be before startTime');
  }

  const { cost } = calculateCost(startMs, endMs, gameType, pricingRules);

  const totalSeconds = (endMs - startMs) / 1000;
  const durationMinutes = Math.floor(totalSeconds / 60);

  return { durationMinutes, cost };
}
