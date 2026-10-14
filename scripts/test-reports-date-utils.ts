import { resolveReportRange, formatINR, calculateDelta, ReportPreset } from '../src/lib/services/reportsDateUtils';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

console.log('🧪 Testing reportsDateUtils.ts...');

// Fixed reference date: 2026-10-14 21:42:00 IST (UTC: 2026-10-14 16:12:00)
const fixedNow = new Date('2026-10-14T16:12:00.000Z');

// 1. Today
const todayRange = resolveReportRange('today', undefined, undefined, fixedNow);
console.log('Today:', todayRange.current.label, 'vs', todayRange.comparison?.label);
assert(todayRange.granularity === 'hourly', 'Today should have hourly granularity');
assert(todayRange.comparison?.label === 'vs yesterday', 'Today comparison label');

// 2. This Month (Oct 1 to Oct 14)
const thisMonthRange = resolveReportRange('thisMonth', undefined, undefined, fixedNow);
console.log('This Month:', thisMonthRange.current.label, 'vs', thisMonthRange.comparison?.label);
assert(thisMonthRange.comparison?.label === 'vs 1–14 Sep', 'This month comparison should be vs 1-14 Sep');
assert(thisMonthRange.granularity === 'daily', 'This month should have daily granularity');

// 3. Last 7 days
const last7Range = resolveReportRange('last7', undefined, undefined, fixedNow);
console.log('Last 7 Days:', last7Range.current.label, 'vs', last7Range.comparison?.label);
assert(last7Range.comparison?.label === 'vs previous 7 days', 'Last 7 days comparison label');

// 4. All time
const allTimeRange = resolveReportRange('allTime', undefined, undefined, fixedNow);
console.log('All time comparison:', allTimeRange.comparison);
assert(allTimeRange.comparison === null, 'All time comparison must be null');

// 5. Custom Range
const customRange = resolveReportRange('custom', '2026-10-01', '2026-10-14', fixedNow);
console.log('Custom Range:', customRange.current.label, 'vs', customRange.comparison?.label);
assert(customRange.comparison?.label === 'vs previous 14 days', 'Custom 14 days comparison label');

// 6. Currency Formatting
assert(formatINR(184260) === '₹1,84,260', 'formatINR(184260) should be ₹1,84,260');
assert(formatINR(-1350) === '-₹1,350', 'formatINR(-1350) should be -₹1,350');
assert(formatINR(0) === '₹0', 'formatINR(0) should be ₹0');

// 7. Delta calculations
const upDelta = calculateDelta(184260, 163932);
console.log('Delta 184260 vs 163932:', upDelta);
assert(upDelta.formatted === '+12.4%', 'Delta up 12.4%');
assert(upDelta.direction === 'up', 'Direction up');

const downDelta = calculateDelta(14420, 14897);
console.log('Delta 14420 vs 14897:', downDelta);
assert(downDelta.formatted === '-3.2%', 'Delta down -3.2%');
assert(downDelta.direction === 'down', 'Direction down');

const zeroDelta = calculateDelta(100, 0);
assert(zeroDelta.formatted === '+100%', 'Zero baseline delta');

const nullDelta = calculateDelta(0, 0);
assert(nullDelta.formatted === '—', '0 vs 0 delta must be em dash');

console.log('✅ ALL DATE UTILITY TESTS PASSED CLEANLY!\n');
