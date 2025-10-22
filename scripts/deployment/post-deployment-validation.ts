#!/usr/bin/env tsx

/**
 * Post-Deployment Validation Script for IxStats v1.2
 * Comprehensive validation of deployment success
 */

import { exit } from "process";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
  critical?: boolean;
}

interface ValidationReport {
  timestamp: string;
  environment: string;
  totalTests: number;
  passed: number;
  failed: number;
  criticalFailures: number;
  duration: number;
  tests: TestResult[];
}

/**
 * Print colored output
 */
function print(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print section header
 */
function printHeader(title: string) {
  console.log("\n" + "=".repeat(60));
  print(`  ${title}`, "cyan");
  console.log("=".repeat(60) + "\n");
}

/**
 * Test HTTP endpoint
 */
async function testEndpoint(
  url: string,
  expectedStatus = 200,
  timeout = 5000
): Promise<{ success: boolean; status?: number; time: number }> {
  const start = Date.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
    });

    const time = Date.now() - start;
    const success = response.status === expectedStatus;

    return { success, status: response.status, time };
  } catch (error) {
    const time = Date.now() - start;
    return { success: false, time };
  }
}

/**
 * Test 1: Application Health Check
 */
async function testHealthCheck(baseUrl: string): Promise<TestResult> {
  const start = Date.now();

  try {
    const result = await testEndpoint(`${baseUrl}/api/health`);

    return {
      name: "Health Check",
      passed: result.success,
      message: result.success
        ? `Health endpoint responding (${result.time}ms)`
        : `Health endpoint failed with status ${result.status || "timeout"}`,
      duration: Date.now() - start,
      critical: true,
    };
  } catch (error) {
    return {
      name: "Health Check",
      passed: false,
      message: `Health check failed: ${error}`,
      duration: Date.now() - start,
      critical: true,
    };
  }
}

/**
 * Test 2: Homepage Accessibility
 */
async function testHomepage(baseUrl: string): Promise<TestResult> {
  const start = Date.now();

  try {
    const result = await testEndpoint(baseUrl);

    return {
      name: "Homepage Accessibility",
      passed: result.success,
      message: result.success
        ? `Homepage accessible (${result.time}ms)`
        : `Homepage failed with status ${result.status || "timeout"}`,
      duration: Date.now() - start,
      critical: true,
    };
  } catch (error) {
    return {
      name: "Homepage Accessibility",
      passed: false,
      message: `Homepage test failed: ${error}`,
      duration: Date.now() - start,
      critical: true,
    };
  }
}

/**
 * Test 3: tRPC API
 */
async function testTRPCAPI(baseUrl: string): Promise<TestResult> {
  const start = Date.now();

  try {
    const result = await testEndpoint(`${baseUrl}/api/trpc/health.check`);

    return {
      name: "tRPC API",
      passed: result.success,
      message: result.success
        ? `tRPC API responding (${result.time}ms)`
        : `tRPC API failed with status ${result.status || "timeout"}`,
      duration: Date.now() - start,
      critical: true,
    };
  } catch (error) {
    return {
      name: "tRPC API",
      passed: false,
      message: `tRPC API test failed: ${error}`,
      duration: Date.now() - start,
      critical: true,
    };
  }
}

/**
 * Test 4: Database Connectivity
 */
async function testDatabase(): Promise<TestResult> {
  const start = Date.now();

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    await prisma.$connect();

    // Test a simple query
    const userCount = await prisma.user.count();

    await prisma.$disconnect();

    return {
      name: "Database Connectivity",
      passed: true,
      message: `Database accessible (${userCount} users)`,
      duration: Date.now() - start,
      critical: true,
    };
  } catch (error) {
    return {
      name: "Database Connectivity",
      passed: false,
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
      duration: Date.now() - start,
      critical: true,
    };
  }
}

/**
 * Test 5: Authentication System
 */
async function testAuthentication(): Promise<TestResult> {
  const start = Date.now();

  const clerkPublicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const nodeEnv = process.env.NODE_ENV;

  if (!clerkPublicKey || !clerkSecretKey) {
    return {
      name: "Authentication System",
      passed: true,
      message: "Authentication not configured (optional)",
      duration: Date.now() - start,
      critical: false,
    };
  }

  // Check for test keys in production
  if (nodeEnv === "production") {
    if (clerkPublicKey.startsWith("pk_test_") || clerkSecretKey.startsWith("sk_test_")) {
      return {
        name: "Authentication System",
        passed: false,
        message: "Using test Clerk keys in production",
        duration: Date.now() - start,
        critical: true,
      };
    }
  }

  return {
    name: "Authentication System",
    passed: true,
    message: "Clerk authentication properly configured",
    duration: Date.now() - start,
    critical: false,
  };
}

/**
 * Test 6: Static Assets
 */
async function testStaticAssets(baseUrl: string): Promise<TestResult> {
  const start = Date.now();

  try {
    // Test common static paths
    const assetPaths = [
      "/_next/static/css",
      "/flags/metadata.json",
    ];

    let allPassed = true;
    const results: string[] = [];

    for (const path of assetPaths) {
      const result = await testEndpoint(`${baseUrl}${path}`, 200, 3000);
      if (!result.success) {
        allPassed = false;
        results.push(`${path}: failed`);
      }
    }

    return {
      name: "Static Assets",
      passed: allPassed,
      message: allPassed
        ? "All static assets accessible"
        : `Some assets failed: ${results.join(", ")}`,
      duration: Date.now() - start,
      critical: false,
    };
  } catch (error) {
    return {
      name: "Static Assets",
      passed: false,
      message: `Static asset test failed: ${error}`,
      duration: Date.now() - start,
      critical: false,
    };
  }
}

/**
 * Test 7: Rate Limiting
 */
async function testRateLimiting(): Promise<TestResult> {
  const start = Date.now();

  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED;
  const redisEnabled = process.env.REDIS_ENABLED;
  const redisUrl = process.env.REDIS_URL;

  if (rateLimitEnabled !== "true") {
    return {
      name: "Rate Limiting",
      passed: true,
      message: "Rate limiting disabled (as configured)",
      duration: Date.now() - start,
      critical: false,
    };
  }

  if (redisEnabled === "true" && !redisUrl) {
    return {
      name: "Rate Limiting",
      passed: false,
      message: "Redis enabled but URL not configured",
      duration: Date.now() - start,
      critical: false,
    };
  }

  // Test Redis connection if enabled
  if (redisEnabled === "true" && redisUrl) {
    try {
      const Redis = (await import("ioredis")).default;
      const redis = new Redis(redisUrl);
      await redis.ping();
      await redis.quit();

      return {
        name: "Rate Limiting",
        passed: true,
        message: "Rate limiting with Redis operational",
        duration: Date.now() - start,
        critical: false,
      };
    } catch (error) {
      return {
        name: "Rate Limiting",
        passed: false,
        message: `Redis connection failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - start,
        critical: false,
      };
    }
  }

  return {
    name: "Rate Limiting",
    passed: true,
    message: "Rate limiting with in-memory fallback",
    duration: Date.now() - start,
    critical: false,
  };
}

/**
 * Test 8: External API Integrations
 */
async function testExternalAPIs(): Promise<TestResult> {
  const start = Date.now();

  const mediawikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL;
  const ixtimeBotUrl = process.env.IXTIME_BOT_URL;

  const results: string[] = [];
  let allPassed = true;

  // Test MediaWiki API
  if (mediawikiUrl) {
    try {
      const result = await testEndpoint(
        `${mediawikiUrl}api.php?action=query&meta=siteinfo&format=json`,
        200,
        5000
      );
      if (!result.success) {
        allPassed = false;
        results.push("MediaWiki API unreachable");
      }
    } catch (error) {
      allPassed = false;
      results.push("MediaWiki API error");
    }
  }

  // Test IxTime Bot
  if (ixtimeBotUrl) {
    try {
      const result = await testEndpoint(`${ixtimeBotUrl}/health`, 200, 5000);
      if (!result.success) {
        allPassed = false;
        results.push("IxTime Bot unreachable");
      }
    } catch (error) {
      allPassed = false;
      results.push("IxTime Bot error");
    }
  }

  return {
    name: "External API Integrations",
    passed: allPassed,
    message: allPassed
      ? "All external APIs accessible"
      : `Issues: ${results.join(", ")}`,
    duration: Date.now() - start,
    critical: false,
  };
}

/**
 * Test 9: Critical Features
 */
async function testCriticalFeatures(baseUrl: string): Promise<TestResult> {
  const start = Date.now();

  try {
    const endpoints = [
      { path: "/builder", name: "Country Builder" },
      { path: "/mycountry", name: "MyCountry Dashboard" },
      { path: "/countries", name: "Countries List" },
      { path: "/thinkpages", name: "ThinkPages" },
    ];

    const results: string[] = [];
    let allPassed = true;

    for (const endpoint of endpoints) {
      const result = await testEndpoint(`${baseUrl}${endpoint.path}`, 200, 5000);
      if (!result.success) {
        allPassed = false;
        results.push(endpoint.name);
      }
    }

    return {
      name: "Critical Features",
      passed: allPassed,
      message: allPassed
        ? "All critical pages accessible"
        : `Failed: ${results.join(", ")}`,
      duration: Date.now() - start,
      critical: false,
    };
  } catch (error) {
    return {
      name: "Critical Features",
      passed: false,
      message: `Feature test failed: ${error}`,
      duration: Date.now() - start,
      critical: false,
    };
  }
}

/**
 * Test 10: Performance Metrics
 */
async function testPerformance(baseUrl: string): Promise<TestResult> {
  const start = Date.now();

  try {
    // Test homepage load time
    const result = await testEndpoint(baseUrl, 200, 10000);

    if (!result.success) {
      return {
        name: "Performance Metrics",
        passed: false,
        message: "Homepage did not load",
        duration: Date.now() - start,
        critical: false,
      };
    }

    // Check if load time is acceptable (<3s)
    const acceptable = result.time < 3000;

    return {
      name: "Performance Metrics",
      passed: acceptable,
      message: acceptable
        ? `Page load time: ${result.time}ms (acceptable)`
        : `Page load time: ${result.time}ms (slow, >3s)`,
      duration: Date.now() - start,
      critical: false,
    };
  } catch (error) {
    return {
      name: "Performance Metrics",
      passed: false,
      message: `Performance test failed: ${error}`,
      duration: Date.now() - start,
      critical: false,
    };
  }
}

/**
 * Generate validation report
 */
function generateReport(report: ValidationReport): string {
  const criticalStatus = report.criticalFailures === 0 ? "✅ PASSED" : "❌ FAILED";
  const overallStatus = report.failed === 0 ? "✅ SUCCESS" : report.criticalFailures > 0 ? "❌ CRITICAL FAILURE" : "⚠️  WARNING";

  let markdown = `# Post-Deployment Validation Report

**Timestamp**: ${report.timestamp}
**Environment**: ${report.environment}
**Overall Status**: ${overallStatus}
**Duration**: ${report.duration}ms

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${report.totalTests} |
| Passed | ${report.passed} |
| Failed | ${report.failed} |
| Critical Failures | ${report.criticalFailures} |
| Success Rate | ${((report.passed / report.totalTests) * 100).toFixed(1)}% |

---

## Test Results

`;

  for (const test of report.tests) {
    const status = test.passed ? "✅" : test.critical ? "❌" : "⚠️";
    const critical = test.critical ? " (CRITICAL)" : "";
    const duration = test.duration ? ` [${test.duration}ms]` : "";

    markdown += `### ${status} ${test.name}${critical}${duration}

${test.message}

`;
  }

  markdown += `---

## Critical Systems Status

${criticalStatus}

`;

  if (report.criticalFailures > 0) {
    markdown += `⚠️  **CRITICAL FAILURES DETECTED**

The following critical systems failed validation:

`;
    for (const test of report.tests) {
      if (test.critical && !test.passed) {
        markdown += `- **${test.name}**: ${test.message}\n`;
      }
    }

    markdown += `
**ACTION REQUIRED**: These failures must be resolved immediately.
Consider rolling back the deployment if issues cannot be resolved quickly.

\`\`\`bash
./scripts/deployment/rollback-deployment.sh
\`\`\`
`;
  } else {
    markdown += `All critical systems are operational.\n`;
  }

  markdown += `
---

## Next Steps

`;

  if (report.criticalFailures > 0) {
    markdown += `1. ❌ **IMMEDIATE ACTION REQUIRED**: Fix critical failures
2. Consider rollback if issues cannot be resolved quickly
3. Review deployment logs for errors
4. Contact development team for assistance
`;
  } else if (report.failed > 0) {
    markdown += `1. ⚠️  Review non-critical failures above
2. Monitor application for issues
3. Address warnings when possible
4. Continue with post-deployment monitoring
`;
  } else {
    markdown += `1. ✅ All tests passed - deployment successful
2. Monitor application performance
3. Verify user reports
4. Update documentation
`;
  }

  markdown += `
---

**Report Generated**: ${new Date().toLocaleString()}
`;

  return markdown;
}

/**
 * Send Discord notification
 */
async function sendDiscordNotification(report: ValidationReport): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const webhookEnabled = process.env.DISCORD_WEBHOOK_ENABLED;

  if (!webhookUrl || webhookEnabled !== "true") {
    return;
  }

  const color =
    report.criticalFailures > 0
      ? 15158332 // Red
      : report.failed > 0
        ? 16776960 // Yellow
        : 3066993; // Green

  const title =
    report.criticalFailures > 0
      ? "❌ Post-Deployment Validation FAILED"
      : report.failed > 0
        ? "⚠️  Post-Deployment Validation: Warnings"
        : "✅ Post-Deployment Validation PASSED";

  const description = `Environment: ${report.environment}
Tests: ${report.passed}/${report.totalTests} passed
Critical Failures: ${report.criticalFailures}
Duration: ${report.duration}ms`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (error) {
    print(`⚠️  Failed to send Discord notification: ${error}`, "yellow");
  }
}

/**
 * Main validation function
 */
async function main() {
  console.clear();

  print("╔═══════════════════════════════════════════════════════╗", "cyan");
  print("║                                                       ║", "cyan");
  print("║   IxStats v1.2 - Post-Deployment Validation          ║", "cyan");
  print("║                                                       ║", "cyan");
  print("╚═══════════════════════════════════════════════════════╝", "cyan");

  const validationStart = Date.now();
  const nodeEnv = process.env.NODE_ENV || "development";
  const port = process.env.PORT || "3550";
  const basePath = process.env.BASE_PATH || "/projects/ixstats";
  const baseUrl = `http://localhost:${port}${basePath}`;

  print(`\nEnvironment: ${nodeEnv}`, "blue");
  print(`Base URL: ${baseUrl}`, "blue");
  print(`Timestamp: ${new Date().toLocaleString()}`, "blue");

  const tests: TestResult[] = [];

  // Run all tests
  printHeader("Running Validation Tests");

  print("Test 1/10: Health Check", "cyan");
  tests.push(await testHealthCheck(baseUrl));
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `❌ ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "red"
  );

  print("\nTest 2/10: Homepage Accessibility", "cyan");
  tests.push(await testHomepage(baseUrl));
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `❌ ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "red"
  );

  print("\nTest 3/10: tRPC API", "cyan");
  tests.push(await testTRPCAPI(baseUrl));
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `❌ ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "red"
  );

  print("\nTest 4/10: Database Connectivity", "cyan");
  tests.push(await testDatabase());
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `❌ ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "red"
  );

  print("\nTest 5/10: Authentication System", "cyan");
  tests.push(await testAuthentication());
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `❌ ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "red"
  );

  print("\nTest 6/10: Static Assets", "cyan");
  tests.push(await testStaticAssets(baseUrl));
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `⚠️  ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "yellow"
  );

  print("\nTest 7/10: Rate Limiting", "cyan");
  tests.push(await testRateLimiting());
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `⚠️  ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "yellow"
  );

  print("\nTest 8/10: External API Integrations", "cyan");
  tests.push(await testExternalAPIs());
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `⚠️  ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "yellow"
  );

  print("\nTest 9/10: Critical Features", "cyan");
  tests.push(await testCriticalFeatures(baseUrl));
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `⚠️  ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "yellow"
  );

  print("\nTest 10/10: Performance Metrics", "cyan");
  tests.push(await testPerformance(baseUrl));
  print(
    tests[tests.length - 1]!.passed
      ? `✅ ${tests[tests.length - 1]!.message}`
      : `⚠️  ${tests[tests.length - 1]!.message}`,
    tests[tests.length - 1]!.passed ? "green" : "yellow"
  );

  // Generate report
  const validationDuration = Date.now() - validationStart;
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed).length;
  const criticalFailures = tests.filter((t) => t.critical && !t.passed).length;

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    environment: nodeEnv,
    totalTests: tests.length,
    passed,
    failed,
    criticalFailures,
    duration: validationDuration,
    tests,
  };

  // Print summary
  printHeader("Validation Summary");

  print(`Total Tests: ${report.totalTests}`, "blue");
  print(`Passed: ${report.passed}`, "green");
  print(`Failed: ${report.failed}`, report.failed > 0 ? "red" : "green");
  print(
    `Critical Failures: ${report.criticalFailures}`,
    report.criticalFailures > 0 ? "red" : "green"
  );
  print(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`, "blue");
  print(`Duration: ${validationDuration}ms`, "blue");

  // Save report
  const reportPath = `deployment-logs/validation-report-${Date.now()}.md`;
  const reportContent = generateReport(report);

  try {
    const { writeFileSync } = await import("fs");
    writeFileSync(reportPath, reportContent);
    print(`\n📄 Report saved: ${reportPath}`, "cyan");
  } catch (error) {
    print(`⚠️  Failed to save report: ${error}`, "yellow");
  }

  // Send Discord notification
  await sendDiscordNotification(report);

  // Final result
  print("\n" + "=".repeat(60), "cyan");

  if (report.criticalFailures > 0) {
    print("\n❌ CRITICAL FAILURES DETECTED", "red");
    print("Deployment validation FAILED", "red");
    print("\nAction required: Fix critical issues or rollback deployment", "yellow");
    print("Run: ./scripts/deployment/rollback-deployment.sh", "yellow");
    exit(1);
  } else if (report.failed > 0) {
    print("\n⚠️  VALIDATION COMPLETED WITH WARNINGS", "yellow");
    print("Some non-critical tests failed", "yellow");
    print("\nMonitor application and address warnings", "blue");
    exit(0);
  } else {
    print("\n✅ VALIDATION PASSED", "green");
    print("All tests passed successfully", "green");
    print("\nDeployment verified - application is ready", "green");
    exit(0);
  }
}

// Run validation
main().catch((error) => {
  print(`\n❌ Validation failed: ${error}`, "red");
  exit(1);
});
