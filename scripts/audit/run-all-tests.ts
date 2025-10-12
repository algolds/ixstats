#!/usr/bin/env tsx
/**
 * Master Test Runner for IxStats v1.0
 * Runs all verification and audit scripts in sequence
 *
 * Usage: npx tsx scripts/audit/run-all-tests.ts
 * Usage (specific): npx tsx scripts/audit/run-all-tests.ts --only=crud,health
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

interface TestSuite {
  name: string;
  script: string;
  description: string;
  critical: boolean;
}

const testSuites: TestSuite[] = [
  {
    name: "crud",
    script: "test-all-crud-operations.ts",
    description: "CRUD operations test for all tRPC routers",
    critical: true,
  },
  {
    name: "health",
    script: "test-api-health.ts",
    description: "API endpoint health check and response times",
    critical: true,
  },
  {
    name: "database",
    script: "verify-database-integrity.ts",
    description: "Database integrity, relationships, and constraints",
    critical: true,
  },
  {
    name: "economics",
    script: "verify-economic-calculations.ts",
    description: "Economic calculations, formulas, and projections",
    critical: false,
  },
  {
    name: "wiring",
    script: "verify-live-data-wiring.ts",
    description: "Live data wiring verification for components",
    critical: false,
  },
];

interface TestResult {
  suite: string;
  status: "PASS" | "FAIL" | "SKIP";
  duration: number;
  output?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTestSuite(suite: TestSuite): Promise<TestResult> {
  const scriptPath = path.join(__dirname, suite.script);
  const start = Date.now();

  console.log(`\n${"=".repeat(80)}`);
  console.log(`🧪 Running: ${suite.name.toUpperCase()} - ${suite.description}`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    const { stdout, stderr } = await execAsync(`npx tsx ${scriptPath}`, {
      cwd: path.join(__dirname, "../.."),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const duration = Date.now() - start;

    console.log(stdout);
    if (stderr && !stderr.includes("ExperimentalWarning")) {
      console.error(stderr);
    }

    return {
      suite: suite.name,
      status: "PASS",
      duration,
      output: stdout,
    };
  } catch (error: any) {
    const duration = Date.now() - start;

    // Check if it's a controlled exit with warnings
    if (error.code === 1 && error.stdout) {
      console.log(error.stdout);
      console.error(error.stderr);

      return {
        suite: suite.name,
        status: "FAIL",
        duration,
        output: error.stdout,
        error: error.stderr,
      };
    }

    console.error(`❌ Error running ${suite.name}:`, error.message);

    return {
      suite: suite.name,
      status: "FAIL",
      duration,
      error: error.message,
    };
  }
}

async function runAllTests(onlyTests?: string[]) {
  console.log("\n🚀 IxStats v1.0 - Comprehensive Test Suite Runner\n");
  console.log(`Starting Time: ${new Date().toISOString()}`);
  console.log(`Node Version: ${process.version}`);
  console.log(`Working Directory: ${process.cwd()}\n`);

  const suitesToRun = onlyTests
    ? testSuites.filter((s) => onlyTests.includes(s.name))
    : testSuites;

  if (onlyTests && suitesToRun.length === 0) {
    console.error(`❌ No matching test suites found for: ${onlyTests.join(", ")}`);
    console.log("\nAvailable test suites:");
    testSuites.forEach((s) => console.log(`  - ${s.name}: ${s.description}`));
    process.exit(1);
  }

  console.log(`Running ${suitesToRun.length} test suite(s):\n`);
  suitesToRun.forEach((s, i) => {
    const critical = s.critical ? "🔴 CRITICAL" : "🟡 OPTIONAL";
    console.log(`  ${i + 1}. [${s.name}] ${s.description} ${critical}`);
  });

  const startTime = Date.now();

  // Run all tests sequentially
  for (const suite of suitesToRun) {
    const result = await runTestSuite(suite);
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("📊 TEST SUITE SUMMARY");
  console.log("=".repeat(80) + "\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  results.forEach((result, index) => {
    const icon = result.status === "PASS" ? "✅" : "❌";
    const suite = testSuites.find((s) => s.name === result.suite);
    const critical = suite?.critical ? " [CRITICAL]" : "";
    console.log(
      `${icon} ${index + 1}. ${result.suite.toUpperCase()}${critical} - ${(result.duration / 1000).toFixed(2)}s`
    );
  });

  console.log("\n" + "-".repeat(80));
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);
  if (skipped > 0) {
    console.log(`⏭️  Skipped: ${skipped}`);
  }
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  // Check critical failures
  const criticalFailures = results.filter(
    (r) =>
      r.status === "FAIL" &&
      testSuites.find((s) => s.name === r.suite)?.critical
  );

  if (criticalFailures.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("🚨 CRITICAL FAILURES DETECTED");
    console.log("=".repeat(80) + "\n");

    criticalFailures.forEach((failure) => {
      const suite = testSuites.find((s) => s.name === failure.suite);
      console.log(`❌ ${failure.suite.toUpperCase()}: ${suite?.description}`);
      if (failure.error) {
        console.log(`   Error: ${failure.error.substring(0, 200)}...`);
      }
    });

    console.log("\n⚠️  System is NOT production-ready due to critical failures.\n");
  } else if (failed > 0) {
    console.log("\n⚠️  Some optional tests failed, but system may still be functional.\n");
  } else {
    console.log("\n✅ ALL TESTS PASSED - System is production-ready!\n");
  }

  // Calculate overall grade
  const score = (passed / results.length) * 100;
  let grade: string;
  if (score === 100) grade = "A+ (Perfect)";
  else if (score >= 90) grade = "A (Excellent)";
  else if (score >= 80) grade = "B (Good)";
  else if (score >= 70) grade = "C (Acceptable)";
  else if (score >= 60) grade = "D (Poor)";
  else grade = "F (Critical Issues)";

  console.log(`🎯 Overall Score: ${score.toFixed(1)}%`);
  console.log(`📊 Grade: ${grade}`);

  console.log("\n" + "=".repeat(80) + "\n");

  // Exit with appropriate code
  if (criticalFailures.length > 0) {
    process.exit(1);
  } else if (failed > 0) {
    process.exit(2); // Non-critical failures
  } else {
    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const onlyArg = args.find((arg) => arg.startsWith("--only="));
const onlyTests = onlyArg?.split("=")[1]?.split(",");

if (args.includes("--help") || args.includes("-h")) {
  console.log("\n🧪 IxStats Test Suite Runner\n");
  console.log("Usage: npx tsx scripts/audit/run-all-tests.ts [options]\n");
  console.log("Options:");
  console.log("  --help, -h          Show this help message");
  console.log("  --only=<tests>      Run only specific tests (comma-separated)");
  console.log("\nAvailable tests:");
  testSuites.forEach((s) => {
    const critical = s.critical ? "[CRITICAL]" : "[OPTIONAL]";
    console.log(`  ${s.name.padEnd(15)} ${critical.padEnd(12)} ${s.description}`);
  });
  console.log("\nExample:");
  console.log("  npx tsx scripts/audit/run-all-tests.ts --only=crud,health\n");
  process.exit(0);
}

runAllTests(onlyTests).catch((error) => {
  console.error("❌ Fatal error running test suite:", error);
  process.exit(1);
});
