#!/usr/bin/env node

/**
 * Clerk Development Setup Helper
 * Helps configure Clerk authentication for development environment
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import readline from "readline";

console.log("🔐 Clerk Development Setup Helper");
console.log("═".repeat(50));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(text) {
  return new Promise((resolve) => {
    rl.question(text, resolve);
  });
}

async function main() {
  console.log(
    "\nThis helper will guide you through setting up Clerk authentication for development.\n"
  );

  const setupChoice = await question("Do you want to set up Clerk authentication? (y/n): ");

  if (setupChoice.toLowerCase() !== "y") {
    console.log("\n✅ Skipping Clerk setup. The app will run in demo mode (no authentication).");
    console.log("📝 You can set up Clerk later by running: bun run clerk:setup\n");
    rl.close();
    return;
  }

  console.log("\n📋 Follow these steps to get your Clerk development keys:\n");
  console.log("1. Go to https://dashboard.clerk.com");
  console.log("2. Create an account or sign in");
  console.log("3. Create a new application or select an existing one");
  console.log('4. Make sure you\'re in the "Development" environment');
  console.log('5. Go to Configure → Domains and add "localhost:3000" (http://)');
  console.log("6. Go to Configure → API Keys");
  console.log("7. Copy your Development keys (they start with pk_test_ and sk_test_)");
  console.log("");

  const publishableKey = await question("Enter your Clerk Publishable Key (pk_test_...): ");
  const secretKey = await question("Enter your Clerk Secret Key (sk_test_...): ");

  // Validate keys
  if (!publishableKey.startsWith("pk_test_")) {
    console.log('❌ Invalid publishable key. It should start with "pk_test_"');
    rl.close();
    return;
  }

  if (!secretKey.startsWith("sk_test_")) {
    console.log('❌ Invalid secret key. It should start with "sk_test_"');
    rl.close();
    return;
  }

  // Update .env.local
  const envLocalPath = join(process.cwd(), ".env.local");

  if (!existsSync(envLocalPath)) {
    console.log("❌ .env.local file not found");
    rl.close();
    return;
  }

  try {
    let envContent = readFileSync(envLocalPath, "utf8");

    // Replace or add the Clerk keys
    if (envContent.includes("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*/,
        `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey}`;
    }

    if (envContent.includes("CLERK_SECRET_KEY=")) {
      envContent = envContent.replace(/CLERK_SECRET_KEY=.*/, `CLERK_SECRET_KEY=${secretKey}`);
    } else {
      envContent += `\nCLERK_SECRET_KEY=${secretKey}`;
    }

    // Remove any commented out versions
    envContent = envContent.replace(/# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*/g, "");
    envContent = envContent.replace(/# CLERK_SECRET_KEY=.*/g, "");

    writeFileSync(envLocalPath, envContent);

    console.log("\n✅ Clerk keys have been saved to .env.local");
    console.log("🔄 Please restart your development server:");
    console.log("   bun run dev");
    console.log("\n🧪 Test your setup by visiting: http://localhost:3000");
    console.log("📊 Check configuration with: bun run auth:check:dev");
  } catch (error) {
    console.log("❌ Error updating .env.local:", error.message);
  }

  rl.close();
}

main().catch(console.error);
