/**
 * Shared ioredis client for the tRPC cache and globalCache.
 *
 * Created on first use and connects immediately (not lazily). Callers must check
 * `isRedisReady()` and fall back to in-process memory otherwise, so an unreachable Redis
 * degrades to memory caching instead of failing requests.
 */

import { Redis } from "ioredis";

let shared: Redis | null = null;
let lastErrorMessage = "";

/** REDIS_URL when REDIS_ENABLED is "true", else null. */
export function getEnabledRedisUrl(): string | null {
  const url = process.env.REDIS_URL;
  return url && process.env.REDIS_ENABLED === "true" ? url : null;
}

/** Single process-wide ioredis client for caches. Connects eagerly; null when Redis is disabled. */
export function getSharedRedis(): Redis | null {
  if (shared) return shared;

  const url = getEnabledRedisUrl();
  if (!url) return null;

  shared = new Redis(url, { maxRetriesPerRequest: 3, enableOfflineQueue: false });
  shared.on("error", (err: Error) => {
    // ioredis emits on every reconnect attempt while Redis is down; log each distinct error once.
    if (err.message === lastErrorMessage) return;
    lastErrorMessage = err.message;
    console.warn("[RedisClient] Redis error, caches use in-process memory:", err.message);
  });
  shared.on("ready", () => {
    lastErrorMessage = "";
  });
  return shared;
}

export function isRedisReady(client: Redis | null): client is Redis {
  return client?.status === "ready";
}

export interface ScanDeleteClient {
  scan(
    cursor: string,
    matchToken: "MATCH",
    pattern: string,
    countToken: "COUNT",
    count: number
  ): Promise<[string, string[]]>;
  unlink(...keys: string[]): Promise<number>;
}

/** Non-blocking replacement for KEYS+DEL. Returns number of keys unlinked. */
export async function deleteKeysByPattern(
  client: ScanDeleteClient,
  pattern: string
): Promise<number> {
  let cursor = "0";
  let total = 0;
  do {
    const [next, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 250);
    cursor = next;
    if (keys.length > 0) total += await client.unlink(...keys);
  } while (cursor !== "0");
  return total;
}
