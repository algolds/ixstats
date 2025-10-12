/**
 * Rate Limiting Service
 *
 * Supports both Redis (production) and in-memory (development) rate limiting
 * Prevents API abuse and ensures fair resource allocation
 */

import { env } from "../env";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// In-memory store for development/fallback
const inMemoryStore = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

class RateLimiter {
  private readonly enabled: boolean;
  private readonly redisEnabled: boolean;
  private readonly config: RateLimitConfig;
  private redisClient: any = null;

  constructor() {
    this.enabled = env.RATE_LIMIT_ENABLED === "true";
    this.redisEnabled = env.REDIS_ENABLED === "true" && !!env.REDIS_URL;
    this.config = {
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    };

    if (this.redisEnabled) {
      this.initRedis();
    }
  }

  /**
   * Initialize Redis client
   */
  private async initRedis() {
    try {
      // Dynamically import ioredis only if Redis is enabled
      const Redis = (await import("ioredis")).default;
      this.redisClient = new Redis(env.REDIS_URL!);

      this.redisClient.on("error", (error: Error) => {
        console.error("[Rate Limiter] Redis error:", error);
        console.log("[Rate Limiter] Falling back to in-memory rate limiting");
        this.redisClient = null;
      });

      this.redisClient.on("connect", () => {
        console.log("[Rate Limiter] Connected to Redis");
      });
    } catch (error) {
      console.error("[Rate Limiter] Failed to initialize Redis:", error);
      console.log("[Rate Limiter] Using in-memory rate limiting");
    }
  }

  /**
   * Check if rate limit is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check rate limit using Redis
   */
  private async checkRedis(key: string): Promise<RateLimitResult> {
    if (!this.redisClient) {
      return this.checkInMemory(key);
    }

    try {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      // Use Redis sorted set to track requests in time window
      const multi = this.redisClient.multi();

      // Remove old entries
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Count requests in window
      multi.zcard(key);

      // Set expiry
      multi.expire(key, Math.ceil(this.config.windowMs / 1000));

      const results = await multi.exec();
      const count = results?.[2]?.[1] as number;

      const success = count <= this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - count);
      const resetAt = new Date(now + this.config.windowMs);

      return { success, remaining, resetAt };
    } catch (error) {
      console.error("[Rate Limiter] Redis check failed, falling back to in-memory:", error);
      return this.checkInMemory(key);
    }
  }

  /**
   * Check rate limit using in-memory store
   */
  private checkInMemory(key: string): RateLimitResult {
    const now = Date.now();
    const entry = inMemoryStore.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of inMemoryStore.entries()) {
        if (v.resetAt < now) {
          inMemoryStore.delete(k);
        }
      }
    }

    if (!entry || entry.resetAt < now) {
      // Create new window
      const resetAt = now + this.config.windowMs;
      inMemoryStore.set(key, { count: 1, resetAt });
      return {
        success: true,
        remaining: this.config.maxRequests - 1,
        resetAt: new Date(resetAt),
      };
    }

    // Increment counter
    entry.count++;
    const success = entry.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);

    return {
      success,
      remaining,
      resetAt: new Date(entry.resetAt),
    };
  }

  /**
   * Check rate limit for a given identifier
   *
   * @param identifier - Unique identifier (e.g., user ID, IP address, API key)
   * @param namespace - Optional namespace to separate different rate limit buckets
   * @returns Rate limit result
   */
  async check(identifier: string, namespace: string = "default"): Promise<RateLimitResult> {
    if (!this.enabled) {
      return {
        success: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      };
    }

    const key = `ratelimit:${namespace}:${identifier}`;

    if (this.redisClient) {
      return this.checkRedis(key);
    }

    return this.checkInMemory(key);
  }

  /**
   * Reset rate limit for a given identifier
   */
  async reset(identifier: string, namespace: string = "default"): Promise<void> {
    const key = `ratelimit:${namespace}:${identifier}`;

    if (this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        console.error("[Rate Limiter] Failed to reset Redis key:", error);
      }
    }

    inMemoryStore.delete(key);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(identifier: string, namespace: string = "default"): Promise<RateLimitResult> {
    if (!this.enabled) {
      return {
        success: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      };
    }

    const key = `ratelimit:${namespace}:${identifier}`;

    if (this.redisClient) {
      try {
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        // Count requests in window without adding new one
        const count = await this.redisClient.zcount(key, windowStart, now);

        const success = count < this.config.maxRequests;
        const remaining = Math.max(0, this.config.maxRequests - count);
        const resetAt = new Date(now + this.config.windowMs);

        return { success, remaining, resetAt };
      } catch (error) {
        console.error("[Rate Limiter] Failed to get Redis status:", error);
      }
    }

    // In-memory status check
    const entry = inMemoryStore.get(key);
    const now = Date.now();

    if (!entry || entry.resetAt < now) {
      return {
        success: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
      };
    }

    return {
      success: entry.count < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetAt: new Date(entry.resetAt),
    };
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Export types
export type { RateLimitResult, RateLimitConfig };
