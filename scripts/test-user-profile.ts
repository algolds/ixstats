#!/usr/bin/env tsx

/**
 * Test script to verify user profile data is correctly stored and retrieved
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_USER_ID = 'user_2zqmDdZvhpNQWGLdAIj2YwH8MLo';

async function testUserProfile() {
  try {
    console.log("🔍 Testing User Profile Data");
    console.log("============================");
    console.log(`Testing user: ${DEV_USER_ID}`);
    console.log("");

    // Step 1: Check user record directly
    console.log("📊 Step 1: Direct database query...");
    const user = await prisma.user.findUnique({
      where: { clerkUserId: DEV_USER_ID },
      include: { 
        country: {
          include: {
            dmInputs: {
              where: { isActive: true },
              orderBy: { ixTimeTimestamp: "desc" },
            },
          },
        },
        role: true 
      }
    });

    if (!user) {
      console.log("❌ User not found in database");
      return;
    }

    console.log("✅ User found:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Clerk ID: ${user.clerkUserId}`);
    console.log(`   Country ID: ${user.countryId || 'None'}`);
    console.log(`   Country Name: ${user.country?.name || 'None'}`);
    console.log(`   Role: ${user.role?.name || 'None'} (Level: ${user.role?.level || 'N/A'})`);
    console.log(`   Active: ${user.isActive}`);
    console.log("");

    // Step 2: Test the exact query from getProfile
    console.log("📊 Step 2: Testing getProfile query logic...");
    
    const clerkUserId = DEV_USER_ID;
    const countryArgs = {
      include: {
        dmInputs: {
          where: { isActive: true },
          orderBy: { ixTimeTimestamp: "desc" },
        },
      },
    } as const;

    let userRecord: any = null;
    let countryRecord: any = null;

    // This is the exact logic from getProfile
    userRecord = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        country: countryArgs,
        role: true,
      },
    }) as any;

    if (userRecord) {
      countryRecord = userRecord?.country ?? null;
    }

    // If we still don't have country details, attempt to load with dmInputs for completeness
    if (!countryRecord && userRecord?.countryId) {
      countryRecord = await prisma.country.findUnique({
        where: { id: userRecord.countryId },
        include: countryArgs.include,
      });
    }

    const result = {
      userId: clerkUserId,
      countryId: countryRecord?.id ?? null,
      country: countryRecord,
      hasCompletedSetup: Boolean(countryRecord),
    };

    console.log("✅ getProfile result:");
    console.log(`   User ID: ${result.userId}`);
    console.log(`   Country ID: ${result.countryId || 'None'}`);
    console.log(`   Country Name: ${result.country?.name || 'None'}`);
    console.log(`   Has Completed Setup: ${result.hasCompletedSetup}`);
    console.log("");

    // Step 3: Check if there are any issues with the relationship
    console.log("📊 Step 3: Checking relationship integrity...");
    
    if (userRecord?.countryId && !countryRecord) {
      console.log("⚠️  User has countryId but country record not found!");
      
      // Try to find the country directly
      const directCountry = await prisma.country.findUnique({
        where: { id: userRecord.countryId }
      });
      
      if (directCountry) {
        console.log(`✅ Country found directly: ${directCountry.name} (${directCountry.id})`);
      } else {
        console.log("❌ Country not found in database!");
      }
    } else if (countryRecord) {
      console.log(`✅ Relationship intact: User linked to ${countryRecord.name}`);
    } else {
      console.log("❌ No country relationship found");
    }

    console.log("\n🎯 Summary:");
    console.log("============");
    if (result.countryId && result.hasCompletedSetup) {
      console.log("✅ User profile is correctly configured");
      console.log("✅ Country access should work in the application");
    } else {
      console.log("❌ User profile has issues");
      console.log("❌ Country access may not work properly");
    }

  } catch (error) {
    console.error('❌ Error testing user profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserProfile();
