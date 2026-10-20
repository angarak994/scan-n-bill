import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { whatsappRepository } from '@/lib/repositories/whatsappRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedBusinessId = searchParams.get('businessId') || sessionCookie.businessId;

    // Enforce multi-tenant isolation
    if (requestedBusinessId !== sessionCookie.businessId) {
      return NextResponse.json({ error: 'Forbidden: Cannot access logs of another business' }, { status: 403 });
    }

    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const direction = searchParams.get('direction') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = (page - 1) * limit;

    const result = await whatsappRepository.getDeliveryLogs(requestedBusinessId, {
      search,
      status,
      direction,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      logs: result.logs,
      totalCount: result.totalCount,
      analytics: result.analytics,
      page,
      limit,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching messaging delivery logs:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
