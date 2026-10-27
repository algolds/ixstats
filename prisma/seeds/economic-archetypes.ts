/**
 * Economic Archetypes Seed Script
 *
 * Seeds the EconomicArchetype table from the built-in archetypes (src/lib/economy/archetypes).
 * Idempotent: archetypes whose `key` already exists are skipped, so admin edits made at
 * /admin/economic-archetypes are kept.
 *
 * The economicArchetypes router seeds an empty table on first read, so this script is only
 * needed to top up a table that already has rows.
 *
 * Run with: bun prisma/seeds/economic-archetypes.ts
 */

import { PrismaClient } from "@prisma/client";
import { buildArchetypeSeedRows } from "../../src/lib/economy/archetypes/seed";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Economic Archetypes seed...\n");

  const rows = buildArchetypeSeedRows();
  const result = await prisma.economicArchetype.createMany({ data: rows, skipDuplicates: true });

  console.log("📈 Seed Summary:");
  console.log(`  ✅ Created: ${result.count}`);
  console.log(`  ⏭️  Already present: ${rows.length - result.count}`);
  console.log(`\n🗄️  Total archetypes in database: ${await prisma.economicArchetype.count()}`);
}

main()
  .catch((e) => {
    console.error("💥 Fatal error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
