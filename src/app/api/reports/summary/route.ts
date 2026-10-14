import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getFinancialReportsSummary } from '@/lib/services/reportsService';
import { ReportPreset } from '@/lib/services/reportsDateUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = session.businessId;
    const { searchParams } = new URL(request.url);

    const period = (searchParams.get('period') || 'thisMonth') as ReportPreset;
    const customStart = searchParams.get('startDate') || undefined;
    const customEnd = searchParams.get('endDate') || undefined;
    const compare = searchParams.get('compare') !== 'false';

    const summary = await getFinancialReportsSummary(
      businessId,
      period,
      customStart,
      customEnd,
      compare
    );

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('[reports/summary] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate financial summary' },
      { status: 500 }
    );
  }
}
