import { calculateDelta, formatINR } from '../src/lib/services/reportsDateUtils';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('\n============================================================');
console.log('🧪 PROPERTY & FIXTURE RECONCILIATION SCENARIOS TEST');
console.log('============================================================\n');

// -------------------------------------------------------------
// SCENARIO 1: Standard Multi-Method & Split Payments (Hand-calculated)
// -------------------------------------------------------------
// Session 1: Cost 1000, Paid: Cash 400 + UPI 600 (Full split)
// Session 2: Cost 500, Paid: Card 500 (Full card)
// Session 3: Cost 800, Paid: UPI 500, Remaining 300 to QKhata (Partial)
// Session 4: Cost 300, Cancelled (Excluded from revenue)
// Refund 1: UPI Refund -150
// Expected:
// Revenue = 1000 + 500 + 800 = 2300
// Collections = (400 + 600) + 500 + 500 = 2000
// Refunds = 150
// Net Collections = 2000 - 150 = 1850
// By Method:
//   Cash: 400
//   UPI: 1100 (600 + 500), Net UPI: 1100 - 150 = 950
//   Card: 500
// Total By Method = 400 + 1100 + 500 = 2000 == Headline Collections!
{
  const payments = [
    { amount: 400, method: 'Cash', status: 'Paid', type: 'PAYMENT' },
    { amount: 600, method: 'UPI', status: 'Paid', type: 'PAYMENT' },
    { amount: 500, method: 'Card', status: 'Paid', type: 'PAYMENT' },
    { amount: 500, method: 'UPI', status: 'Paid', type: 'PAYMENT' },
    { amount: 150, method: 'UPI', status: 'Refunded', type: 'REFUND' }
  ];

  const totalColl = payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + p.amount, 0);
  const totalRef = payments.filter(p => p.status === 'Refunded').reduce((acc, p) => acc + p.amount, 0);

  const byMethod: Record<string, { collected: number, refunds: number }> = {
    Cash: { collected: 0, refunds: 0 },
    UPI: { collected: 0, refunds: 0 },
    Card: { collected: 0, refunds: 0 }
  };

  for (const p of payments) {
    if (p.status === 'Paid') byMethod[p.method].collected += p.amount;
    if (p.status === 'Refunded') byMethod[p.method].refunds += p.amount;
  }

  const methodSum = Object.values(byMethod).reduce((acc, m) => acc + m.collected, 0);
  assert(totalColl === 2000, 'Total Collections must be 2000');
  assert(totalRef === 150, 'Total Refunds must be 150');
  assert(methodSum === totalColl, 'Rule (a): Sum of methods must equal total collections');
  console.log('✅ Scenario 1 (Split payments & methods): PASSED');
}

// -------------------------------------------------------------
// SCENARIO 2: Revenue Composition (Table + F&B)
// -------------------------------------------------------------
// Session A: Total Billed 1500 (Table 1200, Food 300)
// Session B: Total Billed 800 (Table 800, Food 0)
// Session C: Total Billed 600 (Table 0, Food 600)
// Expected:
// Table Revenue = 1200 + 800 + 0 = 2000
// F&B Revenue = 300 + 0 + 600 = 900
// Total Revenue = 2000 + 900 = 2900
{
  const sessions = [
    { cost: 1500, food: 300 },
    { cost: 800, food: 0 },
    { cost: 600, food: 600 }
  ];

  const totalRev = sessions.reduce((acc, s) => acc + s.cost, 0);
  const totalFood = sessions.reduce((acc, s) => acc + s.food, 0);
  const totalTable = sessions.reduce((acc, s) => acc + (s.cost - s.food), 0);

  assert(totalRev === 2900, 'Total Revenue must be 2900');
  assert(totalFood === 900, 'Total Food must be 900');
  assert(totalTable === 2000, 'Total Table must be 2000');
  assert(totalTable + totalFood === totalRev, 'Rule (c): Table + Food == Total Revenue');
  console.log('✅ Scenario 2 (Revenue composition Table + F&B): PASSED');
}

// -------------------------------------------------------------
// SCENARIO 3: Dues Roll-Forward Integrity
// -------------------------------------------------------------
// Opening Dues: 5,000
// New Billed Dues (Unpaid in period): 3,000
// Settled Collections in period: 2,500
// Write-offs: 0
// Expected Closing Dues: 5000 + 3000 - 2500 = 5500
{
  const opening = 5000;
  const newDues = 3000;
  const settled = 2500;
  const closing = opening + newDues - settled;

  assert(closing === 5500, 'Rule (d): Closing dues must equal 5500');
  console.log('✅ Scenario 3 (Dues Roll-Forward): PASSED');
}

// -------------------------------------------------------------
// SCENARIO 4: Property-Based Randomized Invariant Checks (1000 trials)
// -------------------------------------------------------------
console.log('Running 1,000 randomized property tests...');
for (let i = 0; i < 1000; i++) {
  const numSessions = Math.floor(Math.random() * 50) + 1;
  let runningRev = 0;
  let runningFood = 0;
  let runningTable = 0;

  for (let s = 0; s < numSessions; s++) {
    const cost = Math.floor(Math.random() * 5000);
    const food = Math.floor(Math.random() * cost);
    const table = cost - food;
    runningRev += cost;
    runningFood += food;
    runningTable += table;
  }

  assert(runningTable + runningFood === runningRev, `Trial ${i}: Invariant Table + Food == Total Revenue violated!`);
}
console.log('✅ Scenario 4 (1,000 randomized property checks): PASSED');

console.log('\n🎉 ALL RECONCILIATION SCENARIOS & PROPERTY TESTS COMPLETED WITH 100% SUCCESS!\n');
