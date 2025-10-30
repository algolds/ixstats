#!/usr/bin/env tsx
/**
 * Remove checkmarks (✔) from all country names
 */

import { PrismaClient } from "@prisma/client";

// Note: Uses DATABASE_URL from environment (PostgreSQL, October 2025)
const prisma = new PrismaClient();

async function removeCheckmarks() {
  console.log("🔍 Finding countries with checkmarks...\n");

  try {
    // Get all countries with checkmarks
    const countriesWithCheckmarks = await prisma.country.findMany({
      where: {
        name: {
          contains: "✔",
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`📊 Found ${countriesWithCheckmarks.length} countries with checkmarks\n`);

    if (countriesWithCheckmarks.length === 0) {
      console.log("✅ No checkmarks found!\n");
      return;
    }

    console.log("🔄 Removing checkmarks from country names...\n");

    let updated = 0;
    for (const country of countriesWithCheckmarks) {
      const cleanName = country.name.replace(/\s*✔\s*/g, "").trim();

      await prisma.country.update({
        where: { id: country.id },
        data: { name: cleanName },
      });

      console.log(`   ✓ "${country.name}" → "${cleanName}"`);
      updated++;
    }

    console.log(`\n✅ Updated ${updated} country names\n`);

    // Show sample of cleaned names
    const sample = await prisma.country.findMany({
      take: 10,
      orderBy: { name: "asc" },
      select: { name: true },
    });

    console.log("📋 Sample of cleaned names:");
    sample.forEach((c) => console.log(`   - ${c.name}`));
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeCheckmarks().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
