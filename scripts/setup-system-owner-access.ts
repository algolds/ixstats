#!/usr/bin/env tsx

/**
 * Script to set up system owner access for multiple Clerk IDs
 * This creates user records with system owner privileges and handles country access
 */

import { PrismaClient } from "@prisma/client";
import { UserManagementService } from "../src/lib/user-management-service";

const prisma = new PrismaClient();

// Your specific user IDs
const DEV_USER_ID = 'user_2zqmDdZvhpNQWGLdAIj2YwH8MLo';
const PROD_USER_ID = 'user_3078Ja62W7yJDlBjjwNppfzceEz';
const COUNTRY_NAME = 'Caphiria';

async function setupSystemOwnerAccess() {
  try {
    console.log("🔐 Setting up system owner access for multiple Clerk IDs");
    console.log("=======================================================");
    console.log(`Dev User ID: ${DEV_USER_ID}`);
    console.log(`Prod User ID: ${PROD_USER_ID}`);
    console.log(`Target Country: ${COUNTRY_NAME}`);
    console.log("");

    // Step 1: Find the Caphiria country
    console.log("🔍 Step 1: Finding Caphiria country...");
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

    // Step 2: Ensure owner role exists
    console.log("\n🔍 Step 2: Ensuring owner role exists...");
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

    // Step 3: Create/update user records for both IDs
    console.log("\n🔍 Step 3: Setting up user records...");
    
    const users: any[] = [];
    
    for (const [userId, env] of [[DEV_USER_ID, 'DEV'], [PROD_USER_ID, 'PROD']]) {
      console.log(`\nProcessing ${env} user: ${userId}`);
      
      // Check if user exists
      let user: any = await prisma.user.findUnique({
        where: { clerkUserId: userId },
        include: { role: true, country: true }
      });

      if (user) {
        console.log(`  ✅ User exists (ID: ${user.id})`);
        console.log(`  Current role: ${user.role?.name || 'none'} (level ${user.role?.level || 'N/A'})`);
        console.log(`  Current country: ${user.country?.name || 'none'}`);
      } else {
        console.log(`  ⚠️  User not found, creating...`);
        // Use centralized UserManagementService for consistent user creation
        const userService = new UserManagementService(prisma);
        const createdUser = await userService.getOrCreateUser(userId);
        if (createdUser) {
          // Re-fetch the user with full relations to match expected type
          user = await prisma.user.findUnique({
            where: { clerkUserId: userId },
            include: { role: true, country: true }
          });
          if (user) {
            console.log(`  ✅ Created user: ${user.id}`);
          } else {
            console.error(`  ❌ Failed to fetch created user: ${userId}`);
            continue;
          }
        } else {
          console.error(`  ❌ Failed to create user: ${userId}`);
          continue;
        }
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

      users.push(user);
    }

    // Step 4: Handle country access
    console.log("\n🔍 Step 4: Setting up country access...");
    
    // Check if any user is currently linked to Caphiria
    const currentOwner = await prisma.user.findFirst({
      where: { countryId: country.id },
      include: { role: true }
    });

    if (currentOwner) {
      console.log(`📋 Caphiria is currently owned by: ${currentOwner.clerkUserId}`);
      console.log(`   Role: ${currentOwner.role?.name} (level ${currentOwner.role?.level})`);
      
      // If the current owner is not a system owner, we need to handle this
      if (currentOwner.role?.level !== 0) {
        console.log("⚠️  Current owner is not a system owner. This may cause issues.");
        console.log("💡 Consider unlinking the current owner or promoting them to system owner.");
      }
    } else {
      console.log("📋 Caphiria is currently unclaimed");
      
      // Link the prod user to Caphiria (since that's the "main" account)
      console.log("🔗 Linking PROD user to Caphiria...");
      await prisma.user.update({
        where: { clerkUserId: PROD_USER_ID },
        data: { countryId: country.id }
      });
      console.log("✅ PROD user linked to Caphiria");
    }

    // Step 5: Verify the setup
    console.log("\n🔍 Step 5: Verifying setup...");
    
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

    console.log("\n🎉 System owner access setup complete!");
    console.log("\n💡 Important Notes:");
    console.log("1. Both users now have system owner privileges (level 0)");
    console.log("2. Only one user can be 'linked' to a country at a time due to database constraints");
    console.log("3. As system owners, both users can access all countries and admin functions");
    console.log("4. The PROD user is linked to Caphiria for normal country operations");
    console.log("5. The DEV user can access Caphiria through admin functions");
    console.log("\n🔧 To switch country ownership:");
    console.log("   - Use admin functions to reassign country ownership");
    console.log("   - Both users have full admin access to manage this");

  } catch (error) {
    console.error('❌ Error setting up system owner access:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupSystemOwnerAccess();
