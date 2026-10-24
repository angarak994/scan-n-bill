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

export async function DELETE(request: Request) {
  try {
    const sessionCookie = await getSession(request);
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: No active session' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    let id: string | null = null;
    let deleteNonMembers = false;

    try {
      const body = await request.json();
      id = body?.id || null;
      deleteNonMembers = Boolean(body?.deleteNonMembers);
    } catch {
      const { searchParams } = new URL(request.url);
      id = searchParams.get('id');
      deleteNonMembers = searchParams.get('deleteNonMembers') === 'true';
    }

    if (deleteNonMembers) {
      // Find all customer records that do not belong to registered members
      const { data: memberRows } = await supabase
        .from('memberships')
        .select('mobile')
        .eq('business_id', businessId);

      const memberPhones = new Set((memberRows || []).map(m => (m.mobile || '').replace(/\D/g, '').slice(-10)).filter(Boolean));

      const { data: custRows } = await supabase
        .from('customers')
        .select('id, phone')
        .eq('business_id', businessId);

      const idsToDelete = (custRows || [])
        .filter(c => {
          const p10 = (c.phone || '').replace(/\D/g, '').slice(-10);
          return !p10 || !memberPhones.has(p10);
        })
        .map(c => c.id);

      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('customers')
          .delete()
          .in('id', idsToDelete)
          .eq('business_id', businessId);

        if (delErr) throw delErr;
      }

      return NextResponse.json({ 
        success: true, 
        message: `Successfully deleted ${idsToDelete.length} non-member customer records.`,
        deletedCount: idsToDelete.length 
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Customer record deleted successfully.'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

