#!/usr/bin/env tsx

/**
 * Script to fix the User.countryId unique constraint issue
 * This script will:
 * 1. Drop the unique index on User.countryId
 * 2. Find Caphiria country ID
 * 3. Link dev user to Caphiria
 * 4. Clean up duplicate user records
 * 5. Display verification information
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// System owner IDs
const DEV_USER_ID = 'user_2zqmDdZvhpNQWGLdAIj2YwH8MLo';
const PROD_USER_ID = 'user_3078Ja62W7yJDlBjjwNppfzceEz';
const COUNTRY_NAME = 'Caphiria';

async function fixUserCountryConstraint() {
  try {
    console.log("🔧 Fixing User.countryId unique constraint issue");
    console.log("=================================================");
    console.log(`Dev User ID: ${DEV_USER_ID}`);
    console.log(`Prod User ID: ${PROD_USER_ID}`);
    console.log(`Target Country: ${COUNTRY_NAME}`);
    console.log("");

    // Step 1: Drop the unique index on User.countryId
    console.log("🔍 Step 1: Dropping unique index on User.countryId...");
    try {
      await prisma.$executeRaw`DROP INDEX IF EXISTS "User_countryId_key"`;
      console.log("✅ Unique index dropped successfully");
    } catch (error) {
      console.log("⚠️  Index may not exist or already dropped:", error);
    }

    // Step 2: Find Caphiria country
    console.log("\n🔍 Step 2: Finding Caphiria country...");
    const country = await prisma.country.findFirst({
      where: {
        name: {
          contains: COUNTRY_NAME
        }
      }
    });

    if (!country) {
      console.log("❌ Caphiria country not found!");
      throw new Error("Country not found");
    }

    console.log(`✅ Found Caphiria: ${country.name} (${country.id})`);

    // Step 3: Check current user records
    console.log("\n🔍 Step 3: Checking current user records...");
    const allUsers = await prisma.user.findMany({
      include: { role: true, country: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${allUsers.length} users in database:`);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.clerkUserId}`);
      console.log(`      Role: ${user.role?.name || 'none'} (level ${user.role?.level || 'N/A'})`);
      console.log(`      Country: ${user.country?.name || 'none'}`);
      console.log(`      Active: ${user.isActive}`);
      console.log("");
    });

    // Step 4: Clean up duplicate user records
    console.log("🔍 Step 4: Cleaning up duplicate user records...");
    
    // Find duplicates by clerkUserId
    const userGroups = allUsers.reduce((acc, user) => {
      if (!acc[user.clerkUserId]) {
        acc[user.clerkUserId] = [];
      }
      acc[user.clerkUserId].push(user);
      return acc;
    }, {} as Record<string, typeof allUsers>);

    const duplicates = Object.entries(userGroups).filter(([_, users]) => users.length > 1);
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate user records:`);
      for (const [clerkUserId, users] of duplicates) {
        console.log(`   Clerk ID: ${clerkUserId} (${users.length} records)`);
        // Keep the most recent active user, delete others
        const sortedUsers = users.sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        const keepUser = sortedUsers[0];
        const deleteUsers = sortedUsers.slice(1);
        
        console.log(`   Keeping: ${keepUser.id} (created: ${keepUser.createdAt.toISOString()})`);
        for (const user of deleteUsers) {
          console.log(`   Deleting: ${user.id} (created: ${user.createdAt.toISOString()})`);
          await prisma.user.delete({ where: { id: user.id } });
        }
      }
    } else {
      console.log("✅ No duplicate user records found");
    }

    // Step 5: Ensure system owner role exists
    console.log("\n🔍 Step 5: Ensuring system owner role exists...");
    let ownerRole = await prisma.role.findFirst({
      where: { name: 'owner' }
    });

    if (!ownerRole) {
      console.log("Creating owner role...");
      ownerRole = await prisma.role.create({
        data: {
          name: 'owner',
          displayName: 'System Owner',
          description: 'System owner with unrestricted access to all functions',
          level: 0,
          isSystem: true,
          isActive: true,
        }
      });
      console.log(`✅ Created owner role: ${ownerRole.id}`);
    } else {
      console.log(`✅ Owner role exists: ${ownerRole.id} (level ${ownerRole.level})`);
    }

    // Step 6: Create/update user records for both system owner IDs
    console.log("\n🔍 Step 6: Setting up system owner user records...");
    
    for (const [userId, env] of [[DEV_USER_ID, 'DEV'], [PROD_USER_ID, 'PROD']]) {
      console.log(`\nProcessing ${env} user: ${userId}`);
      
      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { clerkUserId: userId },
        include: { role: true, country: true }
      });

      if (user) {
        console.log(`  ✅ User exists (ID: ${user.id})`);
        console.log(`  Current role: ${user.role?.name || 'none'} (level ${user.role?.level || 'N/A'})`);
        console.log(`  Current country: ${user.country?.name || 'none'}`);
      } else {
        console.log(`  ⚠️  User not found, creating...`);
        user = await prisma.user.create({
          data: {
            clerkUserId: userId,
            roleId: ownerRole.id,
            isActive: true,
          },
          include: { role: true, country: true }
        });
        console.log(`  ✅ Created user: ${user.id}`);
      }

      // Update user to have owner role
      if (user.roleId !== ownerRole.id) {
        await prisma.user.update({
          where: { clerkUserId: userId },
          data: { roleId: ownerRole.id }
        });
        console.log(`  🔄 Updated role to "owner"`);
      } else {
        console.log(`  ✅ User already has owner role`);
      }
    }

    // Step 7: Link dev user to Caphiria
    console.log("\n🔍 Step 7: Linking dev user to Caphiria...");
    
    // Check if any user is currently linked to Caphiria
    const currentOwner = await prisma.user.findFirst({
      where: { countryId: country.id },
      include: { role: true }
    });

    if (currentOwner) {
      console.log(`📋 Caphiria is currently owned by: ${currentOwner.clerkUserId}`);
      console.log(`   Role: ${currentOwner.role?.name} (level ${currentOwner.role?.level})`);
      
      // If it's the prod user, that's fine - we'll link the dev user too
      if (currentOwner.clerkUserId === PROD_USER_ID) {
        console.log("✅ PROD user is already linked to Caphiria");
      }
    } else {
      console.log("📋 Caphiria is currently unclaimed");
    }

    // Link the dev user to Caphiria
    console.log("🔗 Linking DEV user to Caphiria...");
    await prisma.user.update({
      where: { clerkUserId: DEV_USER_ID },
      data: { countryId: country.id }
    });
    console.log("✅ DEV user linked to Caphiria");

    // Step 8: Verify the setup
    console.log("\n🔍 Step 8: Verifying setup...");
    
    const devUser = await prisma.user.findUnique({
      where: { clerkUserId: DEV_USER_ID },
      include: { role: true, country: true }
    });
    
    const prodUser = await prisma.user.findUnique({
      where: { clerkUserId: PROD_USER_ID },
      include: { role: true, country: true }
    });

    console.log("\n📊 Final Status:");
    console.log("================");
    
    if (devUser) {
      console.log(`✅ DEV User (${DEV_USER_ID}):`);
      console.log(`   Role: ${devUser.role?.name} (level ${devUser.role?.level})`);
      console.log(`   Country: ${devUser.country?.name || 'none'}`);
      console.log(`   Active: ${devUser.isActive}`);
    } else {
      console.log(`❌ DEV User not found`);
    }

    if (prodUser) {
      console.log(`✅ PROD User (${PROD_USER_ID}):`);
      console.log(`   Role: ${prodUser.role?.name} (level ${prodUser.role?.level})`);
      console.log(`   Country: ${prodUser.country?.name || 'none'}`);
      console.log(`   Active: ${prodUser.isActive}`);
    } else {
      console.log(`❌ PROD User not found`);
    }

    // Check all users linked to Caphiria
    const caphiriaUsers = await prisma.user.findMany({
      where: { countryId: country.id },
      include: { role: true }
    });

    console.log(`\n🏛️  Users linked to Caphiria: ${caphiriaUsers.length}`);
    caphiriaUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.clerkUserId} (${user.role?.name || 'no role'})`);
    });

    console.log("\n🎉 Fix completed successfully!");
    console.log("\n💡 Next Steps:");
    console.log("1. Run: npx prisma generate");
    console.log("2. Restart your dev server: npm run dev");
    console.log("3. Check the debug page: http://localhost:3000/debug");
    console.log("4. Verify you can access /mycountry");
    console.log("\n🔧 The unique constraint has been removed, allowing multiple system owners to access the same country.");

  } catch (error) {
    console.error('❌ Error fixing user country constraint:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserCountryConstraint();
