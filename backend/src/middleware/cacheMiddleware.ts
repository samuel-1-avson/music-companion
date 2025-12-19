import { Request, Response, NextFunction } from 'express';
import { cache, createCacheKey, CACHE_TTL } from '../services/cacheService';

interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
}

/**
 * Cache middleware factory
 * Caches GET request responses automatically
 */
export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = CACHE_TTL.YOUTUBE_SEARCH, keyPrefix = 'api' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create cache key from URL
    const cacheKey = createCacheKey(keyPrefix, req.originalUrl);

    try {
      // Check cache
      const cachedResponse = await cache.get<any>(cacheKey);
      
      if (cachedResponse) {
        console.log(`[Cache] HIT: ${cacheKey}`);
        return res.json({
          ...cachedResponse,
          _cached: true,
          _cacheKey: cacheKey,
        });
      }

      console.log(`[Cache] MISS: ${cacheKey}`);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode === 200) {
          cache.set(cacheKey, body, ttl).catch(err => {
            console.error('[Cache] Failed to cache response:', err);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('[Cache Middleware] Error:', error);
      next();
    }
  };
};

/**
 * Clear cache for a specific pattern
 */
export const clearCachePattern = async (pattern: string) => {
  // Note: Pattern matching requires SCAN command
  // For simplicity, we'll just log for now
  console.log(`[Cache] Clear pattern requested: ${pattern}`);
};

export default cacheMiddleware;
