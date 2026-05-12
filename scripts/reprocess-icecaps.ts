/**
 * Reprocess Icecaps GeoJSON
 *
 * Cleans the existing icecaps.geojson by:
 * 1. Filtering out non-icecap debug features (colored fills like blue, red)
 * 2. Fixing antimeridian crossings: for rings where coordinates jump from
 *    ~-180° to ~+180° (like polar ice caps), shifts the pre-jump portion
 *    by +360° so the runtime splitting algorithm works correctly
 *
 * Run: bunx tsx scripts/reprocess-icecaps.ts
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { join } from "path";
import type { FeatureCollection, Feature, Position } from "geojson";

const GEOJSON_PATH = join(process.cwd(), "scripts", "geojson_fixed", "icecaps.geojson");
const BACKUP_PATH = join(process.cwd(), "scripts", "geojson_fixed", "icecaps.geojson.bak");

// ── White/near-white filter ──────────────────────
function isIcecapColor(fill: string | undefined): boolean {
  if (!fill) return true;
  const hex = fill.toLowerCase().replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r > 200 && g > 200 && b > 200;
}

// ── Fix antimeridian crossings ──────────────────────
// For rings with a jump from ~-180 to ~+180, shift the pre-jump coordinates
// by +360 so they become > 180. This lets the runtime splitting algorithm
// detect the crossing and split correctly.
// Without this fix, the unwrapRing in map-utils.ts collapses the 360° wrap
// into a range entirely ≤ 180, preventing any split from happening.
function fixAntimeridianRing(ring: Position[]): Position[] {
  // Find the antimeridian jump: consecutive coordinates with |Δlng| > 300°
  // (a jump from ~-180 to ~+180 or vice versa)
  let jumpIdx = -1;
  for (let i = 1; i < ring.length; i++) {
    const delta = Math.abs(ring[i][0] - ring[i - 1][0]);
    if (delta > 300) {
      jumpIdx = i;
      break;
    }
  }

  if (jumpIdx === -1) return ring; // No jump found

  const preLng = ring[jumpIdx - 1][0];
  const postLng = ring[jumpIdx][0];

  // Case: jump from negative (~-180) to positive (~+180)
  // Shift indices 0..jumpIdx-1 by +360 so they become > 180
  if (preLng < 0 && postLng > 0) {
    const fixed = ring.map((c, i) => {
      if (i < jumpIdx) {
        return [c[0] + 360, c[1], ...c.slice(2)] as Position;
      }
      return c;
    });
    return fixed;
  }

  // Case: jump from positive (~+180) to negative (~-180)
  // Shift indices jumpIdx.. by +360
  if (preLng > 0 && postLng < 0) {
    const fixed = ring.map((c, i) => {
      if (i >= jumpIdx) {
        return [c[0] + 360, c[1], ...c.slice(2)] as Position;
      }
      return c;
    });
    return fixed;
  }

  return ring; // Unknown pattern, keep as-is
}

function fixGeometry(geometry: Feature["geometry"]): Feature["geometry"] {
  if (!geometry || !("coordinates" in geometry)) return geometry;

  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map(fixAntimeridianRing),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map(fixAntimeridianRing)
      ),
    };
  }

  return geometry;
}

// ── Compute ring statistics ──────────────────────
function ringStats(coords: Position[][]) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  let totalPts = 0;
  for (const ring of coords) {
    for (const c of ring) {
      minLng = Math.min(minLng, c[0]);
      maxLng = Math.max(maxLng, c[0]);
      minLat = Math.min(minLat, c[1]);
      maxLat = Math.max(maxLat, c[1]);
      totalPts++;
    }
  }
  return { minLng, maxLng, minLat, maxLat, totalPts };
}

// ── Main ──────────────────────
function main() {
  console.log("Reprocessing icecaps.geojson...\n");

  if (!existsSync(GEOJSON_PATH) && !existsSync(BACKUP_PATH)) {
    console.error(`File not found: ${GEOJSON_PATH}`);
    process.exit(1);
  }

  // Back up original (only once)
  if (!existsSync(BACKUP_PATH)) {
    copyFileSync(GEOJSON_PATH, BACKUP_PATH);
    console.log(`Backed up original to ${BACKUP_PATH}`);
  }

  // Always read from backup (original data) to allow re-running
  const raw = readFileSync(BACKUP_PATH, "utf-8");
  const fc = JSON.parse(raw) as FeatureCollection;
  console.log(`Input: ${fc.features.length} features\n`);

  const kept: Feature[] = [];
  let skipped = 0;

  for (const feature of fc.features) {
    const id = feature.properties?.id || "unknown";
    const fill = feature.properties?.fill as string | undefined;

    if (!isIcecapColor(fill)) {
      console.log(`  SKIP ${id}: non-icecap fill (${fill})`);
      skipped++;
      continue;
    }

    // Fix antimeridian crossings for polar features
    const fixedGeom = fixGeometry(feature.geometry);

    // Extract all rings for stats
    const allRings: Position[][] = [];
    if (fixedGeom.type === "Polygon") {
      allRings.push(...(fixedGeom as { coordinates: Position[][] }).coordinates);
    } else if (fixedGeom.type === "MultiPolygon") {
      for (const poly of (fixedGeom as { coordinates: Position[][][] }).coordinates) {
        allRings.push(...poly);
      }
    }
    const stats = ringStats(allRings);

    console.log(`  KEEP ${id}: ${allRings.length} ring(s), ${stats.totalPts} pts, fill=${fill || "default"}`);
    console.log(`    lng: [${stats.minLng.toFixed(2)}, ${stats.maxLng.toFixed(2)}], lat: [${stats.minLat.toFixed(2)}, ${stats.maxLat.toFixed(2)}]`);
    if (stats.maxLng > 180) {
      console.log(`    ✓ Has coordinates > 180° (will be split at runtime)`);
    }

    kept.push({
      ...feature,
      geometry: fixedGeom,
    });
  }

  console.log(`\nResult: ${kept.length} features kept, ${skipped} skipped`);

  const output: FeatureCollection = {
    type: "FeatureCollection",
    features: kept,
  };

  const json = JSON.stringify(output);
  writeFileSync(GEOJSON_PATH, json);
  console.log(`Written to ${GEOJSON_PATH} (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB)`);
}

main();
