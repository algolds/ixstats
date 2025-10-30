#!/usr/bin/env tsx

/**
 * Database Verification Script
 *
 * Checks for duplicate users and validates system owner roles
 * Run with: npm run tsx scripts/verify-single-user.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// System owner Clerk IDs for validation
const SYSTEM_OWNER_IDS = [
  "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo", // Dev environment owner
  "user_3078Ja62W7yJDlBjjwNppfzceEz", // Production environment owner
];

interface UserReport {
  clerkUserId: string;
  count: number;
  roles: string[];
  userIds: string[];
}

async function verifySingleUser() {
  console.log("🔍 Verifying single user records per Clerk ID...\n");

  try {
    // Get all users with their roles
    const users = await db.user.findMany({
      include: {
        role: true,
      },
      orderBy: {
        clerkUserId: "asc",
      },
    });

    console.log(`📊 Total users in database: ${users.length}\n`);

    // Group users by clerkUserId to detect duplicates
    const userGroups = new Map<string, UserReport>();

    for (const user of users) {
      const clerkUserId = user.clerkUserId;

      if (!userGroups.has(clerkUserId)) {
        userGroups.set(clerkUserId, {
          clerkUserId,
          count: 0,
          roles: [],
          userIds: [],
        });
      }

      const group = userGroups.get(clerkUserId)!;
      group.count++;
      group.userIds.push(user.id);

      if (user.role) {
        group.roles.push(user.role.name);
      } else {
        group.roles.push("NO_ROLE");
      }
    }

    // Report findings
    let duplicateCount = 0;
    let systemOwnerIssues = 0;

    console.log("📋 User Report by Clerk ID:");
    console.log("=".repeat(80));

    for (const [clerkUserId, report] of userGroups) {
      const isSystemOwner = SYSTEM_OWNER_IDS.includes(clerkUserId);
      const hasOwnerRole = report.roles.includes("owner");
      const hasMultipleRoles = new Set(report.roles).size > 1;

      // Check for issues
      const issues = [];
      if (report.count > 1) {
        issues.push(`❌ DUPLICATE: ${report.count} records`);
        duplicateCount++;
      }
      if (isSystemOwner && !hasOwnerRole) {
        issues.push(`❌ SYSTEM OWNER WITHOUT OWNER ROLE: has ${report.roles.join(", ")}`);
        systemOwnerIssues++;
      }
      if (hasMultipleRoles) {
        issues.push(`⚠️  MULTIPLE ROLES: ${report.roles.join(", ")}`);
      }

      // Status indicator
      const status = issues.length > 0 ? "❌" : "✅";

      console.log(`${status} ${clerkUserId}`);
      console.log(`   Records: ${report.count}`);
      console.log(`   Roles: ${report.roles.join(", ")}`);
      console.log(`   IDs: ${report.userIds.join(", ")}`);
      if (isSystemOwner) {
        console.log(`   🏆 SYSTEM OWNER`);
      }
      if (issues.length > 0) {
        issues.forEach((issue) => console.log(`   ${issue}`));
      }
      console.log();
    }

    // Summary
    console.log("📊 Summary:");
    console.log("=".repeat(40));
    console.log(`✅ Unique Clerk IDs: ${userGroups.size}`);
    console.log(`❌ Duplicate user groups: ${duplicateCount}`);
    console.log(`❌ System owner role issues: ${systemOwnerIssues}`);
    console.log();

    // Check system owner IDs
    console.log("🏆 System Owner Validation:");
    console.log("=".repeat(40));
    for (const systemOwnerId of SYSTEM_OWNER_IDS) {
      const userGroup = userGroups.get(systemOwnerId);
      if (userGroup) {
        const hasOwnerRole = userGroup.roles.includes("owner");
        const status = hasOwnerRole ? "✅" : "❌";
        console.log(`${status} ${systemOwnerId}: ${userGroup.roles.join(", ")}`);
      } else {
        console.log(`⚠️  ${systemOwnerId}: NOT FOUND IN DATABASE`);
      }
    }
    console.log();

    // Recommendations
    if (duplicateCount > 0 || systemOwnerIssues > 0) {
      console.log("🔧 Recommendations:");
      console.log("=".repeat(40));

      if (duplicateCount > 0) {
        console.log(
          "• Remove duplicate user records, keeping the one with the most recent updatedAt"
        );
        console.log("• Verify that the centralized UserManagementService is working correctly");
      }

      if (systemOwnerIssues > 0) {
        console.log("• Assign 'owner' role to system owner Clerk IDs");
        console.log("• Verify that system owner detection is working in UserManagementService");
      }
    } else {
      console.log("🎉 All user records look good! No duplicates or role issues found.");
    }
  } catch (error) {
    console.error("❌ Error during verification:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the verification
verifySingleUser().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
