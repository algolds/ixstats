/**
 * Vector Tile Proxy API Route
 * Proxies requests to Martin tile server with Redis caching (Phase 2)
 *
 * This proxy solves:
 * 1. Browser security (CORS, localhost access from remote clients)
 * 2. Redis caching layer for 5-10x additional performance
 * 3. Graceful fallback if Martin is unavailable
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";
import { env } from "~/env";

// Global error logging flags to reduce log noise
declare global {
  // eslint-disable-next-line no-var
  var __martinConnectionErrorLogged: boolean | undefined;
}

// Valid layer names
const VALID_LAYERS = ["political", "rivers", "lakes", "icecaps", "climate", "altitudes"] as const;

type LayerName = (typeof VALID_LAYERS)[number];

// Martin tile server URL
const MARTIN_BASE_URL = process.env.MARTIN_URL || "http://localhost:3800";

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
    console.warn("[TileProxy] Redis not available, caching disabled:", error);
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  const startTime = Date.now();
  const params = await context.params;
  const { layer, z, x, y } = params;

  try {

    // Validate layer name
    if (!VALID_LAYERS.includes(layer as LayerName)) {
      return NextResponse.json({ error: `Invalid layer: ${layer}` }, { status: 400 });
    }

    // Parse and validate tile coordinates
    const zNum = parseInt(z);
    const xNum = parseInt(x);
    const yNum = parseInt(y);

    if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum) || zNum < 0 || zNum > 18) {
      return NextResponse.json({ error: "Invalid tile coordinates" }, { status: 400 });
    }

    // Cache key for Redis (Phase 2)
    const cacheKey = `tile:map_layer_${layer}:${z}:${x}:${y}`;

    // Try to get from Redis cache first
    const redis = getRedisClient();
    if (redis) {
      try {
        const cachedTile = await redis.getBuffer(cacheKey);
        if (cachedTile && cachedTile.length > 0) {
          const duration = Date.now() - startTime;
          return new NextResponse(cachedTile, {
            status: 200,
            headers: {
              "Content-Type": "application/x-protobuf",
              "Cache-Control": "public, max-age=2592000, immutable", // 30 days
              "X-Cache-Status": "HIT-REDIS",
              "X-Response-Time": `${duration}ms`,
            },
          });
        }
      } catch (error) {
        console.warn("[TileProxy] Redis read error:", error);
      }
    }

    // Fetch from Martin tile server
    const martinUrl = `${MARTIN_BASE_URL}/map_layer_${layer}/${z}/${x}/${y}`;
    const martinResponse = await fetch(martinUrl, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!martinResponse.ok) {
      // Only log errors on first occurrence to reduce log noise
      if (martinResponse.status !== 404) {
        console.warn(`[TileProxy] ${layer}/${z}/${x}/${y}: HTTP ${martinResponse.status}`);
      }
      return new NextResponse(Buffer.from([]), {
        status: 200,
        headers: {
          "Content-Type": "application/x-protobuf",
          "Cache-Control": "public, max-age=3600",
          "X-Cache-Status": "EMPTY",
        },
      });
    }

    // Get tile data as buffer
    const tileData = Buffer.from(await martinResponse.arrayBuffer());

    // Store in Redis cache (Phase 2) - 30 day TTL
    if (redis && tileData.length > 0) {
      try {
        await redis.setex(cacheKey, 2592000, tileData); // 30 days
      } catch (error) {
        console.warn("[TileProxy] Redis write error:", error);
      }
    }

    // Return tile with appropriate headers
    const duration = Date.now() - startTime;
    return new NextResponse(tileData, {
      status: 200,
      headers: {
        "Content-Type": "application/x-protobuf",
        "Cache-Control": "public, max-age=2592000, immutable", // 30 days
        "X-Cache-Status": redis ? "MISS-CACHED" : "MISS-NO-REDIS",
        "X-Response-Time": `${duration}ms`,
      },
    });
  } catch (error) {
    // Simplified error logging - only log connection errors once per startup
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("ECONNREFUSED")) {
      // Only log first occurrence to reduce noise
      if (!globalThis.__martinConnectionErrorLogged) {
        console.warn("[TileProxy] Martin tile server not responding (further errors suppressed)");
        globalThis.__martinConnectionErrorLogged = true;
      }
    } else if (!errorMsg.includes("ETIMEDOUT")) {
      // Log unexpected errors but keep them concise
      console.warn(`[TileProxy] ${layer}/${z}/${x}/${y}:`, errorMsg);
    }

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
