import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reconcileMonthlySheets } from '@/lib/googleSheets';
import { getMonthKey, getBusinessTimezone } from '@/lib/sheetsTimezone';
import { businessManager } from '@/lib/businessManager';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_id, month } = body;

    if (!business_id) {
      return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
    }

    // Strict multi-tenant isolation check
    if (sessionCookie.businessId !== business_id) {
      return NextResponse.json({ error: 'Forbidden: Unauthorized business access' }, { status: 403 });
    }

    const business = await businessManager.getBusiness(business_id);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.google_sheet_id) {
      return NextResponse.json({ error: 'No Google Sheet connected for this business' }, { status: 400 });
    }

    const timezone = getBusinessTimezone(business);
    const targetMonth = month || getMonthKey(new Date(), timezone);

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json({ error: `Invalid month format '${targetMonth}'. Expected 'YYYY-MM'.` }, { status: 400 });
    }

    const report = await reconcileMonthlySheets(business_id, targetMonth);

    return NextResponse.json({
      success: report.success,
      report
    });
  } catch (error: any) {
    console.error('[SheetsReconcileAPI] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
