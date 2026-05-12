/**
 * Export World Template - CLI script to export current map state as a JSON template.
 *
 * Run: bunx tsx scripts/export-world-template.ts --name "IxEarth v2" --output template.json
 *
 * Options:
 *   --name <name>      Template name (required)
 *   --output <file>    Output file path (default: stdout)
 *   --description <d>  Optional description
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const name = getArg("--name");
  const output = getArg("--output");
  const description = getArg("--description");

  if (!name) {
    console.error("Usage: bunx tsx scripts/export-world-template.ts --name <name> [--output <file>] [--description <d>]");
    process.exit(1);
  }

  console.log(`Exporting world template: "${name}"...`);

  // Gather all active map layers
  const allLayers = await prisma.mapLayer.findMany({
    where: { isActive: true },
    select: {
      layerType: true,
      featureId: true,
      geometry: true,
      properties: true,
      displayName: true,
      areaSqKm: true,
      centroid: true,
      boundingBox: true,
      countryId: true,
    },
  });

  console.log(`  Found ${allLayers.length} active features`);

  // Group into FeatureCollections
  const layers: Record<string, { type: string; features: unknown[] }> = {};
  for (const layer of allLayers) {
    if (!layers[layer.layerType]) {
      layers[layer.layerType] = { type: "FeatureCollection", features: [] };
    }
    layers[layer.layerType]!.features.push({
      type: "Feature",
      id: layer.featureId,
      geometry: layer.geometry,
      properties: {
        ...(layer.properties as Record<string, unknown>),
        featureId: layer.featureId,
        displayName: layer.displayName,
        areaSqKm: layer.areaSqKm,
        countryId: layer.countryId,
      },
    });
  }

  for (const [type, fc] of Object.entries(layers)) {
    console.log(`  ${type}: ${fc.features.length} features`);
  }

  // Gather countries
  const countries = await prisma.country.findMany({
    select: { id: true, name: true, slug: true, flagCode: true, region: true, subregion: true },
  });
  console.log(`  ${countries.length} countries`);

  // Gather sovereignty
  const sovereignty = await prisma.countrySovereignty.findMany({
    select: { sovereignId: true, subjectId: true, relationshipType: true, autonomyLevel: true, description: true },
  });
  console.log(`  ${sovereignty.length} sovereignty relationships`);

  const template = {
    version: "1.0.0",
    metadata: {
      name,
      description,
      featureCounts: Object.fromEntries(
        Object.entries(layers).map(([k, v]) => [k, v.features.length])
      ),
      totalFeatures: allLayers.length,
      totalCountries: countries.length,
      exportedAt: new Date().toISOString(),
    },
    layers,
    countries: countries.map((c) => ({
      name: c.name,
      slug: c.slug,
      flagCode: c.flagCode,
      region: c.region,
      subregion: c.subregion,
    })),
    sovereignty: sovereignty.map((s) => ({
      sovereign: s.sovereignId,
      subject: s.subjectId,
      type: s.relationshipType,
      autonomy: s.autonomyLevel,
      description: s.description,
    })),
  };

  const json = JSON.stringify(template, null, 2);
  const sizeKB = (Buffer.byteLength(json, "utf-8") / 1024).toFixed(1);

  if (output) {
    writeFileSync(output, json, "utf-8");
    console.log(`\nTemplate written to ${output} (${sizeKB} KB)`);
  } else {
    process.stdout.write(json);
  }
}

main()
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
