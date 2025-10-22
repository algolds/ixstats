#!/usr/bin/env tsx

/**
 * User Management Verification Script
 * 
 * Comprehensive verification of user account system to ensure:
 * - No duplicate user records exist
 * - System owner IDs are properly configured
 * - All users have proper roles assigned
 * - UserManagementService is working correctly
 * 
 * Usage: npm run tsx scripts/verify-user-management.ts
 */

import { PrismaClient } from "@prisma/client";
import { SYSTEM_OWNER_IDS, isSystemOwner } from "../src/lib/system-owner-constants";
import { UserManagementService } from "../src/lib/user-management-service";

const prisma = new PrismaClient();

interface UserReport {
  clerkUserId: string;
  count: number;
  roles: string[];
  userIds: string[];
  countries: string[];
  issues: string[];
}

interface VerificationResult {
  totalUsers: number;
  duplicateUsers: UserReport[];
  usersWithoutRoles: any[];
  systemOwnerStatus: {
    dev: boolean;
    prod: boolean;
    devUser?: any;
    prodUser?: any;
  };
  orphanedCountryLinks: any[];
  userManagementServiceTest: {
    success: boolean;
    error?: string;
  };
}

async function verifyUserManagement(): Promise<VerificationResult> {
  console.log("🔍 User Management System Verification");
  console.log("=====================================");
  console.log("");

  const result: VerificationResult = {
    totalUsers: 0,
    duplicateUsers: [],
    usersWithoutRoles: [],
    systemOwnerStatus: {
      dev: false,
      prod: false
    },
    orphanedCountryLinks: [],
    userManagementServiceTest: {
      success: false
    }
  };

  try {
    // 1. Check for duplicate users by clerkUserId
    console.log("📊 Step 1: Checking for duplicate user records...");
    const allUsers = await prisma.user.findMany({
      include: {
        role: true,
        country: true
      },
      orderBy: { createdAt: 'desc' }
    });

    result.totalUsers = allUsers.length;
    console.log(`   Found ${allUsers.length} total users`);

    // Group users by clerkUserId to find duplicates
    const userGroups = new Map<string, any[]>();
    allUsers.forEach(user => {
      if (!userGroups.has(user.clerkUserId)) {
        userGroups.set(user.clerkUserId, []);
      }
      userGroups.get(user.clerkUserId)!.push(user);
    });

    // Find duplicates
    for (const [clerkUserId, users] of userGroups) {
      if (users.length > 1) {
        const report: UserReport = {
          clerkUserId,
          count: users.length,
          roles: users.map(u => u.role?.name || 'NO_ROLE'),
          userIds: users.map(u => u.id),
          countries: users.map(u => u.country?.name || 'NO_COUNTRY'),
          issues: []
        };

        // Check for issues
        if (users.some(u => !u.role)) {
          report.issues.push('Some users have no role assigned');
        }
        if (users.some(u => !u.isActive)) {
          report.issues.push('Some users are inactive');
        }
        if (new Set(users.map(u => u.countryId)).size > 1) {
          report.issues.push('Users linked to different countries');
        }

        result.duplicateUsers.push(report);
      }
    }

    if (result.duplicateUsers.length > 0) {
      console.log(`   ❌ Found ${result.duplicateUsers.length} duplicate user groups:`);
      result.duplicateUsers.forEach((dup, index) => {
        console.log(`   ${index + 1}. Clerk ID: ${dup.clerkUserId} (${dup.count} records)`);
        console.log(`      Roles: ${dup.roles.join(', ')}`);
        console.log(`      Countries: ${dup.countries.join(', ')}`);
        if (dup.issues.length > 0) {
          console.log(`      Issues: ${dup.issues.join(', ')}`);
        }
      });
    } else {
      console.log("   ✅ No duplicate user records found");
    }

    // 2. Check for users without roles
    console.log("\n📋 Step 2: Checking for users without roles...");
    const usersWithoutRoles = allUsers.filter(user => !user.role);
    result.usersWithoutRoles = usersWithoutRoles;

    if (usersWithoutRoles.length > 0) {
      console.log(`   ❌ Found ${usersWithoutRoles.length} users without roles:`);
      usersWithoutRoles.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.clerkUserId} (ID: ${user.id})`);
        console.log(`      Country: ${user.country?.name || 'None'}`);
        console.log(`      Active: ${user.isActive}`);
        console.log(`      Created: ${user.createdAt.toISOString()}`);
      });
    } else {
      console.log("   ✅ All users have roles assigned");
    }

    // 3. Verify system owner status
    console.log("\n🔐 Step 3: Verifying system owner configuration...");
    const devUserId = SYSTEM_OWNER_IDS[0];
    const prodUserId = SYSTEM_OWNER_IDS[1];

    const devUser = allUsers.find(u => u.clerkUserId === devUserId);
    const prodUser = allUsers.find(u => u.clerkUserId === prodUserId);

    result.systemOwnerStatus.dev = !!devUser && devUser.role?.name === 'owner';
    result.systemOwnerStatus.prod = !!prodUser && prodUser.role?.name === 'owner';
    result.systemOwnerStatus.devUser = devUser;
    result.systemOwnerStatus.prodUser = prodUser;

    console.log(`   Dev System Owner (${devUserId}):`);
    if (devUser) {
      console.log(`      ✅ Found in database`);
      console.log(`      Role: ${devUser.role?.name || 'NO_ROLE'} (Level: ${devUser.role?.level || 'N/A'})`);
      console.log(`      Country: ${devUser.country?.name || 'None'}`);
      console.log(`      Active: ${devUser.isActive}`);
    } else {
      console.log(`      ❌ Not found in database`);
    }

    console.log(`   Prod System Owner (${prodUserId}):`);
    if (prodUser) {
      console.log(`      ✅ Found in database`);
      console.log(`      Role: ${prodUser.role?.name || 'NO_ROLE'} (Level: ${prodUser.role?.level || 'N/A'})`);
      console.log(`      Country: ${prodUser.country?.name || 'None'}`);
      console.log(`      Active: ${prodUser.isActive}`);
    } else {
      console.log(`      ❌ Not found in database`);
    }

    // 4. Check for orphaned country links
    console.log("\n🔗 Step 4: Checking for orphaned country links...");
    const usersWithCountries = allUsers.filter(u => u.countryId);
    const countryIds = await prisma.country.findMany({
      select: { id: true }
    });
    const validCountryIds = new Set(countryIds.map(c => c.id));

    const orphanedLinks = usersWithCountries.filter(u => !validCountryIds.has(u.countryId!));
    result.orphanedCountryLinks = orphanedLinks;

    if (orphanedLinks.length > 0) {
      console.log(`   ❌ Found ${orphanedLinks.length} users with orphaned country links:`);
      orphanedLinks.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.clerkUserId} -> Country ID: ${user.countryId} (not found)`);
      });
    } else {
      console.log("   ✅ No orphaned country links found");
    }

    // 5. Test UserManagementService
    console.log("\n🧪 Step 5: Testing UserManagementService...");
    try {
      const userService = new UserManagementService(prisma);
      
      // Test with a known system owner ID
      const testUserId = devUserId;
      const testUser = await userService.getOrCreateUser(testUserId);
      
      if (testUser) {
        result.userManagementServiceTest.success = true;
        console.log(`   ✅ UserManagementService working correctly`);
        console.log(`      Retrieved user: ${testUser.clerkUserId}`);
        console.log(`      Role: ${testUser.role?.name || 'NO_ROLE'}`);
        console.log(`      Is System Owner: ${isSystemOwner(testUser.clerkUserId)}`);
      } else {
        result.userManagementServiceTest.success = false;
        result.userManagementServiceTest.error = "Failed to retrieve user";
        console.log(`   ❌ UserManagementService failed to retrieve user`);
      }
    } catch (error) {
      result.userManagementServiceTest.success = false;
      result.userManagementServiceTest.error = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ UserManagementService test failed: ${result.userManagementServiceTest.error}`);
    }

    // 6. Summary
    console.log("\n📋 Verification Summary");
    console.log("======================");
    console.log(`Total Users: ${result.totalUsers}`);
    console.log(`Duplicate Groups: ${result.duplicateUsers.length}`);
    console.log(`Users Without Roles: ${result.usersWithoutRoles.length}`);
    console.log(`Dev System Owner: ${result.systemOwnerStatus.dev ? '✅' : '❌'}`);
    console.log(`Prod System Owner: ${result.systemOwnerStatus.prod ? '✅' : '❌'}`);
    console.log(`Orphaned Country Links: ${result.orphanedCountryLinks.length}`);
    console.log(`UserManagementService: ${result.userManagementServiceTest.success ? '✅' : '❌'}`);

    const hasIssues = result.duplicateUsers.length > 0 || 
                     result.usersWithoutRoles.length > 0 || 
                     !result.systemOwnerStatus.dev || 
                     !result.systemOwnerStatus.prod ||
                     result.orphanedCountryLinks.length > 0 ||
                     !result.userManagementServiceTest.success;

    if (hasIssues) {
      console.log("\n⚠️  Issues found that need attention:");
      if (result.duplicateUsers.length > 0) {
        console.log("   - Duplicate user records detected");
      }
      if (result.usersWithoutRoles.length > 0) {
        console.log("   - Users without roles detected");
      }
      if (!result.systemOwnerStatus.dev || !result.systemOwnerStatus.prod) {
        console.log("   - System owner configuration incomplete");
      }
      if (result.orphanedCountryLinks.length > 0) {
        console.log("   - Orphaned country links detected");
      }
      if (!result.userManagementServiceTest.success) {
        console.log("   - UserManagementService not working correctly");
      }
    } else {
      console.log("\n🎉 All user management systems are working correctly!");
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

// Run the verification
verifyUserManagement()
  .then(() => {
    console.log("\n✅ User management verification completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ User management verification failed:", error);
    process.exit(1);
  });

export { verifyUserManagement };
