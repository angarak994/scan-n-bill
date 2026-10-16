import { applySessionDiscounts } from '../src/lib/billing';
import { normalizePlanDiscounts } from '../src/lib/membershipUtils';

console.log('--- TESTING MEMBERSHIP DISCOUNTS ENGINE ---');

let passed = 0;
let failed = 0;

function assert(desc: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${desc}`, details);
    failed++;
  }
}

// 1. Percentage Discounts
{
  const config = { type: 'percentage', percent: 15, applyToFood: true } as any;
  const res = applySessionDiscounts(200, 100, config);
  // Total = 300. 15% of 300 = 45. Final = 255.
  assert('Percentage Discount 15% on ₹300 total', res.totalDiscountAmount === 45 && res.finalTotalCost === 255, res);
}

// 2. Fixed Rupee Discounts
{
  const config = { type: 'fixed', amount: 50, applyToFood: true } as any;
  const res = applySessionDiscounts(200, 100, config);
  // Total = 300. Flat ₹50 off. Final = 250.
  assert('Fixed Discount ₹50 on ₹300 total', res.totalDiscountAmount === 50 && res.finalTotalCost === 250, res);
}

// 3. Zero Discounts
{
  const configPct = { type: 'percentage', percent: 0, applyToFood: true } as any;
  const resPct = applySessionDiscounts(200, 50, configPct);
  assert('Zero percentage discount', resPct.totalDiscountAmount === 0 && resPct.finalTotalCost === 250, resPct);

  const configFixed = { type: 'fixed', amount: 0, applyToFood: true } as any;
  const resFixed = applySessionDiscounts(200, 50, configFixed);
  assert('Zero fixed discount', resFixed.totalDiscountAmount === 0 && resFixed.finalTotalCost === 250, resFixed);
}

// 4. Discount Equal to Bill
{
  const config = { type: 'fixed', amount: 200, applyToFood: false } as any;
  const res = applySessionDiscounts(200, 0, config);
  assert('Discount equal to bill results in ₹0 final bill', res.totalDiscountAmount === 200 && res.finalTotalCost === 0, res);
}

// 5. Discount Greater than Bill (Never Negative, Capped at Bill)
{
  const config = { type: 'fixed', amount: 500, applyToFood: false } as any;
  const res = applySessionDiscounts(150, 0, config);
  assert('Fixed discount (₹500) exceeding bill (₹150) capped at ₹150, final ₹0', res.totalDiscountAmount === 150 && res.finalTotalCost === 0, res);
}

// 6. Decimal Amounts & Safe Rounding
{
  const config = { type: 'percentage', percent: 12.5, applyToFood: true } as any;
  const res = applySessionDiscounts(199, 50, config);
  assert('Decimal percentage calculates safely without NaN', !isNaN(res.finalTotalCost) && res.finalTotalCost >= 0, res);
}

// 7. Normalization of Legacy & Modern Plans
{
  const legacyPlan = {
    id: 'p1',
    name: 'Legacy VIP',
    price: 1000,
    duration_months: 1,
    discount_percent: 20,
    benefits: ['Free locker']
  };
  const normalizedLegacy = normalizePlanDiscounts(legacyPlan);
  assert('Legacy plan defaults to percentage type with discount_percent intact', 
    normalizedLegacy.discount_type === 'percentage' && 
    normalizedLegacy.discount_percent === 20 && 
    normalizedLegacy.discount_amount === 0,
    normalizedLegacy
  );

  const fixedPlan = {
    id: 'p2',
    name: 'Flat Saver',
    price: 1500,
    duration_months: 1,
    discount_type: 'fixed',
    discount_amount: 100,
    discount_percent: 0,
    benefits: ['Priority access']
  };
  const normalizedFixed = normalizePlanDiscounts(fixedPlan);
  assert('Fixed plan normalizes discount_amount properly', 
    normalizedFixed.discount_type === 'fixed' && 
    normalizedFixed.discount_amount === 100 && 
    normalizedFixed.discount_percent === 0,
    normalizedFixed
  );

  const embeddedPlan = {
    id: 'p3',
    name: 'Fallback Plan',
    price: 1200,
    duration_months: 1,
    benefits: ['__DISCOUNT__:fixed:75', 'Access to lounge']
  };
  const normalizedEmbedded = normalizePlanDiscounts(embeddedPlan);
  assert('Embedded discount metadata extracts clean benefits and fixed amount', 
    normalizedEmbedded.discount_type === 'fixed' && 
    normalizedEmbedded.discount_amount === 75 && 
    normalizedEmbedded.benefits.length === 1 && 
    normalizedEmbedded.benefits[0] === 'Access to lounge',
    normalizedEmbedded
  );
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY! 🚀');
}
