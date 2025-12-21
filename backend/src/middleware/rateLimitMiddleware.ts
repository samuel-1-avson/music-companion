/**
 * Rate Limiting Middleware
 * 
 * Implements sliding window rate limiting to protect API endpoints from abuse.
 * Uses in-memory storage (suitable for single-server deployments).
 * 
 * For multi-server deployments, replace with Redis-based rate limiting.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
  /** Message to return when rate limited */
  message?: string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Key generator function (defaults to IP) */
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  timestamps: number[];
  blocked: boolean;
  blockUntil?: number;
}

// In-memory store for rate limit data
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    // Remove entries that haven't been accessed in 10 minutes
    if (record.timestamps.length === 0 || 
        now - Math.max(...record.timestamps) > 10 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate limit middleware with specified options
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    skip,
    keyGenerator = defaultKeyGenerator,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Check if we should skip rate limiting
    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create record
    let record = rateLimitStore.get(key);
    if (!record) {
      record = { timestamps: [], blocked: false };
      rateLimitStore.set(key, record);
    }

    // Check if currently blocked
    if (record.blocked && record.blockUntil && now < record.blockUntil) {
      const retryAfter = Math.ceil((record.blockUntil - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(record.blockUntil));
      
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter,
      });
    }

    // Clean old timestamps outside the window
    record.timestamps = record.timestamps.filter(ts => now - ts < windowMs);
    record.blocked = false;

    // Check if over limit
    if (record.timestamps.length >= max) {
      // Block for the remainder of the window
      record.blocked = true;
      record.blockUntil = now + windowMs;
      
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(record.blockUntil));
      
      console.warn(`[RateLimit] Blocked ${key} on ${req.path} (${record.timestamps.length}/${max})`);
      
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter,
      });
    }

    // Record this request
    record.timestamps.push(now);
    
    // Set rate limit headers
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - record.timestamps.length)));
    res.set('X-RateLimit-Reset', String(now + windowMs));

    next();
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

/** Auth endpoints - reasonable limit (25 per minute) */
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 25,
  message: 'Too many authentication attempts. Please wait a minute.',
});

/** AI endpoints - moderate limit (15 per minute) */
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: 'AI request limit reached. Please wait before making more requests.',
});

/** Search endpoints - generous limit (60 per minute) */
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Search rate limit exceeded. Please slow down.',
});

/** General API - very generous limit (120 per minute) */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Rate limit exceeded.',
});

/** Download endpoints - strict limit (5 per minute per user) */
export const downloadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Download rate limit reached. Please wait before downloading more.',
});

/**
 * Get rate limit statistics for monitoring
 */
export function getRateLimitStats(): { 
  totalKeys: number; 
  blockedCount: number;
  topOffenders: Array<{ key: string; count: number }>;
} {
  let blockedCount = 0;
  const keyStats: Array<{ key: string; count: number }> = [];

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.blocked) blockedCount++;
    keyStats.push({ key: key.substring(0, 20), count: record.timestamps.length });
  }

  // Sort by request count descending
  keyStats.sort((a, b) => b.count - a.count);

  return {
    totalKeys: rateLimitStore.size,
    blockedCount,
    topOffenders: keyStats.slice(0, 10),
  };
}
