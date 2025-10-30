/**
 * Migration script to populate slug field for all existing countries
 * Run with: npx tsx scripts/populate-country-slugs.ts
 */

import { PrismaClient } from "@prisma/client";
import { generateSlug } from "../src/lib/slug-utils";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting slug population for countries...\n");

  // Get all countries
  const countries = await prisma.country.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  console.log(`Found ${countries.length} countries\n`);

  let updated = 0;
  let skipped = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (const country of countries) {
    if (country.slug) {
      console.log(`✓ ${country.name} - already has slug: ${country.slug}`);
      skipped++;
      continue;
    }

    const slug = generateSlug(country.name);

    try {
      await prisma.country.update({
        where: { id: country.id },
        data: { slug },
      });

      console.log(`✓ ${country.name} → ${slug}`);
      updated++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`✗ ${country.name} - Error: ${errorMsg}`);
      errors.push({ name: country.name, error: errorMsg });
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total countries: ${countries.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (already had slug): ${skipped}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
