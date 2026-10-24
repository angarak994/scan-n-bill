import { NextResponse } from 'next/server';
import { getDeveloperSession } from '@/lib/auth';
import { developerAuditService } from '@/lib/services/developerAuditService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const devSession = await getDeveloperSession(request);
    if (!devSession) {
      return NextResponse.json({ error: 'Unauthorized: Developer access required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const businessId = searchParams.get('businessId') || undefined;

    const logs = await developerAuditService.getLogs(limit, businessId);

    return NextResponse.json({
      success: true,
      logs,
    });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
