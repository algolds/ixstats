/**
 * Martin Tile Server Proxy with Redis Caching
 * 
 * This route proxies vector tile requests to the Martin tile server
 * and adds Redis caching for improved performance.
 * 
 * Routes:
 *   /api/tiles/{layer}/{z}/{x}/{y}
 * 
 * Layers: political, climate, altitudes, rivers, lakes, icecaps
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from 'ioredis';

// Martin tile server configuration
const MARTIN_HOST = process.env.MARTIN_HOST || 'localhost';
const MARTIN_PORT = process.env.MARTIN_PORT || '3800';
const MARTIN_URL = `http://${MARTIN_HOST}:${MARTIN_PORT}`;

// Redis configuration for tile caching
let redis: Redis | null = null;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 1, // Use DB 1 for tile cache
    lazyConnect: true,
    retryStrategy: () => null, // Don't retry, just fail gracefully
  });
} catch (error) {
  console.warn('[TileProxy] Redis not available, caching disabled:', error);
  redis = null;
}

// Valid layer names
const VALID_LAYERS = ['political', 'climate', 'altitudes', 'rivers', 'lakes', 'icecaps'] as const;

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ layer: string; z: string; x: string; y: string }>;
  }
) {
  try {
    const params = await context.params;
    const { layer, z, x, y } = params;

    // Validate layer
    if (!VALID_LAYERS.includes(layer as any)) {
      return NextResponse.json(
        { error: `Invalid layer: ${layer}` },
        { status: 400 }
      );
    }

    // Map layer names to Martin table names
    const martinTableName = `map_layer_${layer}`;
    const cacheKey = `tile:${layer}:${z}:${x}:${y}`;

    // Try Redis cache first
    if (redis) {
      try {
        const cached = await redis.getBuffer(cacheKey);
        if (cached) {
          return new NextResponse(cached, {
            status: 200,
            headers: {
              'Content-Type': 'application/x-protobuf',
              'Cache-Control': 'public, max-age=86400',
              'X-Cache-Status': 'HIT',
            },
          });
        }
      } catch (error) {
        console.warn('[TileProxy] Redis error:', error);
      }
    }

    // Fetch from Martin
    const martinUrl = `${MARTIN_URL}/${martinTableName}/${z}/${x}/${y}`;
    
    const response = await fetch(martinUrl, {
      headers: {
        'Accept': 'application/x-protobuf',
      },
    });

    if (!response.ok) {
      console.error(`[TileProxy] Martin error: ${response.status} ${martinUrl}`);
      return NextResponse.json(
        { error: 'Tile not found' },
        { status: response.status }
      );
    }

    const tileData = await response.arrayBuffer();
    const buffer = Buffer.from(tileData);

    // Cache in Redis
    if (redis && buffer.length > 0) {
      try {
        await redis.setex(cacheKey, 86400, buffer); // 24 hour cache
      } catch (error) {
        console.warn('[TileProxy] Redis cache write error:', error);
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Cache-Control': 'public, max-age=86400',
        'X-Cache-Status': 'MISS',
      },
    });

  } catch (error) {
    console.error('[TileProxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

