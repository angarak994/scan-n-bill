export interface NormalizedMembershipPlan {
  id: string;
  business_id: string;
  name: string;
  price: number;
  duration_months: number;
  discount_type: 'percentage' | 'fixed' | 'flat_rate';
  discount_amount: number;
  discount_percent: number;
  flat_hourly_rate: number | null;
  benefits: string[];
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface MemberPlanInfo {
  plan: NormalizedMembershipPlan | null;
  planName: string;
  isExpired: boolean;
  isActive: boolean;
  displayStatus: 'Active' | 'Expired' | 'Inactive' | 'No Plan';
  discountLabel: string;
  discountType: 'percentage' | 'fixed' | 'flat_rate' | 'none';
  discountValue: number;
  daysRemaining: number | null;
  expiryDateFormatted: string;
}

export function normalizePlanDiscounts(plan: any): NormalizedMembershipPlan {
  if (!plan) return plan;
  let discount_type: 'percentage' | 'fixed' | 'flat_rate' = 
    plan.discount_type === 'fixed' ? 'fixed' : 
    plan.discount_type === 'flat_rate' ? 'flat_rate' : 'percentage';
    
  let discount_amount = Math.max(0, Number(plan.discount_amount || 0));
  let discount_percent = Math.max(0, Math.min(100, Number(plan.discount_percent || 0)));
  let flat_hourly_rate: number | null = plan.flat_hourly_rate ? Number(plan.flat_hourly_rate) : null;

  const cleanBenefits: string[] = [];
  if (Array.isArray(plan.benefits)) {
    for (const b of plan.benefits) {
      if (typeof b === 'string' && b.startsWith('__DISCOUNT__:')) {
        const parts = b.split(':');
        if (parts[1] === 'fixed') {
          discount_type = 'fixed';
          discount_amount = Math.max(0, Number(parts[2]) || 0);
          discount_percent = 0;
        } else if (parts[1] === 'percentage') {
          discount_type = 'percentage';
          discount_percent = Math.max(0, Math.min(100, Number(parts[2]) || 0));
          discount_amount = 0;
        }
      } else if (typeof b === 'string' && b.startsWith('__FLAT_RATE__:')) {
        const parts = b.split(':');
        discount_type = 'flat_rate';
        flat_hourly_rate = Math.max(0, Number(parts[1]) || 0);
        discount_amount = 0;
        discount_percent = 0;
      } else {
        cleanBenefits.push(b);
      }
    }
  }

  if (discount_type === 'fixed') {
    discount_percent = 0;
    flat_hourly_rate = null;
  } else if (discount_type === 'flat_rate') {
    discount_amount = 0;
    discount_percent = 0;
  } else {
    discount_amount = 0;
    flat_hourly_rate = null;
  }

  return {
    ...plan,
    discount_type,
    discount_amount,
    discount_percent,
    flat_hourly_rate,
    benefits: cleanBenefits
  };
}

export function getMemberPlanInfo(member: any, rawPlans: any[] = []): MemberPlanInfo {
  if (!member) {
    return {
      plan: null,
      planName: 'No Active Plan',
      isExpired: false,
      isActive: false,
      displayStatus: 'No Plan',
      discountLabel: 'None',
      discountType: 'none',
      discountValue: 0,
      daysRemaining: null,
      expiryDateFormatted: '-'
    };
  }

  const plans = (rawPlans || []).map(normalizePlanDiscounts);

  // Match plan by plan_id, id === member.tier, or name === member.tier
  const matchedPlan = plans.find((p: NormalizedMembershipPlan) => {
    if (member.plan_id && String(p.id).toLowerCase() === String(member.plan_id).toLowerCase()) return true;
    if (member.tier && String(p.id).toLowerCase() === String(member.tier).toLowerCase()) return true;
    if (member.tier && p.name && p.name.trim().toLowerCase() === member.tier.trim().toLowerCase()) return true;
    return false;
  }) || null;

  // Check Expiry Date
  let isExpired = false;
  let daysRemaining: number | null = null;
  let expiryDateFormatted = '-';

  if (member.expiry_date) {
    const expDate = new Date(member.expiry_date);
    if (!isNaN(expDate.getTime())) {
      const now = new Date();
      const diffMs = expDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      isExpired = diffMs < 0;
      expiryDateFormatted = expDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  const isStatusActive = !member.status || member.status.toLowerCase() === 'active';
  const isActive = isStatusActive && !isExpired;

  let displayStatus: 'Active' | 'Expired' | 'Inactive' | 'No Plan' = 'Active';
  if (isExpired) {
    displayStatus = 'Expired';
  } else if (!isStatusActive) {
    displayStatus = 'Inactive';
  } else if (!matchedPlan && (!member.tier || member.tier === 'Standard' || member.tier === 'Member')) {
    displayStatus = 'No Plan';
  }

  // Determine Plan Name to display
  let planName = 'No Active Plan';
  if (matchedPlan) {
    planName = matchedPlan.name;
  } else if (member.tier && member.tier !== 'Standard' && member.tier !== 'Member') {
    // Member has a tier name directly recorded
    planName = member.tier;
  }

  // Determine Discount Label & Values
  let discountLabel = 'None';
  let discountType: 'percentage' | 'fixed' | 'flat_rate' | 'none' = 'none';
  let discountValue = 0;

  if (matchedPlan) {
    if (matchedPlan.discount_type === 'fixed' && matchedPlan.discount_amount > 0) {
      discountType = 'fixed';
      discountValue = matchedPlan.discount_amount;
      discountLabel = `Flat ₹${matchedPlan.discount_amount} Off`;
    } else if (matchedPlan.discount_type === 'flat_rate' && matchedPlan.flat_hourly_rate !== null) {
      discountType = 'flat_rate';
      discountValue = matchedPlan.flat_hourly_rate;
      discountLabel = `Flat ₹${matchedPlan.flat_hourly_rate}/hr`;
    } else if (matchedPlan.discount_percent > 0) {
      discountType = 'percentage';
      discountValue = matchedPlan.discount_percent;
      discountLabel = `${matchedPlan.discount_percent}% Off`;
    }
  } else if (member.tier) {
    // Legacy tier fallback
    if (member.tier === 'Elite') { discountType = 'percentage'; discountValue = 30; discountLabel = '30% Off'; }
    else if (member.tier === 'VIP') { discountType = 'percentage'; discountValue = 20; discountLabel = '20% Off'; }
    else if (member.tier === 'Pro') { discountType = 'percentage'; discountValue = 10; discountLabel = '10% Off'; }
    else if (member.tier === 'Standard') { discountType = 'percentage'; discountValue = 5; discountLabel = '5% Off'; }
  }

  return {
    plan: matchedPlan,
    planName,
    isExpired,
    isActive,
    displayStatus,
    discountLabel,
    discountType,
    discountValue,
    daysRemaining,
    expiryDateFormatted
  };
}
