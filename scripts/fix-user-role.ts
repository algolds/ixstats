#!/usr/bin/env tsx

/**
 * Script to fix the user role issue
 * The tRPC context is overriding the user role with upsert
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_USER_ID = "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo";

async function fixUserRole() {
  try {
    console.log("🔧 Fixing user role issue");
    console.log("==========================");
    console.log(`Fixing user: ${DEV_USER_ID}`);
    console.log("");

    // Step 1: Find the user record
    console.log("🔍 Step 1: Finding user record...");
    const user = await prisma.user.findUnique({
      where: { clerkUserId: DEV_USER_ID },
      include: { role: true, country: true },
    });

    if (!user) {
      console.log("❌ User not found!");
      return;
    }

    console.log("✅ User found:");
    console.log(`   ID: ${user.id}`);
    console.log(
      `   Current Role: ${user.role?.name || "none"} (Level: ${user.role?.level || "N/A"})`
    );
    console.log(`   Current Country: ${user.country?.name || "none"}`);
    console.log("");

    // Step 2: Find the owner role
    console.log("🔍 Step 2: Finding owner role...");
    const ownerRole = await prisma.role.findFirst({
      where: { name: "owner" },
    });

    if (!ownerRole) {
      console.log("❌ Owner role not found!");
      return;
    }

    console.log(`✅ Owner role found: ${ownerRole.id} (Level: ${ownerRole.level})`);
    console.log("");

    // Step 3: Find Caphiria country
    console.log("🔍 Step 3: Finding Caphiria country...");
    const caphiria = await prisma.country.findFirst({
      where: { name: "Caphiria" },
    });

    if (!caphiria) {
      console.log("❌ Caphiria country not found!");
      return;
    }

    console.log(`✅ Caphiria found: ${caphiria.id} (${caphiria.name})`);
    console.log("");

    // Step 4: Update user to have owner role and Caphiria
    console.log("🔧 Step 4: Updating user record...");
    const updatedUser = await prisma.user.update({
      where: { clerkUserId: DEV_USER_ID },
      data: {
        roleId: ownerRole.id,
        countryId: caphiria.id,
      },
      include: { role: true, country: true },
    });

    console.log("✅ User updated successfully:");
    console.log(`   Role: ${updatedUser.role?.name} (Level: ${updatedUser.role?.level})`);
    console.log(`   Country: ${updatedUser.country?.name}`);
    console.log("");

    // Step 5: Verify the fix
    console.log("🔍 Step 5: Verifying fix...");
    const verifyUser = await prisma.user.findUnique({
      where: { clerkUserId: DEV_USER_ID },
      include: { role: true, country: true },
    });

    if (verifyUser?.role?.name === "owner" && verifyUser?.country?.name === "Caphiria") {
      console.log("✅ Fix successful!");
      console.log("The user now has the correct role and country access.");
    } else {
      console.log("❌ Fix failed!");
      console.log(`   Role: ${verifyUser?.role?.name || "none"}`);
      console.log(`   Country: ${verifyUser?.country?.name || "none"}`);
    }

    console.log("\n💡 Next Steps:");
    console.log("1. Refresh the debug page in your browser");
    console.log("2. You should now see the correct role and country data");
    console.log("3. Try accessing /mycountry to test Caphiria access");
  } catch (error) {
    console.error("❌ Error fixing user role:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserRole();
