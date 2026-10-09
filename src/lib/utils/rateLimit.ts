import { NextResponse } from 'next/server';

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting. 
// Note: In serverless environments (Vercel), this will reset on cold starts
// and won't be shared across edge nodes. For enterprise production, 
// this should be backed by Redis (e.g., Upstash).
const rateLimitStore = new Map<string, RateLimitTracker>();

/**
 * Validates a rate limit for a specific identifier (like IP address).
 * @param identifier The unique identifier for the requester (e.g. IP address)
 * @param limit Max number of requests allowed within the window
 * @param windowMs The time window in milliseconds
 */
export function checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired records occasionally to prevent memory leaks
  if (rateLimitStore.size > 1000) {
      for (const [key, val] of rateLimitStore.entries()) {
          if (val.resetAt < now) rateLimitStore.delete(key);
      }
  }

  if (!record || record.resetAt < now) {
    // First request or window expired
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false; // Rate limit exceeded
  }

  record.count += 1;
  return true;
}

/**
 * Helper to extract IP address from the request securely.
 */
export function getIpAddress(request: Request): string {
  // Use x-forwarded-for if behind a proxy (like Vercel), otherwise fallback
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return 'unknown-ip';
}
