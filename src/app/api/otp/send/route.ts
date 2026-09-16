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

    const { mobile } = await request.json();
    if (!mobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    const normalizedMobile = normalizePhone(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }

    // Rate Limiting & Cooldown Check
    const { data: recentRequests, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('created_at')
      .eq('business_id', sessionCookie.businessId)
      .eq('mobile', normalizedMobile)
      .order('created_at', { ascending: false })
      .limit(3);

    if (fetchError) throw fetchError;

    if (recentRequests && recentRequests.length > 0) {
      const lastRequest = new Date(recentRequests[0].created_at).getTime();
      const now = Date.now();
      
      // 60-second cooldown
      if (now - lastRequest < 60000) {
        return NextResponse.json({ error: 'Please wait 60 seconds before requesting another OTP.' }, { status: 429 });
      }

      // Max 3 requests per hour
      if (recentRequests.length === 3) {
        const oldestRequest = new Date(recentRequests[2].created_at).getTime();
        if (now - oldestRequest < 3600000) {
           return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert([{
        business_id: sessionCookie.businessId,
        mobile: normalizedMobile,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString()
      }]);

    if (insertError) throw insertError;

    // Simulate SMS Delivery
    console.log(`\n=======================================\n📲 [MOCK SMS] OTP for ${mobile} is: ${otp}\n=======================================\n`);

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });

  } catch (error: any) {
    
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
