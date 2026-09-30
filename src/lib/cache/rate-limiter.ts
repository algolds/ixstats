/**
 * Rate Limiting Service
 *
 * Supports both Redis (production) and in-memory (development) rate limiting
 * Prevents API abuse and ensures fair resource allocation
 */

import type { Redis } from "ioredis";
import { env } from "~/env";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

function fullWindow(cfg: RateLimitConfig, now: number): RateLimitResult {
  return { success: true, remaining: cfg.maxRequests, resetAt: new Date(now + cfg.windowMs) };
}

// In-memory store for development/fallback
const inMemoryStore = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

export class RateLimiter {
  private readonly enabled: boolean;
  private readonly redisEnabled: boolean;
  private readonly config: RateLimitConfig;
  private redisClient: Redis | null = null;

  constructor() {
    this.enabled = env.RATE_LIMIT_ENABLED === "true";
    this.redisEnabled = env.REDIS_ENABLED === "true" && !!env.REDIS_URL;
    this.config = {
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    };

    if (this.redisEnabled) {
      this.initRedis();
    } else if (process.env.NODE_ENV !== "test") {
      console.warn("[RateLimiter] Redis not available — using in-memory fallback");
    }
  }

  /**
   * Initialize Redis client
   */
  private async initRedis() {
    try {
      // Dynamically import ioredis only if Redis is enabled
      const IORedis = (await import("ioredis")).default;
      this.redisClient = new IORedis(env.REDIS_URL!);

      // ioredis reconnects on its own; checks use in-memory limits while the client is not ready.
      this.redisClient.on("error", (error: Error) => {
        console.error("[Rate Limiter] Redis error:", error);
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
   * The Redis client, or null when it is missing or not currently connected
   */
  private readyClient(): Redis | null {
    return this.redisClient?.status === "ready" ? this.redisClient : null;
  }

  /**
   * Check rate limit using Redis
   */
  private async checkRedis(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
    const client = this.readyClient();
    if (!client) {
      return this.checkInMemory(key, cfg);
    }

    try {
      const now = Date.now();
      const windowStart = now - cfg.windowMs;

      // Use Redis sorted set to track requests in time window
      const multi = client.multi();

      // Remove old entries
      multi.zremrangebyscore(key, 0, windowStart);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Count requests in window
      multi.zcard(key);

      // Set expiry
      multi.expire(key, Math.ceil(cfg.windowMs / 1000));

      const results = await multi.exec();
      const count = results?.[2]?.[1] as number;

      const success = count <= cfg.maxRequests;
      const remaining = Math.max(0, cfg.maxRequests - count);
      const resetAt = new Date(now + cfg.windowMs);

      return { success, remaining, resetAt };
    } catch (error) {
      console.error("[Rate Limiter] Redis check failed, falling back to in-memory:", error);
      return this.checkInMemory(key, cfg);
    }
  }

  /**
   * Check rate limit using in-memory store
   */
  private checkInMemory(key: string, cfg: RateLimitConfig): RateLimitResult {
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
      const resetAt = now + cfg.windowMs;
      inMemoryStore.set(key, { count: 1, resetAt });
      return {
        success: true,
        remaining: cfg.maxRequests - 1,
        resetAt: new Date(resetAt),
      };
    }

    // Increment counter
    entry.count++;
    const success = entry.count <= cfg.maxRequests;
    const remaining = Math.max(0, cfg.maxRequests - entry.count);

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
   * @param limits - Per-call limits; defaults to the RATE_LIMIT_* env config
   * @returns Rate limit result
   */
  async check(
    identifier: string,
    namespace: string = "default",
    limits?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const cfg = limits ?? this.config;
    if (!this.enabled) {
      return fullWindow(cfg, Date.now());
    }

    return this.checkRedis(`ratelimit:${namespace}:${identifier}`, cfg);
  }

  /**
   * Reset rate limit for a given identifier
   */
  async reset(identifier: string, namespace: string = "default"): Promise<void> {
    const key = `ratelimit:${namespace}:${identifier}`;
    const client = this.readyClient();

    if (client) {
      try {
        await client.del(key);
      } catch (error) {
        console.error("[Rate Limiter] Failed to reset Redis key:", error);
      }
    }

    inMemoryStore.delete(key);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(
    identifier: string,
    namespace: string = "default",
    limits?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const cfg = limits ?? this.config;
    if (!this.enabled) {
      return fullWindow(cfg, Date.now());
    }

    const key = `ratelimit:${namespace}:${identifier}`;
    const client = this.readyClient();

    if (client) {
      try {
        const now = Date.now();
        const windowStart = now - cfg.windowMs;

        // Count requests in window without adding new one
        const count = await client.zcount(key, windowStart, now);

        const success = count < cfg.maxRequests;
        const remaining = Math.max(0, cfg.maxRequests - count);
        const resetAt = new Date(now + cfg.windowMs);

        return { success, remaining, resetAt };
      } catch (error) {
        console.error("[Rate Limiter] Failed to get Redis status:", error);
      }
    }

    // In-memory status check
    const entry = inMemoryStore.get(key);
    const now = Date.now();

    if (!entry || entry.resetAt < now) {
      return fullWindow(cfg, now);
    }

    return {
      success: entry.count < cfg.maxRequests,
      remaining: Math.max(0, cfg.maxRequests - entry.count),
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
