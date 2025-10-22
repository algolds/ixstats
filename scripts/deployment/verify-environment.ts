#!/usr/bin/env tsx

/**
 * Environment Verification Script for IxStats v1.2
 * Validates all required environment variables and external connections
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

// Required environment variables
const REQUIRED_VARS = [
  "DATABASE_URL",
  "NODE_ENV",
] as const;

// Optional but recommended environment variables
const RECOMMENDED_VARS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DISCORD_WEBHOOK_URL",
  "RATE_LIMIT_ENABLED",
  "BASE_PATH",
  "NEXT_PUBLIC_BASE_PATH",
] as const;

// Production-specific requirements
const PRODUCTION_VARS = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DISCORD_WEBHOOK_URL",
] as const;

interface ValidationResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
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
 * Check if environment variable exists
 */
function checkEnvVar(varName: string, required = true): boolean {
  const value = process.env[varName];
  const exists = !!value && value.trim() !== "";

  if (exists) {
    // Mask sensitive values
    const displayValue =
      varName.includes("SECRET") ||
      varName.includes("KEY") ||
      varName.includes("TOKEN") ||
      varName.includes("PASSWORD")
        ? "***REDACTED***"
        : value.length > 50
          ? value.substring(0, 47) + "..."
          : value;

    print(`✅ ${varName}: ${displayValue}`, "green");
    return true;
  } else {
    if (required) {
      print(`❌ ${varName}: MISSING (required)`, "red");
    } else {
      print(`⚠️  ${varName}: Not set (optional)`, "yellow");
    }
    return false;
  }
}

/**
 * Validate Clerk configuration
 */
function validateClerk(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const publicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const nodeEnv = process.env.NODE_ENV;

  if (!publicKey || !secretKey) {
    result.warnings.push(
      "Clerk authentication not configured (authentication will be disabled)"
    );
    return result;
  }

  // Check for test keys in production
  if (nodeEnv === "production") {
    if (publicKey.startsWith("pk_test_")) {
      result.errors.push(
        "Using test Clerk public key in production (must use pk_live_*)"
      );
      result.passed = false;
    }

    if (secretKey.startsWith("sk_test_")) {
      result.errors.push(
        "Using test Clerk secret key in production (must use sk_live_*)"
      );
      result.passed = false;
    }
  }

  // Check for production keys in development
  if (nodeEnv === "development") {
    if (publicKey.startsWith("pk_live_")) {
      result.warnings.push(
        "Using production Clerk keys in development (consider using test keys)"
      );
    }
  }

  return result;
}

/**
 * Validate database configuration
 */
function validateDatabase(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const databaseUrl = process.env.DATABASE_URL;
  const nodeEnv = process.env.NODE_ENV;

  if (!databaseUrl) {
    result.errors.push("DATABASE_URL is required");
    result.passed = false;
    return result;
  }

  // Check database type
  if (databaseUrl.startsWith("file:")) {
    const dbType = "SQLite";
    print(`  Database Type: ${dbType}`, "blue");

    if (nodeEnv === "production") {
      result.warnings.push(
        "Using SQLite in production (PostgreSQL recommended for production)"
      );
    }
  } else if (
    databaseUrl.startsWith("postgresql://") ||
    databaseUrl.startsWith("postgres://")
  ) {
    const dbType = "PostgreSQL";
    print(`  Database Type: ${dbType}`, "blue");
  } else {
    result.warnings.push(
      `Unknown database type: ${databaseUrl.split(":")[0]}`
    );
  }

  return result;
}

/**
 * Validate Redis configuration
 */
function validateRedis(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const redisUrl = process.env.REDIS_URL;
  const redisEnabled = process.env.REDIS_ENABLED;
  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED;

  if (rateLimitEnabled === "true" && !redisUrl) {
    result.warnings.push(
      "Rate limiting enabled without Redis (will use in-memory fallback)"
    );
  }

  if (redisEnabled === "true" && !redisUrl) {
    result.errors.push("REDIS_ENABLED is true but REDIS_URL is not set");
    result.passed = false;
  }

  return result;
}

/**
 * Validate Discord webhook configuration
 */
function validateDiscordWebhook(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const webhookEnabled = process.env.DISCORD_WEBHOOK_ENABLED;
  const nodeEnv = process.env.NODE_ENV;

  if (webhookEnabled === "true" && !webhookUrl) {
    result.errors.push(
      "DISCORD_WEBHOOK_ENABLED is true but DISCORD_WEBHOOK_URL is not set"
    );
    result.passed = false;
  }

  if (nodeEnv === "production" && !webhookUrl) {
    result.warnings.push(
      "Discord webhook not configured in production (monitoring alerts disabled)"
    );
  }

  if (webhookUrl && !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    result.errors.push("Invalid Discord webhook URL format");
    result.passed = false;
  }

  return result;
}

/**
 * Validate base path configuration
 */
function validateBasePath(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const basePath = process.env.BASE_PATH;
  const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === "production") {
    if (!basePath || basePath === "/") {
      result.warnings.push(
        "BASE_PATH not set or set to root (expected: /projects/ixstats)"
      );
    }

    if (basePath !== publicBasePath) {
      result.errors.push(
        `BASE_PATH (${basePath}) does not match NEXT_PUBLIC_BASE_PATH (${publicBasePath})`
      );
      result.passed = false;
    }
  }

  return result;
}

/**
 * Check Node.js version
 */
function checkNodeVersion(): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const currentVersion = process.version.slice(1); // Remove 'v' prefix
  const minVersion = "18.17.0";

  print(`  Node.js Version: ${currentVersion}`, "blue");

  const current = currentVersion.split(".").map(Number);
  const min = minVersion.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    if (current[i]! > min[i]!) break;
    if (current[i]! < min[i]!) {
      result.errors.push(
        `Node.js version ${currentVersion} is below minimum required version ${minVersion}`
      );
      result.passed = false;
      break;
    }
  }

  return result;
}

/**
 * Check disk space
 */
async function checkDiskSpace(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execPromise = promisify(exec);

    const { stdout } = await execPromise("df -BG . | tail -1 | awk '{print $4}'");
    const availableGB = parseInt(stdout.trim().replace("G", ""));

    print(`  Disk Space Available: ${availableGB}GB`, "blue");

    if (availableGB < 5) {
      result.errors.push(
        `Insufficient disk space: ${availableGB}GB available, 5GB required`
      );
      result.passed = false;
    } else if (availableGB < 10) {
      result.warnings.push(
        `Low disk space: ${availableGB}GB available (10GB+ recommended)`
      );
    }
  } catch (error) {
    result.warnings.push("Could not check disk space (not critical)");
  }

  return result;
}

/**
 * Test database connection
 */
async function testDatabaseConnection(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    await prisma.$connect();
    print("✅ Database connection successful", "green");
    await prisma.$disconnect();
  } catch (error) {
    result.errors.push(
      `Database connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
    result.passed = false;
  }

  return result;
}

/**
 * Test Redis connection
 */
async function testRedisConnection(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const redisUrl = process.env.REDIS_URL;
  const redisEnabled = process.env.REDIS_ENABLED;

  if (redisEnabled !== "true" || !redisUrl) {
    print("⚠️  Redis not enabled, skipping connection test", "yellow");
    return result;
  }

  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(redisUrl);

    await redis.ping();
    print("✅ Redis connection successful", "green");
    await redis.quit();
  } catch (error) {
    result.errors.push(
      `Redis connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
    result.passed = false;
  }

  return result;
}

/**
 * Test external API connections
 */
async function testExternalAPIs(): Promise<ValidationResult> {
  const result: ValidationResult = {
    passed: true,
    warnings: [],
    errors: [],
  };

  const mediawikiUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL;
  const ixtimeBotUrl = process.env.IXTIME_BOT_URL;

  // Test MediaWiki API
  if (mediawikiUrl) {
    try {
      const response = await fetch(`${mediawikiUrl}api.php?action=query&meta=siteinfo&format=json`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        print("✅ MediaWiki API accessible", "green");
      } else {
        result.warnings.push(
          `MediaWiki API returned status ${response.status}`
        );
      }
    } catch (error) {
      result.warnings.push(
        `MediaWiki API not accessible (non-critical): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Test IxTime Bot
  if (ixtimeBotUrl) {
    try {
      const response = await fetch(`${ixtimeBotUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        print("✅ IxTime Bot accessible", "green");
      } else {
        result.warnings.push(`IxTime Bot returned status ${response.status}`);
      }
    } catch (error) {
      result.warnings.push(
        `IxTime Bot not accessible (non-critical): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

/**
 * Main verification function
 */
async function main() {
  console.clear();

  print("╔═══════════════════════════════════════════════════════╗", "cyan");
  print("║                                                       ║", "cyan");
  print("║     IxStats v1.2 - Environment Verification          ║", "cyan");
  print("║                                                       ║", "cyan");
  print("╚═══════════════════════════════════════════════════════╝", "cyan");

  const allResults: ValidationResult[] = [];

  // Check required environment variables
  printHeader("Required Environment Variables");
  let allRequiredPresent = true;
  for (const varName of REQUIRED_VARS) {
    if (!checkEnvVar(varName, true)) {
      allRequiredPresent = false;
    }
  }

  if (!allRequiredPresent) {
    print("\n❌ Missing required environment variables", "red");
    exit(1);
  }

  // Check recommended environment variables
  printHeader("Recommended Environment Variables");
  for (const varName of RECOMMENDED_VARS) {
    checkEnvVar(varName, false);
  }

  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    printHeader("Production-Specific Variables");
    for (const varName of PRODUCTION_VARS) {
      checkEnvVar(varName, false);
    }
  }

  // Validate configurations
  printHeader("Configuration Validation");

  print("Checking Clerk authentication...", "blue");
  const clerkResult = validateClerk();
  allResults.push(clerkResult);

  print("\nChecking database configuration...", "blue");
  const dbResult = validateDatabase();
  allResults.push(dbResult);

  print("\nChecking Redis configuration...", "blue");
  const redisResult = validateRedis();
  allResults.push(redisResult);

  print("\nChecking Discord webhook...", "blue");
  const webhookResult = validateDiscordWebhook();
  allResults.push(webhookResult);

  print("\nChecking base path configuration...", "blue");
  const basePathResult = validateBasePath();
  allResults.push(basePathResult);

  // System checks
  printHeader("System Requirements");

  const nodeResult = checkNodeVersion();
  allResults.push(nodeResult);

  const diskResult = await checkDiskSpace();
  allResults.push(diskResult);

  // Connection tests
  printHeader("Connection Tests");

  print("Testing database connection...", "blue");
  const dbConnResult = await testDatabaseConnection();
  allResults.push(dbConnResult);

  print("\nTesting Redis connection...", "blue");
  const redisConnResult = await testRedisConnection();
  allResults.push(redisConnResult);

  print("\nTesting external APIs...", "blue");
  const apiResult = await testExternalAPIs();
  allResults.push(apiResult);

  // Summary
  printHeader("Verification Summary");

  const totalErrors = allResults.reduce(
    (sum, r) => sum + r.errors.length,
    0
  );
  const totalWarnings = allResults.reduce(
    (sum, r) => sum + r.warnings.length,
    0
  );
  const allPassed = allResults.every((r) => r.passed);

  if (totalErrors > 0) {
    print("\n❌ Errors Found:", "red");
    for (const result of allResults) {
      for (const error of result.errors) {
        print(`  • ${error}`, "red");
      }
    }
  }

  if (totalWarnings > 0) {
    print("\n⚠️  Warnings:", "yellow");
    for (const result of allResults) {
      for (const warning of result.warnings) {
        print(`  • ${warning}`, "yellow");
      }
    }
  }

  print("\n" + "=".repeat(60), "cyan");

  if (allPassed && totalErrors === 0) {
    print("\n✅ Environment verification PASSED", "green");
    print(`   ${totalWarnings} warning(s), ${totalErrors} error(s)`, "green");

    if (totalWarnings > 0) {
      print("\n   Review warnings above before deployment", "yellow");
    }

    exit(0);
  } else {
    print("\n❌ Environment verification FAILED", "red");
    print(`   ${totalWarnings} warning(s), ${totalErrors} error(s)`, "red");
    print("\n   Fix errors before proceeding with deployment", "red");
    exit(1);
  }
}

// Run verification
main().catch((error) => {
  print(`\n❌ Verification failed: ${error}`, "red");
  exit(1);
});
