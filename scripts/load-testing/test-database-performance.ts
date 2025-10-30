#!/usr/bin/env tsx
/**
 * Database Performance Test Script
 *
 * Tests database operations under load:
 * - Complex queries with full relations
 * - Concurrent write operations (10+ simultaneous)
 * - Query execution time measurements
 * - Connection pool health
 * - Transaction handling under load
 *
 * Usage:
 *   tsx scripts/load-testing/test-database-performance.ts [--concurrent=10] [--iterations=100]
 */

import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

// ============================================================================
// Configuration
// ============================================================================

interface DatabaseTestConfig {
  concurrentWrites: number;
  iterations: number;
  testComplexQueries: boolean;
  testTransactions: boolean;
  cleanupAfter: boolean;
}

interface QueryTestResult {
  name: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p95Time: number;
  p99Time: number;
  successCount: number;
  errorCount: number;
  passed: boolean;
}

interface ConcurrentWriteResult {
  totalWrites: number;
  successfulWrites: number;
  failedWrites: number;
  averageTime: number;
  connectionPoolExhausted: boolean;
  raceConditionsDetected: number;
  passed: boolean;
}

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

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)] ?? 0;
}

function progressBar(current: number, total: number, width: number = 40): string {
  const percentage = Math.min(100, (current / total) * 100);
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  return `[${"=".repeat(filled)}${" ".repeat(empty)}] ${percentage.toFixed(1)}%`;
}

// ============================================================================
// Database Test Functions
// ============================================================================

/**
 * Test 1: Complex Query Performance
 * Measures execution time for queries with deep relations
 */
async function testComplexQueries(db: PrismaClient, iterations: number): Promise<QueryTestResult> {
  console.log(colorize("\n=== Testing Complex Queries ===", "cyan"));
  console.log("Query: Country with full relations (economy, government, diplomatic, etc.)\n");

  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < iterations; i++) {
    try {
      const startTime = performance.now();

      // Complex query with multiple nested relations
      await db.country.findFirst({
        include: {
          creator: true,
          economy: {
            include: {
              atomicEconomicComponents: true,
              taxSystem: {
                include: {
                  atomicTaxComponents: true,
                },
              },
            },
          },
          government: {
            include: {
              atomicGovernmentComponents: true,
            },
          },
          nationalIdentity: true,
          embassiesHosted: {
            include: {
              country: true,
            },
          },
          embassiesAbroad: {
            include: {
              hostCountry: true,
            },
          },
          posts: {
            take: 10,
            include: {
              author: true,
            },
          },
        },
      });

      const endTime = performance.now();
      times.push(endTime - startTime);
      successCount++;

      // Progress indicator
      if (i % 10 === 0 || i === iterations - 1) {
        process.stdout.write(
          `\r${progressBar(i + 1, iterations)} | Success: ${successCount} | Errors: ${errorCount}`
        );
      }
    } catch (error) {
      errorCount++;
      console.error(`\nError in iteration ${i + 1}:`, error);
    }
  }

  console.log(""); // New line after progress bar

  times.sort((a, b) => a - b);

  const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = times[0] || 0;
  const maxTime = times[times.length - 1] || 0;
  const p95Time = calculatePercentile(times, 95);
  const p99Time = calculatePercentile(times, 99);

  // Pass if p95 < 500ms and p99 < 1000ms
  const passed = p95Time < 500 && p99Time < 1000 && errorCount === 0;

  return {
    name: "Complex Query Performance",
    averageTime,
    minTime,
    maxTime,
    p95Time,
    p99Time,
    successCount,
    errorCount,
    passed,
  };
}

/**
 * Test 2: Concurrent Write Performance
 * Tests simultaneous country creation operations
 */
async function testConcurrentWrites(
  db: PrismaClient,
  concurrentCount: number,
  iterations: number
): Promise<ConcurrentWriteResult> {
  console.log(colorize("\n=== Testing Concurrent Writes ===", "cyan"));
  console.log(`Concurrent Operations: ${concurrentCount}\n`);

  const times: number[] = [];
  let successfulWrites = 0;
  let failedWrites = 0;
  let connectionPoolExhausted = false;
  let raceConditionsDetected = 0;

  // Create a test user first
  let testUserId: string;
  try {
    const testUser = await db.user.findFirst({
      where: {
        clerkUserId: { startsWith: "load_test_" },
      },
    });

    if (testUser) {
      testUserId = testUser.id;
    } else {
      const newUser = await db.user.create({
        data: {
          clerkUserId: `load_test_${Date.now()}`,
          email: `loadtest${Date.now()}@example.com`,
          displayName: "Load Test User",
        },
      });
      testUserId = newUser.id;
    }
  } catch (error) {
    console.error(colorize("Failed to create test user:", "red"), error);
    return {
      totalWrites: 0,
      successfulWrites: 0,
      failedWrites: 0,
      averageTime: 0,
      connectionPoolExhausted: true,
      raceConditionsDetected: 0,
      passed: false,
    };
  }

  for (let batch = 0; batch < Math.ceil(iterations / concurrentCount); batch++) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrentCount; i++) {
      const uniqueId = batch * concurrentCount + i;

      const promise = (async () => {
        const startTime = performance.now();

        try {
          // Test concurrent country creation
          await db.country.create({
            data: {
              name: `Load Test Country ${uniqueId}`,
              slug: `load-test-country-${uniqueId}-${Date.now()}`,
              description: "Created during database load testing",
              population: Math.floor(Math.random() * 10000000) + 100000,
              gdp: Math.floor(Math.random() * 100000000000) + 1000000000,
              creatorId: testUserId,
            },
          });

          const endTime = performance.now();
          times.push(endTime - startTime);
          successfulWrites++;
        } catch (error) {
          failedWrites++;

          const errorMessage = error instanceof Error ? error.message : String(error);

          if (errorMessage.includes("connection") || errorMessage.includes("pool")) {
            connectionPoolExhausted = true;
          }

          if (errorMessage.includes("unique") || errorMessage.includes("constraint")) {
            raceConditionsDetected++;
          }

          console.error(
            `\nWrite error (batch ${batch}, item ${i}):`,
            errorMessage.substring(0, 100)
          );
        }
      })();

      promises.push(promise);
    }

    // Wait for all concurrent operations to complete
    await Promise.all(promises);

    // Progress indicator
    const completedIterations = Math.min((batch + 1) * concurrentCount, iterations);
    process.stdout.write(
      `\r${progressBar(completedIterations, iterations)} | Success: ${successfulWrites} | Failed: ${failedWrites}`
    );
  }

  console.log(""); // New line after progress bar

  const averageTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const totalWrites = successfulWrites + failedWrites;

  // Pass if no connection pool exhaustion and >95% success rate
  const successRate = (successfulWrites / totalWrites) * 100;
  const passed = !connectionPoolExhausted && successRate > 95 && raceConditionsDetected === 0;

  return {
    totalWrites,
    successfulWrites,
    failedWrites,
    averageTime,
    connectionPoolExhausted,
    raceConditionsDetected,
    passed,
  };
}

/**
 * Test 3: Transaction Performance
 * Tests complex transactions with multiple operations
 */
async function testTransactions(db: PrismaClient, iterations: number): Promise<QueryTestResult> {
  console.log(colorize("\n=== Testing Transaction Performance ===", "cyan"));
  console.log("Testing multi-operation transactions under load\n");

  const times: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Create test user
  let testUserId: string;
  try {
    const testUser = await db.user.findFirst({
      where: {
        clerkUserId: { startsWith: "load_test_" },
      },
    });

    if (testUser) {
      testUserId = testUser.id;
    } else {
      const newUser = await db.user.create({
        data: {
          clerkUserId: `load_test_${Date.now()}`,
          email: `loadtest${Date.now()}@example.com`,
          displayName: "Load Test User",
        },
      });
      testUserId = newUser.id;
    }
  } catch (error) {
    console.error(colorize("Failed to create test user:", "red"), error);
    return {
      name: "Transaction Performance",
      averageTime: 0,
      minTime: 0,
      maxTime: 0,
      p95Time: 0,
      p99Time: 0,
      successCount: 0,
      errorCount: 1,
      passed: false,
    };
  }

  for (let i = 0; i < iterations; i++) {
    try {
      const startTime = performance.now();

      // Complex transaction: Create country with economy and government
      await db.$transaction(async (tx) => {
        const country = await tx.country.create({
          data: {
            name: `Transaction Test Country ${i}`,
            slug: `transaction-test-${i}-${Date.now()}`,
            description: "Created in transaction test",
            population: 1000000,
            gdp: 50000000000,
            creatorId: testUserId,
          },
        });

        await tx.economy.create({
          data: {
            countryId: country.id,
            gdp: country.gdp,
            gdpGrowthRate: 2.5,
            unemploymentRate: 5.0,
            inflationRate: 2.0,
          },
        });

        await tx.government.create({
          data: {
            countryId: country.id,
            governmentType: "Democracy",
            headOfState: "Test Leader",
            capitalCity: "Test Capital",
          },
        });
      });

      const endTime = performance.now();
      times.push(endTime - startTime);
      successCount++;

      // Progress indicator
      if (i % 10 === 0 || i === iterations - 1) {
        process.stdout.write(
          `\r${progressBar(i + 1, iterations)} | Success: ${successCount} | Errors: ${errorCount}`
        );
      }
    } catch (error) {
      errorCount++;
      console.error(`\nTransaction error in iteration ${i + 1}:`, error);
    }
  }

  console.log(""); // New line after progress bar

  times.sort((a, b) => a - b);

  const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = times[0] || 0;
  const maxTime = times[times.length - 1] || 0;
  const p95Time = calculatePercentile(times, 95);
  const p99Time = calculatePercentile(times, 99);

  // Pass if p95 < 2000ms and no errors
  const passed = p95Time < 2000 && errorCount === 0;

  return {
    name: "Transaction Performance",
    averageTime,
    minTime,
    maxTime,
    p95Time,
    p99Time,
    successCount,
    errorCount,
    passed,
  };
}

/**
 * Test 4: Connection Pool Health
 * Monitors connection pool status during load
 */
async function testConnectionPool(db: PrismaClient): Promise<boolean> {
  console.log(colorize("\n=== Testing Connection Pool Health ===", "cyan"));

  try {
    // Test rapid concurrent connections
    const testCount = 50;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < testCount; i++) {
      promises.push(
        db.country.findFirst({
          where: { id: 1 },
        })
      );
    }

    const startTime = performance.now();
    await Promise.all(promises);
    const endTime = performance.now();

    console.log(`\n✓ Successfully handled ${testCount} concurrent connections`);
    console.log(`  Total time: ${formatMs(endTime - startTime)}`);
    console.log(`  Average per query: ${formatMs((endTime - startTime) / testCount)}`);

    return true;
  } catch (error) {
    console.error(colorize("\n✗ Connection pool test failed:", "red"), error);
    return false;
  }
}

// ============================================================================
// Cleanup Function
// ============================================================================

async function cleanup(db: PrismaClient): Promise<void> {
  console.log(colorize("\n=== Cleaning Up Test Data ===", "yellow"));

  try {
    // Delete test countries
    const deletedCountries = await db.country.deleteMany({
      where: {
        OR: [
          { name: { startsWith: "Load Test Country" } },
          { name: { startsWith: "Transaction Test Country" } },
        ],
      },
    });

    console.log(`✓ Deleted ${deletedCountries.count} test countries`);

    // Delete test users
    const deletedUsers = await db.user.deleteMany({
      where: {
        clerkUserId: { startsWith: "load_test_" },
      },
    });

    console.log(`✓ Deleted ${deletedUsers.count} test users`);
  } catch (error) {
    console.error(colorize("Cleanup failed:", "red"), error);
  }
}

// ============================================================================
// Results Display
// ============================================================================

function displayQueryResults(result: QueryTestResult) {
  console.log(colorize(`\n=== ${result.name} Results ===`, "cyan"));
  console.log(`Total Queries:       ${result.successCount + result.errorCount}`);
  console.log(`Successful:          ${colorize(String(result.successCount), "green")}`);
  console.log(
    `Errors:              ${result.errorCount > 0 ? colorize(String(result.errorCount), "red") : String(result.errorCount)}`
  );

  console.log(colorize("\n=== Query Times ===", "cyan"));
  console.log(`Average:             ${formatMs(result.averageTime)}`);
  console.log(`Min:                 ${formatMs(result.minTime)}`);
  console.log(`Max:                 ${formatMs(result.maxTime)}`);
  console.log(
    `P95:                 ${formatMs(result.p95Time)} ${result.p95Time < 500 ? colorize("✓", "green") : colorize("✗", "red")}`
  );
  console.log(
    `P99:                 ${formatMs(result.p99Time)} ${result.p99Time < 1000 ? colorize("✓", "green") : colorize("✗", "red")}`
  );

  console.log(
    `\n${colorize("Status:", "cyan")} ${result.passed ? colorize("PASSED ✓", "green") : colorize("FAILED ✗", "red")}`
  );
}

function displayConcurrentResults(result: ConcurrentWriteResult) {
  console.log(colorize("\n=== Concurrent Write Results ===", "cyan"));
  console.log(`Total Writes:        ${result.totalWrites}`);
  console.log(`Successful:          ${colorize(String(result.successfulWrites), "green")}`);
  console.log(
    `Failed:              ${result.failedWrites > 0 ? colorize(String(result.failedWrites), "red") : String(result.failedWrites)}`
  );
  console.log(
    `Success Rate:        ${((result.successfulWrites / result.totalWrites) * 100).toFixed(2)}%`
  );
  console.log(`Average Time:        ${formatMs(result.averageTime)}`);

  console.log(colorize("\n=== Health Checks ===", "cyan"));
  console.log(
    `Connection Pool:     ${result.connectionPoolExhausted ? colorize("EXHAUSTED ✗", "red") : colorize("HEALTHY ✓", "green")}`
  );
  console.log(
    `Race Conditions:     ${result.raceConditionsDetected > 0 ? colorize(`${result.raceConditionsDetected} DETECTED ✗`, "red") : colorize("NONE ✓", "green")}`
  );

  console.log(
    `\n${colorize("Status:", "cyan")} ${result.passed ? colorize("PASSED ✓", "green") : colorize("FAILED ✗", "red")}`
  );
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log(
    colorize("╔═══════════════════════════════════════════════════════════════════╗", "blue")
  );
  console.log(
    colorize("║          IxStats Database Performance Test Suite v1.0            ║", "blue")
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

  const config: DatabaseTestConfig = {
    concurrentWrites: parseInt(getArg("concurrent", "10"), 10),
    iterations: parseInt(getArg("iterations", "50"), 10),
    testComplexQueries: getArg("skip-complex", "false") !== "true",
    testTransactions: getArg("skip-transactions", "false") !== "true",
    cleanupAfter: getArg("cleanup", "true") === "true",
  };

  console.log(`\n${colorize("Test Configuration:", "yellow")}`);
  console.log(`  Concurrent Writes:   ${config.concurrentWrites}`);
  console.log(`  Iterations:          ${config.iterations}`);
  console.log(`  Test Complex Queries: ${config.testComplexQueries ? "Yes" : "No"}`);
  console.log(`  Test Transactions:   ${config.testTransactions ? "Yes" : "No"}`);
  console.log(`  Cleanup After:       ${config.cleanupAfter ? "Yes" : "No"}`);

  // Initialize Prisma client
  const db = new PrismaClient();

  try {
    // Test connection
    await db.$connect();
    console.log(colorize("\n✓ Database connected successfully", "green"));

    const results: boolean[] = [];

    // Test 1: Complex Queries
    if (config.testComplexQueries) {
      const complexQueryResult = await testComplexQueries(db, config.iterations);
      displayQueryResults(complexQueryResult);
      results.push(complexQueryResult.passed);
    }

    // Test 2: Concurrent Writes
    const concurrentWriteResult = await testConcurrentWrites(
      db,
      config.concurrentWrites,
      config.iterations
    );
    displayConcurrentResults(concurrentWriteResult);
    results.push(concurrentWriteResult.passed);

    // Test 3: Transactions
    if (config.testTransactions) {
      const transactionResult = await testTransactions(db, Math.floor(config.iterations / 2));
      displayQueryResults(transactionResult);
      results.push(transactionResult.passed);
    }

    // Test 4: Connection Pool
    const connectionPoolHealthy = await testConnectionPool(db);
    results.push(connectionPoolHealthy);

    // Cleanup
    if (config.cleanupAfter) {
      await cleanup(db);
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
    const passedTests = results.filter((r) => r).length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal Tests:    ${totalTests}`);
    console.log(
      `Passed:         ${colorize(String(passedTests), "green")} (${((passedTests / totalTests) * 100).toFixed(1)}%)`
    );
    console.log(
      `Failed:         ${failedTests > 0 ? colorize(String(failedTests), "red") : String(failedTests)} (${((failedTests / totalTests) * 100).toFixed(1)}%)`
    );

    // Exit code
    const exitCode = failedTests > 0 ? 1 : 0;
    console.log(
      `\n${exitCode === 0 ? colorize("All tests passed! ✓", "green") : colorize("Some tests failed! ✗", "red")}\n`
    );

    await db.$disconnect();
    process.exit(exitCode);
  } catch (error) {
    console.error(colorize("\nFatal database error:", "red"), error);
    await db.$disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(colorize("\nFatal error:", "red"), error);
    process.exit(1);
  });
}

export { testComplexQueries, testConcurrentWrites, testTransactions, DatabaseTestConfig };
