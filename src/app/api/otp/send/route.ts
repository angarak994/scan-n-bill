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

    const { contact } = await request.json();
    if (!contact) {
      return NextResponse.json({ error: 'Contact (Mobile or Email) is required' }, { status: 400 });
    }

    let normalizedContact = contact.trim().toLowerCase();
    const isEmail = normalizedContact.includes('@');
    
    if (!isEmail) {
      normalizedContact = normalizePhone(contact);
      if (!normalizedContact) {
        return NextResponse.json({ error: 'Invalid mobile number (must be 10 digits)' }, { status: 400 });
      }
    }

    // Rate Limiting & Cooldown Check
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

    // We store the email in the existing 'mobile' column to avoid DB migrations for local testing
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert([{
        business_id: sessionCookie.businessId,
        mobile: normalizedContact,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString()
      }]);

    if (insertError) throw insertError;

    if (isEmail) {
      try {
        const { Resend } = require('resend');
        // Fallback key just for local console-logging if none provided, 
        // though Resend needs a real key to send real emails.
        const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');
        
        console.log(`\n=======================================\n📧 [MOCK EMAIL] To: ${normalizedContact}\nSubject: Your QControl Code\nOTP: ${otp}\n=======================================\n`);
        
        if (process.env.RESEND_API_KEY) {
           await resend.emails.send({
            from: 'QControl <onboarding@resend.dev>',
            to: normalizedContact,
            subject: 'Your QControl Verification Code',
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Welcome to QControl!</h2>
                <p>Your secure verification code is:</p>
                <h1 style="letter-spacing: 5px; color: #10B981;">${otp}</h1>
                <p>This code will expire in 5 minutes.</p>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('Email delivery error:', err);
      }
    } else {
      // Simulate SMS Delivery for testing
      console.log(`\n=======================================\n📲 [MOCK SMS] OTP for ${normalizedContact} is: ${otp}\n=======================================\n`);
      
      // Attempt WhatsApp Delivery if configured, else fallback to Global QControl Bot
      try {
        const { data: business } = await supabase.from('businesses').select('whatsapp_config').eq('id', sessionCookie.businessId).single();
        const { sendWhatsAppText } = require('@/lib/whatsapp');
        
        let overrideToken;
        let overridePhoneId;
        if (business && business.whatsapp_config && business.whatsapp_config.enabled) {
            overrideToken = business.whatsapp_config.token;
            overridePhoneId = business.whatsapp_config.phoneId;
        }

        await sendWhatsAppText(
            normalizedContact, 
            `Your QControl Verification Code is: *${otp}*\n\nThis code is valid for 5 minutes. Do not share this with anyone.`, 
            false, 
            overrideToken, 
            overridePhoneId
        );
      } catch (waErr) {
         console.error('Failed to send WhatsApp OTP:', waErr);
      }
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully' });

  } catch (error: any) {
    
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
