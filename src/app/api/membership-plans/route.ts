import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
import { normalizePlanDiscounts } from '@/lib/membershipUtils';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    let query = supabase
      .from('membership_plans')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .order('created_at', { ascending: false });
      
    if (activeOnly) {
      query = query.eq('status', 'Active');
    }

    const { data, error } = await query;

    if (error) throw error;

    const normalizedPlans = (data || []).map(normalizePlanDiscounts);

    return NextResponse.json({ success: true, plans: normalizedPlans });
  } catch (error: any) {
    console.error('Membership Plans GET error:', error);
    return NextResponse.json({ error: 'Failed to load membership plans' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, price, duration_months, benefits, discount_type, discount_percent, discount_amount, flat_hourly_rate } = await request.json();

    if (!name || price === undefined || !duration_months) {
      return NextResponse.json({ error: 'Name, price, and duration are required' }, { status: 400 });
    }

    const parsedPrice = Math.max(0, Number(price) || 0);
    const parsedDuration = Math.max(1, parseInt(String(duration_months), 10) || 1);
    const cleanType: 'percentage' | 'fixed' | 'flat_rate' = 
      discount_type === 'flat_rate' ? 'flat_rate' : (discount_type === 'fixed' ? 'fixed' : 'percentage');
    
    let cleanPercent = 0;
    let cleanAmount = 0;
    let cleanFlatRate = 0;

    if (cleanType === 'flat_rate') {
      cleanFlatRate = Math.max(0, Number(flat_hourly_rate) || 0);
      cleanPercent = 0;
      cleanAmount = 0;
    } else if (cleanType === 'fixed') {
      cleanAmount = Math.max(0, Number(discount_amount) || 0);
      cleanPercent = 0;
      cleanFlatRate = 0;
    } else {
      cleanPercent = Math.max(0, Math.min(100, Number(discount_percent) || 0));
      cleanAmount = 0;
      cleanFlatRate = 0;
    }

    const rawBenefits = Array.isArray(benefits) ? benefits.map((b: any) => String(b).trim()).filter(Boolean) : [];

    // Attempt primary insert with native discount_type, discount_amount & flat_hourly_rate
    let { data, error } = await supabase
      .from('membership_plans')
      .insert([{
        business_id: sessionCookie.businessId,
        name: String(name).trim(),
        price: parsedPrice,
        duration_months: parsedDuration,
        benefits: rawBenefits,
        discount_type: cleanType,
        discount_amount: cleanAmount,
        discount_percent: cleanPercent,
        flat_hourly_rate: cleanFlatRate,
        status: 'Active'
      }])
      .select()
      .single();

    // Graceful fallback if migration columns don't exist yet in the database
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      const fallbackBenefits = [...rawBenefits];
      if (cleanType === 'flat_rate' && cleanFlatRate > 0) {
        fallbackBenefits.push(`__FLAT_RATE__:${cleanFlatRate}`);
      } else if (cleanType === 'fixed' && cleanAmount > 0) {
        fallbackBenefits.push(`__DISCOUNT__:fixed:${cleanAmount}`);
      } else if (cleanType === 'percentage' && cleanPercent > 0) {
        fallbackBenefits.push(`__DISCOUNT__:percentage:${cleanPercent}`);
      }

      const fallbackRes = await supabase
        .from('membership_plans')
        .insert([{
          business_id: sessionCookie.businessId,
          name: String(name).trim(),
          price: parsedPrice,
          duration_months: parsedDuration,
          benefits: fallbackBenefits,
          discount_percent: cleanPercent,
          status: 'Active'
        }])
        .select()
        .single();

      if (fallbackRes.error) throw fallbackRes.error;
      data = fallbackRes.data;
    } else if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, plan: normalizePlanDiscounts(data) });
  } catch (error: any) {
    console.error('Membership Plans POST error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create membership plan' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, name, price, duration_months, benefits, discount_type, discount_percent, discount_amount, flat_hourly_rate, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const cleanType: 'percentage' | 'fixed' | 'flat_rate' = 
      discount_type === 'flat_rate' ? 'flat_rate' : (discount_type === 'fixed' ? 'fixed' : 'percentage');
    let cleanPercent = 0;
    let cleanAmount = 0;
    let cleanFlatRate = 0;

    if (cleanType === 'flat_rate') {
      cleanFlatRate = Math.max(0, Number(flat_hourly_rate) || 0);
    } else if (cleanType === 'fixed') {
      cleanAmount = Math.max(0, Number(discount_amount) || 0);
    } else {
      cleanPercent = Math.max(0, Math.min(100, Number(discount_percent) || 0));
    }

    const rawBenefits = Array.isArray(benefits) ? benefits.map((b: any) => String(b).trim()).filter(Boolean) : [];

    let { data, error } = await supabase
      .from('membership_plans')
      .update({
        ...(name !== undefined && { name: String(name).trim() }),
        ...(price !== undefined && { price: Math.max(0, Number(price) || 0) }),
        ...(duration_months !== undefined && { duration_months: Math.max(1, parseInt(String(duration_months), 10) || 1) }),
        ...(benefits !== undefined && { benefits: rawBenefits }),
        discount_type: cleanType,
        discount_amount: cleanAmount,
        discount_percent: cleanPercent,
        flat_hourly_rate: cleanFlatRate,
        ...(status !== undefined && { status }),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId)
      .select()
      .single();

    if (error && (error.message?.includes('column') || error.code === '42703')) {
      const fallbackBenefits = [...rawBenefits];
      if (cleanType === 'flat_rate' && cleanFlatRate > 0) {
        fallbackBenefits.push(`__FLAT_RATE__:${cleanFlatRate}`);
      } else if (cleanType === 'fixed' && cleanAmount > 0) {
        fallbackBenefits.push(`__DISCOUNT__:fixed:${cleanAmount}`);
      } else if (cleanType === 'percentage' && cleanPercent > 0) {
        fallbackBenefits.push(`__DISCOUNT__:percentage:${cleanPercent}`);
      }

      const fallbackRes = await supabase
        .from('membership_plans')
        .update({
          ...(name !== undefined && { name: String(name).trim() }),
          ...(price !== undefined && { price: Math.max(0, Number(price) || 0) }),
          ...(duration_months !== undefined && { duration_months: Math.max(1, parseInt(String(duration_months), 10) || 1) }),
          ...(benefits !== undefined && { benefits: fallbackBenefits }),
          discount_percent: cleanPercent,
          ...(status !== undefined && { status }),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', sessionCookie.businessId)
        .select()
        .single();

      if (fallbackRes.error) throw fallbackRes.error;
      data = fallbackRes.data;
    } else if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, plan: normalizePlanDiscounts(data) });
  } catch (error: any) {
    console.error('Membership Plans PUT error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update membership plan' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Plan ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('membership_plans')
      .delete()
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Membership Plans DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete membership plan' }, { status: 500 });
  }
}
