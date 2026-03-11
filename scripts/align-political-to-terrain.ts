/**
 * Align Political to Terrain
 *
 * Normalizes political.geojson coordinates to [-180, 180] and snaps
 * coastline vertices to the nearest altitude boundary vertices for
 * pixel-perfect alignment between layers.
 *
 * Run:  npx tsx scripts/align-political-to-terrain.ts [--dry-run] [--threshold 0.05] [--verbose]
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── CLI args ──────────────────────────────────────────────
const isDryRun = process.argv.includes("--dry-run");
const isVerbose = process.argv.includes("--verbose");
const thresholdIdx = process.argv.indexOf("--threshold");
const SNAP_THRESHOLD =
  thresholdIdx !== -1 ? parseFloat(process.argv[thresholdIdx + 1]) : 0.05;
const SNAP_THRESHOLD_SQ = SNAP_THRESHOLD * SNAP_THRESHOLD;

const GEOJSON_DIR = join(process.cwd(), "scripts", "geojson_fixed");
const PRECISION = 10000; // 4 decimal places

// ── Helpers ───────────────────────────────────────────────

function normalizeLng(lng: number): number {
  if (lng > 180) return lng - 360;
  if (lng < -180) return lng + 360;
  return lng;
}

function truncate(n: number): number {
  return Math.round(n * PRECISION) / PRECISION;
}

type Coord = [number, number];

// ── Spatial index (grid-based) ────────────────────────────

class SpatialIndex {
  private grid = new Map<string, Coord[]>();
  private count = 0;

  private key(lng: number, lat: number): string {
    return `${Math.floor(lng * 10)}_${Math.floor(lat * 10)}`;
  }

  add(lng: number, lat: number): void {
    const k = this.key(lng, lat);
    let bucket = this.grid.get(k);
    if (!bucket) {
      bucket = [];
      this.grid.set(k, bucket);
    }
    bucket.push([lng, lat]);
    this.count++;
  }

  get size(): number {
    return this.count;
  }

  findNearest(lng: number, lat: number): Coord | null {
    const cellX = Math.floor(lng * 10);
    const cellY = Math.floor(lat * 10);

    let nearest: Coord | null = null;
    let nearestDist = SNAP_THRESHOLD_SQ;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const candidates = this.grid.get(`${cellX + dx}_${cellY + dy}`);
        if (!candidates) continue;
        for (const c of candidates) {
          const d2 = (c[0] - lng) ** 2 + (c[1] - lat) ** 2;
          if (d2 < nearestDist) {
            nearestDist = d2;
            nearest = c;
          }
        }
      }
    }

    return nearest;
  }
}

// ── Extract coordinates from GeoJSON geometry ─────────────

function extractPositions(coords: unknown): Coord[] {
  if (!Array.isArray(coords)) return [];
  if (
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    return [[coords[0] as number, coords[1] as number]];
  }
  const result: Coord[] = [];
  for (const c of coords) {
    result.push(...extractPositions(c));
  }
  return result;
}

// ── Walk & transform coordinates in-place ─────────────────

interface Stats {
  totalVertices: number;
  normalizedVertices: number;
  snappedVertices: number;
  totalSnapDist: number;
}

function walkAndTransform(
  coords: unknown,
  index: SpatialIndex,
  stats: Stats
): unknown {
  if (!Array.isArray(coords)) return coords;

  // Leaf: [lng, lat, ...]
  if (
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    stats.totalVertices++;
    let lng = coords[0] as number;
    const lat = coords[1] as number;

    // Phase A: Normalize
    const origLng = lng;
    lng = normalizeLng(lng);
    if (lng !== origLng) stats.normalizedVertices++;

    // Truncate to match runtime precision before snapping
    lng = truncate(lng);
    const tLat = truncate(lat);

    // Phase B: Snap to altitude vertex
    const nearest = index.findNearest(lng, tLat);
    if (nearest) {
      const dist = Math.sqrt((nearest[0] - lng) ** 2 + (nearest[1] - tLat) ** 2);
      stats.snappedVertices++;
      stats.totalSnapDist += dist;
      return [nearest[0], nearest[1], ...coords.slice(2)];
    }

    return [lng, tLat, ...coords.slice(2)];
  }

  // Recursive: array of arrays
  return coords.map((c) => walkAndTransform(c, index, stats));
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log("=== Align Political to Terrain ===");
  console.log(`  Snap threshold: ${SNAP_THRESHOLD}° (${(SNAP_THRESHOLD * 111).toFixed(1)} km)`);
  console.log(`  Dry run: ${isDryRun}`);
  console.log();

  // 1. Load altitudes (reference layer)
  console.log("[1/4] Loading altitudes.geojson (reference layer)...");
  const altRaw = readFileSync(join(GEOJSON_DIR, "altitudes.geojson"), "utf-8");
  const altitudes = JSON.parse(altRaw);
  console.log(`  ${altitudes.features.length} altitude features`);

  // 2. Build spatial index from altitude boundary vertices
  console.log("[2/4] Building spatial index...");
  const index = new SpatialIndex();

  for (const feature of altitudes.features) {
    const positions = extractPositions(feature.geometry.coordinates);
    for (const [lng, lat] of positions) {
      index.add(truncate(lng), truncate(lat));
    }
  }
  console.log(`  ${index.size.toLocaleString()} altitude vertices indexed`);

  // 3. Load and transform political layer
  console.log("[3/4] Loading and transforming political.geojson...");
  const polRaw = readFileSync(join(GEOJSON_DIR, "political.geojson"), "utf-8");
  const political = JSON.parse(polRaw);
  console.log(`  ${political.features.length} political features`);

  const globalStats: Stats = {
    totalVertices: 0,
    normalizedVertices: 0,
    snappedVertices: 0,
    totalSnapDist: 0,
  };

  const featureReports: Array<{ name: string; stats: Stats }> = [];

  for (const feature of political.features) {
    const featureStats: Stats = {
      totalVertices: 0,
      normalizedVertices: 0,
      snappedVertices: 0,
      totalSnapDist: 0,
    };

    feature.geometry.coordinates = walkAndTransform(
      feature.geometry.coordinates,
      index,
      featureStats
    );

    globalStats.totalVertices += featureStats.totalVertices;
    globalStats.normalizedVertices += featureStats.normalizedVertices;
    globalStats.snappedVertices += featureStats.snappedVertices;
    globalStats.totalSnapDist += featureStats.totalSnapDist;

    const name =
      feature.properties?.displayName ||
      feature.properties?.id ||
      feature.id ||
      "unknown";

    featureReports.push({ name, stats: featureStats });
  }

  // 4. Report
  console.log();
  console.log("=== Alignment Report ===");
  console.log(`  Total vertices:      ${globalStats.totalVertices.toLocaleString()}`);
  console.log(`  Normalized (>180°):  ${globalStats.normalizedVertices.toLocaleString()}`);
  console.log(
    `  Snapped to terrain:  ${globalStats.snappedVertices.toLocaleString()} (${((globalStats.snappedVertices / globalStats.totalVertices) * 100).toFixed(1)}%)`
  );
  if (globalStats.snappedVertices > 0) {
    const avgDist = globalStats.totalSnapDist / globalStats.snappedVertices;
    console.log(
      `  Avg snap distance:   ${avgDist.toFixed(6)}° (${(avgDist * 111000).toFixed(1)}m)`
    );
  }

  if (isVerbose) {
    console.log();
    console.log("Per-feature breakdown:");
    for (const { name, stats } of featureReports) {
      if (stats.snappedVertices === 0 && stats.normalizedVertices === 0) continue;
      console.log(
        `  ${name}: ${stats.totalVertices} verts, ${stats.normalizedVertices} normalized, ${stats.snappedVertices} snapped`
      );
    }
  }

  // Top features by snap count
  const topSnapped = featureReports
    .filter((f) => f.stats.snappedVertices > 0)
    .sort((a, b) => b.stats.snappedVertices - a.stats.snappedVertices)
    .slice(0, 10);
  if (topSnapped.length > 0) {
    console.log();
    console.log("Top 10 most-snapped features:");
    for (const { name, stats } of topSnapped) {
      const pct = ((stats.snappedVertices / stats.totalVertices) * 100).toFixed(1);
      console.log(`  ${name}: ${stats.snappedVertices}/${stats.totalVertices} (${pct}%)`);
    }
  }

  // 5. Write output
  if (isDryRun) {
    console.log();
    console.log("[DRY RUN] No files modified.");
  } else {
    console.log();
    console.log("[4/4] Writing aligned political.geojson...");
    const outPath = join(GEOJSON_DIR, "political.geojson");
    writeFileSync(outPath, JSON.stringify(political), "utf-8");
    const sizeMB = (Buffer.byteLength(JSON.stringify(political)) / 1024 / 1024).toFixed(2);
    console.log(`  Written: ${outPath} (${sizeMB} MB)`);
    console.log();
    console.log("Next steps:");
    console.log("  1. npx tsx scripts/migrations/seed-map-data.ts --force");
    console.log("  2. pm2 restart ixworld");
    console.log("  3. Visually verify alignment in the map");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
