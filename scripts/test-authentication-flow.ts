#!/usr/bin/env tsx

/**
 * Comprehensive Authentication Flow Test
 *
 * This script tests the complete authentication and country linking system
 * to ensure all fixes are working correctly.
 *
 * Run with: npx tsx scripts/test-authentication-flow.ts
 */

import { PrismaClient } from "@prisma/client";
import { isSystemOwner, SYSTEM_OWNER_IDS } from "../src/lib/system-owner-constants";

const db = new PrismaClient();

async function testAuthenticationFlow() {
  console.log("🔍 Testing Authentication and Country Linking Flow...\n");

  try {
    // Test 1: System Owner Constants
    console.log("📋 Test 1: System Owner Constants");
    console.log("=".repeat(50));

    for (const systemOwnerId of SYSTEM_OWNER_IDS) {
      const isOwner = isSystemOwner(systemOwnerId);
      console.log(`✅ ${systemOwnerId}: ${isOwner ? "System Owner" : "NOT System Owner"}`);
    }

    // Test non-system owner
    const nonSystemOwner = isSystemOwner("user_random123");
    console.log(`❌ user_random123: ${nonSystemOwner ? "System Owner" : "NOT System Owner"}`);
    console.log();

    // Test 2: User Records
    console.log("📋 Test 2: User Records");
    console.log("=".repeat(50));

    const users = await db.user.findMany({
      include: { role: true, country: true },
      orderBy: { clerkUserId: "asc" },
    });

    console.log(`Total users in database: ${users.length}`);

    for (const user of users) {
      const isOwner = isSystemOwner(user.clerkUserId);
      const roleInfo = user.role ? `${user.role.name} (Level: ${user.role.level})` : "NO_ROLE";
      const countryInfo = user.country ? user.country.name : "NO_COUNTRY";

      const status = isOwner ? "🏆" : "👤";
      console.log(`${status} ${user.clerkUserId}: ${roleInfo}, ${countryInfo}`);
    }
    console.log();

    // Test 3: System Owner Validation
    console.log("📋 Test 3: System Owner Validation");
    console.log("=".repeat(50));

    const systemOwnerUser = await db.user.findUnique({
      where: { clerkUserId: "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo" },
      include: { role: true, country: true },
    });

    if (systemOwnerUser) {
      console.log(`✅ System Owner Found: ${systemOwnerUser.clerkUserId}`);
      console.log(
        `   Role: ${systemOwnerUser.role?.name || "NO_ROLE"} (Level: ${systemOwnerUser.role?.level ?? "N/A"})`
      );
      console.log(`   Country: ${systemOwnerUser.country?.name || "NO_COUNTRY"}`);
      console.log(`   Is System Owner: ${isSystemOwner(systemOwnerUser.clerkUserId)}`);

      // Validate role level
      const hasCorrectRole = systemOwnerUser.role?.level === 0;
      console.log(`   Has Correct Role Level: ${hasCorrectRole ? "✅" : "❌"}`);

      // Validate country link
      const hasCountryLink = !!systemOwnerUser.countryId;
      console.log(`   Has Country Link: ${hasCountryLink ? "✅" : "❌"}`);
    } else {
      console.log(`❌ System Owner NOT Found in Database`);
    }
    console.log();

    // Test 4: Country Access
    console.log("📋 Test 4: Country Access");
    console.log("=".repeat(50));

    const caphiria = await db.country.findUnique({
      where: { slug: "caphiria" },
      include: { users: true },
    });

    if (caphiria) {
      console.log(`✅ Caphiria Found: ${caphiria.name} (ID: ${caphiria.id})`);

      const usersLinkedToCaphiria = await db.user.findMany({
        where: { countryId: caphiria.id },
        include: { role: true },
      });

      console.log(`   Users linked to Caphiria: ${usersLinkedToCaphiria.length}`);
      usersLinkedToCaphiria.forEach((user, index) => {
        const isOwner = isSystemOwner(user.clerkUserId);
        const roleInfo = user.role ? `${user.role.name} (Level: ${user.role.level})` : "NO_ROLE";
        console.log(`   ${index + 1}. ${user.clerkUserId}: ${roleInfo} ${isOwner ? "🏆" : ""}`);
      });
    } else {
      console.log(`❌ Caphiria NOT Found in Database`);
    }
    console.log();

    // Test 5: Duplicate Check
    console.log("📋 Test 5: Duplicate User Check");
    console.log("=".repeat(50));

    const userGroups = new Map<string, any[]>();

    for (const user of users) {
      if (!userGroups.has(user.clerkUserId)) {
        userGroups.set(user.clerkUserId, []);
      }
      userGroups.get(user.clerkUserId)!.push(user);
    }

    let duplicateCount = 0;
    for (const [clerkUserId, userList] of userGroups) {
      if (userList.length > 1) {
        duplicateCount++;
        console.log(`❌ DUPLICATE: ${clerkUserId} has ${userList.length} records`);
      }
    }

    if (duplicateCount === 0) {
      console.log(`✅ No duplicate user records found`);
    } else {
      console.log(`❌ Found ${duplicateCount} duplicate user groups`);
    }
    console.log();

    // Test 6: Summary
    console.log("📊 Test Summary");
    console.log("=".repeat(50));

    const systemOwnerCount = users.filter((user) => isSystemOwner(user.clerkUserId)).length;
    const usersWithCountries = users.filter((user) => user.countryId).length;
    const usersWithRoles = users.filter((user) => user.role).length;

    console.log(`✅ System Owners: ${systemOwnerCount}/${SYSTEM_OWNER_IDS.length}`);
    console.log(`✅ Users with Countries: ${usersWithCountries}/${users.length}`);
    console.log(`✅ Users with Roles: ${usersWithRoles}/${users.length}`);
    console.log(`✅ No Duplicates: ${duplicateCount === 0 ? "YES" : "NO"}`);

    if (
      systemOwnerCount === SYSTEM_OWNER_IDS.length &&
      usersWithCountries > 0 &&
      usersWithRoles > 0 &&
      duplicateCount === 0
    ) {
      console.log("\n🎉 All authentication tests PASSED!");
      console.log("✅ System is ready for production use");
    } else {
      console.log("\n⚠️ Some authentication tests FAILED!");
      console.log("❌ System needs attention before production use");
    }
  } catch (error) {
    console.error("❌ Error during authentication flow test:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testAuthenticationFlow().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
