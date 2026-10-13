import { applySessionDiscounts, TableDiscountConfig } from '../src/lib/billing';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('\n=============================================');
  console.log('🧪 QCONTROL DISCOUNT & BILLING ENGINE TESTS');
  console.log('=============================================\n');

  // Test 1: Standard Percentage Discount (Table Fee Only)
  {
    const config: TableDiscountConfig = {
      type: 'percentage',
      percent: 20,
      applyToFood: false,
      label: '20% Off'
    };
    const res = applySessionDiscounts(200, 100, config);
    assert(res.tableDiscountAmount === 40, 'Test 1: 20% on ₹200 table fee gives ₹40 table discount');
    assert(res.foodDiscountAmount === 0, 'Test 1: F&B discount is 0 when applyToFood is false');
    assert(res.finalTableCost === 160, 'Test 1: Final table cost is ₹160');
    assert(res.finalFoodCost === 100, 'Test 1: Final food cost remains ₹100');
    assert(res.finalTotalCost === 260, 'Test 1: Final total is ₹260');
    assert(res.totalDiscountAmount === 40, 'Test 1: Total discount is ₹40');
  }

  // Test 2: Percentage Discount with maxDiscount Cap
  {
    const config: TableDiscountConfig = {
      type: 'percentage',
      percent: 50,
      maxDiscount: 100,
      applyToFood: false,
      label: '50% Off (Max ₹100)'
    };
    const res = applySessionDiscounts(500, 0, config);
    assert(res.totalDiscountAmount === 100, 'Test 2: 50% on ₹500 capped at maxDiscount ₹100 (not ₹250)');
    assert(res.finalTableCost === 400, 'Test 2: Final table cost is ₹400');
    assert(res.finalTotalCost === 400, 'Test 2: Final total is ₹400');
  }

  // Test 3: Fixed Rupee Discount (Table Fee Only)
  {
    const config: TableDiscountConfig = {
      type: 'fixed',
      amount: 50,
      applyToFood: false,
      label: 'Flat ₹50 Off'
    };
    const res = applySessionDiscounts(200, 100, config);
    assert(res.tableDiscountAmount === 50, 'Test 3: Fixed ₹50 discount applies to table fee');
    assert(res.foodDiscountAmount === 0, 'Test 3: F&B discount is 0 when applyToFood is false');
    assert(res.finalTableCost === 150, 'Test 3: Final table cost is ₹150');
    assert(res.finalTotalCost === 250, 'Test 3: Final total is ₹250');
  }

  // Test 4: Fixed Rupee Discount Capped at Bill Amount (Never Negative)
  {
    const config: TableDiscountConfig = {
      type: 'fixed',
      amount: 150,
      applyToFood: false,
      label: 'Flat ₹150 Off'
    };
    const res = applySessionDiscounts(30, 0, config);
    assert(res.tableDiscountAmount === 30, 'Test 4: ₹150 discount on ₹30 bill capped at ₹30 (cannot exceed bill)');
    assert(res.finalTableCost === 0, 'Test 4: Final table cost is ₹0, never negative');
    assert(res.finalTotalCost === 0, 'Test 4: Final total bill is ₹0, never negative');
  }

  // Test 5: Minimum Bill Amount Threshold Constraint
  {
    const config: TableDiscountConfig = {
      type: 'fixed',
      amount: 30,
      minBillAmount: 100,
      applyToFood: false,
      label: '₹30 Off on Min ₹100'
    };
    // Sub-case A: Below threshold (bill is ₹80)
    const belowRes = applySessionDiscounts(80, 0, config);
    assert(belowRes.totalDiscountAmount === 0, 'Test 5A: Discount is 0 when eligible bill ₹80 < minBillAmount ₹100');
    assert(belowRes.finalTotalCost === 80, 'Test 5A: Final bill remains ₹80');

    // Sub-case B: Meets threshold (bill is ₹120)
    const meetsRes = applySessionDiscounts(120, 0, config);
    assert(meetsRes.totalDiscountAmount === 30, 'Test 5B: Discount applies when eligible bill ₹120 >= minBillAmount ₹100');
    assert(meetsRes.finalTotalCost === 90, 'Test 5B: Final bill is ₹90');
  }

  // Test 6: Zero-Value Bills (Zero elapsed or free table)
  {
    const config: TableDiscountConfig = {
      type: 'percentage',
      percent: 50,
      applyToFood: true
    };
    const res = applySessionDiscounts(0, 0, config);
    assert(res.totalDiscountAmount === 0, 'Test 6: Total discount on ₹0 bill is 0');
    assert(res.finalTotalCost === 0, 'Test 6: Final cost on ₹0 bill is 0, no NaN or negative');
  }

  // Test 7: Fixed Discount with Proportional F&B Distribution (applyToFood: true)
  {
    const config: TableDiscountConfig = {
      type: 'fixed',
      amount: 60,
      applyToFood: true,
      label: 'Flat ₹60 Off Combo'
    };
    // Table is ₹100, F&B is ₹50 => Total is ₹150
    // Table is 2/3 of total, F&B is 1/3 of total
    // Discount distribution: ₹40 table discount, ₹20 food discount
    const res = applySessionDiscounts(100, 50, config);
    assert(res.totalDiscountAmount === 60, 'Test 7: Total discount is ₹60');
    assert(res.tableDiscountAmount === 40, 'Test 7: Table discount is ₹40 (proportional 2/3)');
    assert(res.foodDiscountAmount === 20, 'Test 7: F&B discount is ₹20 (proportional 1/3)');
    assert(res.finalTableCost === 60, 'Test 7: Final table cost is ₹60');
    assert(res.finalFoodCost === 30, 'Test 7: Final food cost is ₹30');
    assert(res.finalTotalCost === 90, 'Test 7: Final total is ₹90 (150 - 60)');
  }

  // Test 8: Inactive Discount Configuration
  {
    const config: TableDiscountConfig = {
      type: 'percentage',
      percent: 25,
      isActive: false
    };
    const res = applySessionDiscounts(200, 0, config);
    assert(res.totalDiscountAmount === 0, 'Test 8: Inactive discount applies 0 discount');
    assert(res.finalTotalCost === 200, 'Test 8: Final bill remains full base amount');
  }

  // Test 9: Backward Compatibility with Legacy Discount Object
  {
    const legacy = { percent: 15, applyToFood: false };
    const res = applySessionDiscounts(100, 50, legacy as any);
    assert(res.totalDiscountAmount === 15, 'Test 9: Legacy { percent: 15 } produces ₹15 discount');
    assert(res.finalTableCost === 85, 'Test 9: Final table cost is ₹85');
    assert(res.finalTotalCost === 135, 'Test 9: Final total is ₹135');
  }

  // Test 10: Rounding to Nearest Rupee
  {
    const config: TableDiscountConfig = {
      type: 'percentage',
      percent: 15,
      applyToFood: false
    };
    // 15% of 35 is 5.25 => rounds to 5
    const res = applySessionDiscounts(35, 0, config);
    assert(res.tableDiscountAmount === 5, 'Test 10: 15% of ₹35 (₹5.25) correctly rounds to ₹5');
    assert(res.finalTableCost === 30, 'Test 10: Final table cost is ₹30');
    assert(res.finalTotalCost === 30, 'Test 10: Final total is ₹30');
  }

  // Test 11: Table-Specific vs Global 'all' Discount Resolution
  {
    const activeDiscounts: Record<string, TableDiscountConfig> = {
      'all': { type: 'percentage', percent: 10, applyToFood: false, label: '10% All Tables' },
      'T1': { type: 'fixed', amount: 50, applyToFood: false, label: 'T1 VIP Flat ₹50' },
      'T2': { type: 'percentage', percent: 20, isActive: false, label: 'T2 Disabled Promo' }
    };

    // Table T1 should get specific T1 discount
    const t1Disc = activeDiscounts['T1'];
    const t1Res = applySessionDiscounts(200, 0, t1Disc);
    assert(t1Res.totalDiscountAmount === 50, 'Test 11A: T1 gets specific ₹50 fixed discount instead of global 10%');

    // Table T3 should fall back to 'all' discount
    const t3Disc = activeDiscounts['T3'] || activeDiscounts['all'];
    const t3Res = applySessionDiscounts(200, 0, t3Disc);
    assert(t3Res.totalDiscountAmount === 20, 'Test 11B: T3 falls back to global 10% discount');

    // Table T2 has isActive: false -> 0 discount
    const t2Disc = activeDiscounts['T2'];
    const t2Res = applySessionDiscounts(200, 0, t2Disc);
    assert(t2Res.totalDiscountAmount === 0, 'Test 11C: T2 inactive discount correctly evaluates to 0 discount');
  }

  // Test 12: Validity Date / Expired Discounts
  {
    const expiredConfig: TableDiscountConfig = {
      type: 'percentage',
      percent: 30,
      applyToFood: false,
      expiryDate: '2020-01-01T00:00:00.000Z',
      label: 'Expired 30% Promo'
    };
    const res = applySessionDiscounts(100, 0, expiredConfig);
    assert(res.totalDiscountAmount === 0, 'Test 12: Expired discount (2020) applies ₹0 discount');
    assert(res.discountAppliedLabel === 'Expired Discount', 'Test 12: Label flags as Expired Discount');
  }

  console.log('\n=============================================');
  console.log('🎉 ALL 12 DISCOUNT SUITE TESTS PASSED!');
  console.log('=============================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
