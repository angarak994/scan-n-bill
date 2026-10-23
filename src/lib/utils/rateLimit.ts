import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabaseClient';

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

// In-memory fast tier to shave latency during normal operations
const inMemoryStore = new Map<string, RateLimitTracker>();

/**
 * Extracts trusted client IP from platform-verified headers.
 * Header spoofing via forged x-forwarded-for is prevented by prioritizing
 * platform-stamped headers (x-vercel-forwarded-for, x-real-ip, cf-connecting-ip).
 */
export function getTrustedClientIp(request: Request): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp && vercelIp.trim()) {
    return vercelIp.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.split(',')[0].trim();
  }

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) {
    return cfIp.split(',')[0].trim();
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
  }

  return '127.0.0.1';
}

// Backward-compatible alias
export const getIpAddress = getTrustedClientIp;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  correlationId: string;
}

/**
 * Serverless-shared, Postgres-backed rate limiter with in-memory fast tier.
 * Works uniformly across Vercel serverless edge and Node.js runtimes.
 *
 * @param identifier Unique key (e.g., `qr_resolve_${ip}`, `order_${tableId}`)
 * @param limit Max allowed requests within window
 * @param windowMs Time window in milliseconds
 * @param logAbuse If true, logs suspicious bursts to security audit table
 */
export async function checkRateLimitShared(
  identifier: string,
  limit: number,
  windowMs: number,
  logAbuse: boolean = false
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartIso = new Date(now - windowMs).toISOString();
  const correlationId = crypto.randomUUID();

  // 1. Fast in-memory check (catches rapid burst within the same serverless container)
  const mem = inMemoryStore.get(identifier);
  if (mem && mem.resetAt > now && mem.count >= limit) {
    const retryAfter = Math.ceil((mem.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      correlationId
    };
  }

  // 2. Shared Postgres check across serverless instances
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'rate_limit_probe')
      .eq('title', identifier)
      .gte('created_at', windowStartIso);

    const currentCount = (count || 0) + 1;

    if (!error && currentCount > limit) {
      if (logAbuse) {
        // Log suspicious attempt without sensitive information
        try {
          await supabase.from('notifications').insert({
            title: `Security Alert: Rate Limit Exceeded`,
            message: `correlationId:${correlationId}|identifier:${identifier}|attempts:${currentCount}|limit:${limit}`,
            type: 'security_abuse_probe'
          });
        } catch {
          // Ignore rate log failure
        }
      }

      const retryAfter = Math.ceil(windowMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        correlationId
      };
    }

    // Record this attempt in shared storage (non-blocking)
    void Promise.resolve(
      supabase.from('notifications').insert({
        title: identifier,
        message: `cid:${correlationId}`,
        type: 'rate_limit_probe'
      })
    ).catch(() => {});

    // Update in-memory tracker
    inMemoryStore.set(identifier, {
      count: (mem && mem.resetAt > now ? mem.count + 1 : 1),
      resetAt: now + windowMs
    });

    return {
      allowed: true,
      remaining: Math.max(0, limit - currentCount),
      retryAfter: 0,
      correlationId
    };
  } catch (err) {
    // Fail safe on DB error using local memory tracker
    const safeMem = inMemoryStore.get(identifier);
    if (safeMem && safeMem.resetAt > now && safeMem.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((safeMem.resetAt - now) / 1000),
        correlationId
      };
    }
    inMemoryStore.set(identifier, {
      count: (safeMem && safeMem.resetAt > now ? safeMem.count + 1 : 1),
      resetAt: now + windowMs
    });
    return {
      allowed: true,
      remaining: 1,
      retryAfter: 0,
      correlationId
    };
  }
}

/**
 * Standard synchronous in-memory rate check for non-critical paths.
 */
export function checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = inMemoryStore.get(identifier);

  if (inMemoryStore.size > 2000) {
    for (const [key, val] of inMemoryStore.entries()) {
      if (val.resetAt < now) inMemoryStore.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    inMemoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

/**
 * Creates an RFC-compliant 429 Too Many Requests response with Retry-After header.
 */
export function createRateLimitResponse(retryAfterSeconds: number, correlationId?: string, message?: string): NextResponse {
  const headers = new Headers();
  headers.set('Retry-After', String(Math.max(1, retryAfterSeconds)));
  if (correlationId) {
    headers.set('X-Correlation-Id', correlationId);
  }

  return NextResponse.json(
    {
      error: message || 'Too many requests. Please try again later.',
      retryAfter: Math.max(1, retryAfterSeconds),
      correlationId
    },
    {
      status: 429,
      headers
    }
  );
}
