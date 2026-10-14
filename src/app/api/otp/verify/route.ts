import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession(request);
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting to mitigate brute-force attempts
    const ip = request.headers.get('x-forwarded-for') || 'local';
    const rateLimit = checkRateLimit(`otp_verify_${ip}`, 15, 10 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many verification attempts. Please wait a few minutes.' }, { status: 429 });
    }

    const { contact, otp } = await request.json();
    if (!contact || !otp) {
      return NextResponse.json({ error: 'Contact and OTP are required' }, { status: 400 });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json({ error: 'OTP must be exactly 6 digits.' }, { status: 400 });
    }

    let normalizedContact = contact.trim().toLowerCase();
    const isEmail = normalizedContact.includes('@');
    
    if (!isEmail) {
      normalizedContact = normalizePhone(contact);
      if (!normalizedContact) {
        return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
      }
    }

    // Retrieve the most recent OTP verification record for this contact within this business
    const { data: verifications, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('business_id', sessionCookie.businessId)
      .eq('mobile', normalizedContact)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!verifications || verifications.length === 0) {
      return NextResponse.json({ error: 'No active OTP request found for this phone number. Please request an OTP first.' }, { status: 400 });
    }

    const verification = verifications[0];

    // Check if already verified
    if (verification.verified) {
      return NextResponse.json({ error: 'This phone number has already been verified. Please proceed with registration.' }, { status: 400 });
    }

    // Check expiration (5 minutes validity)
    if (new Date(verification.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new OTP.' }, { status: 400 });
    }

    // Check attempt limits (max 3 failed tries)
    if ((verification.attempts || 0) >= 3) {
      return NextResponse.json({ error: 'Maximum verification attempts exceeded (3/3). Please request a new OTP.' }, { status: 400 });
    }

    // Strictly compare cryptographic hash (NO universal or hardcoded bypasses)
    const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');

    if (verification.otp_hash !== candidateHash) {
      const nextAttempts = (verification.attempts || 0) + 1;
      await supabase
        .from('otp_verifications')
        .update({ attempts: nextAttempts })
        .eq('id', verification.id);
      
      const remaining = 3 - nextAttempts;
      return NextResponse.json({ 
        error: remaining > 0 
          ? `Invalid OTP. ${remaining} attempt(s) remaining.` 
          : 'Maximum verification attempts exceeded. Please request a new OTP.' 
      }, { status: 400 });
    }

    // Mark verification as verified in database
    await supabase
      .from('otp_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    // Generate secure HMAC-signed verification token scoped to verificationId, businessId, and mobile
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'qcontrol_secure_verification_secret_key';
    const tokenPayload = `${verification.id}:${sessionCookie.businessId}:${normalizedContact}`;
    const verificationToken = crypto.createHmac('sha256', secret).update(tokenPayload).digest('hex');

    return NextResponse.json({ 
      success: true, 
      verificationToken, 
      verificationId: verification.id,
      verifiedContact: normalizedContact 
    });

  } catch (error: any) {
    console.error('Failed to verify OTP:', error?.message);
    return NextResponse.json({ error: 'Failed to verify OTP. Please try again.' }, { status: 500 });
  }
}
