#!/usr/bin/env tsx

/**
 * Script to check for duplicate user records and fix the issue
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_USER_ID = 'user_2zqmDdZvhpNQWGLdAIj2YwH8MLo';

async function checkDuplicateUsers() {
  try {
    console.log("🔍 Checking for duplicate user records");
    console.log("=====================================");
    console.log(`Checking user: ${DEV_USER_ID}`);
    console.log("");

    // Find ALL user records for this Clerk ID
    const allUsers = await prisma.user.findMany({
      where: { clerkUserId: DEV_USER_ID },
      include: { role: true, country: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${allUsers.length} user records for ${DEV_USER_ID}:`);
    console.log("");

    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.id}`);
      console.log(`   Clerk ID: ${user.clerkUserId}`);
      console.log(`   Role: ${user.role?.name || 'none'} (Level: ${user.role?.level || 'N/A'})`);
      console.log(`   Country: ${user.country?.name || 'none'}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log("");
    });

    if (allUsers.length > 1) {
      console.log("⚠️  DUPLICATE USER RECORDS FOUND!");
      console.log("This explains why the debug page shows different data.");
      console.log("");

      // Find the correct user record (the one with owner role and Caphiria)
      const correctUser = allUsers.find(u => 
        u.role?.name === 'owner' && 
        u.country?.name === 'Caphiria'
      );

      if (correctUser) {
        console.log("✅ Found the correct user record:");
        console.log(`   ID: ${correctUser.id}`);
        console.log(`   Role: ${correctUser.role?.name} (Level: ${correctUser.role?.level})`);
        console.log(`   Country: ${correctUser.country?.name}`);
        console.log("");

        // Find the incorrect user record (the one being used by the app)
        const incorrectUsers = allUsers.filter(u => u.id !== correctUser.id);
        
        console.log("❌ Found incorrect user record(s):");
        incorrectUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ID: ${user.id}`);
          console.log(`      Role: ${user.role?.name || 'none'} (Level: ${user.role?.level || 'N/A'})`);
          console.log(`      Country: ${user.country?.name || 'none'}`);
          console.log(`      Created: ${user.createdAt.toISOString()}`);
        });
        console.log("");

        console.log("🔧 Solution: Delete the incorrect user record(s)");
        console.log("This will force the app to use the correct user record.");
        console.log("");

        // Ask if we should delete the incorrect records
        console.log("Would you like me to delete the incorrect user record(s)?");
        console.log("This will fix the authentication issue.");
        
        // For now, just show what would be deleted
        console.log("\n📋 Records that would be deleted:");
        incorrectUsers.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.id} (created: ${user.createdAt.toISOString()})`);
        });

      } else {
        console.log("❌ Could not find the correct user record with owner role and Caphiria");
      }
    } else {
      console.log("✅ No duplicate user records found");
      console.log("The issue might be elsewhere.");
    }

  } catch (error) {
    console.error('❌ Error checking duplicate users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateUsers();
