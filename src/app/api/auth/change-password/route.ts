import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { getSession, clearSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing session' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    // 4-digit PIN validation
    if (!/^\d{4}$/.test(newPassword)) {
      return NextResponse.json({ error: 'New PIN must be exactly 4 digits' }, { status: 400 });
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
      isValid = await bcrypt.compare(String(currentPassword || '').trim(), String(data.dashboard_pin));
    } else {
      isValid = String(data.dashboard_pin).trim() === String(currentPassword || '').trim();
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect current password.' }, { status: 401 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('businesses')
      .update({ dashboard_pin: hashedNewPassword })
      .eq('id', businessId);

    if (updateError) {
      throw updateError;
    }

    await clearSession();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
