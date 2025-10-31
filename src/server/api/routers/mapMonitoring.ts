// src/server/api/routers/mapMonitoring.ts
// Map system monitoring and statistics router (Admin only)

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { Redis } from "ioredis";

// Redis client (singleton)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      return redisClient;
    }
  } catch (error) {
    console.warn("[MapMonitoring] Redis not available:", error);
  }

  return null;
}

interface CacheStats {
  enabled: boolean;
  connected: boolean;
  totalKeys: number;
  memoryUsed: string;
  memoryMax: string;
  memoryUsagePercent: number;
  hitRate: number;
  hits: number;
  misses: number;
  evictedKeys: number;
  uptime: string;
}

interface MartinStatus {
  running: boolean;
  healthy: boolean;
  endpoint: string;
  availableLayers: string[];
  error?: string;
}

interface ServiceStatus {
  name: string;
  running: boolean;
  healthy: boolean;
  details?: string;
}

export const mapMonitoringRouter = createTRPCRouter({
  /**
   * Get Redis cache statistics
   * Admin only
   */
  getCacheStats: adminProcedure.query(async () => {
    const redis = getRedisClient();

    if (!redis) {
      return {
        enabled: false,
        connected: false,
        totalKeys: 0,
        memoryUsed: "0 B",
        memoryMax: "0 B",
        memoryUsagePercent: 0,
        hitRate: 0,
        hits: 0,
        misses: 0,
        evictedKeys: 0,
        uptime: "0s",
      } as CacheStats;
    }

    try {
      // Connect if not already connected
      if (redis.status !== "ready") {
        await redis.connect();
      }

      // Get all stats in parallel
      const [infoStats, dbSize] = await Promise.all([
        redis.info("stats"),
        redis.dbsize(),
      ]);

      const infoMemory = await redis.info("memory");
      const infoServer = await redis.info("server");

      // Parse stats
      const parseInfo = (info: string): Record<string, string> => {
        const result: Record<string, string> = {};
        info.split("\r\n").forEach((line) => {
          if (line && !line.startsWith("#")) {
            const [key, value] = line.split(":");
            if (key && value) {
              result[key] = value;
            }
          }
        });
        return result;
      };

      const stats = parseInfo(infoStats);
      const memory = parseInfo(infoMemory);
      const server = parseInfo(infoServer);

      const hits = parseInt(stats.keyspace_hits || "0");
      const misses = parseInt(stats.keyspace_misses || "0");
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      const memoryUsed = parseInt(memory.used_memory || "0");
      const memoryMax = parseInt(memory.maxmemory || "0");
      const memoryUsagePercent =
        memoryMax > 0 ? (memoryUsed / memoryMax) * 100 : 0;

      // Format bytes
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
      };

      // Format uptime
      const formatUptime = (seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
      };

      return {
        enabled: true,
        connected: true,
        totalKeys: dbSize,
        memoryUsed: formatBytes(memoryUsed),
        memoryMax: formatBytes(memoryMax),
        memoryUsagePercent: Math.round(memoryUsagePercent * 10) / 10,
        hitRate: Math.round(hitRate * 10) / 10,
        hits,
        misses,
        evictedKeys: parseInt(stats.evicted_keys || "0"),
        uptime: formatUptime(parseInt(server.uptime_in_seconds || "0")),
      } as CacheStats;
    } catch (error) {
      console.error("[MapMonitoring] Error fetching cache stats:", error);
      return {
        enabled: true,
        connected: false,
        totalKeys: 0,
        memoryUsed: "0 B",
        memoryMax: "0 B",
        memoryUsagePercent: 0,
        hitRate: 0,
        hits: 0,
        misses: 0,
        evictedKeys: 0,
        uptime: "0s",
      } as CacheStats;
    }
  }),

  /**
   * Get Martin tile server status
   * Admin only
   */
  getMartinStatus: adminProcedure.query(async () => {
    const martinUrl = process.env.MARTIN_URL || "http://localhost:3800";

    try {
      // Check health endpoint
      const healthResponse = await fetch(`${martinUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });

      // Get catalog
      const catalogResponse = await fetch(`${martinUrl}/catalog`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!catalogResponse.ok) {
        return {
          running: false,
          healthy: false,
          endpoint: martinUrl,
          availableLayers: [],
          error: `Catalog returned ${catalogResponse.status}`,
        } as MartinStatus;
      }

      const catalog = (await catalogResponse.json()) as {
        tiles: Record<string, unknown>;
      };
      const layers = Object.keys(catalog.tiles || {});

      return {
        running: true,
        healthy: healthResponse.ok,
        endpoint: martinUrl,
        availableLayers: layers,
      } as MartinStatus;
    } catch (error) {
      return {
        running: false,
        healthy: false,
        endpoint: martinUrl,
        availableLayers: [],
        error: error instanceof Error ? error.message : "Connection failed",
      } as MartinStatus;
    }
  }),

  /**
   * Get all map-related service statuses
   * Admin only
   */
  getServiceStatuses: adminProcedure.query(async ({ ctx }) => {
    const services: ServiceStatus[] = [];

    // Check Redis
    try {
      const redis = getRedisClient();
      if (redis) {
        if (redis.status !== "ready") {
          await redis.connect();
        }
        await redis.ping();
        services.push({
          name: "Redis Cache",
          running: true,
          healthy: true,
          details: "Connected and responding",
        });
      } else {
        services.push({
          name: "Redis Cache",
          running: false,
          healthy: false,
          details: "Not configured",
        });
      }
    } catch (error) {
      services.push({
        name: "Redis Cache",
        running: false,
        healthy: false,
        details: error instanceof Error ? error.message : "Connection failed",
      });
    }

    // Check Martin
    try {
      const martinUrl = process.env.MARTIN_URL || "http://localhost:3800";
      const response = await fetch(`${martinUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });

      services.push({
        name: "Martin Tile Server",
        running: true,
        healthy: response.ok,
        details: response.ok ? "Serving tiles" : `HTTP ${response.status}`,
      });
    } catch (error) {
      services.push({
        name: "Martin Tile Server",
        running: false,
        healthy: false,
        details: error instanceof Error ? error.message : "Connection failed",
      });
    }

    // Check PostGIS
    try {
      const countryCount = await ctx.db.country.count();
      services.push({
        name: "PostGIS Database",
        running: true,
        healthy: true,
        details: `${countryCount} countries loaded`,
      });
    } catch (error) {
      services.push({
        name: "PostGIS Database",
        running: false,
        healthy: false,
        details: error instanceof Error ? error.message : "Connection failed",
      });
    }

    return services;
  }),

  /**
   * Clear Redis cache (force regeneration)
   * Admin only - use with caution
   */
  clearCache: adminProcedure
    .input(
      z.object({
        pattern: z.string().default("tile:*"), // Default to clearing all tiles
        confirm: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      if (!input.confirm) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cache clear must be confirmed",
        });
      }

      const redis = getRedisClient();
      if (!redis) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Redis not available",
        });
      }

      try {
        if (redis.status !== "ready") {
          await redis.connect();
        }

        // Get all keys matching pattern
        const keys = await redis.keys(input.pattern);

        if (keys.length === 0) {
          return { cleared: 0, pattern: input.pattern };
        }

        // Delete keys in batches
        const batchSize = 1000;
        let cleared = 0;

        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await redis.del(...batch);
          cleared += batch.length;
        }

        return { cleared, pattern: input.pattern };
      } catch (error) {
        console.error("[MapMonitoring] Error clearing cache:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to clear cache",
        });
      }
    }),

  /**
   * Get tile request performance metrics
   * Admin only
   */
  getTileMetrics: adminProcedure.query(async () => {
    const redis = getRedisClient();

    if (!redis) {
      return {
        avgResponseTime: 0,
        totalRequests: 0,
        cacheHitRate: 0,
        layerStats: [],
      };
    }

    try {
      if (redis.status !== "ready") {
        await redis.connect();
      }

      // Get sample of tile keys to analyze
      const sampleKeys = await redis.keys("tile:*");
      const layerCounts: Record<string, number> = {};

      sampleKeys.forEach((key) => {
        const parts = key.split(":");
        if (parts.length >= 2) {
          const layer = parts[1]?.replace("map_layer_", "") || "unknown";
          layerCounts[layer] = (layerCounts[layer] || 0) + 1;
        }
      });

      const layerStats = Object.entries(layerCounts).map(([layer, count]) => ({
        layer,
        cachedTiles: count,
      }));

      // Get cache hit rate from stats
      const info = await redis.info("stats");
      const stats: Record<string, string> = {};
      info.split("\r\n").forEach((line) => {
        if (line && !line.startsWith("#")) {
          const [key, value] = line.split(":");
          if (key && value) {
            stats[key] = value;
          }
        }
      });

      const hits = parseInt(stats.keyspace_hits || "0");
      const misses = parseInt(stats.keyspace_misses || "0");
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      return {
        avgResponseTime: 15, // Placeholder - would need actual timing data
        totalRequests: total,
        cacheHitRate: Math.round(hitRate * 10) / 10,
        layerStats,
      };
    } catch (error) {
      console.error("[MapMonitoring] Error fetching tile metrics:", error);
      return {
        avgResponseTime: 0,
        totalRequests: 0,
        cacheHitRate: 0,
        layerStats: [],
      };
    }
  }),
});
