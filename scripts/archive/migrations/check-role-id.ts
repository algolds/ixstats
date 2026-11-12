#!/usr/bin/env tsx
import { createPrismaClient } from "~/server/prisma-client";

/**
 * Script to check what role ID cmgn9cbl600244kyxt8z60ola corresponds to
 */

const prisma = createPrismaClient();

const ROLE_ID = "cmgn9cbl600244kyxt8z60ola";

async function checkRoleId() {
  try {
    console.log("🔍 Checking role ID");
    console.log("===================");
    console.log(`Checking role ID: ${ROLE_ID}`);
    console.log("");

    // Check what role this ID corresponds to
    const role = await prisma.role.findUnique({
      where: { id: ROLE_ID },
    });

    if (role) {
      console.log("✅ Role found:");
      console.log(`   ID: ${role.id}`);
      console.log(`   Name: ${role.name}`);
      console.log(`   Display Name: ${role.displayName}`);
      console.log(`   Level: ${role.level}`);
      console.log(`   Is System: ${role.isSystem}`);
      console.log(`   Is Active: ${role.isActive}`);
    } else {
      console.log("❌ Role not found!");
    }

    console.log("");

    // Check all roles to see what's available
    console.log("📊 All available roles:");
    const allRoles = await prisma.role.findMany({
      orderBy: { level: "asc" },
    });

    allRoles.forEach((role, index) => {
      console.log(`   ${index + 1}. ${role.name} (ID: ${role.id}, Level: ${role.level})`);
    });

    console.log("");

    // Check the current user's role
    console.log("🔍 Current user's role:");
    const user = await prisma.user.findUnique({
      where: { clerkUserId: "user_2zqmDdZvhpNQWGLdAIj2YwH8MLo" },
      include: { role: true },
    });

    if (user) {
      console.log(`   User ID: ${user.id}`);
      console.log(`   Role ID: ${user.roleId}`);
      console.log(`   Role Name: ${user.role?.name || "none"}`);
      console.log(`   Role Level: ${user.role?.level || "N/A"}`);
    } else {
      console.log("❌ User not found!");
    }
  } catch (error) {
    console.error("❌ Error checking role ID:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoleId();
