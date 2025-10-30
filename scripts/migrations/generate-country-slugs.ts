#!/usr/bin/env npx tsx

/**
 * Generate Country Slugs Migration Script
 *
 * This script generates slugs for all countries that don't have them.
 * It ensures all countries have proper slugs for the /nation/{slug} URL format.
 */

import { PrismaClient } from "@prisma/client";
import { generateSlug } from "../../src/lib/slug-utils";

const prisma = new PrismaClient();

interface Country {
  id: string;
  name: string;
  slug?: string | null;
}

async function generateCountrySlugs() {
  console.log("🔄 Starting country slug generation...");

  try {
    // Get all countries
    const countries = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`📊 Found ${countries.length} countries total`);

    // Find countries without slugs
    const countriesWithoutSlugs = countries.filter((country) => !country.slug);
    console.log(`🔍 Found ${countriesWithoutSlugs.length} countries without slugs`);

    if (countriesWithoutSlugs.length === 0) {
      console.log("✅ All countries already have slugs!");
      return;
    }

    // Generate slugs and check for duplicates
    const slugUpdates: Array<{ id: string; name: string; newSlug: string }> = [];
    const usedSlugs = new Set<string>();

    // First, collect all existing slugs
    countries.forEach((country) => {
      if (country.slug) {
        usedSlugs.add(country.slug);
      }
    });

    // Generate new slugs
    for (const country of countriesWithoutSlugs) {
      let baseSlug = generateSlug(country.name);
      let finalSlug = baseSlug;
      let counter = 1;

      // Ensure uniqueness
      while (usedSlugs.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      usedSlugs.add(finalSlug);
      slugUpdates.push({
        id: country.id,
        name: country.name,
        newSlug: finalSlug,
      });
    }

    console.log(`📝 Generated ${slugUpdates.length} new slugs`);

    // Show what will be updated
    console.log("\n📋 Slugs to be generated:");
    slugUpdates.forEach(({ name, newSlug }) => {
      console.log(`  ${name} → ${newSlug}`);
    });

    // Confirm before proceeding
    console.log("\n⚠️  This will update the database. Continue? (y/N)");

    // For automated scripts, you might want to add a --force flag
    // For now, we'll just proceed since this is a migration script
    console.log("🤖 Auto-proceeding with updates...");

    // Update the database
    let successCount = 0;
    let errorCount = 0;

    for (const update of slugUpdates) {
      try {
        await prisma.country.update({
          where: { id: update.id },
          data: { slug: update.newSlug },
        });
        successCount++;
        console.log(`✅ Updated ${update.name} → ${update.newSlug}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to update ${update.name}:`, error);
      }
    }

    console.log("\n📊 Migration Results:");
    console.log(`  ✅ Successfully updated: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log(`  📝 Total processed: ${slugUpdates.length}`);

    if (errorCount === 0) {
      console.log("\n🎉 All slugs generated successfully!");
    } else {
      console.log("\n⚠️  Some updates failed. Check the errors above.");
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Validation function to check for duplicate slugs
async function validateSlugs() {
  console.log("\n🔍 Validating slugs for duplicates...");

  try {
    const countries = await prisma.country.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      where: {
        slug: {
          not: null,
        },
      },
    });

    const slugCounts = new Map<string, string[]>();

    countries.forEach((country) => {
      if (country.slug) {
        if (!slugCounts.has(country.slug)) {
          slugCounts.set(country.slug, []);
        }
        slugCounts.get(country.slug)!.push(country.name);
      }
    });

    const duplicates = Array.from(slugCounts.entries()).filter(([_, names]) => names.length > 1);

    if (duplicates.length === 0) {
      console.log("✅ No duplicate slugs found!");
    } else {
      console.log(`⚠️  Found ${duplicates.length} duplicate slugs:`);
      duplicates.forEach(([slug, names]) => {
        console.log(`  ${slug}: ${names.join(", ")}`);
      });
    }
  } catch (error) {
    console.error("💥 Validation failed:", error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--validate")) {
    await validateSlugs();
  } else {
    await generateCountrySlugs();
    await validateSlugs();
  }
}

// Run the script
main().catch((error) => {
  console.error("💥 Script failed:", error);
  process.exit(1);
});
