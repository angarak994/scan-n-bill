import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET || 'super_secret_qcontrol_development_key';
  return new TextEncoder().encode(secret);
};

export async function signToken(payload: JWTPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // 30 days session
    .sign(getJwtSecretKey());
  return token;
}

export async function verifyToken(token: string) {
  try {
    const verified = await jwtVerify(token, getJwtSecretKey());
    return verified.payload as { businessId: string; role: string; [key: string]: any };
  } catch (err) {
    return null;
  }
}

export async function getSession(req?: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('qcontrol_session')?.value;
    if (token) return await verifyToken(token);
  } catch (err) {
    // cookies() was called outside request scope (e.g. In unit test)
  }

  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/qcontrol_session=([^;]+)/);
    if (match && match[1]) {
      return await verifyToken(match[1]);
    }
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      return await verifyToken(authHeader.substring(7));
    }
  }

  return null;
}

export async function setSession(businessId: string, role: string = 'owner') {
  const token = await signToken({ businessId, role });
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'qcontrol_session',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete('qcontrol_session');
}

// ============================================================================
// DEVELOPER PLATFORM AUTHENTICATION & SERVER-SIDE AUTHORIZATION
// ============================================================================

export interface DeveloperSessionPayload {
  role: 'developer';
  email: string;
  sub: string;
  [key: string]: any;
}

export async function signDeveloperToken(payload: { email: string; [key: string]: any }) {
  const token = await new SignJWT({
    role: 'developer',
    sub: 'developer_platform_owner',
    ...payload,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7 days developer session
    .sign(getJwtSecretKey());
  return token;
}

export async function verifyDeveloperToken(token: string): Promise<DeveloperSessionPayload | null> {
  try {
    const verified = await jwtVerify(token, getJwtSecretKey());
    const payload = verified.payload as any;
    if (payload && payload.role === 'developer') {
      return payload as DeveloperSessionPayload;
    }
    return null;
  } catch (err) {
    return null;
  }
}

export async function getDeveloperSession(req?: Request): Promise<DeveloperSessionPayload | null> {
  // 1. Check for valid server-configured Master Developer Key via header (safe for CI/automated tests/scripts)
  if (req) {
    const masterKey = req.headers.get('x-developer-secret') || req.headers.get('x-developer-key');
    const configuredSecret = process.env.DEVELOPER_SECRET;
    if (masterKey && configuredSecret && masterKey.trim() === configuredSecret.trim()) {
      return {
        role: 'developer',
        email: process.env.DEVELOPER_EMAIL || 'admin@qcontrol.com',
        sub: 'developer_master_key',
      };
    }
  }

  // 2. Check for developer session cookie
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('qcontrol_dev_session')?.value;
    if (token) {
      const verified = await verifyDeveloperToken(token);
      if (verified) return verified;
    }
  } catch (err) {
    // cookies() called outside request context
  }

  // 3. Check for authorization header or cookie header in request
  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/qcontrol_dev_session=([^;]+)/);
    if (match && match[1]) {
      const verified = await verifyDeveloperToken(match[1]);
      if (verified) return verified;
    }

    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      const verified = await verifyDeveloperToken(authHeader.substring(7));
      if (verified) return verified;
    }
  }

  return null;
}

export async function setDeveloperSession(email: string) {
  const token = await signDeveloperToken({ email });
  const cookieStore = await cookies();
  cookieStore.set({
    name: 'qcontrol_dev_session',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearDeveloperSession() {
  const cookieStore = await cookies();
  cookieStore.delete('qcontrol_dev_session');
}

