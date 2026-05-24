/**
 * Seed Map Data - Normalizes GeoJSON and populates the map_layers table.
 * Also links political features to existing Country records and
 * updates Country.geometry, Country.centroid, Country.boundingBox.
 *
 * Run: npx tsx scripts/migrations/seed-map-data.ts
 *
 * Options:
 *   --force    Clear existing map_layers and re-seed
 *   --dry-run  Show what would be done without writing
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

const GEOJSON_DIR = join(process.cwd(), "scripts", "geojson_fixed");
const LAYER_TYPES = [
  "background",
  "altitudes",
  "climate",
  "political",
  "lakes",
  "rivers",
  "icecaps",
];

const isDryRun = process.argv.includes("--dry-run");
const isForce = process.argv.includes("--force");

// ──────────────────────────────────────────────
// Coordinate normalization
// ──────────────────────────────────────────────

function normalizeLng(lng: number): number {
  if (lng > 180) return lng - 360;
  if (lng < -180) return lng + 360;
  return lng;
}

function normalizeCoords(coords: unknown): unknown {
  if (!Array.isArray(coords)) return coords;
  if (coords.length >= 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
    return [normalizeLng(coords[0] as number), coords[1], ...coords.slice(2)];
  }
  return coords.map((c) => normalizeCoords(c));
}

// ──────────────────────────────────────────────
// Centroid & bounding box calculation
// ──────────────────────────────────────────────

interface Position {
  lng: number;
  lat: number;
}

function extractPositions(coords: unknown): Position[] {
  const positions: Position[] = [];
  function scan(c: unknown): void {
    if (!Array.isArray(c)) return;
    if (c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number") {
      positions.push({ lng: c[0] as number, lat: c[1] as number });
      return;
    }
    for (const item of c) scan(item);
  }
  scan(coords);
  return positions;
}

function calculateCentroid(geometry: { coordinates: unknown }): [number, number] | null {
  const positions = extractPositions(geometry.coordinates);
  if (positions.length === 0) return null;
  const sumLng = positions.reduce((s, p) => s + p.lng, 0);
  const sumLat = positions.reduce((s, p) => s + p.lat, 0);
  return [sumLng / positions.length, sumLat / positions.length];
}

function calculateBBox(geometry: {
  coordinates: unknown;
}): [number, number, number, number] | null {
  const positions = extractPositions(geometry.coordinates);
  if (positions.length === 0) return null;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const p of positions) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

// Approximate area calculation using the Shoelace formula on the first ring
function calculateApproxAreaSqKm(geometry: { type: string; coordinates: unknown }): number | null {
  const positions = extractPositions(geometry.coordinates);
  if (positions.length < 3) return null;

  // Very rough: use latitude-corrected Shoelace formula
  // 1 degree lat ≈ 111 km, 1 degree lng ≈ 111 * cos(lat) km
  const midLat = positions.reduce((s, p) => s + p.lat, 0) / positions.length;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < positions.length; i++) {
    const j = (i + 1) % positions.length;
    const xi = positions[i].lng * cosLat;
    const yi = positions[i].lat;
    const xj = positions[j].lng * cosLat;
    const yj = positions[j].lat;
    area += xi * yj - xj * yi;
  }

  // Convert from degree² to km² (111 km per degree)
  return Math.abs(area / 2) * 111 * 111;
}

// ──────────────────────────────────────────────
// Name matching
// ──────────────────────────────────────────────

function featureIdToName(id: string): string {
  return id.replace(/_/g, " ");
}

function normalizeForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log(`${isDryRun ? "[DRY RUN] " : ""}Seeding map data from GeoJSON files...`);

  // Load all countries for name matching
  const countries = await prisma.country.findMany({
    select: { id: true, name: true },
  });
  console.log(`Found ${countries.length} countries in database\n`);

  // Build name lookup
  const countryByNormalizedName = new Map<string, { id: string; name: string }>();
  for (const c of countries) {
    countryByNormalizedName.set(normalizeForMatching(c.name), c);
  }

  if (isForce && !isDryRun) {
    console.log("Clearing existing map_layers...");
    const deleted = await prisma.mapLayer.deleteMany();
    console.log(`Deleted ${deleted.count} existing records\n`);
  }

  let totalCreated = 0;
  let totalLinked = 0;
  const unmatched: string[] = [];

  for (const layerType of LAYER_TYPES) {
    const filePath = join(GEOJSON_DIR, `${layerType}.geojson`);
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      console.log(`  Skipping ${layerType}: file not found`);
      continue;
    }

    const fc = JSON.parse(raw) as {
      type: string;
      features: Array<{
        type: string;
        properties?: Record<string, unknown>;
        geometry: { type: string; coordinates: unknown };
      }>;
    };

    console.log(`Processing ${layerType}: ${fc.features.length} features`);

    let layerCreated = 0;
    let layerLinked = 0;

    for (let i = 0; i < fc.features.length; i++) {
      const feature = fc.features[i];
      const featureId = (feature.properties?.id as string) || `${layerType}-${i}`;
      const displayName = (feature.properties?.displayName as string) || featureIdToName(featureId);

      // Normalize geometry
      const normalizedGeometry = {
        type: feature.geometry.type,
        coordinates: normalizeCoords(feature.geometry.coordinates),
      };

      const centroid = calculateCentroid(normalizedGeometry);
      const bbox = calculateBBox(normalizedGeometry);
      const areaSqKm = calculateApproxAreaSqKm(normalizedGeometry);

      // Try to match to a Country record (political layer only)
      let countryId: string | null = null;
      if (layerType === "political") {
        const normalized = normalizeForMatching(displayName);
        const match = countryByNormalizedName.get(normalized);
        if (match) {
          countryId = match.id;
          layerLinked++;
        } else {
          unmatched.push(displayName);
        }
      }

      if (!isDryRun) {
        await prisma.mapLayer.upsert({
          where: {
            layerType_featureId: { layerType, featureId },
          },
          create: {
            layerType,
            featureId,
            displayName,
            geometry: normalizedGeometry as object,
            properties: (feature.properties || {}) as object,
            countryId,
            areaSqKm,
            centroid: centroid ? { type: "Point", coordinates: centroid } : undefined,
            boundingBox: bbox || undefined,
          },
          update: {
            geometry: normalizedGeometry as object,
            properties: (feature.properties || {}) as object,
            countryId,
            displayName,
            areaSqKm,
            centroid: centroid ? { type: "Point", coordinates: centroid } : undefined,
            boundingBox: bbox || undefined,
          },
        });
      }

      layerCreated++;
    }

    console.log(
      `  Created: ${layerCreated}${layerType === "political" ? `, Linked to countries: ${layerLinked}` : ""}`
    );
    totalCreated += layerCreated;
    totalLinked += layerLinked;
  }

  // Now update Country records with geometry from their linked MapLayer
  if (!isDryRun) {
    console.log("\nUpdating Country geometry from linked MapLayers...");
    const linkedLayers = await prisma.mapLayer.findMany({
      where: { layerType: "political", countryId: { not: null } },
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
    console.log(`Updated ${countryUpdated} Country records with geometry`);
  }

  // Summary
  console.log("\n═══════════════════════════════════════");
  console.log("Summary:");
  console.log(`  Total features seeded: ${totalCreated}`);
  console.log(`  Political features linked to countries: ${totalLinked}`);
  console.log(`  Unmatched political features: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log("\nUnmatched features (no Country record found):");
    for (const name of unmatched.sort()) {
      console.log(`  - ${name}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
