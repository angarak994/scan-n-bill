import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const businessId = sessionCookie.businessId;
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const hasBalance = searchParams.get('hasBalance') === 'true';

    const safeLimit = Math.min(limit, 100);
    const offset = (page - 1) * safeLimit;

    let query = supabase
      .from('customers')
      .select('id, name, phone, outstanding_balance', { count: 'exact' })
      .eq('business_id', businessId)
      .order('outstanding_balance', { ascending: false }) // QKhata customers with highest balance first
      .order('created_at', { ascending: false });

    if (search) {
      // Support searching by name or phone
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (hasBalance) {
      query = query.gt('outstanding_balance', 0);
    }

    query = query.range(offset, offset + safeLimit - 1);

    const { data: customers, count, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      customers: customers || [], 
      total: count || 0,
      page,
      limit: safeLimit,
      totalPages: count ? Math.ceil(count / safeLimit) : 0
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
