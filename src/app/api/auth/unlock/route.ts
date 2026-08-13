import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = checkRateLimit(`unlock_${ip}`, 5, 15 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const { businessId, pin } = await request.json();

    if (!businessId || !pin) {
      return NextResponse.json({ error: 'Business ID and Password/PIN are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('businesses')
      .select('id, dashboard_pin')
      .eq('id', businessId)
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
    }

    const isHashed = String(data.dashboard_pin).startsWith('$2a$') || String(data.dashboard_pin).startsWith('$2b$');
    let isValid = false;

    if (isHashed) {
      isValid = await bcrypt.compare(String(pin || '').trim(), String(data.dashboard_pin));
    } else {
      isValid = String(data.dashboard_pin).trim() === String(pin || '').trim();
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect Password/PIN.' }, { status: 401 });
    }

    await setSession(data.id, 'owner');

    return NextResponse.json({ success: true, businessId: data.id });
  } catch (error: any) {
    console.error('Unlock error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
