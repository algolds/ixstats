#!/usr/bin/env tsx

/**
 * Sync System Owner Roles Across Databases
 * 
 * This script ensures both dev.db and prod.db have correct owner roles
 * for both system owner Clerk user IDs. It handles:
 * - Creating users if they don't exist
 * - Assigning correct owner roles
 * - Reporting status for each database
 */

import { PrismaClient } from "@prisma/client";
import { UserManagementService } from "../src/lib/user-management-service";
import { SYSTEM_OWNER_IDS } from "../src/lib/system-owner-constants";

interface DatabaseInfo {
  name: string;
  path: string;
  db: PrismaClient;
}

async function syncSystemOwnerRoles(): Promise<void> {
  console.log("🔄 Syncing System Owner Roles Across Databases");
  console.log("==============================================");
  
  // Use environment DATABASE_URL for current database
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const databases: DatabaseInfo[] = [
    {
      name: "Current Database",
      path: process.env.DATABASE_URL,
      db: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })
    }
  ];

  for (const dbInfo of databases) {
    console.log(`\n📊 Processing ${dbInfo.name} Database (${dbInfo.path})`);
    console.log("=" + "=".repeat(50));
    
    try {
      // Ensure roles exist
      const userService = new UserManagementService(dbInfo.db);
      await userService.ensureRolesExist(dbInfo.db);

      // Get owner role
      const ownerRole = await dbInfo.db.role.findUnique({
        where: { name: 'owner' }
      });

      if (!ownerRole) {
        console.log(`❌ Owner role not found in ${dbInfo.name} database`);
        continue;
      }

      console.log(`✅ Owner role found: ${ownerRole.name} (level ${ownerRole.level})`);

      // Process each system owner ID
      for (const clerkUserId of SYSTEM_OWNER_IDS) {
        console.log(`\n👤 Processing user: ${clerkUserId}`);
        
        try {
          // Use UserManagementService to get or create user
          const user = await userService.getOrCreateUser(clerkUserId);
          
          if (!user) {
            console.log(`❌ Failed to get/create user: ${clerkUserId}`);
            continue;
          }

          // Check current role
          const currentRole = user.role;
          console.log(`   Current role: ${currentRole?.name || 'NO_ROLE'} (level ${currentRole?.level ?? 'N/A'})`);

          // Update to owner role if not already
          if (user.roleId !== ownerRole.id) {
            await dbInfo.db.user.update({
              where: { clerkUserId },
              data: { roleId: ownerRole.id }
            });
            console.log(`   ✅ Updated to owner role`);
          } else {
            console.log(`   ✅ Already has owner role`);
          }

        } catch (error) {
          console.log(`   ❌ Error processing user ${clerkUserId}:`, error);
        }
      }

      // Final verification
      console.log(`\n🔍 Final verification for ${dbInfo.name}:`);
      for (const clerkUserId of SYSTEM_OWNER_IDS) {
        const user = await dbInfo.db.user.findUnique({
          where: { clerkUserId },
          include: { role: true }
        });
        
        if (user) {
          console.log(`   ${clerkUserId}: ${user.role?.name || 'NO_ROLE'} (level ${user.role?.level ?? 'N/A'})`);
        } else {
          console.log(`   ${clerkUserId}: NOT FOUND`);
        }
      }

    } catch (error) {
      console.log(`❌ Error processing ${dbInfo.name} database:`, error);
    } finally {
      await dbInfo.db.$disconnect();
    }
  }

  console.log("\n✅ System owner role sync completed!");
  console.log("\n💡 Next steps:");
  console.log("1. Restart your development server: npm run dev");
  console.log("2. Sign in and verify you have admin access");
  console.log("3. Check /admin to confirm system owner privileges");
}

// Run the sync
syncSystemOwnerRoles()
  .then(() => {
    console.log("\n🎉 Sync completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Sync failed:", error);
    process.exit(1);
  });
