#!/usr/bin/env npx tsx
/**
 * IxStats Performance Benchmark Suite
 *
 * Measures and validates performance against defined targets.
 * Run with: npx tsx scripts/diagnostics/benchmark.ts
 */

import { performance } from "perf_hooks";

// ============================================================================
// Configuration & Targets
// ============================================================================

interface BenchmarkTarget {
  name: string;
  target: number;
  unit: string;
  warning: number;
  critical: number;
}

const TARGETS: Record<string, BenchmarkTarget> = {
  // Response time targets (milliseconds)
  apiResponseTime: {
    name: "API Response Time (avg)",
    target: 200,
    warning: 500,
    critical: 1000,
    unit: "ms",
  },
  ttfb: {
    name: "Time to First Byte",
    target: 200,
    warning: 400,
    critical: 800,
    unit: "ms",
  },
  dbQueryTime: {
    name: "Database Query Time (avg)",
    target: 50,
    warning: 100,
    critical: 200,
    unit: "ms",
  },
  cacheHitRate: {
    name: "Cache Hit Rate",
    target: 70,
    warning: 50,
    critical: 30,
    unit: "%",
  },
  memoryUsage: {
    name: "Memory Usage",
    target: 500,
    warning: 800,
    critical: 950,
    unit: "MB",
  },
};

// ============================================================================
// Result Types
// ============================================================================

interface BenchmarkResult {
  name: string;
  value: number;
  unit: string;
  status: "pass" | "warning" | "fail";
  target: number;
  samples?: number;
}

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
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getStatus(
  value: number,
  target: BenchmarkTarget,
  higherIsBetter = false
): "pass" | "warning" | "fail" {
  if (higherIsBetter) {
    if (value >= target.target) return "pass";
    if (value >= target.warning) return "warning";
    return "fail";
  } else {
    if (value <= target.target) return "pass";
    if (value <= target.warning) return "warning";
    return "fail";
  }
}

function formatResult(result: BenchmarkResult): string {
  const statusIcon = result.status === "pass" ? "✓" : result.status === "warning" ? "⚠" : "✗";
  const statusColor =
    result.status === "pass" ? "green" : result.status === "warning" ? "yellow" : "red";
  const samples = result.samples ? ` (${result.samples} samples)` : "";
  return `${colors[statusColor]}${statusIcon}${colors.reset} ${result.name}: ${result.value.toFixed(2)}${result.unit} (target: ${result.target}${result.unit})${samples}`;
}

// ============================================================================
// Benchmark Functions
// ============================================================================

async function benchmarkHttpEndpoint(
  url: string,
  iterations: number = 10
): Promise<{ avgTime: number; ttfb: number; samples: number }> {
  const times: number[] = [];
  const ttfbs: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const ttfb = performance.now() - start;
      ttfbs.push(ttfb);

      await response.text(); // Consume response
      const total = performance.now() - start;
      times.push(total);
    } catch (error) {
      // Skip failed requests
    }
  }

  if (times.length === 0) {
    return { avgTime: -1, ttfb: -1, samples: 0 };
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const avgTtfb = ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length;

  return { avgTime, ttfb: avgTtfb, samples: times.length };
}

async function benchmarkTrpcEndpoint(
  baseUrl: string,
  endpoint: string,
  input: unknown = {}
): Promise<{ time: number; success: boolean }> {
  const url = `${baseUrl}/api/trpc/${endpoint}`;
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const time = performance.now() - start;
    return { time, success: response.ok };
  } catch (error) {
    return { time: performance.now() - start, success: false };
  }
}

function getMemoryUsage(): number {
  const used = process.memoryUsage();
  return used.heapUsed / 1024 / 1024; // Convert to MB
}

// ============================================================================
// Main Benchmark Suite
// ============================================================================

async function runBenchmarks() {
  log("\n═══════════════════════════════════════════════════════════════", "blue");
  log("  IxStats Performance Benchmark Suite", "blue");
  log("═══════════════════════════════════════════════════════════════\n", "blue");

  const results: BenchmarkResult[] = [];
  const baseUrl = process.env.BENCHMARK_URL || "http://localhost:3000";

  log(`Target URL: ${baseUrl}`, "cyan");
  log(`Running benchmarks...\n`, "cyan");

  // -------------------------------------------------------------------------
  // 1. Homepage Response Time
  // -------------------------------------------------------------------------
  log("▸ Testing Homepage Response Time...", "blue");
  const homepageResult = await benchmarkHttpEndpoint(`${baseUrl}/`, 5);

  if (homepageResult.samples > 0) {
    results.push({
      name: "Homepage Response Time",
      value: homepageResult.avgTime,
      unit: "ms",
      status: getStatus(homepageResult.avgTime, TARGETS.apiResponseTime),
      target: TARGETS.apiResponseTime.target,
      samples: homepageResult.samples,
    });

    results.push({
      name: "Homepage TTFB",
      value: homepageResult.ttfb,
      unit: "ms",
      status: getStatus(homepageResult.ttfb, TARGETS.ttfb),
      target: TARGETS.ttfb.target,
      samples: homepageResult.samples,
    });
  } else {
    results.push({
      name: "Homepage Response Time",
      value: -1,
      unit: "ms",
      status: "fail",
      target: TARGETS.apiResponseTime.target,
    });
  }

  // -------------------------------------------------------------------------
  // 2. API Endpoint Tests
  // -------------------------------------------------------------------------
  log("▸ Testing tRPC API Endpoints...", "blue");

  const apiEndpoints = [
    { name: "countries.getAll", endpoint: "countries.getAll" },
    { name: "countries.getGlobalStats", endpoint: "countries.getGlobalStats" },
  ];

  for (const api of apiEndpoints) {
    const apiResult = await benchmarkTrpcEndpoint(baseUrl, api.endpoint);

    results.push({
      name: `API: ${api.name}`,
      value: apiResult.time,
      unit: "ms",
      status: apiResult.success ? getStatus(apiResult.time, TARGETS.apiResponseTime) : "fail",
      target: TARGETS.apiResponseTime.target,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Memory Usage
  // -------------------------------------------------------------------------
  log("▸ Checking Memory Usage...", "blue");
  const memoryMB = getMemoryUsage();

  results.push({
    name: "Script Memory Usage",
    value: memoryMB,
    unit: "MB",
    status: getStatus(memoryMB, TARGETS.memoryUsage),
    target: TARGETS.memoryUsage.target,
  });

  // -------------------------------------------------------------------------
  // 4. Static Asset Loading
  // -------------------------------------------------------------------------
  log("▸ Testing Static Asset Loading...", "blue");
  const staticAssets = [`${baseUrl}/favicon.ico`, `${baseUrl}/manifest.json`];

  for (const asset of staticAssets) {
    const assetName = asset.split("/").pop() || "unknown";
    const assetResult = await benchmarkHttpEndpoint(asset, 3);

    if (assetResult.samples > 0) {
      results.push({
        name: `Static: ${assetName}`,
        value: assetResult.avgTime,
        unit: "ms",
        status: getStatus(assetResult.avgTime, {
          ...TARGETS.apiResponseTime,
          target: 100,
          warning: 200,
        }),
        target: 100,
        samples: assetResult.samples,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Results Summary
  // -------------------------------------------------------------------------
  log("\n═══════════════════════════════════════════════════════════════", "blue");
  log("  Results", "blue");
  log("═══════════════════════════════════════════════════════════════\n", "blue");

  let passed = 0;
  let warnings = 0;
  let failed = 0;

  for (const result of results) {
    console.log(formatResult(result));

    if (result.status === "pass") passed++;
    else if (result.status === "warning") warnings++;
    else failed++;
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  log("\n═══════════════════════════════════════════════════════════════", "blue");
  log("  Summary", "blue");
  log("═══════════════════════════════════════════════════════════════\n", "blue");

  log(`  Passed:   ${passed}`, "green");
  log(`  Warnings: ${warnings}`, "yellow");
  log(`  Failed:   ${failed}`, "red");
  log("");

  // -------------------------------------------------------------------------
  // Performance Grade
  // -------------------------------------------------------------------------
  const total = results.length;
  const score = (passed * 100 + warnings * 50) / total;
  let grade: string;
  let gradeColor: keyof typeof colors;

  if (score >= 90) {
    grade = "A";
    gradeColor = "green";
  } else if (score >= 80) {
    grade = "B";
    gradeColor = "green";
  } else if (score >= 70) {
    grade = "C";
    gradeColor = "yellow";
  } else if (score >= 60) {
    grade = "D";
    gradeColor = "yellow";
  } else {
    grade = "F";
    gradeColor = "red";
  }

  log(`  Performance Grade: ${grade} (${score.toFixed(1)}%)`, gradeColor);
  log("");

  // Exit code based on results
  if (failed > 0) {
    process.exit(1);
  } else if (warnings > 0) {
    process.exit(0);
  } else {
    process.exit(0);
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
IxStats Performance Benchmark Suite

Usage: npx tsx scripts/diagnostics/benchmark.ts [options]

Options:
  --help, -h     Show this help message
  --url URL      Set base URL (default: http://localhost:3000)

Environment Variables:
  BENCHMARK_URL  Base URL for benchmarks

Performance Targets:
  - API Response Time: <${TARGETS.apiResponseTime.target}ms (warning: ${TARGETS.apiResponseTime.warning}ms)
  - TTFB: <${TARGETS.ttfb.target}ms (warning: ${TARGETS.ttfb.warning}ms)
  - Memory Usage: <${TARGETS.memoryUsage.target}MB (warning: ${TARGETS.memoryUsage.warning}MB)
`);
  process.exit(0);
}

// Handle --url argument
const urlIndex = args.indexOf("--url");
if (urlIndex !== -1 && args[urlIndex + 1]) {
  process.env.BENCHMARK_URL = args[urlIndex + 1];
}

runBenchmarks().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
