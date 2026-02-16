/**
 * Link Dev User to Country
 *
 * This script links your development Clerk user ID to a specified country.
 * Use this to ensure your dev user has the same country access as your prod user.
 *
 * Usage:
 *   npx tsx scripts/link-dev-user-to-country.ts [countryName]
 *
 * Examples:
 *   npx tsx scripts/link-dev-user-to-country.ts Caphiria
 *   npx tsx scripts/link-dev-user-to-country.ts "Caphiria"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const countryName = process.argv[2] || "Caphiria";

  // Get SYSTEM_OWNER_IDS from environment
  const systemOwnerIds = (process.env.SYSTEM_OWNER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.startsWith("user_"));

  if (systemOwnerIds.length === 0) {
    console.error("❌ No SYSTEM_OWNER_IDS found in environment.");
    console.error("   Make sure .env.local or .env.local.dev has SYSTEM_OWNER_IDS set.");
    process.exit(1);
  }

  console.log(`\n🔍 Looking for country: "${countryName}"`);

  // Find the country
  const country = await prisma.country.findFirst({
    where: {
      name: {
        equals: countryName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      users: {
        select: {
          clerkUserId: true,
        },
      },
    },
  });

  if (!country) {
    console.error(`❌ Country "${countryName}" not found.`);

    // Show available countries
    const countries = await prisma.country.findMany({
      take: 10,
      orderBy: { name: "asc" },
      select: { name: true },
    });
    console.log("\n   Available countries (first 10):");
    countries.forEach((c) => console.log(`   - ${c.name}`));
    process.exit(1);
  }

  console.log(`✅ Found country: ${country.name} (ID: ${country.id})`);
  console.log(`   Currently linked users: ${country.users.map((u) => u.clerkUserId).join(", ") || "none"}`);

  // Link each system owner to the country
  console.log(`\n📎 Linking ${systemOwnerIds.length} system owner(s) to ${country.name}...`);

  for (const clerkUserId of systemOwnerIds) {
    // Check if user already linked
    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, countryId: true },
    });

    if (existingUser?.countryId === country.id) {
      console.log(`   ⏭️  ${clerkUserId} - already linked to ${country.name}`);
      continue;
    }

    // Upsert the user with the country link
    await prisma.user.upsert({
      where: { clerkUserId },
      update: { countryId: country.id },
      create: {
        clerkUserId,
        countryId: country.id,
      },
    });

    console.log(`   ✅ ${clerkUserId} - linked to ${country.name}`);
  }

  // Show final state
  const updatedCountry = await prisma.country.findUnique({
    where: { id: country.id },
    select: {
      name: true,
      users: {
        select: { clerkUserId: true },
      },
    },
  });

  console.log(`\n🎉 Done! ${updatedCountry?.name} is now linked to:`);
  updatedCountry?.users.forEach((u) => console.log(`   - ${u.clerkUserId}`));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
