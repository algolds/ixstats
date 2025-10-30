/**
 * Phase 3: Pre-generate Vector Tiles (Zoom 0-8)
 *
 * Pre-generates commonly accessed tiles and stores them in Redis cache
 * for instant loading. This script generates all tiles for zoom levels 0-8,
 * which covers world view to country-level detail.
 *
 * Zoom level breakdown:
 * - Zoom 0: 1 tile (world)
 * - Zoom 1: 4 tiles
 * - Zoom 2: 16 tiles
 * - Zoom 3: 64 tiles
 * - Zoom 4: 256 tiles
 * - Zoom 5: 1,024 tiles
 * - Zoom 6: 4,096 tiles
 * - Zoom 7: 16,384 tiles
 * - Zoom 8: 65,536 tiles
 * Total: 87,381 tiles
 *
 * Usage:
 *   npx tsx scripts/pregenerate-tiles.ts [--zoom-max=8] [--layers=political,climate]
 */

import { Redis } from "ioredis";

// Configuration
const MARTIN_BASE_URL = process.env.MARTIN_URL || "http://localhost:3800";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MAX_ZOOM = parseInt(process.env.MAX_ZOOM || "8");
const LAYERS = (process.env.LAYERS || "political").split(",");

// Parse command line arguments
const args = process.argv.slice(2);
const maxZoom = args.find((arg) => arg.startsWith("--zoom-max="))?.split("=")[1]
  ? parseInt(args.find((arg) => arg.startsWith("--zoom-max="))!.split("=")[1]!)
  : MAX_ZOOM;

const layers =
  args
    .find((arg) => arg.startsWith("--layers="))
    ?.split("=")[1]
    ?.split(",") || LAYERS;

interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

interface GenerationStats {
  totalTiles: number;
  successfulTiles: number;
  failedTiles: number;
  cachedTiles: number;
  emptyTiles: number;
  startTime: number;
  endTime?: number;
  layerStats: Record<string, { success: number; failed: number; cached: number; empty: number }>;
}

/**
 * Calculate total number of tiles for given zoom levels
 */
function calculateTotalTiles(maxZoom: number): number {
  let total = 0;
  for (let z = 0; z <= maxZoom; z++) {
    const tilesAtZoom = Math.pow(4, z);
    total += tilesAtZoom;
  }
  return total;
}

/**
 * Generate all tile coordinates for zoom levels 0 to maxZoom
 */
function* generateTileCoordinates(maxZoom: number): Generator<TileCoordinate> {
  for (let z = 0; z <= maxZoom; z++) {
    const maxTile = Math.pow(2, z);
    for (let x = 0; x < maxTile; x++) {
      for (let y = 0; y < maxTile; y++) {
        yield { z, x, y };
      }
    }
  }
}

/**
 * Fetch a single tile from Martin and cache it in Redis
 */
async function fetchAndCacheTile(
  redis: Redis,
  layer: string,
  coord: TileCoordinate
): Promise<{ success: boolean; cached: boolean; empty: boolean; size: number }> {
  const { z, x, y } = coord;
  const cacheKey = `tile:map_layer_${layer}:${z}:${x}:${y}`;

  try {
    // Check if already cached
    const existing = await redis.exists(cacheKey);
    if (existing) {
      return { success: true, cached: true, empty: false, size: 0 };
    }

    // Fetch from Martin
    const martinUrl = `${MARTIN_BASE_URL}/map_layer_${layer}/${z}/${x}/${y}`;
    const response = await fetch(martinUrl, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`Failed to fetch tile ${layer}/${z}/${x}/${y}: ${response.status}`);
      return { success: false, cached: false, empty: false, size: 0 };
    }

    const tileData = Buffer.from(await response.arrayBuffer());

    // Empty tiles (no features in this area)
    if (tileData.length === 0) {
      return { success: true, cached: false, empty: true, size: 0 };
    }

    // Cache in Redis with 30 day TTL
    await redis.setex(cacheKey, 2592000, tileData);

    return { success: true, cached: false, empty: false, size: tileData.length };
  } catch (error) {
    console.error(`Error fetching tile ${layer}/${z}/${x}/${y}:`, error);
    return { success: false, cached: false, empty: false, size: 0 };
  }
}

/**
 * Process tiles in batches for better performance
 */
async function processTileBatch(
  redis: Redis,
  layer: string,
  batch: TileCoordinate[],
  stats: GenerationStats
): Promise<void> {
  const promises = batch.map((coord) => fetchAndCacheTile(redis, layer, coord));
  const results = await Promise.allSettled(promises);

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const { success, cached, empty } = result.value;

      if (!stats.layerStats[layer]) {
        stats.layerStats[layer] = { success: 0, failed: 0, cached: 0, empty: 0 };
      }

      if (success) {
        stats.successfulTiles++;
        stats.layerStats[layer]!.success++;

        if (cached) {
          stats.cachedTiles++;
          stats.layerStats[layer]!.cached++;
        }

        if (empty) {
          stats.emptyTiles++;
          stats.layerStats[layer]!.empty++;
        }
      } else {
        stats.failedTiles++;
        stats.layerStats[layer]!.failed++;
      }
    } else {
      stats.failedTiles++;
      if (!stats.layerStats[layer]) {
        stats.layerStats[layer] = { success: 0, failed: 0, cached: 0, empty: 0 };
      }
      stats.layerStats[layer]!.failed++;
    }
  });
}

/**
 * Display progress bar
 */
function displayProgress(
  current: number,
  total: number,
  layer: string,
  stats: GenerationStats
): void {
  const percentage = ((current / total) * 100).toFixed(1);
  const elapsed = Date.now() - stats.startTime;
  const rate = current / (elapsed / 1000);
  const remaining = (total - current) / rate;

  const bar = "=".repeat(Math.floor((current / total) * 40));
  const spaces = " ".repeat(40 - bar.length);

  process.stdout.write(
    `\r[${bar}${spaces}] ${percentage}% | ` +
      `${current}/${total} tiles | ` +
      `${rate.toFixed(1)} tiles/sec | ` +
      `ETA: ${Math.floor(remaining / 60)}m ${Math.floor(remaining % 60)}s | ` +
      `Layer: ${layer} | ` +
      `Cached: ${stats.cachedTiles} | ` +
      `Empty: ${stats.emptyTiles} | ` +
      `Failed: ${stats.failedTiles}   `
  );
}

/**
 * Main execution
 */
async function main() {
  console.log("=== Vector Tile Pre-Generation (Phase 3) ===\n");
  console.log(`Configuration:`);
  console.log(`  - Max Zoom Level: ${maxZoom}`);
  console.log(`  - Layers: ${layers.join(", ")}`);
  console.log(`  - Martin URL: ${MARTIN_BASE_URL}`);
  console.log(`  - Redis URL: ${REDIS_URL}`);

  const totalTiles = calculateTotalTiles(maxZoom) * layers.length;
  console.log(`  - Total Tiles to Generate: ${totalTiles.toLocaleString()}\n`);

  // Connect to Redis
  console.log("Connecting to Redis...");
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  await redis.ping();
  console.log("✓ Connected to Redis\n");

  // Initialize stats
  const stats: GenerationStats = {
    totalTiles,
    successfulTiles: 0,
    failedTiles: 0,
    cachedTiles: 0,
    emptyTiles: 0,
    startTime: Date.now(),
    layerStats: {},
  };

  // Process each layer
  for (const layer of layers) {
    console.log(`\nProcessing layer: ${layer}`);
    console.log("─".repeat(80));

    const coordinates = Array.from(generateTileCoordinates(maxZoom));
    const batchSize = 50; // Process 50 tiles at a time
    let processedInLayer = 0;

    for (let i = 0; i < coordinates.length; i += batchSize) {
      const batch = coordinates.slice(i, i + batchSize);
      await processTileBatch(redis, layer, batch, stats);
      processedInLayer += batch.length;
      displayProgress(processedInLayer, coordinates.length, layer, stats);
    }

    console.log("\n");
  }

  stats.endTime = Date.now();

  // Display final statistics
  console.log("\n" + "=".repeat(80));
  console.log("Pre-Generation Complete!");
  console.log("=".repeat(80));

  const duration = (stats.endTime - stats.startTime) / 1000;
  const rate = stats.totalTiles / duration;

  console.log(`\nOverall Statistics:`);
  console.log(`  - Total Tiles: ${stats.totalTiles.toLocaleString()}`);
  console.log(`  - Successful: ${stats.successfulTiles.toLocaleString()}`);
  console.log(`  - Failed: ${stats.failedTiles.toLocaleString()}`);
  console.log(`  - Already Cached: ${stats.cachedTiles.toLocaleString()}`);
  console.log(`  - Empty: ${stats.emptyTiles.toLocaleString()}`);
  console.log(`  - Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
  console.log(`  - Average Rate: ${rate.toFixed(1)} tiles/sec`);

  console.log(`\nPer-Layer Statistics:`);
  for (const [layer, layerStats] of Object.entries(stats.layerStats)) {
    console.log(`  ${layer}:`);
    console.log(`    - Success: ${layerStats.success.toLocaleString()}`);
    console.log(`    - Failed: ${layerStats.failed.toLocaleString()}`);
    console.log(`    - Cached: ${layerStats.cached.toLocaleString()}`);
    console.log(`    - Empty: ${layerStats.empty.toLocaleString()}`);
  }

  // Close Redis connection
  await redis.quit();
  console.log("\n✓ Redis connection closed");
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
