#!/usr/bin/env tsx
/**
 * Fix Country Names - Remove Trailing Spaces
 *
 * This script removes trailing spaces from country names in the database
 * to ensure consistent flag loading and data integrity.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking for country names with trailing/leading spaces...\n");

  try {
    // Get all countries
    const countries = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    let fixedCount = 0;
    const issues: Array<{ original: string; fixed: string }> = [];

    // Check each country name
    for (const country of countries) {
      const trimmedName = country.name.trim();

      if (country.name !== trimmedName) {
        issues.push({
          original: `"${country.name}"`,
          fixed: `"${trimmedName}"`,
        });

        // Update the country name
        await prisma.country.update({
          where: { id: country.id },
          data: { name: trimmedName },
        });

        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      console.log(`✅ Fixed ${fixedCount} country names:\n`);
      issues.forEach(({ original, fixed }) => {
        console.log(`   ${original} → ${fixed}`);
      });
    } else {
      console.log("✅ No trailing/leading spaces found. All country names are clean!");
    }

    console.log(`\n📊 Total countries checked: ${countries.length}`);
    console.log(`🔧 Countries fixed: ${fixedCount}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
