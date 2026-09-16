import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, memberships: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load memberships' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, mobile, email, tier, duration_months, verificationToken, verificationId } = await request.json();

    if (!name || !mobile || !verificationToken || !verificationId) {
      return NextResponse.json({ error: 'Name, Mobile, and OTP Verification are required' }, { status: 400 });
    }

    const normalizedMobile = normalizePhone(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }

    // 1. Validate Verification Token
    const expectedToken = crypto.createHash('sha256').update(`${verificationId}-${process.env.SUPABASE_JWT_SECRET || 'secret'}`).digest('hex');
    if (expectedToken !== verificationToken) {
       return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 403 });
    }

    // Verify it actually belongs to this mobile
    const { data: verif } = await supabase.from('otp_verifications').select('*').eq('id', verificationId).single();
    if (!verif || !verif.verified || verif.mobile !== normalizedMobile) {
       return NextResponse.json({ error: 'Verification mismatch' }, { status: 403 });
    }

    // 2. Check for Duplicate Mobile
    const { data: existing } = await supabase
       .from('memberships')
       .select('id')
       .eq('business_id', sessionCookie.businessId)
       .eq('mobile', normalizedMobile)
       .single();
       
    if (existing) {
       return NextResponse.json({ error: 'This mobile number is already registered for this business.' }, { status: 409 });
    }

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (parseInt(duration_months) || 12));

    const { data, error } = await supabase
      .from('memberships')
      .insert([{
        business_id: sessionCookie.businessId,
        name,
        mobile: normalizedMobile,
        email: email || null,
        tier: tier || 'Standard',
        status: 'Active',
        expiry_date: expiryDate.toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    
    // Optionally delete the verification record to prevent reuse
    await supabase.from('otp_verifications').delete().eq('id', verificationId);

    return NextResponse.json({ success: true, membership: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create membership' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Membership ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('id', id)
      .eq('business_id', sessionCookie.businessId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete membership' }, { status: 500 });
  }
}
