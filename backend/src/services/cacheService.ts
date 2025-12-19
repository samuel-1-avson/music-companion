import Redis from 'ioredis';

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

// Create Redis client
let redis: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redis) {
    redis = new Redis(redisConfig);

    redis.on('connect', () => {
      console.log('[Redis] Connected to Redis');
    });

    redis.on('error', (error) => {
      console.error('[Redis] Connection error:', error.message);
    });

    redis.on('close', () => {
      console.log('[Redis] Connection closed');
    });
  }

  return redis;
};

// Cache service
export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  },

  /**
   * Set cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (error) {
      console.error('[Cache] Set error:', error);
      return false;
    }
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.error('[Cache] Delete error:', error);
      return false;
    }
  },

  /**
   * Clear all cache (use with caution)
   */
  async flush(): Promise<boolean> {
    try {
      const client = getRedisClient();
      await client.flushdb();
      return true;
    } catch (error) {
      console.error('[Cache] Flush error:', error);
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      const count = await client.exists(key);
      return count > 0;
    } catch (error) {
      console.error('[Cache] Exists error:', error);
      return false;
    }
  },

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = getRedisClient();
      return await client.ttl(key);
    } catch (error) {
      console.error('[Cache] TTL error:', error);
      return -1;
    }
  },
};

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  YOUTUBE_SEARCH: 5 * 60,      // 5 minutes
  GEMINI_RESPONSE: 10 * 60,    // 10 minutes
  SPOTIFY_TRACK: 60 * 60,      // 1 hour
  USER_SESSION: 24 * 60 * 60,  // 24 hours
};

// Create cache key
export const createCacheKey = (prefix: string, ...parts: string[]): string => {
  return `mc:${prefix}:${parts.join(':')}`;
};

export default cache;
