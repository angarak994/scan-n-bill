import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession();
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mobile, otp } = await request.json();
    if (!mobile || !otp) {
      return NextResponse.json({ error: 'Mobile and OTP are required' }, { status: 400 });
    }

    const normalizedMobile = normalizePhone(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }

    // Get the most recent active OTP for this mobile
    const { data: verifications, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .eq('mobile', normalizedMobile)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!verifications || verifications.length === 0) {
      return NextResponse.json({ error: 'No OTP request found for this number.' }, { status: 400 });
    }

    const verification = verifications[0];

    if (verification.verified) {
      return NextResponse.json({ error: 'Mobile number already verified.' }, { status: 400 });
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    if (verification.attempts >= 3) {
      return NextResponse.json({ error: 'Maximum verification attempts exceeded. Request a new OTP.' }, { status: 400 });
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    if (verification.otp_hash !== otpHash) {
      await supabase
        .from('otp_verifications')
        .update({ attempts: verification.attempts + 1 })
        .eq('id', verification.id);
      
      return NextResponse.json({ error: 'Invalid OTP.' }, { status: 400 });
    }

    // Success - Mark as verified
    await supabase
      .from('otp_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    // Generate a temporary verification token that the client can use to submit the registration
    const verificationToken = crypto.createHash('sha256').update(`${verification.id}-${process.env.SUPABASE_JWT_SECRET || 'secret'}`).digest('hex');

    return NextResponse.json({ success: true, verificationToken, verificationId: verification.id });

  } catch (error: any) {
    
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
