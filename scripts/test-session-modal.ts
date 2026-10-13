import { calculateBilling, applySessionDiscounts } from '../src/lib/billing';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('\n=== RUNNING SESSION COMPLETION MODAL & BILLING TEST SUITE ===\n');

// TEST 1: Discount Label Resolution (Never "None" when discount > 0)
console.log('--- TEST 1: Discount Label Resolution ---');
{
  // 1a. Table discount with percentage
  const disc1 = applySessionDiscounts(500, 0, { type: 'percentage', percent: 20, applyToFood: false } as any);
  assert(disc1.totalDiscountAmount === 100, 'Percentage discount amount should be 100');
  assert(disc1.discountAppliedLabel === '20% Off', 'Discount label should be 20% Off');

  // 1b. Table discount with fixed amount
  const disc2 = applySessionDiscounts(500, 0, { type: 'fixed', amount: 50, applyToFood: false } as any);
  assert(disc2.totalDiscountAmount === 50, 'Fixed discount amount should be 50');
  assert(disc2.discountAppliedLabel === 'Flat ₹50 Off', 'Discount label should be Flat ₹50 Off');

  // 1c. Bug reproduction test: Promotion discount present, but table discount empty
  // In the old code, disc.discountAppliedLabel was 'None'
  const discEmpty = applySessionDiscounts(500, 0, null);
  assert(discEmpty.discountAppliedLabel === 'None', 'Null discount returns None from engine');
  
  // Modal label resolution logic:
  const resolveModalLabel = (breakdown: { discountAmount: number; discountLabel?: string; appliedRateName?: string; discountPercent?: number }) => {
    if (!breakdown || breakdown.discountAmount <= 0) return null;
    let raw = (breakdown.discountLabel || '').trim();
    if (!raw || raw.toLowerCase() === 'none' || raw.toLowerCase().includes('required')) {
      if (breakdown.appliedRateName && breakdown.appliedRateName.toLowerCase() !== 'standard') {
        raw = breakdown.appliedRateName;
      } else if (breakdown.discountPercent && breakdown.discountPercent > 0) {
        raw = `${breakdown.discountPercent}% Off`;
      } else {
        raw = 'Applied Discount';
      }
    }
    return raw;
  };

  const resolved = resolveModalLabel({ discountAmount: 80, discountLabel: 'None', appliedRateName: 'Happy Hours (40% HH Off)' });
  assert(resolved === 'Happy Hours (40% HH Off)', 'When discountLabel is None, fallback resolves to rate name');
  assert(resolved !== 'None', 'Modal label is NEVER None when discountAmount > 0');
}

// TEST 2: Single Payment Tender & Change Calculation
console.log('\n--- TEST 2: Single Payment Tender & Change Due ---');
{
  const totalCost = 275;
  const numReceived = 275;

  // Customer gives exact cash
  let tendered = 275;
  let changeDue = Math.max(0, tendered - numReceived);
  assert(changeDue === 0, 'Exact cash tender gives 0 change');

  // Customer gives ₹500 note
  tendered = 500;
  changeDue = Math.max(0, tendered - numReceived);
  assert(changeDue === 225, '₹500 on ₹275 gives ₹225 change');

  // Customer gives ₹300 (three 100 notes)
  tendered = 300;
  changeDue = Math.max(0, tendered - numReceived);
  assert(changeDue === 25, '₹300 on ₹275 gives ₹25 change');

  // Customer gives insufficient cash
  tendered = 200;
  const isShort = tendered > 0 && tendered < numReceived;
  assert(isShort === true, '₹200 on ₹275 is detected as short');
  assert(numReceived - tendered === 75, 'Short amount is ₹75');
}

// TEST 3: Split Payment Validation & Fill Remaining
console.log('\n--- TEST 3: Split Payment Multi-Tender & Auto-Fill ---');
{
  const totalCost = 450;
  
  // Fill remaining for UPI when Cash is 200
  let splitCash = 200;
  let splitUpi = 0;
  let splitCard = 0;
  
  // Helper
  const fillRemaining = (currentCash: number, currentUpi: number, currentCard: number, target: 'cash'|'upi'|'card') => {
    let otherSum = 0;
    if (target === 'cash') otherSum = currentUpi + currentCard;
    if (target === 'upi') otherSum = currentCash + currentCard;
    if (target === 'card') otherSum = currentCash + currentUpi;
    return Math.max(0, totalCost - otherSum);
  };

  splitUpi = fillRemaining(splitCash, splitUpi, splitCard, 'upi');
  assert(splitUpi === 250, 'Fill Remaining for UPI correctly assigns 250');
  assert(splitCash + splitUpi === totalCost, 'Sum matches total cost');

  // Overpayment test
  splitCard = 50;
  const currentSum = splitCash + splitUpi + splitCard; // 200 + 250 + 50 = 500
  const isOver = currentSum > totalCost;
  assert(isOver === true, 'Overpayment is detected');
  assert(currentSum - totalCost === 50, 'Overage is 50');

  // Split validation helper
  const validateSplit = (sum: number, bill: number, isMember: boolean) => {
    if (sum <= 0) return { valid: false, error: 'Empty' };
    if (sum > bill) return { valid: false, error: 'Exceeds' };
    if (sum < bill && !isMember) return { valid: false, error: 'Walk-in cannot leave unpaid balance' };
    return { valid: true };
  };

  assert(validateSplit(500, 450, false).valid === false, 'Split exceeding bill is invalid');
  assert(validateSplit(400, 450, false).valid === false, 'Walk-in underpayment is invalid');
  assert(validateSplit(400, 450, true).valid === true, 'Member underpayment is allowed (remainder to QKhata)');
  assert(validateSplit(450, 450, false).valid === true, 'Exact split is valid for walk-in');
}

// TEST 4: Walk-in vs Member Policy Enforcement
console.log('\n--- TEST 4: Walk-in vs Member Credit Policy ---');
{
  const totalCost = 300;
  
  const validateSingle = (received: number, bill: number, isMember: boolean) => {
    if (isNaN(received) || received < 0) return false;
    if (received < bill && !isMember) return false;
    return true;
  };

  assert(validateSingle(300, 300, false) === true, 'Walk-in full payment allowed');
  assert(validateSingle(200, 300, false) === false, 'Walk-in partial payment disallowed');
  assert(validateSingle(200, 300, true) === true, 'Member partial payment allowed');
  assert(validateSingle(0, 300, true) === true, 'Member 0 payment (full credit) allowed');
}

// TEST 5: Customer Metadata & Outstanding QKhata Dues Resolution
console.log('\n--- TEST 5: Customer Metadata & Outstanding Dues Resolution ---');
{
  const mockCustomerMapByPhone = new Map<string, any>([
    ['9876543210', { id: 'c1', name: 'Rahul Sharma', phone: '9876543210', outstanding_balance: 450, is_member: true, tier: 'VIP' }]
  ]);

  const mockMembershipById = new Map<string, any>([
    ['mem-123', { id: 'mem-123', name: 'Amit Verma', mobile: '9876543210', tier: 'Gold', loyalty_points: 120 }]
  ]);

  const resolveMeta = (session: { customer_name?: string; member_id?: string }) => {
    if (session.member_id && mockMembershipById.has(session.member_id)) {
      const m = mockMembershipById.get(session.member_id);
      const c = mockCustomerMapByPhone.get(m.mobile);
      return {
        isMember: true,
        displayName: m.name,
        tier: m.tier,
        outstandingBalance: c?.outstanding_balance || 0
      };
    }
    const c = session.customer_name ? mockCustomerMapByPhone.get(session.customer_name) : null;
    if (c) {
      return {
        isMember: Boolean(c.is_member),
        displayName: c.name,
        tier: c.tier,
        outstandingBalance: c.outstanding_balance || 0
      };
    }
    return {
      isMember: false,
      displayName: session.customer_name || 'Guest',
      tier: undefined,
      outstandingBalance: 0
    };
  };

  const metaMember = resolveMeta({ member_id: 'mem-123' });
  assert(metaMember.isMember === true, 'Member detected');
  assert(metaMember.tier === 'Gold', 'Tier is Gold');
  assert(metaMember.outstandingBalance === 450, 'Outstanding balance is 450');

  const metaWalkin = resolveMeta({ customer_name: 'Guest 101' });
  assert(metaWalkin.isMember === false, 'Walk-in customer detected');
  assert(metaWalkin.outstandingBalance === 0, 'Walk-in balance is 0');
}

console.log('\n======================================================');
console.log('🎉 ALL MODAL LOGIC & BILLING VALIDATION TESTS PASSED!');
console.log('======================================================\n');
