#!/usr/bin/env node

/**
 * Validation script for Clerk production configuration
 * This script ensures that production Clerk keys are properly configured
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔐 Validating Clerk Production Configuration...\n");

// Check if .env.production exists
const envProductionPath = path.join(__dirname, "..", ".env.production");
if (!fs.existsSync(envProductionPath)) {
  console.error("❌ .env.production file not found");
  process.exit(1);
}

// Read .env.production file
const envContent = fs.readFileSync(envProductionPath, "utf8");
const envLines = envContent.split("\n").filter((line) => line.trim() && !line.startsWith("#"));

let hasPublishableKey = false;
let hasSecretKey = false;
let publishableKeyType = null;
let secretKeyType = null;

// Parse environment variables
envLines.forEach((line) => {
  const [key, value] = line.split("=", 2);
  if (!key || !value) return;

  const cleanValue = value.replace(/"/g, "");

  if (key.trim() === "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") {
    hasPublishableKey = true;
    if (cleanValue.startsWith("pk_live_")) {
      publishableKeyType = "LIVE";
    } else if (cleanValue.startsWith("pk_test_")) {
      publishableKeyType = "TEST";
    } else {
      publishableKeyType = "INVALID";
    }
  }

  if (key.trim() === "CLERK_SECRET_KEY") {
    hasSecretKey = true;
    if (cleanValue.startsWith("sk_live_")) {
      secretKeyType = "LIVE";
    } else if (cleanValue.startsWith("sk_test_")) {
      secretKeyType = "TEST";
    } else {
      secretKeyType = "INVALID";
    }
  }
});

// Validation results
console.log("📋 Configuration Status:");
console.log(
  `   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${hasPublishableKey ? "✅ Present" : "❌ Missing"}`
);
if (hasPublishableKey) {
  console.log(
    `   Publishable Key Type: ${publishableKeyType === "LIVE" ? "✅ LIVE" : publishableKeyType === "TEST" ? "⚠️  TEST" : "❌ INVALID"}`
  );
}

console.log(`   CLERK_SECRET_KEY: ${hasSecretKey ? "✅ Present" : "❌ Missing"}`);
if (hasSecretKey) {
  console.log(
    `   Secret Key Type: ${secretKeyType === "LIVE" ? "✅ LIVE" : secretKeyType === "TEST" ? "⚠️  TEST" : "❌ INVALID"}`
  );
}

console.log();

// Overall validation
let isValid = true;
const issues = [];

if (!hasPublishableKey) {
  issues.push("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  isValid = false;
}

if (!hasSecretKey) {
  issues.push("Missing CLERK_SECRET_KEY");
  isValid = false;
}

if (publishableKeyType === "TEST") {
  issues.push("Using TEST publishable key in production (should be pk_live_*)");
  isValid = false;
}

if (secretKeyType === "TEST") {
  issues.push("Using TEST secret key in production (should be sk_live_*)");
  isValid = false;
}

if (publishableKeyType === "INVALID") {
  issues.push("Invalid publishable key format (should start with pk_live_*)");
  isValid = false;
}

if (secretKeyType === "INVALID") {
  issues.push("Invalid secret key format (should start with sk_live_*)");
  isValid = false;
}

if (isValid) {
  console.log("✅ Production Clerk configuration is valid!");
  console.log("🚀 Ready for production deployment with live authentication");
} else {
  console.log("❌ Production Clerk configuration has issues:");
  issues.forEach((issue) => console.log(`   • ${issue}`));
  console.log();
  console.log("🔧 To fix these issues:");
  console.log("   1. Obtain live Clerk keys from your Clerk dashboard");
  console.log("   2. Update .env.production with:");
  console.log("      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...");
  console.log("      CLERK_SECRET_KEY=sk_live_...");
  console.log("   3. Restart the production server");

  process.exit(1);
}
