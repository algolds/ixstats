import { existsSync, readFileSync } from "fs";
import { join } from "path";

// Helper to manually load env files for standalone script execution
function loadEnvFile(filename: string) {
  const filePath = join(process.cwd(), filename);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts
            .slice(1)
            .join("=")
            .trim()
            .replace(/^['"]|['"]$/g, "");
          process.env[key] = val;
        }
      }
    });
  }
}

// Load env files in standard priority order
loadEnvFile(".env");
loadEnvFile(".env.local");
loadEnvFile(".env.local.dev");

import { clerkClient } from "@clerk/nextjs/server";

async function main() {
  const clerkUserId = process.argv[2];
  const role = process.argv[3] || "owner";

  if (!clerkUserId) {
    console.error("Usage: bun scripts/set-clerk-role.ts <clerkUserId> [role]");
    process.exit(1);
  }

  try {
    const client = await clerkClient();
    console.log(`Setting Clerk user metadata role to "${role}" for user "${clerkUserId}"...`);

    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role,
      },
    });

    console.log("✅ Clerk user metadata updated successfully!");
  } catch (error) {
    console.error("❌ Failed to update Clerk metadata:", error);
    process.exit(1);
  }
}

main();
