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
