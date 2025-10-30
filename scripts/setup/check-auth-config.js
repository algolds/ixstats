#!/usr/bin/env node

/**
 * Authentication Configuration Checker
 * Verifies that the correct Clerk keys are being used for each environment
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Simple env file parser
function parseEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    const env = {};

    content.split("\n").forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith("#")) {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
          let value = valueParts.join("=").trim();
          // Remove quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          env[key.trim()] = value;
        }
      }
    });

    return env;
  } catch (error) {
    return {};
  }
}

// Load environment variables based on NODE_ENV
const environment = process.env.NODE_ENV || "development";

console.log(`🔍 Checking authentication configuration for: ${environment}`);
console.log("═".repeat(60));

// Determine which env file to check
let envFile;
if (environment === "development") {
  envFile = ".env.local.dev";
} else if (environment === "production") {
  envFile = ".env.production";
} else {
  envFile = ".env";
}

// Check if env file exists
const envFilePath = join(process.cwd(), envFile);
if (!existsSync(envFilePath)) {
  console.log(`❌ Environment file not found: ${envFile}`);
  console.log(`📝 Create ${envFile} with your Clerk authentication keys`);
  process.exit(1);
}

// Load the environment file
const envVars = parseEnvFile(envFilePath);

const publishableKey =
  envVars.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const secretKey = envVars.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;

console.log(`📄 Environment file: ${envFile}`);
console.log(`🌍 Environment: ${environment}`);
console.log("");

// Check publishable key
if (!publishableKey) {
  console.log("❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
} else {
  console.log(`🔑 Publishable Key: ${publishableKey.substring(0, 20)}...`);

  if (publishableKey.startsWith("pk_test_")) {
    console.log("🧪 Key Type: TEST (Development)");
    if (environment === "production") {
      console.log("⚠️  WARNING: Using test keys in production!");
    } else {
      console.log("✅ Correct key type for development");
    }
  } else if (publishableKey.startsWith("pk_live_")) {
    console.log("🔴 Key Type: LIVE (Production)");
    if (environment === "development") {
      console.log("⚠️  WARNING: Using live keys in development!");
    } else {
      console.log("✅ Correct key type for production");
    }
  } else {
    console.log("❌ Invalid publishable key format");
  }
}

console.log("");

// Check secret key
if (!secretKey) {
  console.log("❌ CLERK_SECRET_KEY is not set");
} else {
  console.log(`🔐 Secret Key: ${secretKey.substring(0, 20)}...`);

  if (secretKey.startsWith("sk_test_")) {
    console.log("🧪 Key Type: TEST (Development)");
    if (environment === "production") {
      console.log("⚠️  WARNING: Using test keys in production!");
    } else {
      console.log("✅ Correct key type for development");
    }
  } else if (secretKey.startsWith("sk_live_")) {
    console.log("🔴 Key Type: LIVE (Production)");
    if (environment === "development") {
      console.log("⚠️  WARNING: Using live keys in development!");
    } else {
      console.log("✅ Correct key type for production");
    }
  } else {
    console.log("❌ Invalid secret key format");
  }
}

console.log("");

// Summary
const isConfigured = publishableKey && secretKey;
const isCorrectKeyType =
  (environment === "development" &&
    publishableKey?.startsWith("pk_test_") &&
    secretKey?.startsWith("sk_test_")) ||
  (environment === "production" &&
    publishableKey?.startsWith("pk_live_") &&
    secretKey?.startsWith("sk_live_"));

if (isConfigured && isCorrectKeyType) {
  console.log("✅ Authentication is properly configured!");
} else if (isConfigured && !isCorrectKeyType) {
  console.log("⚠️  Authentication is configured but using wrong key type");
  console.log("");
  console.log("Recommendations:");
  if (environment === "development") {
    console.log("- Use pk_test_* and sk_test_* keys for development");
    console.log("- Get test keys from: https://dashboard.clerk.com → API Keys");
  } else {
    console.log("- Use pk_live_* and sk_live_* keys for production");
    console.log("- Get live keys from: https://dashboard.clerk.com → API Keys");
  }
} else {
  console.log("❌ Authentication is not properly configured");
  console.log("");
  console.log("Setup instructions:");
  console.log(`1. Add the following to ${envFile}:`);
  if (environment === "development") {
    console.log("   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_test_key_here");
    console.log("   CLERK_SECRET_KEY=sk_test_your_test_secret_here");
  } else {
    console.log("   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_live_key_here");
    console.log("   CLERK_SECRET_KEY=sk_live_your_live_secret_here");
  }
  console.log("2. Get keys from: https://dashboard.clerk.com → API Keys");
  console.log("3. Restart the server");
}

console.log("");
console.log("═".repeat(60));
console.log("📖 For detailed setup instructions, see: docs/AUTHENTICATION_SETUP.md");
