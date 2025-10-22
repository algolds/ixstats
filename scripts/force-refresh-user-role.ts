#!/usr/bin/env tsx

/**
 * Force refresh user role script
 * 
 * This script forces a refresh of the user's role data by triggering
 * a database update and clearing any potential cache issues.
 * 
 * Run with: npx tsx scripts/force-refresh-user-role.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// System owner Clerk IDs
const SYSTEM_OWNER_IDS = [
  "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo", // Dev environment owner
  "user_3078Ja62W7yJDlBjjwNppfzceEz", // Production environment owner
];

async function forceRefreshUserRole() {
  console.log("🔄 Force refreshing user roles...\n");

  try {
    for (const clerkUserId of SYSTEM_OWNER_IDS) {
      console.log(`Processing user: ${clerkUserId}`);
      
      // Get the user record
      const user = await db.user.findUnique({
        where: { clerkUserId },
        include: { role: true }
      });

      if (!user) {
        console.log(`❌ User not found: ${clerkUserId}`);
        continue;
      }

      console.log(`Current role: ${user.role?.name || 'NO_ROLE'} (Level: ${user.role?.level ?? 'N/A'})`);

      // Get the owner role
      const ownerRole = await db.role.findUnique({
        where: { name: 'owner' }
      });

      if (!ownerRole) {
        console.log(`❌ Owner role not found in database`);
        continue;
      }

      // Force update the user's role and timestamp to trigger cache refresh
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          roleId: ownerRole.id,
          updatedAt: new Date(), // Force update timestamp
        },
        include: {
          role: true,
        }
      });

      console.log(`✅ Updated user role to: ${updatedUser.role?.name} (Level: ${updatedUser.role?.level})`);
      console.log(`   User ID: ${updatedUser.id}`);
      console.log(`   Updated at: ${updatedUser.updatedAt}`);
      console.log();
    }

    console.log("🎉 User role refresh completed!");
    console.log("\nNext steps:");
    console.log("1. Refresh your browser page");
    console.log("2. Click 'Refresh Role Data' button on debug page");
    console.log("3. Check that role shows as 'owner' with level 0");

  } catch (error) {
    console.error("❌ Error during role refresh:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the refresh
forceRefreshUserRole().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
