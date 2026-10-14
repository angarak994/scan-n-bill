import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendSMS, SMSConfig } from '@/lib/services/smsService';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession(request);
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // IP-level rate limiting (max 10 requests per 10 minutes)
    const ip = request.headers.get('x-forwarded-for') || 'local';
    const rateLimit = checkRateLimit(`otp_send_${ip}`, 10, 10 * 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many OTP requests. Please wait a few minutes before trying again.' }, { status: 429 });
    }

    const { contact } = await request.json();
    if (!contact) {
      return NextResponse.json({ error: 'Contact (Mobile or Email) is required' }, { status: 400 });
    }

    let normalizedContact = contact.trim().toLowerCase();
    const isEmail = normalizedContact.includes('@');
    
    if (!isEmail) {
      normalizedContact = normalizePhone(contact);
      if (!normalizedContact) {
        return NextResponse.json({ error: 'Invalid mobile number (must be exactly 10 digits)' }, { status: 400 });
      }
    }

    // Rate Limiting & Cooldown Check per destination phone/email
    const { data: recentRequests, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('created_at')
      .eq('business_id', sessionCookie.businessId)
      .eq('mobile', normalizedContact)
      .order('created_at', { ascending: false })
      .limit(3);

    if (fetchError) throw fetchError;

    if (recentRequests && recentRequests.length > 0) {
      const lastRequest = new Date(recentRequests[0].created_at).getTime();
      const now = Date.now();
      
      // 60-second cooldown between OTP requests
      const elapsed = now - lastRequest;
      if (elapsed < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsed) / 1000);
        return NextResponse.json({ 
          error: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
          retryAfter: remainingSeconds
        }, { status: 429 });
      }

      // Max 3 requests per hour
      if (recentRequests.length === 3) {
        const oldestRequest = new Date(recentRequests[2].created_at).getTime();
        if (now - oldestRequest < 3600000) {
           return NextResponse.json({ error: 'Maximum OTP request limit reached (3 per hour). Please try again later or use Owner Manual Verification.' }, { status: 429 });
        }
      }
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Store hashed OTP in database
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert([{
        business_id: sessionCookie.businessId,
        mobile: normalizedContact,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        verified: false
      }]);

    if (insertError) throw insertError;

    // Fetch business details and SMS configuration
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name, pricing_rules, whatsapp_config')
      .eq('id', sessionCookie.businessId)
      .single();

    const clubName = business?.business_name || 'QControl';

    if (isEmail) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
        
        if (process.env.RESEND_API_KEY) {
          await resend.emails.send({
            from: 'QControl <onboarding@resend.dev>',
            to: normalizedContact,
            subject: `Your ${clubName} Verification Code`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Welcome to ${clubName}!</h2>
                <p>Your secure verification code is:</p>
                <h1 style="letter-spacing: 5px; color: #10B981;">${otp}</h1>
                <p>This code will expire in 5 minutes. Never share this code with anyone.</p>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('Email delivery error:', err);
      }
    } else {
      // Determine SMS configuration from business or environment
      const smsConfig: SMSConfig | undefined = 
        (business as any)?.sms_config || 
        business?.pricing_rules?.sms_config ||
        (process.env.MSG91_AUTH_KEY ? {
          enabled: true,
          provider: 'msg91',
          authKey: process.env.MSG91_AUTH_KEY,
          senderId: process.env.MSG91_SENDER_ID || 'QCNTRL'
        } : undefined) ||
        (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_PHONE_NUMBER ? {
          enabled: true,
          provider: 'twilio',
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          fromPhone: process.env.TWILIO_PHONE_NUMBER
        } : undefined);

      if (smsConfig && smsConfig.enabled) {
        const smsMessage = `Your ${clubName} membership verification code is ${otp}. Valid for 5 minutes. Do not share this OTP with anyone.`;
        const smsResult = await sendSMS(
          sessionCookie.businessId,
          normalizedContact,
          'Customer',
          smsMessage,
          'otp_verification_v1',
          smsConfig
        );

        if (!smsResult.success) {
          return NextResponse.json({
            error: `SMS provider delivery failed: ${smsResult.error || 'Provider rejected request'}. Please check SMS provider settings or use Owner Manual Verification.`
          }, { status: 502 });
        }
      } else if (business?.whatsapp_config && business.whatsapp_config.enabled) {
        // Fallback to WhatsApp if configured
        try {
          const { sendWhatsAppText } = require('@/lib/whatsapp');
          await sendWhatsAppText(
            normalizedContact,
            `Your *${clubName}* Membership Verification Code is: *${otp}*\n\nValid for 5 minutes. Do not share this code with anyone.`,
            false,
            business.whatsapp_config.token,
            business.whatsapp_config.phoneId
          );
        } catch (waErr: any) {
          console.error('WhatsApp OTP delivery error:', waErr?.message);
        }
      } else {
        // No SMS provider configured
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({
            error: 'SMS service is not enabled for this business. Please configure an SMS provider or use Owner Manual Approval.'
          }, { status: 400 });
        }
        // In local/test environment, OTP is securely hashed in DB and ready for verification
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully. Valid for 5 minutes.',
      cooldownSeconds: 60
    });

  } catch (error: any) {
    console.error('Failed to send OTP:', error?.message);
    return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 });
  }
}
