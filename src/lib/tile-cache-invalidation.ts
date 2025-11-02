/**
 * Tile Cache Invalidation Service
 * Invalidates vector tile caches when map data changes
 */

import { Redis } from "ioredis";

// Redis client (singleton)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      return redisClient;
    }
  } catch (error) {
    console.warn("[TileCacheInvalidation] Redis not available:", error);
  }

  return null;
}

/**
 * Invalidate all tiles for a specific layer
 * This uses a pattern match to delete all cached tiles for a layer
 */
async function invalidateLayer(layer: "subdivisions" | "cities" | "pois"): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    return 0;
  }

  try {
    // Pattern to match all tiles for this layer
    const pattern = `tile:${layer}:*`;

    // Use SCAN for efficient pattern matching
    let cursor = "0";
    let deletedCount = 0;

    do {
      const result = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        deletedCount += deleted;
      }
    } while (cursor !== "0");

    console.log(`[TileCacheInvalidation] Invalidated ${deletedCount} ${layer} tiles`);
    return deletedCount;
  } catch (error) {
    console.error(`[TileCacheInvalidation] Error invalidating ${layer}:`, error);
    return 0;
  }
}

/**
 * Invalidate tiles in a specific bounding box
 * More efficient than invalidating all tiles when we know the affected area
 */
async function invalidateBoundingBox(
  layer: "subdivisions" | "cities" | "pois",
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number }
): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    return 0;
  }

  try {
    // Calculate affected tile coordinates for zoom levels 0-14
    const affectedTiles: string[] = [];

    for (let z = 0; z <= 14; z++) {
      const tiles = getTilesInBBox(bbox, z);
      tiles.forEach((tile) => {
        affectedTiles.push(`tile:${layer}:${tile.z}:${tile.x}:${tile.y}`);
      });
    }

    if (affectedTiles.length === 0) {
      return 0;
    }

    // Delete all affected tiles
    const deletedCount = await redis.del(...affectedTiles);
    console.log(
      `[TileCacheInvalidation] Invalidated ${deletedCount}/${affectedTiles.length} ${layer} tiles in bbox`,
      bbox
    );
    return deletedCount;
  } catch (error) {
    console.error(`[TileCacheInvalidation] Error invalidating bbox:`, error);
    return 0;
  }
}

/**
 * Get tile coordinates that intersect with a bounding box at a given zoom level
 * Uses Web Mercator projection (EPSG:3857)
 */
function getTilesInBBox(
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  z: number
): Array<{ z: number; x: number; y: number }> {
  const tiles: Array<{ z: number; x: number; y: number }> = [];

  // Convert lng/lat to tile coordinates
  const minTileX = lngToTileX(bbox.minLng, z);
  const maxTileX = lngToTileX(bbox.maxLng, z);
  const minTileY = latToTileY(bbox.maxLat, z); // Note: Y is inverted
  const maxTileY = latToTileY(bbox.minLat, z);

  // Clamp to valid tile range
  const startX = Math.max(0, Math.min(Math.floor(minTileX), Math.pow(2, z) - 1));
  const endX = Math.max(0, Math.min(Math.floor(maxTileX), Math.pow(2, z) - 1));
  const startY = Math.max(0, Math.min(Math.floor(minTileY), Math.pow(2, z) - 1));
  const endY = Math.max(0, Math.min(Math.floor(maxTileY), Math.pow(2, z) - 1));

  // Add all tiles in range
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      tiles.push({ z, x, y });
    }
  }

  return tiles;
}

/**
 * Convert longitude to tile X coordinate
 */
function lngToTileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z);
}

/**
 * Convert latitude to tile Y coordinate
 */
function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z);
}

/**
 * Public API for cache invalidation
 */
export const tileCacheInvalidation = {
  /**
   * Invalidate all subdivision tiles
   */
  async invalidateSubdivisions(): Promise<number> {
    return invalidateLayer("subdivisions");
  },

  /**
   * Invalidate all city tiles
   */
  async invalidateCities(): Promise<number> {
    return invalidateLayer("cities");
  },

  /**
   * Invalidate all POI tiles
   */
  async invalidatePOIs(): Promise<number> {
    return invalidateLayer("pois");
  },

  /**
   * Invalidate subdivision tiles in a bounding box
   */
  async invalidateSubdivisionBBox(bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }): Promise<number> {
    return invalidateBoundingBox("subdivisions", bbox);
  },

  /**
   * Invalidate city tiles in a bounding box
   */
  async invalidateCityBBox(bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }): Promise<number> {
    return invalidateBoundingBox("cities", bbox);
  },

  /**
   * Invalidate POI tiles in a bounding box
   */
  async invalidatePOIBBox(bbox: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  }): Promise<number> {
    return invalidateBoundingBox("pois", bbox);
  },

  /**
   * Invalidate all map tiles (use sparingly)
   */
  async invalidateAll(): Promise<number> {
    const subdivisions = await invalidateLayer("subdivisions");
    const cities = await invalidateLayer("cities");
    const pois = await invalidateLayer("pois");
    return subdivisions + cities + pois;
  },
};
