/**
 * Subdivisions Vector Tile API Route
 * Generates MVT (Mapbox Vector Tiles) from PostGIS for user-submitted subdivisions
 *
 * Features:
 * - PostGIS ST_AsMVT for efficient vector tile generation
 * - Zoom-level filtering (show at zoom 6+)
 * - Redis caching with 7-day TTL
 * - Status filtering (approved only)
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";
import { db } from "~/server/db";
import { env } from "~/env";

// Redis client (singleton)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  try {
    if (env.NODE_ENV === "production" && process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      return redisClient;
    }
  } catch (error) {
    console.warn("[SubdivisionsTile] Redis not available, caching disabled:", error);
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const params = await context.params;
    const { z, x, y } = params;

    // Parse and validate tile coordinates
    const zNum = parseInt(z);
    const xNum = parseInt(x);
    const yNum = parseInt(y);

    if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum)) {
      return new NextResponse("Invalid tile coordinates", { status: 400 });
    }

    // Zoom filtering: show subdivisions at zoom 6+
    if (zNum < 6) {
      return new NextResponse(Buffer.from([]), {
        status: 200,
        headers: {
          "Content-Type": "application/x-protobuf",
          "Cache-Control": "public, max-age=604800", // 7 days
        },
      });
    }

    // Cache key for Redis
    const cacheKey = `tile:subdivisions:${z}:${x}:${y}`;

    // Try to get from Redis cache first
    const redis = getRedisClient();
    if (redis) {
      try {
        const cachedTile = await redis.getBuffer(cacheKey);
        if (cachedTile && cachedTile.length > 0) {
          return new NextResponse(cachedTile, {
            status: 200,
            headers: {
              "Content-Type": "application/x-protobuf",
              "Cache-Control": "public, max-age=604800", // 7 days
              "X-Cache-Status": "HIT",
            },
          });
        }
      } catch (error) {
        console.warn("[SubdivisionsTile] Redis read error:", error);
      }
    }

    // Generate MVT from PostGIS
    const mvtResult = await db.$queryRaw<Array<{ mvt: Buffer }>>`
      SELECT ST_AsMVT(tile, 'subdivisions', 4096, 'geom') as mvt
      FROM (
        SELECT
          ST_AsMVTGeom(
            geom_postgis,
            ST_TileEnvelope(${zNum}, ${xNum}, ${yNum}),
            4096,
            256,
            true
          ) as geom,
          id,
          name,
          type,
          level,
          population,
          "areaSqKm",
          capital
        FROM subdivisions
        WHERE status = 'approved'
          AND geom_postgis IS NOT NULL
          AND geom_postgis && ST_TileEnvelope(${zNum}, ${xNum}, ${yNum})
      ) as tile
      WHERE geom IS NOT NULL
    `;

    // Extract MVT buffer
    const mvtBuffer = mvtResult[0]?.mvt || Buffer.from([]);

    // Store in Redis cache (7 day TTL)
    if (redis && mvtBuffer.length > 0) {
      try {
        await redis.setex(cacheKey, 604800, mvtBuffer); // 7 days
      } catch (error) {
        console.warn("[SubdivisionsTile] Redis write error:", error);
      }
    }

    // Return MVT with appropriate headers
    return new NextResponse(mvtBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "public, max-age=604800", // 7 days
        "X-Cache-Status": redis ? "MISS" : "NO-REDIS",
      },
    });
  } catch (error) {
    console.error("[SubdivisionsTile] Error:", error);

    // Return empty tile on error (MapLibre handles gracefully)
    return new NextResponse(Buffer.from([]), {
      status: 200,
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "public, max-age=60",
      },
    });
  }
}
