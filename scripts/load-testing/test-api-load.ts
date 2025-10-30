#!/usr/bin/env tsx
/**
 * API Load Testing Script
 *
 * Tests IxStats platform under various load scenarios:
 * - 50, 100, and 200 concurrent users
 * - Critical endpoints (auth, country creation, data fetching)
 * - Response time measurements (p50, p95, p99)
 * - Error rate tracking
 * - Rate limiting validation
 *
 * Usage:
 *   tsx scripts/load-testing/test-api-load.ts [--users=100] [--duration=60] [--endpoint=all]
 */

import { performance } from "perf_hooks";

// ============================================================================
// Configuration
// ============================================================================

interface LoadTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  duration: number; // seconds
  targetEndpoint?: string;
  authToken?: string;
}

interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: Map<string, number>;
}

interface EndpointDefinition {
  name: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  requiresAuth: boolean;
  category: "read" | "write" | "heavy";
}

// ============================================================================
// Test Endpoints
// ============================================================================

const TEST_ENDPOINTS: EndpointDefinition[] = [
  // Read operations (should be fast)
  {
    name: "Get All Countries",
    path: "/api/trpc/countries.getAll",
    method: "GET",
    requiresAuth: false,
    category: "read",
  },
  {
    name: "Get Country by Slug",
    path: "/api/trpc/countries.getBySlug?input=%7B%22slug%22%3A%22test-country%22%7D",
    method: "GET",
    requiresAuth: false,
    category: "read",
  },
  {
    name: "Get User Profile",
    path: "/api/trpc/users.getProfile",
    method: "GET",
    requiresAuth: true,
    category: "read",
  },
  {
    name: "Get Economic Data",
    path: "/api/trpc/enhancedEconomics.getCountryEconomics?input=%7B%22countryId%22%3A1%7D",
    method: "GET",
    requiresAuth: false,
    category: "read",
  },
  {
    name: "Get MyCountry Dashboard",
    path: "/api/trpc/mycountry.getDashboard",
    method: "GET",
    requiresAuth: true,
    category: "read",
  },
  // Write operations (moderate load)
  {
    name: "Update Country Name",
    path: "/api/trpc/countries.update",
    method: "POST",
    requiresAuth: true,
    category: "write",
    body: {
      id: 1,
      name: "Test Country Updated",
    },
  },
  {
    name: "Create ThinkPages Post",
    path: "/api/trpc/thinkpages.createPost",
    method: "POST",
    requiresAuth: true,
    category: "write",
    body: {
      content: "Load test post",
      visibility: "public",
    },
  },
  // Heavy operations (resource intensive)
  {
    name: "Create Country (Heavy)",
    path: "/api/trpc/countries.create",
    method: "POST",
    requiresAuth: true,
    category: "heavy",
    body: {
      name: "Load Test Country",
      slug: "load-test-country",
      description: "Created during load testing",
      population: 1000000,
      gdp: 50000000000,
    },
  },
  {
    name: "Calculate Economy (Heavy)",
    path: "/api/trpc/formulas.calculateGDPGrowth",
    method: "POST",
    requiresAuth: true,
    category: "heavy",
    body: {
      countryId: 1,
    },
  },
];

// ============================================================================
// Utilities
// ============================================================================

function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)] ?? 0;
}

function colorize(text: string, color: "green" | "yellow" | "red" | "blue" | "cyan"): string {
  const colors = {
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
  };
  return `${colors[color]}${text}\x1b[0m`;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function progressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.min(100, (current / total) * 100);
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  return `[${"=".repeat(filled)}${" ".repeat(empty)}] ${percentage.toFixed(1)}%`;
}

// ============================================================================
// Load Testing Engine
// ============================================================================

async function makeRequest(
  endpoint: EndpointDefinition,
  config: LoadTestConfig
): Promise<{ success: boolean; responseTime: number; error?: string; rateLimited: boolean }> {
  const startTime = performance.now();

  try {
    const url = `${config.baseUrl}${endpoint.path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (endpoint.requiresAuth && config.authToken) {
      headers["Authorization"] = `Bearer ${config.authToken}`;
    }

    const options: RequestInit = {
      method: endpoint.method,
      headers,
    };

    if (endpoint.body && (endpoint.method === "POST" || endpoint.method === "PUT")) {
      options.body = JSON.stringify(endpoint.body);
    }

    const response = await fetch(url, options);
    const responseTime = performance.now() - startTime;

    // Check for rate limiting
    const rateLimited = response.status === 429;

    if (!response.ok && !rateLimited) {
      const errorText = await response.text();
      return {
        success: false,
        responseTime,
        error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
        rateLimited: false,
      };
    }

    return {
      success: response.ok,
      responseTime,
      rateLimited,
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      rateLimited: false,
    };
  }
}

async function runLoadTest(
  endpoint: EndpointDefinition,
  config: LoadTestConfig
): Promise<LoadTestResult> {
  console.log(`\n${colorize(`Testing: ${endpoint.name}`, "cyan")}`);
  console.log(
    `${colorize(`Category: ${endpoint.category.toUpperCase()}`, "blue")} | ${colorize(`Method: ${endpoint.method}`, "blue")} | ${colorize(`Auth: ${endpoint.requiresAuth ? "Required" : "Public"}`, "blue")}`
  );

  const responseTimes: number[] = [];
  const errors = new Map<string, number>();
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let rateLimitedRequests = 0;

  const startTime = Date.now();
  const endTime = startTime + config.duration * 1000;

  // Create concurrent user workers
  const workers: Promise<void>[] = [];

  for (let i = 0; i < config.concurrentUsers; i++) {
    const worker = async () => {
      while (Date.now() < endTime) {
        const result = await makeRequest(endpoint, config);

        totalRequests++;
        responseTimes.push(result.responseTime);

        if (result.rateLimited) {
          rateLimitedRequests++;
        } else if (result.success) {
          successfulRequests++;
        } else {
          failedRequests++;
          if (result.error) {
            errors.set(result.error, (errors.get(result.error) || 0) + 1);
          }
        }

        // Progress indicator
        if (totalRequests % 100 === 0) {
          const elapsed = Date.now() - startTime;
          const remaining = endTime - Date.now();
          process.stdout.write(
            `\r${progressBar(elapsed, config.duration * 1000)} | Requests: ${totalRequests} | Success: ${successfulRequests} | Failed: ${failedRequests} | Rate Limited: ${rateLimitedRequests}`
          );
        }

        // Small delay to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };

    workers.push(worker());
  }

  await Promise.all(workers);
  console.log(""); // New line after progress bar

  const actualDuration = (Date.now() - startTime) / 1000;

  // Calculate statistics
  responseTimes.sort((a, b) => a - b);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minResponseTime = responseTimes[0] || 0;
  const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
  const p50ResponseTime = calculatePercentile(responseTimes, 50);
  const p95ResponseTime = calculatePercentile(responseTimes, 95);
  const p99ResponseTime = calculatePercentile(responseTimes, 99);
  const requestsPerSecond = totalRequests / actualDuration;
  const errorRate = (failedRequests / totalRequests) * 100;

  return {
    endpoint: endpoint.name,
    totalRequests,
    successfulRequests,
    failedRequests,
    rateLimitedRequests,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    p50ResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    requestsPerSecond,
    errorRate,
    errors,
  };
}

// ============================================================================
// Results Display
// ============================================================================

function displayResults(
  result: LoadTestResult,
  targets: { p95: number; p99: number; errorRate: number }
) {
  console.log(colorize("\n=== Test Results ===", "cyan"));
  console.log(`Total Requests:      ${result.totalRequests}`);
  console.log(
    `Successful:          ${colorize(String(result.successfulRequests), "green")} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%)`
  );
  console.log(
    `Failed:              ${result.failedRequests > 0 ? colorize(String(result.failedRequests), "red") : String(result.failedRequests)} (${((result.failedRequests / result.totalRequests) * 100).toFixed(2)}%)`
  );
  console.log(
    `Rate Limited:        ${result.rateLimitedRequests > 0 ? colorize(String(result.rateLimitedRequests), "yellow") : String(result.rateLimitedRequests)} (${((result.rateLimitedRequests / result.totalRequests) * 100).toFixed(2)}%)`
  );
  console.log(`Requests/Second:     ${result.requestsPerSecond.toFixed(2)}`);

  console.log(colorize("\n=== Response Times ===", "cyan"));
  console.log(`Average:             ${formatMs(result.avgResponseTime)}`);
  console.log(`Min:                 ${formatMs(result.minResponseTime)}`);
  console.log(`Max:                 ${formatMs(result.maxResponseTime)}`);

  // P50 check
  const p50Pass = result.p50ResponseTime < targets.p95;
  console.log(
    `P50 (Median):        ${formatMs(result.p50ResponseTime)} ${p50Pass ? colorize("✓", "green") : colorize("✗", "red")}`
  );

  // P95 check
  const p95Pass = result.p95ResponseTime < targets.p95;
  console.log(
    `P95:                 ${formatMs(result.p95ResponseTime)} ${p95Pass ? colorize("✓", "green") : colorize(`✗ (target: ${targets.p95}ms)`, "red")}`
  );

  // P99 check
  const p99Pass = result.p99ResponseTime < targets.p99;
  console.log(
    `P99:                 ${formatMs(result.p99ResponseTime)} ${p99Pass ? colorize("✓", "green") : colorize(`✗ (target: ${targets.p99}ms)`, "red")}`
  );

  // Error rate check
  const errorRatePass = result.errorRate < targets.errorRate;
  console.log(
    `\nError Rate:          ${result.errorRate.toFixed(2)}% ${errorRatePass ? colorize("✓", "green") : colorize(`✗ (target: <${targets.errorRate}%)`, "red")}`
  );

  // Display errors if any
  if (result.errors.size > 0) {
    console.log(colorize("\n=== Errors ===", "yellow"));
    for (const [error, count] of result.errors.entries()) {
      console.log(`  ${count}x: ${error}`);
    }
  }

  // Overall pass/fail
  const overallPass = p95Pass && p99Pass && errorRatePass;
  console.log(
    `\n${colorize("=== Overall Status ===", "cyan")}\n${overallPass ? colorize("PASSED ✓", "green") : colorize("FAILED ✗", "red")}`
  );

  return overallPass;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log(
    colorize("╔═══════════════════════════════════════════════════════════════════╗", "blue")
  );
  console.log(
    colorize("║              IxStats API Load Testing Suite v1.0                 ║", "blue")
  );
  console.log(
    colorize("╚═══════════════════════════════════════════════════════════════════╝", "blue")
  );

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const getArg = (name: string, defaultValue: string): string => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split("=")[1] || defaultValue : defaultValue;
  };

  const concurrentUsers = parseInt(getArg("users", "50"), 10);
  const duration = parseInt(getArg("duration", "30"), 10);
  const targetEndpoint = getArg("endpoint", "all");
  const baseUrl = getArg("url", process.env.BASE_URL || "http://localhost:3000");
  const authToken = getArg("token", process.env.TEST_AUTH_TOKEN || "");

  const config: LoadTestConfig = {
    baseUrl,
    concurrentUsers,
    duration,
    targetEndpoint,
    authToken,
  };

  console.log(`\n${colorize("Test Configuration:", "yellow")}`);
  console.log(`  Base URL:          ${baseUrl}`);
  console.log(`  Concurrent Users:  ${concurrentUsers}`);
  console.log(`  Test Duration:     ${duration}s per endpoint`);
  console.log(`  Target Endpoint:   ${targetEndpoint}`);
  console.log(
    `  Auth Token:        ${authToken ? "Provided" : "Not provided (public endpoints only)"}`
  );

  // Filter endpoints
  const endpointsToTest =
    targetEndpoint === "all"
      ? TEST_ENDPOINTS
      : TEST_ENDPOINTS.filter((e) => e.name.toLowerCase().includes(targetEndpoint.toLowerCase()));

  if (endpointsToTest.length === 0) {
    console.error(colorize(`\nNo endpoints found matching: ${targetEndpoint}`, "red"));
    process.exit(1);
  }

  console.log(`\n${colorize(`Testing ${endpointsToTest.length} endpoint(s)...`, "cyan")}`);

  const results: { result: LoadTestResult; passed: boolean }[] = [];

  for (const endpoint of endpointsToTest) {
    // Skip auth-required endpoints if no token provided
    if (endpoint.requiresAuth && !authToken) {
      console.log(
        `\n${colorize(`Skipping ${endpoint.name}`, "yellow")} - Requires authentication token`
      );
      continue;
    }

    // Set performance targets based on category
    const targets =
      endpoint.category === "read"
        ? { p95: 500, p99: 1000, errorRate: 1 }
        : endpoint.category === "write"
          ? { p95: 1000, p99: 2000, errorRate: 1 }
          : { p95: 2000, p99: 5000, errorRate: 5 }; // heavy operations

    const result = await runLoadTest(endpoint, config);
    const passed = displayResults(result, targets);
    results.push({ result, passed });

    // Wait between tests
    if (endpointsToTest.indexOf(endpoint) < endpointsToTest.length - 1) {
      console.log(colorize("\nWaiting 5 seconds before next test...\n", "yellow"));
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Summary
  console.log(
    colorize("\n╔═══════════════════════════════════════════════════════════════════╗", "blue")
  );
  console.log(
    colorize("║                        Test Summary                               ║", "blue")
  );
  console.log(
    colorize("╚═══════════════════════════════════════════════════════════════════╝", "blue")
  );

  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`\nTotal Tests:    ${totalTests}`);
  console.log(
    `Passed:         ${colorize(String(passedTests), "green")} (${((passedTests / totalTests) * 100).toFixed(1)}%)`
  );
  console.log(
    `Failed:         ${failedTests > 0 ? colorize(String(failedTests), "red") : String(failedTests)} (${((failedTests / totalTests) * 100).toFixed(1)}%)`
  );

  // List failed tests
  if (failedTests > 0) {
    console.log(colorize("\nFailed Tests:", "red"));
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.result.endpoint}`);
      });
  }

  // Exit code
  const exitCode = failedTests > 0 ? 1 : 0;
  console.log(
    `\n${exitCode === 0 ? colorize("All tests passed! ✓", "green") : colorize("Some tests failed! ✗", "red")}\n`
  );
  process.exit(exitCode);
}

// Run if executed directly
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(colorize("\nFatal error:", "red"), error);
    process.exit(1);
  });
}

export { runLoadTest, LoadTestConfig, LoadTestResult };
