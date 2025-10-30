#!/usr/bin/env tsx

/**
 * Script to help find your Clerk user ID for system owner setup
 * This will show you how to get your user ID from Clerk
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function findUserInfo() {
  try {
    console.log("🔍 Finding User Information for System Owner Setup");
    console.log("==================================================");

    // Get all users from the database
    const users = await prisma.user.findMany({
      include: {
        role: true,
        country: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`\n📊 Found ${users.length} users in the database:`);
    console.log("");

    users.forEach((user, index) => {
      console.log(`${index + 1}. Clerk ID: ${user.clerkUserId}`);
      console.log(`   Name: ${user.name || "Not set"}`);
      console.log(`   Email: ${user.email || "Not set"}`);
      console.log(`   Role: ${user.role?.name || "No role"} (Level: ${user.role?.level || "N/A"})`);
      console.log(`   Country: ${user.country?.name || "Not linked"}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log("");
    });

    // Check current system owner IDs
    const SYSTEM_OWNERS = [
      "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo", // Dev environment
      "user_3078Ja62W7yJDlBjjwNppfzceEz", // Production environment
    ];

    console.log("🔐 Current System Owner IDs:");
    SYSTEM_OWNERS.forEach((id, index) => {
      const user = users.find((u) => u.clerkUserId === id);
      if (user) {
        console.log(`   ${index + 1}. ${id} ✅ (Found in database)`);
        console.log(`      Name: ${user.name || "Not set"}`);
        console.log(`      Role: ${user.role?.name || "No role"}`);
      } else {
        console.log(`   ${index + 1}. ${id} ❌ (Not found in database)`);
      }
    });

    console.log("\n💡 How to get your Clerk User ID:");
    console.log("1. Start the development server: npm run dev");
    console.log("2. Go to http://localhost:3000");
    console.log("3. Sign in with your Clerk account");
    console.log("4. Open browser developer tools (F12)");
    console.log("5. Go to Console tab");
    console.log("6. Type: window.Clerk.user.id");
    console.log("7. Copy the user ID that appears");
    console.log("");
    console.log("8. Then run: npm run set-admin-role");
    console.log("   This will add your user ID to the system owner list");
  } catch (error) {
    console.error("❌ Error finding user information:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findUserInfo();
