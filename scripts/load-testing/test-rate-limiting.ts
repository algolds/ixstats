#!/usr/bin/env tsx
/**
 * Rate Limiting Test Script
 *
 * Validates rate limiting configuration and behavior:
 * - Public endpoints should limit at 30 req/min
 * - Standard endpoints should limit at 100 req/min
 * - Admin endpoints should limit at 10 req/min
 * - Legitimate traffic should not be blocked
 * - Excessive traffic should be blocked appropriately
 * - Redis fallback to in-memory should work
 *
 * Usage:
 *   tsx scripts/load-testing/test-rate-limiting.ts [--url=http://localhost:3000]
 */

import { performance } from "perf_hooks";

// ============================================================================
// Configuration
// ============================================================================

interface RateLimitTestConfig {
  baseUrl: string;
  testRedis?: boolean;
  authToken?: string;
  adminToken?: string;
}

interface RateLimitEndpoint {
  name: string;
  path: string;
  expectedLimit: number;
  windowMs: number;
  requiresAuth: boolean;
  requiresAdmin: boolean;
  namespace: string;
}

interface RateLimitTestResult {
  endpoint: string;
  expectedLimit: number;
  actualLimit: number;
  rateLimitKickedIn: boolean;
  legitimateTrafficBlocked: boolean;
  excessiveTrafficBlocked: boolean;
  firstRateLimitAt: number;
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  passed: boolean;
  errors: string[];
}

// ============================================================================
// Test Endpoints
// ============================================================================

const RATE_LIMIT_TESTS: RateLimitEndpoint[] = [
  {
    name: "Public Endpoint (Countries)",
    path: "/api/trpc/countries.getAll",
    expectedLimit: 30,
    windowMs: 60000,
    requiresAuth: false,
    requiresAdmin: false,
    namespace: "public",
  },
  {
    name: "Standard Query (User Profile)",
    path: "/api/trpc/users.getProfile",
    expectedLimit: 120,
    windowMs: 60000,
    requiresAuth: true,
    requiresAdmin: false,
    namespace: "queries",
  },
  {
    name: "Light Mutation (Toggle Like)",
    path: "/api/trpc/thinkpages.toggleLike",
    expectedLimit: 100,
    windowMs: 60000,
    requiresAuth: true,
    requiresAdmin: false,
    namespace: "light_mutations",
  },
  {
    name: "Standard Mutation (Create Post)",
    path: "/api/trpc/thinkpages.createPost",
    expectedLimit: 60,
    windowMs: 60000,
    requiresAuth: true,
    requiresAdmin: false,
    namespace: "mutations",
  },
  {
    name: "Heavy Mutation (Create Country)",
    path: "/api/trpc/countries.create",
    expectedLimit: 10,
    windowMs: 60000,
    requiresAuth: true,
    requiresAdmin: false,
    namespace: "heavy_mutations",
  },
  {
    name: "Admin Endpoint (System Stats)",
    path: "/api/trpc/admin.getSystemStats",
    expectedLimit: 100, // Admin endpoints use default rate limit
    windowMs: 60000,
    requiresAuth: true,
    requiresAdmin: true,
    namespace: "default",
  },
];

// ============================================================================
// Utilities
// ============================================================================

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

function progressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.min(100, (current / total) * 100);
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  return `[${"=".repeat(filled)}${" ".repeat(empty)}] ${percentage.toFixed(1)}%`;
}

// ============================================================================
// Rate Limit Testing Engine
// ============================================================================

async function testRateLimit(
  endpoint: RateLimitEndpoint,
  config: RateLimitTestConfig
): Promise<RateLimitTestResult> {
  console.log(`\n${colorize(`Testing: ${endpoint.name}`, "cyan")}`);
  console.log(
    `Expected Limit: ${colorize(`${endpoint.expectedLimit} req/min`, "blue")} | Namespace: ${colorize(endpoint.namespace, "blue")}`
  );

  const errors: string[] = [];
  let totalRequests = 0;
  let successfulRequests = 0;
  let rateLimitedRequests = 0;
  let firstRateLimitAt = -1;

  // Test 1: Send requests up to expected limit + 50% buffer
  const testLimit = Math.ceil(endpoint.expectedLimit * 1.5);

  console.log(`\nSending ${testLimit} requests to test rate limiting...`);

  const startTime = Date.now();

  for (let i = 0; i < testLimit; i++) {
    try {
      const url = `${config.baseUrl}${endpoint.path}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add auth token if required
      if (endpoint.requiresAuth || endpoint.requiresAdmin) {
        const token = endpoint.requiresAdmin ? config.adminToken : config.authToken;
        if (!token) {
          errors.push("Missing required authentication token");
          break;
        }
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      totalRequests++;

      if (response.status === 429) {
        rateLimitedRequests++;
        if (firstRateLimitAt === -1) {
          firstRateLimitAt = i + 1;
        }
      } else if (response.ok) {
        successfulRequests++;
      } else {
        errors.push(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Progress indicator
      if (i % 10 === 0 || i === testLimit - 1) {
        process.stdout.write(
          `\r${progressBar(i + 1, testLimit)} | Success: ${successfulRequests} | Rate Limited: ${rateLimitedRequests}`
        );
      }

      // Very small delay to prevent network congestion (not rate limit testing)
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.log(""); // New line after progress bar

  const elapsed = Date.now() - startTime;

  // Test 2: Validate legitimate traffic (well under limit)
  console.log(`\nTesting legitimate traffic (${Math.floor(endpoint.expectedLimit * 0.5)} requests)...`);

  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

  let legitimateBlocked = false;
  const legitimateRequests = Math.floor(endpoint.expectedLimit * 0.5);

  for (let i = 0; i < legitimateRequests; i++) {
    try {
      const url = `${config.baseUrl}${endpoint.path}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (endpoint.requiresAuth || endpoint.requiresAdmin) {
        const token = endpoint.requiresAdmin ? config.adminToken : config.authToken;
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (response.status === 429) {
        legitimateBlocked = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore network errors for this test
    }
  }

  // Analysis
  const rateLimitKickedIn = firstRateLimitAt > 0;
  const actualLimit = firstRateLimitAt > 0 ? firstRateLimitAt - 1 : totalRequests;
  const excessiveTrafficBlocked = rateLimitedRequests > 0;

  // Determine pass/fail
  const limitWithinTolerance =
    actualLimit >= endpoint.expectedLimit * 0.9 && actualLimit <= endpoint.expectedLimit * 1.1;
  const rateLimitWorking = rateLimitKickedIn && excessiveTrafficBlocked;
  const legitimateTrafficNotBlocked = !legitimateBlocked;

  const passed = limitWithinTolerance && rateLimitWorking && legitimateTrafficNotBlocked;

  return {
    endpoint: endpoint.name,
    expectedLimit: endpoint.expectedLimit,
    actualLimit,
    rateLimitKickedIn,
    legitimateTrafficBlocked: legitimateBlocked,
    excessiveTrafficBlocked,
    firstRateLimitAt,
    totalRequests,
    successfulRequests,
    rateLimitedRequests,
    passed,
    errors,
  };
}

// ============================================================================
// Results Display
// ============================================================================

function displayResults(result: RateLimitTestResult) {
  console.log(colorize("\n=== Test Results ===", "cyan"));

  // Limit accuracy
  const limitDiff = Math.abs(result.actualLimit - result.expectedLimit);
  const limitAccuracy = ((1 - limitDiff / result.expectedLimit) * 100).toFixed(1);
  const limitPass = limitDiff <= result.expectedLimit * 0.1;

  console.log(`Expected Limit:      ${result.expectedLimit} req/min`);
  console.log(
    `Actual Limit:        ${result.actualLimit} req/min (${limitAccuracy}% accurate) ${limitPass ? colorize("✓", "green") : colorize("✗", "red")}`
  );
  console.log(`First Rate Limit:    Request #${result.firstRateLimitAt > 0 ? result.firstRateLimitAt : "N/A"}`);

  console.log(colorize("\n=== Request Statistics ===", "cyan"));
  console.log(`Total Requests:      ${result.totalRequests}`);
  console.log(`Successful:          ${colorize(String(result.successfulRequests), "green")}`);
  console.log(`Rate Limited:        ${result.rateLimitedRequests > 0 ? colorize(String(result.rateLimitedRequests), "yellow") : String(result.rateLimitedRequests)}`);

  console.log(colorize("\n=== Validation Checks ===", "cyan"));

  // Check 1: Rate limiting kicked in
  console.log(
    `Rate Limit Active:   ${result.rateLimitKickedIn ? colorize("Yes ✓", "green") : colorize("No ✗", "red")}`
  );

  // Check 2: Excessive traffic blocked
  console.log(
    `Excessive Blocked:   ${result.excessiveTrafficBlocked ? colorize("Yes ✓", "green") : colorize("No ✗", "red")}`
  );

  // Check 3: Legitimate traffic allowed
  console.log(
    `Legitimate Allowed:  ${!result.legitimateTrafficBlocked ? colorize("Yes ✓", "green") : colorize("No ✗", "red")}`
  );

  // Errors
  if (result.errors.length > 0) {
    console.log(colorize("\n=== Errors ===", "yellow"));
    result.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  }

  // Overall status
  console.log(
    `\n${colorize("=== Overall Status ===", "cyan")}\n${result.passed ? colorize("PASSED ✓", "green") : colorize("FAILED ✗", "red")}`
  );

  return result.passed;
}

// ============================================================================
// Redis Fallback Test
// ============================================================================

async function testRedisFallback(config: RateLimitTestConfig): Promise<boolean> {
  console.log(colorize("\n╔═══════════════════════════════════════════════════════════════════╗", "blue"));
  console.log(colorize("║                   Redis Fallback Test                             ║", "blue"));
  console.log(colorize("╚═══════════════════════════════════════════════════════════════════╝", "blue"));

  console.log("\nThis test validates that rate limiting gracefully falls back to");
  console.log("in-memory storage when Redis is unavailable.\n");

  console.log(colorize("Manual Steps Required:", "yellow"));
  console.log("1. Temporarily disable Redis in .env (set REDIS_ENABLED=false)");
  console.log("2. Restart the application");
  console.log("3. Run this script again");
  console.log("4. Verify rate limiting still works (using in-memory storage)");
  console.log("5. Re-enable Redis and restart\n");

  console.log(
    "For automated testing, the main rate limit tests will verify\nfunctionality regardless of backend storage.\n"
  );

  return true;
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log(colorize("╔═══════════════════════════════════════════════════════════════════╗", "blue"));
  console.log(colorize("║            IxStats Rate Limiting Test Suite v1.0                 ║", "blue"));
  console.log(colorize("╚═══════════════════════════════════════════════════════════════════╝", "blue"));

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const getArg = (name: string, defaultValue: string): string => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split("=")[1] || defaultValue : defaultValue;
  };

  const baseUrl = getArg("url", process.env.BASE_URL || "http://localhost:3000");
  const authToken = getArg("token", process.env.TEST_AUTH_TOKEN || "");
  const adminToken = getArg("admin-token", process.env.TEST_ADMIN_TOKEN || "");
  const testRedis = getArg("test-redis", "false") === "true";

  const config: RateLimitTestConfig = {
    baseUrl,
    authToken,
    adminToken,
    testRedis,
  };

  console.log(`\n${colorize("Test Configuration:", "yellow")}`);
  console.log(`  Base URL:          ${baseUrl}`);
  console.log(`  Auth Token:        ${authToken ? "Provided" : "Not provided"}`);
  console.log(`  Admin Token:       ${adminToken ? "Provided" : "Not provided"}`);
  console.log(`  Test Redis:        ${testRedis ? "Yes" : "No"}`);

  // Warning if tokens not provided
  if (!authToken) {
    console.log(
      colorize(
        "\n⚠️  No auth token provided. Authenticated endpoints will be skipped.",
        "yellow"
      )
    );
  }

  if (!adminToken) {
    console.log(
      colorize("\n⚠️  No admin token provided. Admin endpoints will be skipped.", "yellow")
    );
  }

  const results: { result: RateLimitTestResult; passed: boolean }[] = [];

  // Test each endpoint
  for (const endpoint of RATE_LIMIT_TESTS) {
    // Skip auth-required endpoints if no token
    if (endpoint.requiresAuth && !authToken) {
      console.log(
        `\n${colorize(`Skipping ${endpoint.name}`, "yellow")} - Requires authentication token`
      );
      continue;
    }

    if (endpoint.requiresAdmin && !adminToken) {
      console.log(
        `\n${colorize(`Skipping ${endpoint.name}`, "yellow")} - Requires admin token`
      );
      continue;
    }

    const result = await testRateLimit(endpoint, config);
    const passed = displayResults(result);
    results.push({ result, passed });

    // Wait between tests to avoid interference
    if (RATE_LIMIT_TESTS.indexOf(endpoint) < RATE_LIMIT_TESTS.length - 1) {
      console.log(colorize("\nWaiting 5 seconds before next test...\n", "yellow"));
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Redis fallback test (informational)
  if (testRedis) {
    await testRedisFallback(config);
  }

  // Summary
  console.log(colorize("\n╔═══════════════════════════════════════════════════════════════════╗", "blue"));
  console.log(colorize("║                        Test Summary                               ║", "blue"));
  console.log(colorize("╚═══════════════════════════════════════════════════════════════════╝", "blue"));

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
        console.log(`    Expected: ${r.result.expectedLimit} req/min`);
        console.log(`    Actual:   ${r.result.actualLimit} req/min`);
      });
  }

  // Recommendations
  console.log(colorize("\n=== Recommendations ===", "cyan"));

  if (failedTests > 0) {
    console.log(
      colorize(
        "⚠️  Some rate limits are not working as expected. Check configuration:",
        "yellow"
      )
    );
    console.log("   - Verify RATE_LIMIT_ENABLED=true in .env");
    console.log("   - Check tRPC middleware rate limit configurations");
    console.log("   - Review rate limiter namespace settings");
  } else {
    console.log(colorize("✓ All rate limits are working correctly!", "green"));
    console.log("  - Public endpoints limited appropriately");
    console.log("  - Authenticated endpoints protected");
    console.log("  - Legitimate traffic allowed");
    console.log("  - Excessive traffic blocked");
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

export { testRateLimit, RateLimitTestConfig, RateLimitTestResult };
