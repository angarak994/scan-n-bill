import { NextResponse } from 'next/server';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';
import { TableDiscountConfig, DiscountType } from '@/lib/billing';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      business_id, 
      table_id, 
      type = 'percentage', 
      percent, 
      amount, 
      maxDiscount, 
      minBillAmount, 
      applyToFood, 
      label, 
      isActive = true,
      remove = false 
    } = body;
    
    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }
    
    if (!business_id || !table_id) {
      return NextResponse.json({ error: 'business_id and table_id are required' }, { status: 400 });
    }

    // Check for removal request
    if (remove || (Number(percent) === 0 && !amount) || (Number(amount) === 0 && !percent)) {
      const activeDiscounts = await businessManager.updateTableDiscount(business_id, table_id, null);
      return NextResponse.json({ success: true, active_discounts: activeDiscounts });
    }

    const discountType: DiscountType = type === 'fixed' ? 'fixed' : 'percentage';

    if (discountType === 'percentage') {
      const numPercent = Number(percent);
      if (isNaN(numPercent) || numPercent < 1 || numPercent > 100) {
        return NextResponse.json({ error: 'Percentage discount must be between 1% and 100%' }, { status: 400 });
      }
      if (maxDiscount !== undefined && maxDiscount !== null && maxDiscount !== '') {
        const numMax = Number(maxDiscount);
        if (isNaN(numMax) || numMax < 0) {
          return NextResponse.json({ error: 'Maximum discount cap must be a non-negative number' }, { status: 400 });
        }
      }
    } else {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount < 1) {
        return NextResponse.json({ error: 'Fixed discount amount must be at least ₹1' }, { status: 400 });
      }
    }

    if (minBillAmount !== undefined && minBillAmount !== null && minBillAmount !== '') {
      const numMinBill = Number(minBillAmount);
      if (isNaN(numMinBill) || numMinBill < 0) {
        return NextResponse.json({ error: 'Minimum bill amount must be a non-negative number' }, { status: 400 });
      }
    }

    const discountConfig: TableDiscountConfig = {
      type: discountType,
      percent: discountType === 'percentage' ? Number(percent) : undefined,
      amount: discountType === 'fixed' ? Number(amount) : undefined,
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      minBillAmount: minBillAmount ? Number(minBillAmount) : undefined,
      applyToFood: Boolean(applyToFood),
      label: label ? String(label).trim() : undefined,
      isActive: isActive !== false,
    };

    const activeDiscounts = await businessManager.updateTableDiscount(business_id, table_id, discountConfig);
    
    return NextResponse.json({ success: true, active_discounts: activeDiscounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
