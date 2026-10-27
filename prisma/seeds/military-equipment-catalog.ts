/**
 * Military Equipment Catalog Seed Script
 *
 * Seeds the DefenseManufacturer and MilitaryEquipmentCatalog tables from the built-in
 * equipment data (src/lib/military). Idempotent: rows whose key already exists are skipped,
 * so admin edits made at /admin/military-equipment are kept.
 *
 * The militaryEquipment router seeds an empty catalog on first read, so this script is only
 * needed to top up a catalog that already has rows.
 *
 * Run with: bun prisma/seeds/military-equipment-catalog.ts
 */

import { PrismaClient } from "@prisma/client";
import {
  buildEquipmentCatalogSeed,
  buildManufacturerSeed,
} from "../../src/lib/military/catalog-seed";

const prisma = new PrismaClient();

export async function seedMilitaryEquipmentCatalog() {
  console.log("\n🔧 Starting military equipment catalog seed...\n");

  const manufacturers = buildManufacturerSeed();
  const manufacturerResult = await prisma.defenseManufacturer.createMany({
    data: manufacturers,
    skipDuplicates: true,
  });

  const equipment = buildEquipmentCatalogSeed();
  const equipmentResult = await prisma.militaryEquipmentCatalog.createMany({
    data: equipment,
    skipDuplicates: true,
  });

  console.log("=================================================================");
  console.log("📊 Seed Summary:");
  console.log("=================================================================");
  console.log(
    `🏭 Manufacturers: ${manufacturerResult.count} created, ${manufacturers.length - manufacturerResult.count} already present`
  );
  console.log(
    `⚔️  Equipment:     ${equipmentResult.count} created, ${equipment.length - equipmentResult.count} already present`
  );
  console.log("=================================================================\n");

  const categoryBreakdown = await prisma.militaryEquipmentCatalog.groupBy({
    by: ["category", "subcategory"],
    _count: true,
    orderBy: { category: "asc" },
  });

  console.log("📂 Equipment by Category:");
  let currentCategory = "";
  for (const item of categoryBreakdown) {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      console.log(`\n${currentCategory.toUpperCase()}:`);
    }
    console.log(`   ${item.subcategory || "general"}: ${item._count}`);
  }
  console.log("");
}

// Execute only when run directly (not when imported by the master seed)
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMilitaryEquipmentCatalog()
    .catch((e) => {
      console.error("\n❌ Fatal error during seed:");
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
