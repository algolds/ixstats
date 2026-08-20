/**
 * Import World Template - CLI script to import a world template JSON into the database.
 *
 * Run: npx tsx scripts/import-world-template.ts --input template.json [--mode replace|merge]
 *
 * Options:
 *   --input <file>     Input JSON template file (required)
 *   --mode <mode>      Import mode: "replace" (default) or "merge"
 *   --dry-run          Show what would be done without writing
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

interface TemplateFeature {
  id?: string;
  geometry: unknown;
  properties?: Record<string, unknown>;
}

interface TemplateLayer {
  type: string;
  features: TemplateFeature[];
}

async function main() {
  const inputFile = getArg("--input");
  const mode = (getArg("--mode") || "replace") as "replace" | "merge";
  const isDryRun = process.argv.includes("--dry-run");

  if (!inputFile) {
    console.error(
      "Usage: npx tsx scripts/import-world-template.ts --input <file> [--mode replace|merge] [--dry-run]"
    );
    process.exit(1);
  }

  console.log(
    `Importing template from: ${inputFile} (mode: ${mode}${isDryRun ? ", DRY RUN" : ""})`
  );

  const raw = readFileSync(inputFile, "utf-8");
  const template = JSON.parse(raw) as {
    version?: string;
    metadata?: Record<string, unknown>;
    layers: Record<string, TemplateLayer>;
  };

  console.log(`  Template version: ${template.version || "unknown"}`);
  if (template.metadata) {
    console.log(`  Exported: ${template.metadata.exportedAt || "unknown"}`);
    console.log(`  Total features: ${template.metadata.totalFeatures || "unknown"}`);
  }

  const layers = template.layers;
  if (!layers || typeof layers !== "object") {
    console.error("Invalid template: missing 'layers' object");
    process.exit(1);
  }

  // Summary
  let totalToImport = 0;
  for (const [type, fc] of Object.entries(layers)) {
    if (!fc.features || !Array.isArray(fc.features)) continue;
    console.log(`  ${type}: ${fc.features.length} features`);
    totalToImport += fc.features.length;
  }
  console.log(`  Total: ${totalToImport} features to import\n`);

  if (isDryRun) {
    console.log("DRY RUN - no changes made.");
    return;
  }

  if (mode === "replace") {
    const deactivated = await prisma.mapLayer.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    console.log(`Deactivated ${deactivated.count} existing features`);
  }

  let totalImported = 0;

  for (const [layerType, fc] of Object.entries(layers)) {
    if (!fc.features || !Array.isArray(fc.features)) continue;

    if (mode === "merge") {
      const deactivated = await prisma.mapLayer.updateMany({
        where: { layerType, isActive: true },
        data: { isActive: false },
      });
      console.log(`  ${layerType}: deactivated ${deactivated.count} existing`);
    }

    const records = fc.features.map((f) => {
      const props = (f.properties || {}) as Record<string, unknown>;
      return {
        layerType,
        featureId:
          (props.featureId as string) ||
          (f.id as string) ||
          `imported-${Math.random().toString(36).slice(2, 10)}`,
        geometry: f.geometry as Record<string, unknown>,
        properties: props,
        displayName: (props.displayName as string) || null,
        areaSqKm: (props.areaSqKm as number) || null,
        centroid: (props.centroid as Record<string, unknown>) || null,
        boundingBox: (props.boundingBox as unknown[]) || null,
        countryId: (props.countryId as string) || null,
        isActive: true,
      };
    });

    const created = await prisma.mapLayer.createMany({
      data: records,
      skipDuplicates: true,
    });

    console.log(`  ${layerType}: imported ${created.count} features`);
    totalImported += created.count;
  }

  console.log(`\nImport complete: ${totalImported} features imported.`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
