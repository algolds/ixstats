/**
 * Fix Legacy Users with NULL roleId
 *
 * This script assigns the default "user" role to all users who were created
 * before the role system was implemented and have NULL roleId.
 *
 * Run with: npx tsx scripts/fix-legacy-users-roles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[MIGRATION] Starting legacy user role assignment...\n');

  // Find the default "user" role
  const defaultRole = await prisma.role.findFirst({
    where: { name: 'user', level: 100 },
  });

  if (!defaultRole) {
    throw new Error('Default "user" role not found! Cannot proceed with migration.');
  }

  console.log(`[MIGRATION] Found default user role: ${defaultRole.name} (ID: ${defaultRole.id}, Level: ${defaultRole.level})\n`);

  // Find all users with NULL roleId
  const usersWithoutRole = await prisma.user.findMany({
    where: {
      roleId: null,
    },
    select: {
      id: true,
      clerkUserId: true,
      countryId: true,
      createdAt: true,
    },
  });

  console.log(`[MIGRATION] Found ${usersWithoutRole.length} users with NULL roleId:\n`);

  usersWithoutRole.forEach((user, index) => {
    console.log(`  ${index + 1}. User ID: ${user.id}`);
    console.log(`     Clerk ID: ${user.clerkUserId}`);
    console.log(`     Country ID: ${user.countryId || 'None'}`);
    console.log(`     Created: ${user.createdAt.toISOString()}\n`);
  });

  if (usersWithoutRole.length === 0) {
    console.log('[MIGRATION] No users need role assignment. Exiting.');
    return;
  }

  // Confirm before proceeding
  console.log(`[MIGRATION] Will assign role "${defaultRole.name}" (${defaultRole.id}) to ${usersWithoutRole.length} users.\n`);

  // Update all users
  const result = await prisma.user.updateMany({
    where: {
      roleId: null,
    },
    data: {
      roleId: defaultRole.id,
    },
  });

  console.log(`[MIGRATION] ✅ Successfully updated ${result.count} users with default role.\n`);

  // Verify the update
  const verifyCount = await prisma.user.count({
    where: {
      roleId: null,
    },
  });

  if (verifyCount === 0) {
    console.log('[MIGRATION] ✅ Verification passed: No more users with NULL roleId.');
  } else {
    console.warn(`[MIGRATION] ⚠️  Warning: Still found ${verifyCount} users with NULL roleId after migration.`);
  }

  // Log the updated users
  console.log('\n[MIGRATION] Updated users:');
  const updatedUsers = await prisma.user.findMany({
    where: {
      id: { in: usersWithoutRole.map(u => u.id) },
    },
    select: {
      id: true,
      clerkUserId: true,
      roleId: true,
      role: {
        select: {
          name: true,
          level: true,
        },
      },
    },
  });

  updatedUsers.forEach((user, index) => {
    console.log(`  ${index + 1}. ${user.clerkUserId}`);
    console.log(`     Role: ${user.role?.name || 'ERROR: NO ROLE'} (Level: ${user.role?.level || 'N/A'})\n`);
  });

  console.log('[MIGRATION] Migration complete!');
}

main()
  .catch((error) => {
    console.error('[MIGRATION] ❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
