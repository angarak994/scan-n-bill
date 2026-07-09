type RateLimitInfo = {
  count: number;
  resetTime: number;
};

// Basic in-memory rate limiter. (Note: On Vercel this is per-lambda instance).
const rateLimitCache = new Map<string, RateLimitInfo>();

export function checkRateLimit(ip: string, limit: number = 5, windowMs: number = 15 * 60 * 1000): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const info = rateLimitCache.get(ip);

  if (!info) {
    rateLimitCache.set(ip, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (now > info.resetTime) {
    rateLimitCache.set(ip, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (info.count >= limit) {
    return { success: false, remaining: 0, resetTime: info.resetTime };
  }

  info.count += 1;
  return { success: true, remaining: limit - info.count, resetTime: info.resetTime };
}
