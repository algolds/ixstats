/**
 * Economic Archetypes Seed Script
 *
 * Migrates all economic archetypes from TypeScript data files to the database.
 * This script is idempotent - it skips existing archetypes based on the `key` field.
 *
 * Run with: npx tsx prisma/seeds/economic-archetypes.ts
 */

import { PrismaClient } from "@prisma/client";
import { modernArchetypes } from "../../src/app/builder/data/archetypes/modern";
import { historicalArchetypes } from "../../src/app/builder/data/archetypes/historical";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Economic Archetypes seed...\n");

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Combine modern and historical archetypes
  const allArchetypes = new Map([
    ...Array.from(modernArchetypes.entries()),
    ...Array.from(historicalArchetypes.entries()),
  ]);

  console.log(`📊 Found ${allArchetypes.size} archetypes to process\n`);

  for (const [key, archetype] of allArchetypes) {
    try {
      // Check if archetype already exists
      const existing = await prisma.economicArchetype.findUnique({
        where: { key },
      });

      if (existing) {
        console.log(`⏭️  Skipping existing archetype: ${archetype.name} (${key})`);
        skippedCount++;
        continue;
      }

      // Determine era (modern vs historical)
      const era = modernArchetypes.has(key) ? "modern" : "historical";

      // Create the archetype
      await prisma.economicArchetype.create({
        data: {
          key,
          name: archetype.name,
          description: archetype.description,
          region: archetype.region,
          era,

          // JSON stringify complex fields
          characteristics: JSON.stringify(archetype.characteristics),
          economicComponents: JSON.stringify(archetype.economicComponents),
          governmentComponents: JSON.stringify(archetype.governmentComponents),
          taxProfile: JSON.stringify(archetype.taxProfile),
          sectorFocus: JSON.stringify(archetype.sectorFocus),
          employmentProfile: JSON.stringify(archetype.employmentProfile),
          growthMetrics: JSON.stringify(archetype.growthMetrics),
          strengths: JSON.stringify(archetype.strengths),
          challenges: JSON.stringify(archetype.challenges),
          culturalFactors: JSON.stringify(archetype.culturalFactors),
          modernExamples: JSON.stringify(archetype.modernExamples),
          recommendations: JSON.stringify(archetype.recommendations),

          implementationComplexity: archetype.implementationComplexity,
          historicalContext: archetype.historicalContext,

          isActive: true,
          isCustom: false,
          usageCount: 0,
        },
      });

      console.log(`✅ Created archetype: ${archetype.name} (${key})`);
      createdCount++;
    } catch (error) {
      console.error(`❌ Error creating archetype ${key}:`, error);
      errorCount++;
    }
  }

  console.log("\n📈 Seed Summary:");
  console.log(`  ✅ Created: ${createdCount}`);
  console.log(`  ⏭️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📊 Total: ${allArchetypes.size}`);

  // Verify database count
  const totalCount = await prisma.economicArchetype.count();
  console.log(`\n🗄️  Total archetypes in database: ${totalCount}`);

  console.log("\n✨ Economic Archetypes seed completed!\n");
}

main()
  .catch((e) => {
    console.error("💥 Fatal error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
