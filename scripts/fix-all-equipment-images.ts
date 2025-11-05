#!/usr/bin/env tsx
/**
 * Fix All Equipment Images
 *
 * Batch resolves all broken equipment images using Wikimedia API
 */

import { PrismaClient } from "@prisma/client";
import { batchResolveImages } from "../src/server/services/wikimedia-equipment-image-resolver";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Starting batch image resolution...\n");

  // Get all equipment with images (including broken ones)
  const equipment = await prisma.militaryEquipmentCatalog.findMany({
    where: {
      imageUrl: { not: null },
    },
    select: { id: true, name: true, imageUrl: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  console.log(`📊 Found ${equipment.length} equipment items with image URLs\n`);

  // Process in batches of 50
  const batchSize = 50;
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalCached = 0;

  for (let i = 0; i < equipment.length; i += batchSize) {
    const batch = equipment.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(equipment.length / batchSize);

    console.log(`\n🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);

    const ids = batch.map((e) => e.id);
    const results = await batchResolveImages(ids);

    const successful = results.filter((r) => r.result.success).length;
    const failed = results.filter((r) => !r.result.success).length;
    const cached = results.filter((r) => r.result.cached).length;

    totalSuccessful += successful;
    totalFailed += failed;
    totalCached += cached;

    console.log(`  ✅ Successful: ${successful}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📦 Cached: ${cached}`);

    // Show some examples
    results.slice(0, 3).forEach((r) => {
      if (r.result.success) {
        console.log(`    ✓ ${r.name}: ${r.result.source}`);
      } else {
        console.log(`    ✗ ${r.name}: ${r.result.error}`);
      }
    });

    // Wait 2 seconds between batches to avoid rate limiting
    if (i + batchSize < equipment.length) {
      console.log(`  ⏳ Waiting 2 seconds before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log("\n" + "=".repeat(65));
  console.log("📊 FINAL RESULTS");
  console.log("=".repeat(65));
  console.log(`Total Processed:    ${equipment.length}`);
  console.log(`✅ Successful:       ${totalSuccessful} (${((totalSuccessful / equipment.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed:           ${totalFailed} (${((totalFailed / equipment.length) * 100).toFixed(1)}%)`);
  console.log(`📦 From Cache:       ${totalCached} (${((totalCached / equipment.length) * 100).toFixed(1)}%)`);
  console.log("=".repeat(65));

  // Also check items with no images
  const noImages = await prisma.militaryEquipmentCatalog.count({
    where: { imageUrl: null },
  });

  if (noImages > 0) {
    console.log(`\n⚠️  Note: ${noImages} equipment items have no image URL at all`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
