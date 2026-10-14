import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone } from '@/lib/utils/phoneValidation';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

const AUTHORIZED_ROLES = ['owner', 'admin', 'PRIMARY_OWNER', 'SECONDARY_OWNER'];

export async function GET(request: Request) {
  try {
    const sessionCookie = await getSession(request);
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = sessionCookie.businessId;
    const { data: rawMembers, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aggregate spend from completed sessions for maximum accuracy & recovery
    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('member_id, customer_name, cost')
      .eq('business_id', businessId)
      .eq('status', 'COMPLETED');

    const memberships = (rawMembers || []).map((m: any) => {
      let sessionSpend = 0;
      if (completedSessions && completedSessions.length > 0) {
        const normName = m.name?.trim().toLowerCase();
        const normMobile = m.mobile?.trim();
        for (const s of completedSessions) {
          const sName = s.customer_name?.trim().toLowerCase();
          const isMatch = s.member_id === m.id || 
            (normName && sName === normName) || 
            (normMobile && (s.customer_name?.trim() === normMobile || sName === normMobile));
          if (isMatch) {
            sessionSpend += Number(s.cost) || 0;
          }
        }
      }
      const finalSpend = Math.max(Number(m.total_spend) || 0, sessionSpend);
      
      // Ensure verification properties exist with sensible defaults for legacy records
      const verification_method = m.verification_method || 'OTP_VERIFIED';
      const is_phone_verified = m.is_phone_verified !== undefined 
        ? m.is_phone_verified 
        : (verification_method === 'OTP_VERIFIED');

      return {
        ...m,
        verification_method,
        is_phone_verified,
        verified_at: m.verified_at || m.created_at,
        verified_by: m.verified_by || (verification_method === 'OTP_VERIFIED' ? 'CUSTOMER_OTP' : 'Owner'),
        audit_info: m.audit_info || {},
        total_spend: finalSpend
      };
    });

    return NextResponse.json({ success: true, memberships });
  } catch (error: any) {
    console.error('Error fetching memberships:', error);
    return NextResponse.json({ error: error.message || 'Failed to load memberships' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionCookie = await getSession(request);
    if (!sessionCookie || !sessionCookie.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      mobile, 
      email, 
      tier, 
      duration_months, 
      verificationMethod = 'OTP_VERIFIED',
      verificationToken, 
      verificationId,
      notes
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    if (!mobile) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    const normalizedMobile = normalizePhone(mobile);
    if (!normalizedMobile) {
      return NextResponse.json({ error: 'Mobile number must be exactly 10 digits' }, { status: 400 });
    }

    // 1. Check for Duplicate Membership within the same business (Multi-tenant isolated)
    const { data: existingMember, error: checkError } = await supabase
       .from('memberships')
       .select('id, name')
       .eq('business_id', sessionCookie.businessId)
       .eq('mobile', normalizedMobile)
       .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('Duplicate check warning:', checkError.message);
    }
       
    if (existingMember) {
       return NextResponse.json({ 
         error: `This mobile number is already registered for this business (${existingMember.name}). Duplicate memberships are not permitted.` 
       }, { status: 409 });
    }

    let isPhoneVerified = false;
    let finalVerificationMethod = 'OTP_VERIFIED';
    let verifiedBy = 'CUSTOMER_OTP';
    const verifiedAt = new Date().toISOString();
    let auditInfo: Record<string, any> = {};

    // 2. Validate Verification Mode
    if (verificationMethod === 'MANUAL_OWNER_VERIFICATION') {
      // Permission check: strictly enforce that only owners or permitted staff can perform manual approval
      const userRole = sessionCookie.role || 'staff';
      if (!AUTHORIZED_ROLES.includes(userRole)) {
        return NextResponse.json({ 
          error: 'Forbidden: Only authenticated business owners or authorized managers can manually approve memberships.' 
        }, { status: 403 });
      }

      finalVerificationMethod = 'MANUAL_OWNER_VERIFICATION';
      // CRITICAL: Do NOT falsely mark phone as OTP-verified when owner approves manually
      isPhoneVerified = false;
      verifiedBy = sessionCookie.userId ? String(sessionCookie.userId) : (userRole === 'owner' ? 'Owner' : userRole);

      const clientIp = request.headers.get('x-forwarded-for') || 'local';
      auditInfo = {
        method: 'MANUAL_OWNER_VERIFICATION',
        approved_by: verifiedBy,
        approver_role: userRole,
        business_id: sessionCookie.businessId,
        approved_at: verifiedAt,
        customer_name: name.trim(),
        customer_phone: normalizedMobile,
        approval_notes: notes || 'Customer known to owner / walk-in approved manually',
        client_ip: clientIp,
        user_agent: request.headers.get('user-agent') || ''
      };

    } else if (verificationMethod === 'OTP_VERIFIED') {
      if (!verificationToken || !verificationId) {
        return NextResponse.json({ error: 'Valid OTP verification is required to activate membership via OTP.' }, { status: 400 });
      }

      // Validate verificationToken
      const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'qcontrol_secure_verification_secret_key';
      
      // Support both new HMAC signature format and legacy sha256 format
      const expectedHmac = crypto.createHmac('sha256', secret).update(`${verificationId}:${sessionCookie.businessId}:${normalizedMobile}`).digest('hex');
      const expectedLegacy = crypto.createHash('sha256').update(`${verificationId}-${process.env.SUPABASE_JWT_SECRET || 'secret'}`).digest('hex');
      
      const isTokenValid = (verificationToken === expectedHmac) || (verificationToken === expectedLegacy);
      if (!isTokenValid) {
        return NextResponse.json({ error: 'Invalid or expired verification token. Please verify OTP again.' }, { status: 403 });
      }

      // Verify the record in otp_verifications belongs to this business and mobile
      const { data: verif, error: verifError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('id', verificationId)
        .single();

      if (verifError || !verif || !verif.verified || verif.mobile !== normalizedMobile || verif.business_id !== sessionCookie.businessId) {
        return NextResponse.json({ error: 'OTP verification mismatch or record not found.' }, { status: 403 });
      }

      finalVerificationMethod = 'OTP_VERIFIED';
      isPhoneVerified = true;
      verifiedBy = 'CUSTOMER_OTP';
      auditInfo = {
        method: 'OTP_VERIFIED',
        verification_id: verificationId,
        verified_phone: normalizedMobile,
        verified_at: verifiedAt,
        business_id: sessionCookie.businessId
      };

      // Invalidate the verification record to prevent reuse / replay
      await supabase.from('otp_verifications').delete().eq('id', verificationId);

    } else {
      return NextResponse.json({ error: `Unsupported verification method: "${verificationMethod}"` }, { status: 400 });
    }

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (parseInt(duration_months) || 12));

    // 3. Insert into memberships table
    const fullInsertPayload = {
      business_id: sessionCookie.businessId,
      name: name.trim(),
      mobile: normalizedMobile,
      email: email?.trim() || null,
      tier: tier || 'Standard',
      status: 'Active',
      expiry_date: expiryDate.toISOString(),
      verification_method: finalVerificationMethod,
      is_phone_verified: isPhoneVerified,
      verified_at: verifiedAt,
      verified_by: verifiedBy,
      audit_info: auditInfo
    };

    let insertedMember: any = null;
    const { data: insertedData, error: insertError } = await supabase
      .from('memberships')
      .insert([fullInsertPayload])
      .select()
      .single();

    if (insertError) {
      // If error is due to missing columns in DB before migration 43 is applied to remote DB, fallback gracefully
      const isColumnMissing = insertError.message?.includes('column') || insertError.code === '42703';
      if (isColumnMissing) {
        console.warn('Audit columns not yet in DB schema cache. Falling back to baseline columns:', insertError.message);
        const baselinePayload = {
          business_id: sessionCookie.businessId,
          name: name.trim(),
          mobile: normalizedMobile,
          email: email?.trim() || null,
          tier: tier || 'Standard',
          status: 'Active',
          expiry_date: expiryDate.toISOString()
        };
        const { data: fbData, error: fbError } = await supabase
          .from('memberships')
          .insert([baselinePayload])
          .select()
          .single();

        if (fbError) throw fbError;
        insertedMember = {
          ...fbData,
          verification_method: finalVerificationMethod,
          is_phone_verified: isPhoneVerified,
          verified_at: verifiedAt,
          verified_by: verifiedBy,
          audit_info: auditInfo
        };
      } else {
        throw insertError;
      }
    } else {
      insertedMember = insertedData;
    }

    // 4. Ensure customer record exists in customers table for seamless QKhata & Session linkage
    try {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('business_id', sessionCookie.businessId)
        .eq('phone', normalizedMobile)
        .maybeSingle();

      if (!existingCust && insertedMember) {
        await supabase.from('customers').insert([{
          id: insertedMember.id,
          business_id: sessionCookie.businessId,
          name: name.trim(),
          phone: normalizedMobile,
          outstanding_balance: 0,
          total_billed: 0,
          total_paid: 0
        }]);
      }
    } catch (custSyncErr: any) {
      console.warn('Customer table sync notice:', custSyncErr?.message);
    }

    return NextResponse.json({ 
      success: true, 
      membership: insertedMember,
      message: finalVerificationMethod === 'MANUAL_OWNER_VERIFICATION' 
        ? 'Member registered and approved manually by owner.' 
        : 'Member registered and verified via phone OTP.'
    });

  } catch (error: any) {
    console.error('Failed to create membership:', error);
    return NextResponse.json({ error: error.message || 'Failed to create membership' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionCookie = await getSession(request);
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

    return NextResponse.json({ success: true, message: 'Membership profile deleted.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete membership' }, { status: 500 });
  }
}
