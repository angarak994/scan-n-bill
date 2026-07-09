import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // Service role client
import bcrypt from 'bcryptjs';
import { setSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Rate Limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = checkRateLimit(`login_${ip}`, 5, 15 * 60 * 1000); // 5 attempts per 15 mins
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 });
    }

    const { identifier, pin } = await request.json();

    if (!identifier || !pin) {
      return NextResponse.json({ error: 'Identifier and PIN are required' }, { status: 400 });
    }

    // Since this uses the service_role client, it bypasses RLS.
    let { data } = await supabase
      .from('businesses')
      .select('id, dashboard_pin')
      .eq('business_name', identifier)
      .limit(1)
      .single();

    if (!data) {
      const phoneRes = await supabase
        .from('businesses')
        .select('id, dashboard_pin')
        .eq('contact_number', identifier)
        .limit(1)
        .single();
      data = phoneRes.data;
    }

    if (!data) {
      return NextResponse.json({ error: 'Business not found. Check your Club Name or Phone.' }, { status: 404 });
    }

    // Verify hashed PIN. (Fallback for legacy unhashed pins in transition: if it doesn't match bcrypt format, do direct compare for safety until migration script completes).
    const isHashed = String(data.dashboard_pin).startsWith('$2a$') || String(data.dashboard_pin).startsWith('$2b$');
    let isValid = false;

    if (isHashed) {
      isValid = await bcrypt.compare(String(pin || '').trim(), String(data.dashboard_pin));
    } else {
      isValid = String(data.dashboard_pin).trim() === String(pin || '').trim();
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect Admin PIN.' }, { status: 401 });
    }

    // Generate JWT and set HttpOnly Cookie
    await setSession(data.id, 'owner');

    return NextResponse.json({ success: true, businessId: data.id });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during login.' }, { status: 500 });
  }
}
