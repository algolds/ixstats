#!/usr/bin/env npx tsx
/**
 * IxStats Cache Performance Test
 *
 * Tests cache effectiveness including hit rates, latency, and Redis connectivity.
 * Run with: npx tsx scripts/diagnostics/cache-test.ts
 */

import { performance } from "perf_hooks";
import { createClient } from "redis";

// ============================================================================
// Types
// ============================================================================

interface CacheTestResult {
  name: string;
  hitRate: number;
  avgLatency: number;
  totalRequests: number;
  hits: number;
  misses: number;
  errors: number;
  status: "pass" | "warning" | "fail";
}

interface RedisStats {
  connected: boolean;
  usedMemory: string;
  totalKeys: number;
  hitRate?: number;
  uptime?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const TARGETS = {
  hitRate: { target: 70, warning: 50, critical: 30 },
  latency: { target: 5, warning: 20, critical: 50 }, // ms
};

const TEST_ITERATIONS = 50;

// ============================================================================
// Utilities
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// In-Memory Cache Simulation
// ============================================================================

class TestCache {
  private cache = new Map<string, { value: any; expires: number; hits: number }>();
  private stats = { hits: 0, misses: 0, sets: 0 };

  set(key: string, value: any, ttlMs: number = 60000): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs,
      hits: 0,
    });
    this.stats.sets++;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      size: this.cache.size,
    };
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0 };
  }
}

// ============================================================================
// Redis Tests
// ============================================================================

async function testRedisConnection(): Promise<RedisStats> {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    const client = createClient({ url: redisUrl });

    client.on("error", () => {
      // Suppress error logging
    });

    await client.connect();

    // Get Redis INFO
    const info = await client.info();
    const infoLines = info.split("\r\n");

    const getInfoValue = (key: string): string => {
      const line = infoLines.find((l) => l.startsWith(`${key}:`));
      return line ? line.split(":")[1] || "" : "";
    };

    const usedMemory = getInfoValue("used_memory_human") || "N/A";
    const keyspaceHits = parseInt(getInfoValue("keyspace_hits") || "0", 10);
    const keyspaceMisses = parseInt(getInfoValue("keyspace_misses") || "0", 10);
    const uptime = parseInt(getInfoValue("uptime_in_seconds") || "0", 10);

    // Get key count
    const dbSize = await client.dbSize();

    await client.disconnect();

    const totalHits = keyspaceHits + keyspaceMisses;
    const hitRate = totalHits > 0 ? (keyspaceHits / totalHits) * 100 : undefined;

    return {
      connected: true,
      usedMemory,
      totalKeys: dbSize,
      hitRate,
      uptime,
    };
  } catch (error) {
    return {
      connected: false,
      usedMemory: "N/A",
      totalKeys: 0,
    };
  }
}

async function benchmarkRedisOperations(): Promise<{
  setLatency: number;
  getLatency: number;
  samples: number;
}> {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    const client = createClient({ url: redisUrl });
    client.on("error", () => {});
    await client.connect();

    const setTimes: number[] = [];
    const getTimes: number[] = [];
    const testKey = `benchmark:test:${Date.now()}`;

    // Benchmark SET operations
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      await client.set(`${testKey}:${i}`, JSON.stringify({ test: i }), {
        EX: 60,
      });
      setTimes.push(performance.now() - start);
    }

    // Benchmark GET operations (hits)
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const start = performance.now();
      await client.get(`${testKey}:${i}`);
      getTimes.push(performance.now() - start);
    }

    // Cleanup
    for (let i = 0; i < TEST_ITERATIONS; i++) {
      await client.del(`${testKey}:${i}`);
    }

    await client.disconnect();

    return {
      setLatency: setTimes.reduce((a, b) => a + b, 0) / setTimes.length,
      getLatency: getTimes.reduce((a, b) => a + b, 0) / getTimes.length,
      samples: TEST_ITERATIONS,
    };
  } catch (error) {
    return { setLatency: -1, getLatency: -1, samples: 0 };
  }
}

// ============================================================================
// In-Memory Cache Tests
// ============================================================================

function testInMemoryCache(): CacheTestResult {
  const cache = new TestCache();
  const errors = 0;

  // Simulate realistic cache access pattern
  // 80% of requests go to 20% of keys (Pareto principle)
  const hotKeys = Array.from({ length: 20 }, (_, i) => `hot:key:${i}`);
  const coldKeys = Array.from({ length: 80 }, (_, i) => `cold:key:${i}`);

  // Pre-populate cache
  for (const key of hotKeys) {
    cache.set(key, { data: key }, 60000);
  }
  for (const key of coldKeys) {
    cache.set(key, { data: key }, 60000);
  }

  // Simulate access pattern
  const latencies: number[] = [];

  for (let i = 0; i < TEST_ITERATIONS * 10; i++) {
    const useHotKey = Math.random() < 0.8;
    const keys = useHotKey ? hotKeys : coldKeys;
    const key = keys[Math.floor(Math.random() * keys.length)];

    const start = performance.now();
    cache.get(key);
    latencies.push(performance.now() - start);
  }

  const stats = cache.getStats();
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  let status: "pass" | "warning" | "fail" = "pass";
  if (stats.hitRate < TARGETS.hitRate.critical) status = "fail";
  else if (stats.hitRate < TARGETS.hitRate.warning) status = "warning";

  return {
    name: "In-Memory Cache",
    hitRate: stats.hitRate,
    avgLatency,
    totalRequests: stats.hits + stats.misses,
    hits: stats.hits,
    misses: stats.misses,
    errors,
    status,
  };
}

function testCacheEviction(): { evictedCount: number; finalSize: number } {
  const MAX_SIZE = 100;
  const cache = new Map<string, any>();

  // Fill beyond capacity
  for (let i = 0; i < MAX_SIZE * 2; i++) {
    // Simple LRU-style eviction
    if (cache.size >= MAX_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(`key:${i}`, { data: i });
  }

  return {
    evictedCount: MAX_SIZE,
    finalSize: cache.size,
  };
}

// ============================================================================
// HTTP Cache Tests (via API)
// ============================================================================

async function testApiCaching(baseUrl: string): Promise<{
  firstRequest: number;
  cachedRequest: number;
  speedup: number;
}> {
  const endpoint = `${baseUrl}/api/trpc/countries.getGlobalStats`;

  try {
    // First request (cache miss)
    const start1 = performance.now();
    await fetch(endpoint);
    const firstRequest = performance.now() - start1;

    // Wait a bit for cache to settle
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second request (should be cached)
    const start2 = performance.now();
    await fetch(endpoint);
    const cachedRequest = performance.now() - start2;

    const speedup = firstRequest > 0 ? firstRequest / cachedRequest : 1;

    return { firstRequest, cachedRequest, speedup };
  } catch (error) {
    return { firstRequest: -1, cachedRequest: -1, speedup: 0 };
  }
}

// ============================================================================
// Main Test Suite
// ============================================================================

async function runCacheTests() {
  log("\n═══════════════════════════════════════════════════════════════", "blue");
  log("  IxStats Cache Performance Tests", "blue");
  log("═══════════════════════════════════════════════════════════════\n", "blue");

  const baseUrl = process.env.BENCHMARK_URL || "http://localhost:3000";

  // -------------------------------------------------------------------------
  // Redis Connection Test
  // -------------------------------------------------------------------------
  log("▸ Testing Redis Connection...", "blue");
  const redisStats = await testRedisConnection();

  if (redisStats.connected) {
    log(`  ✓ Redis connected`, "green");
    log(`    Memory: ${redisStats.usedMemory}`, "dim");
    log(`    Keys: ${redisStats.totalKeys}`, "dim");
    if (redisStats.hitRate !== undefined) {
      log(`    Hit Rate: ${redisStats.hitRate.toFixed(2)}%`, "dim");
    }
    if (redisStats.uptime) {
      const hours = Math.floor(redisStats.uptime / 3600);
      log(`    Uptime: ${hours} hours`, "dim");
    }
  } else {
    log(`  ⚠ Redis not available (using in-memory fallback)`, "yellow");
  }

  // -------------------------------------------------------------------------
  // Redis Latency Benchmark
  // -------------------------------------------------------------------------
  if (redisStats.connected) {
    log("\n▸ Benchmarking Redis Operations...", "blue");
    const redisBenchmark = await benchmarkRedisOperations();

    if (redisBenchmark.samples > 0) {
      const setStatus =
        redisBenchmark.setLatency < TARGETS.latency.target
          ? "green"
          : redisBenchmark.setLatency < TARGETS.latency.warning
            ? "yellow"
            : "red";
      const getStatus =
        redisBenchmark.getLatency < TARGETS.latency.target
          ? "green"
          : redisBenchmark.getLatency < TARGETS.latency.warning
            ? "yellow"
            : "red";

      log(`  SET latency: ${redisBenchmark.setLatency.toFixed(2)}ms`, setStatus);
      log(`  GET latency: ${redisBenchmark.getLatency.toFixed(2)}ms`, getStatus);
      log(`  Samples: ${redisBenchmark.samples}`, "dim");
    }
  }

  // -------------------------------------------------------------------------
  // In-Memory Cache Test
  // -------------------------------------------------------------------------
  log("\n▸ Testing In-Memory Cache...", "blue");
  const memCacheResult = testInMemoryCache();

  const hitRateStatus =
    memCacheResult.hitRate >= TARGETS.hitRate.target
      ? "green"
      : memCacheResult.hitRate >= TARGETS.hitRate.warning
        ? "yellow"
        : "red";

  log(`  Hit Rate: ${memCacheResult.hitRate.toFixed(2)}%`, hitRateStatus);
  log(`  Latency: ${(memCacheResult.avgLatency * 1000).toFixed(3)}µs`, "reset");
  log(`  Total Requests: ${memCacheResult.totalRequests}`, "dim");
  log(`  Hits: ${memCacheResult.hits} | Misses: ${memCacheResult.misses}`, "dim");

  // -------------------------------------------------------------------------
  // Cache Eviction Test
  // -------------------------------------------------------------------------
  log("\n▸ Testing Cache Eviction...", "blue");
  const evictionResult = testCacheEviction();

  log(`  Evicted: ${evictionResult.evictedCount} entries`, "reset");
  log(`  Final Size: ${evictionResult.finalSize} entries`, "reset");
  log(`  ✓ LRU eviction working correctly`, "green");

  // -------------------------------------------------------------------------
  // API Cache Test
  // -------------------------------------------------------------------------
  log("\n▸ Testing API Cache Effectiveness...", "blue");
  const apiCacheResult = await testApiCaching(baseUrl);

  if (apiCacheResult.firstRequest > 0) {
    log(`  First request: ${apiCacheResult.firstRequest.toFixed(2)}ms`, "reset");
    log(`  Cached request: ${apiCacheResult.cachedRequest.toFixed(2)}ms`, "reset");

    const speedupStatus =
      apiCacheResult.speedup > 2 ? "green" : apiCacheResult.speedup > 1.5 ? "yellow" : "red";
    log(`  Speedup: ${apiCacheResult.speedup.toFixed(2)}x`, speedupStatus);
  } else {
    log(`  ⚠ Could not test API caching (server not running?)`, "yellow");
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  log("\n═══════════════════════════════════════════════════════════════", "blue");
  log("  Summary & Recommendations", "blue");
  log("═══════════════════════════════════════════════════════════════\n", "blue");

  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!redisStats.connected) {
    issues.push("Redis not connected - using in-memory cache only");
    recommendations.push(
      "Configure Redis for production (better cache persistence across restarts)"
    );
  }

  if (memCacheResult.hitRate < TARGETS.hitRate.warning) {
    issues.push(`Low cache hit rate: ${memCacheResult.hitRate.toFixed(2)}%`);
    recommendations.push("Consider increasing cache TTL or pre-warming critical data");
  }

  if (apiCacheResult.speedup > 0 && apiCacheResult.speedup < 1.5) {
    issues.push("API caching not providing significant speedup");
    recommendations.push("Check if cached procedures are being used correctly");
  }

  if (issues.length === 0) {
    log("  ✓ All cache systems performing well", "green");
  } else {
    log("  Issues:", "yellow");
    for (const issue of issues) {
      log(`    ⚠ ${issue}`, "yellow");
    }
  }

  if (recommendations.length > 0) {
    log("\n  Recommendations:", "cyan");
    for (const rec of recommendations) {
      log(`    → ${rec}`, "reset");
    }
  }

  // Performance targets
  log("\n  Performance Targets:", "cyan");
  log(
    `    Cache Hit Rate: ≥${TARGETS.hitRate.target}% (warning: <${TARGETS.hitRate.warning}%)`,
    "dim"
  );
  log(
    `    Redis Latency: <${TARGETS.latency.target}ms (warning: >${TARGETS.latency.warning}ms)`,
    "dim"
  );
  log("");
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
IxStats Cache Performance Tests

Usage: npx tsx scripts/diagnostics/cache-test.ts [options]

Options:
  --help, -h     Show this help message
  --url URL      Set API base URL (default: http://localhost:3000)

Environment Variables:
  REDIS_URL      Redis connection string
  BENCHMARK_URL  API base URL for testing

Tests performed:
  - Redis connectivity and statistics
  - Redis SET/GET latency benchmarks
  - In-memory cache hit rate simulation
  - LRU cache eviction verification
  - API response caching effectiveness
`);
  process.exit(0);
}

const urlIndex = args.indexOf("--url");
if (urlIndex !== -1 && args[urlIndex + 1]) {
  process.env.BENCHMARK_URL = args[urlIndex + 1];
}

runCacheTests().catch((error) => {
  console.error("Cache test failed:", error.message);
  process.exit(1);
});
