/**
 * Import updated political layer from an SVG file.
 *
 * Parses the SVG, preserves existing country linkages, upserts MapLayer
 * records, deactivates removed features, and updates Country geometry.
 *
 * Usage:
 *   npx tsx scripts/import-political-update.ts [--dry-run]
 *
 * The SVG must be at: public/master-map-updated.svg
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  parseSvgToGeoJson,
  normalizeForMatching,
  type ParsedFeature,
} from "../src/lib/svg-parser";
import type { FeatureCollection } from "geojson";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

const SVG_PATH = join(process.cwd(), "public", "master-map-updated.svg");
const REF_PATH = join(process.cwd(), "scripts", "geojson_fixed", "political.geojson");
const LAYER_TYPE = "political";

function featureIdToName(id: string): string {
  return id.replace(/_/g, " ");
}

async function main() {
  console.log(`${isDryRun ? "[DRY RUN] " : ""}Importing political layer from SVG...\n`);

  // ── 1. Read & parse SVG ──────────────────────────

  if (!existsSync(SVG_PATH)) {
    console.error(`SVG not found: ${SVG_PATH}`);
    process.exit(1);
  }

  const svgContent = readFileSync(SVG_PATH, "utf-8");
  console.log(`SVG file: ${(Buffer.byteLength(svgContent) / 1024 / 1024).toFixed(1)}MB`);

  // Load reference GeoJSON for coordinate calibration
  let referenceGeoJson: FeatureCollection | undefined;
  if (existsSync(REF_PATH)) {
    try {
      referenceGeoJson = JSON.parse(readFileSync(REF_PATH, "utf-8"));
      console.log(`Reference GeoJSON loaded: ${REF_PATH}`);
    } catch {
      console.warn("Failed to parse reference GeoJSON — using bounds-based calibration");
    }
  } else {
    console.warn("No reference GeoJSON found — using bounds-based calibration");
  }

  const result = parseSvgToGeoJson(svgContent, LAYER_TYPE, { referenceGeoJson });
  console.log(`\nParsed ${result.features.length} features from SVG`);
  console.log(`Layers found in SVG: ${result.layersFound.join(", ")}`);

  if (result.features.length === 0) {
    console.error("No features parsed — aborting");
    process.exit(1);
  }

  // ── 2. Preserve existing country linkages ────────

  const existingLayers = await prisma.mapLayer.findMany({
    where: { layerType: LAYER_TYPE, isActive: true },
    select: { featureId: true, countryId: true },
  });

  const existingLinkages = new Map<string, string>();
  for (const layer of existingLayers) {
    if (layer.countryId) {
      existingLinkages.set(layer.featureId, layer.countryId);
    }
  }
  console.log(`\nExisting political features: ${existingLayers.length}`);
  console.log(`Existing country linkages: ${existingLinkages.size}`);

  // Build fuzzy-match lookup for new features
  const countries = await prisma.country.findMany({
    select: { id: true, name: true },
  });
  const countryByNorm = new Map<string, { id: string; name: string }>();
  for (const c of countries) {
    countryByNorm.set(normalizeForMatching(c.name), c);
  }

  // ── 3. Map features to country IDs ───────────────

  const newFeatureIds = new Set<string>();
  let linked = 0;
  let newLinks = 0;
  const unmatched: string[] = [];

  const featureData: Array<{
    feature: ParsedFeature;
    countryId: string | null;
    isNew: boolean;
  }> = [];

  for (const feature of result.features) {
    newFeatureIds.add(feature.featureId);

    // Priority 1: preserve existing linkage
    let countryId = existingLinkages.get(feature.featureId) ?? null;

    // Priority 2: fuzzy-match new features
    if (!countryId) {
      const displayName = feature.displayName || featureIdToName(feature.featureId);
      const norm = normalizeForMatching(displayName);
      const match = countryByNorm.get(norm);
      if (match) {
        countryId = match.id;
        newLinks++;
      } else {
        unmatched.push(displayName);
      }
    }

    if (countryId) linked++;
    featureData.push({
      feature,
      countryId,
      isNew: !existingLinkages.has(feature.featureId) && !existingLayers.some(l => l.featureId === feature.featureId),
    });
  }

  // Features that exist in DB but not in new SVG
  const removedFeatures = existingLayers.filter(l => !newFeatureIds.has(l.featureId));

  console.log(`\n── Summary ──`);
  console.log(`  New features: ${featureData.filter(f => f.isNew).length}`);
  console.log(`  Updated features: ${featureData.filter(f => !f.isNew).length}`);
  console.log(`  Removed features: ${removedFeatures.length}`);
  console.log(`  Linked to countries: ${linked}`);
  console.log(`  New country matches: ${newLinks}`);
  console.log(`  Unmatched: ${unmatched.length}`);

  if (removedFeatures.length > 0) {
    console.log(`\n  Removed feature IDs:`);
    for (const f of removedFeatures) {
      console.log(`    - ${f.featureId}${f.countryId ? ` (linked to ${f.countryId})` : ""}`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`\n  Unmatched features (no Country record):`);
    for (const name of unmatched.sort()) {
      console.log(`    - ${name}`);
    }
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] No changes written. Remove --dry-run to apply.");
    return;
  }

  // ── 4. Upsert features ──────────────────────────

  console.log(`\nUpserting ${featureData.length} features...`);
  let upserted = 0;

  for (const { feature, countryId } of featureData) {
    const displayName = feature.displayName || featureIdToName(feature.featureId);

    await prisma.mapLayer.upsert({
      where: {
        layerType_featureId: { layerType: LAYER_TYPE, featureId: feature.featureId },
      },
      create: {
        layerType: LAYER_TYPE,
        featureId: feature.featureId,
        displayName,
        geometry: feature.geometry as object,
        properties: feature.properties as object,
        countryId,
        areaSqKm: feature.areaSqKm,
        centroid: { type: "Point", coordinates: feature.centroid },
        boundingBox: feature.boundingBox,
        isActive: true,
      },
      update: {
        geometry: feature.geometry as object,
        properties: feature.properties as object,
        countryId,
        displayName,
        areaSqKm: feature.areaSqKm,
        centroid: { type: "Point", coordinates: feature.centroid },
        boundingBox: feature.boundingBox,
        isActive: true,
      },
    });
    upserted++;

    if (upserted % 50 === 0) {
      console.log(`  ${upserted}/${featureData.length} upserted...`);
    }
  }
  console.log(`  ${upserted} features upserted`);

  // ── 5. Deactivate removed features ──────────────

  if (removedFeatures.length > 0) {
    console.log(`\nDeactivating ${removedFeatures.length} removed features...`);
    await prisma.mapLayer.updateMany({
      where: {
        layerType: LAYER_TYPE,
        featureId: { in: removedFeatures.map(f => f.featureId) },
      },
      data: { isActive: false },
    });
  }

  // ── 6. Update Country geometry ──────────────────

  console.log("\nUpdating Country geometry from linked MapLayers...");
  const linkedLayers = await prisma.mapLayer.findMany({
    where: { layerType: LAYER_TYPE, countryId: { not: null }, isActive: true },
    select: {
      countryId: true,
      geometry: true,
      centroid: true,
      boundingBox: true,
      areaSqKm: true,
    },
  });

  let countryUpdated = 0;
  for (const layer of linkedLayers) {
    if (!layer.countryId) continue;
    await prisma.country.update({
      where: { id: layer.countryId },
      data: {
        geometry: layer.geometry as object,
        centroid: layer.centroid as object | undefined,
        boundingBox: layer.boundingBox as object | undefined,
      },
    });
    countryUpdated++;
  }
  console.log(`Updated ${countryUpdated} Country records`);

  console.log("\n═══════════════════════════════════════");
  console.log("Done! Political layer updated.");
  console.log("The dev server will pick up changes when the 15-min cache expires,");
  console.log("or restart the dev server for immediate effect.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
