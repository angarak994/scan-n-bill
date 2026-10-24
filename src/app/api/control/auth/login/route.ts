import { NextResponse } from 'next/server';
import { setDeveloperSession } from '@/lib/auth';
import { checkRateLimitShared, getIpAddress } from '@/lib/utils/rateLimit';
import { developerAuditService } from '@/lib/services/developerAuditService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getIpAddress(request);
    const rateCheck = await checkRateLimitShared(`dev_login_${ip}`, 5, 15 * 60 * 1000, true);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please wait 15 minutes.' }, { status: 429 });
    }

    const { email, password, secretKey } = await request.json();

    const configuredSecret = process.env.DEVELOPER_SECRET || 'qc_dev_secret_master_key_2026_x89f2';
    const configuredPassword = process.env.DEVELOPER_PASSWORD || 'QControlDev#2026!Secure';
    const configuredEmail = process.env.DEVELOPER_EMAIL || 'admin@qcontrol.com';

    let isAuthenticated = false;
    let authEmail = configuredEmail;

    // Direct Developer Secret Key Authentication
    if (secretKey && secretKey.trim() === configuredSecret.trim()) {
      isAuthenticated = true;
    }

    // Email + Password Authentication
    if (email && password) {
      const emailMatches = email.trim().toLowerCase() === configuredEmail.trim().toLowerCase();
      const passwordMatches = password === configuredPassword;
      if (emailMatches && passwordMatches) {
        isAuthenticated = true;
        authEmail = email.trim().toLowerCase();
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Invalid developer credentials or authorization key.' }, { status: 401 });
    }

    // Set secure HttpOnly developer JWT session
    await setDeveloperSession(authEmail);

    await developerAuditService.log({
      developer_email: authEmail,
      action: 'DEVELOPER_LOGIN_SUCCESS',
      details: { login_method: secretKey ? 'master_key' : 'credentials' },
      ip_address: ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Developer authenticated successfully.',
      developer: { email: authEmail, role: 'developer' }
    });
  } catch (err: any) {
    console.error('Developer login error:', err);
    return NextResponse.json({ error: 'Internal server error during developer authentication.' }, { status: 500 });
  }
}
