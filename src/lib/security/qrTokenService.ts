import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { supabase } from '@/lib/supabaseClient';
import { businessManager, BusinessData, invalidateBusinessCache } from '@/lib/businessManager';
import { sessionRepository } from '@/lib/repositories/sessionRepository';

const QR_COOKIE_NAME = 'qcontrol_qr_session';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JWT_SECRET || 'qcontrol_default_secure_hmac_secret_2026';
  return new TextEncoder().encode(crypto.createHash('sha256').update(secret).digest('hex'));
}

export function generateSecureQrToken(): { token: string; hash: string } {
  // 128-bit cryptographic entropy, URL-safe base64
  const token = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export interface QrTokenResolveResult {
  valid: boolean;
  businessId?: string;
  tableId?: string;
  businessName?: string;
  business?: BusinessData;
  table?: any;
  error?: string;
  isRevoked?: boolean;
}

/**
 * Resolves an opaque public QR token to its authoritative business and table.
 */
export async function resolveQrToken(token: string): Promise<QrTokenResolveResult> {
  if (!token || typeof token !== 'string' || token.trim().length < 8) {
    return { valid: false, error: 'Invalid QR token format' };
  }

  const cleanToken = token.trim();
  const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

  // Search across businesses to find table with matching qr_token or qr_token_hash
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*');

  if (error || !businesses) {
    return { valid: false, error: 'Failed to query business data' };
  }

  for (const b of businesses) {
    const tables = b.tables || [];
    for (const t of tables) {
      const matchesToken = t.qr_token === cleanToken || t.qr_token_hash === tokenHash;
      if (matchesToken) {
        if (t.qr_token_revoked === true) {
          return { valid: false, isRevoked: true, error: 'This QR code has been revoked by the venue.' };
        }
        return {
          valid: true,
          businessId: b.id,
          tableId: t.id,
          businessName: b.business_name,
          business: b,
          table: t,
        };
      }
    }
  }

  return { valid: false, error: 'QR Code not found or expired' };
}

/**
 * Gets or creates a secure QR token for a table.
 */
export async function getOrCreateTableQrToken(businessId: string, tableId: string): Promise<string> {
  const business = await businessManager.getBusiness(businessId);
  if (!business) throw new Error('Business not found');

  const tables = [...(business.tables || [])];
  const tableIdx = tables.findIndex((t: any) =>
    String(t.id).trim().toLowerCase() === String(tableId).trim().toLowerCase() ||
    String(t.name).trim().toLowerCase() === String(tableId).trim().toLowerCase()
  );

  if (tableIdx === -1) {
    throw new Error(`Table '${tableId}' not found in business config`);
  }

  const table = tables[tableIdx] as any;
  if (table.qr_token && !table.qr_token_revoked) {
    return table.qr_token;
  }

  // Generate new token
  const { token, hash } = generateSecureQrToken();
  tables[tableIdx] = {
    ...table,
    qr_token: token,
    qr_token_hash: hash,
    qr_token_created_at: new Date().toISOString(),
    qr_token_revoked: false
  } as any;

  const { error: updateErr } = await supabase
    .from('businesses')
    .update({ tables })
    .eq('id', businessId);

  if (updateErr) {
    throw new Error('Failed to persist table QR token: ' + updateErr.message);
  }

  invalidateBusinessCache(businessId);
  return token;
}

/**
 * Regenerates / Revokes a table's QR token (Dashboard Owner action).
 * Old token immediately ceases to function.
 */
export async function regenerateTableQrToken(businessId: string, tableId: string): Promise<{ newToken: string; correlationId: string }> {
  const business = await businessManager.getBusiness(businessId);
  if (!business) throw new Error('Business not found');

  const tables = [...(business.tables || [])];
  const tableIdx = tables.findIndex((t: any) =>
    String(t.id).trim().toLowerCase() === String(tableId).trim().toLowerCase() ||
    String(t.name).trim().toLowerCase() === String(tableId).trim().toLowerCase()
  );

  if (tableIdx === -1) {
    throw new Error(`Table '${tableId}' not found`);
  }

  const correlationId = crypto.randomUUID();
  const oldToken = (tables[tableIdx] as any).qr_token;
  const { token: newToken, hash: newHash } = generateSecureQrToken();

  tables[tableIdx] = {
    ...tables[tableIdx],
    qr_token: newToken,
    qr_token_hash: newHash,
    qr_token_created_at: new Date().toISOString(),
    qr_token_revoked: false,
    previous_qr_token_revoked_at: new Date().toISOString()
  } as any;

  const { error } = await supabase
    .from('businesses')
    .update({ tables })
    .eq('id', businessId);

  if (error) {
    throw new Error('Failed to update table QR token: ' + error.message);
  }

  // Record audit log entry (no secret values exposed)
  try {
    await supabase.from('notifications').insert({
      business_id: businessId,
      title: `Audit: QR Token Regenerated (${tableId})`,
      message: `correlationId:${correlationId}|table:${tableId}|action:regenerate_token|timestamp:${new Date().toISOString()}`,
      type: 'security_audit'
    });
  } catch (auditErr) {
    console.error('[regenerateTableQrToken] Audit log error:', auditErr);
  }

  invalidateBusinessCache(businessId);
  return { newToken, correlationId };
}

/**
 * Generates a short-lived session-scoped signed JWT credential bound strictly to one active session.
 */
export async function createQrSessionToken(params: {
  businessId: string;
  tableId: string;
  sessionId: string;
}): Promise<string> {
  const { businessId, tableId, sessionId } = params;
  const secretKey = getJwtSecretKey();

  return await new SignJWT({
    businessId,
    tableId,
    sessionId,
    role: 'qr_session',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secretKey);
}

export interface QrSessionAuthVerification {
  authorized: boolean;
  businessId: string;
  tableId: string;
  sessionId: string;
  error?: string;
}

/**
 * Verifies session-scoped credential from cookie or Authorization header.
 * Validates cryptographic signature, session ownership, and checks DB that session is still ACTIVE.
 */
export async function verifyQrSessionToken(
  request: Request,
  expectedSessionId?: string,
  expectedTableId?: string
): Promise<QrSessionAuthVerification> {
  let token: string | undefined;

  // 1. Try cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${QR_COOKIE_NAME}=`));
  if (match) {
    token = decodeURIComponent(match.substring(QR_COOKIE_NAME.length + 1));
  }

  // 2. Try Authorization or x-qr-session-token header
  if (!token) {
    const authHeader = request.headers.get('x-qr-session-token') || request.headers.get('authorization');
    if (authHeader) {
      token = authHeader.replace(/^Bearer\s+/i, '').trim();
    }
  }

  if (!token) {
    return { authorized: false, businessId: '', tableId: '', sessionId: '', error: 'Missing session credential cookie or token.' };
  }

  try {
    const secretKey = getJwtSecretKey();
    const { payload } = await jwtVerify(token, secretKey);

    const businessId = payload.businessId as string;
    const tableId = payload.tableId as string;
    const sessionId = payload.sessionId as string;

    if (!businessId || !sessionId || payload.role !== 'qr_session') {
      return { authorized: false, businessId: '', tableId: '', sessionId: '', error: 'Invalid session credential payload.' };
    }

    if (expectedSessionId && expectedSessionId !== sessionId) {
      return { authorized: false, businessId, tableId, sessionId, error: 'Cross-session authorization denied.' };
    }

    if (expectedTableId && expectedTableId.toLowerCase() !== tableId.toLowerCase()) {
      return { authorized: false, businessId, tableId, sessionId, error: 'Cross-table authorization denied.' };
    }

    // Verify session in DB is still ACTIVE
    const session = await sessionRepository.findById(sessionId, businessId);
    if (!session || session.status !== 'ACTIVE') {
      return { authorized: false, businessId, tableId, sessionId, error: 'Session has ended or is inactive.' };
    }

    return {
      authorized: true,
      businessId,
      tableId,
      sessionId
    };
  } catch (err: any) {
    return { authorized: false, businessId: '', tableId: '', sessionId: '', error: 'Session credential invalid or expired: ' + err.message };
  }
}

export function setQrSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: QR_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 // 12 hours
  });
}

export function clearQrSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: QR_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
}
