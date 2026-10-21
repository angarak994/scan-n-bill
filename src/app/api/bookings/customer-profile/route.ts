import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { bookingService } from '@/lib/services/bookingService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone') || '';
    const name = searchParams.get('name') || '';

    if (!phone && !name) {
      return NextResponse.json({ error: 'Customer phone or name is required' }, { status: 400 });
    }

    const profile = await bookingService.getCustomerProfileAndHistory(businessId, phone, name);

    if (!profile) {
      return NextResponse.json({
        profile: {
          name: name || 'Customer',
          phone: phone || '',
          total_visits: 0,
          completed_bookings_count: 0,
          outstanding_balance: 0,
          recent_bookings: []
        }
      });
    }

    return NextResponse.json({ profile });
  } catch (err: any) {
    console.error('Customer Profile API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
