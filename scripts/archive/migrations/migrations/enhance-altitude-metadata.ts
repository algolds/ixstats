/**
 * Migration: Enhance Altitude Metadata
 *
 * Backfills existing altitude MapLayer records with meter-based elevation metadata.
 * Also seeds the ElevationZone reference table.
 *
 * Usage: npx tsx scripts/migrations/enhance-altitude-metadata.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";
import { ELEVATION_ZONES, getZoneByColor } from "../../src/lib/elevation-config";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

async function seedElevationZones() {
  console.log("\n--- Seeding ElevationZone reference table ---");

  for (const zone of ELEVATION_ZONES) {
    if (isDryRun) {
      console.log(`  [DRY RUN] Would upsert: ${zone.zoneId} (${zone.zoneName})`);
      continue;
    }

    await prisma.elevationZone.upsert({
      where: { zoneId: zone.zoneId },
      update: {
        zoneName: zone.zoneName,
        elevationMin: zone.elevationMin,
        elevationMax: zone.elevationMax,
        color: zone.color,
        sortOrder: zone.sortOrder,
      },
      create: {
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        elevationMin: zone.elevationMin,
        elevationMax: zone.elevationMax,
        color: zone.color,
        sortOrder: zone.sortOrder,
      },
    });
    console.log(`  Upserted: ${zone.zoneId} (${zone.zoneName})`);
  }

  console.log(`  Done. ${ELEVATION_ZONES.length} elevation zones seeded.`);
}

async function enhanceAltitudeFeatures() {
  console.log("\n--- Enhancing altitude MapLayer properties ---");

  const altitudeLayers = await prisma.mapLayer.findMany({
    where: { layerType: "altitudes", isActive: true },
  });

  console.log(`  Found ${altitudeLayers.length} active altitude features`);

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const layer of altitudeLayers) {
    const props = layer.properties as Record<string, unknown>;
    const fillColor = (props.fill as string) ?? "";

    // Already enhanced?
    if (props.elevationMin !== undefined && props.elevationMax !== undefined) {
      skipped++;
      continue;
    }

    // Match by color
    const zone = getZoneByColor(fillColor);
    if (!zone) {
      console.log(
        `  WARNING: No zone match for color "${fillColor}" on feature ${layer.featureId}`
      );
      unmatched++;
      continue;
    }

    const enhancedProps = {
      ...props,
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      elevationMin: zone.elevationMin,
      elevationMax: zone.elevationMax,
      elevationMidpoint: Math.round((zone.elevationMin + zone.elevationMax) / 2),
      elevationLabel: `${zone.elevationMin}-${zone.elevationMax}m`,
    };

    if (isDryRun) {
      console.log(
        `  [DRY RUN] Would update ${layer.featureId}: ${zone.zoneName} (${zone.elevationMin}-${zone.elevationMax}m)`
      );
    } else {
      await prisma.mapLayer.update({
        where: { id: layer.id },
        data: { properties: enhancedProps },
      });
    }
    updated++;
  }

  console.log(`\n  Results:`);
  console.log(`    Updated: ${updated}`);
  console.log(`    Skipped (already enhanced): ${skipped}`);
  console.log(`    Unmatched (no color match): ${unmatched}`);
}

async function main() {
  console.log("=== Altitude Metadata Enhancement Migration ===");
  if (isDryRun) console.log("  (DRY RUN MODE - no changes will be made)\n");

  try {
    await seedElevationZones();
    await enhanceAltitudeFeatures();
    console.log("\n=== Migration complete ===");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
