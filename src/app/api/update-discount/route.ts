import { NextResponse } from 'next/server';
import { businessManager } from '@/lib/businessManager';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { business_id, table_id, percent, applyToFood } = await request.json();
    
    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }
    
    if (!business_id || !table_id || percent === undefined) {
      return NextResponse.json({ error: 'business_id, table_id, and percent are required' }, { status: 400 });
    }

    const activeDiscounts = await businessManager.updateTableDiscount(business_id, table_id, Number(percent), Boolean(applyToFood));
    
    return NextResponse.json({ success: true, active_discounts: activeDiscounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
