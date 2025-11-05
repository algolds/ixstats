// src/app/api/equipment-images/resolve/route.ts
/**
 * Equipment Image Resolution API
 *
 * Dynamically resolves military equipment images from Wikimedia Commons.
 * Supports both single and batch resolution.
 *
 * GET  /api/equipment-images/resolve?id=<equipmentId> - Resolve single image
 * POST /api/equipment-images/resolve - Batch resolve (body: {ids: string[]})
 */

import { NextRequest, NextResponse } from "next/server";
import {
  resolveEquipmentImage,
  batchResolveImages,
  getImageCacheStats,
} from "~/server/services/wikimedia-equipment-image-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds

/**
 * GET /api/equipment-images/resolve
 * Resolve a single equipment image or get cache stats
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const equipmentId = url.searchParams.get("id");
    const stats = url.searchParams.get("stats");

    // Return cache statistics
    if (stats === "true") {
      const cacheStats = await getImageCacheStats();
      return NextResponse.json({
        success: true,
        stats: cacheStats,
        timestamp: new Date().toISOString(),
      });
    }

    // Validate equipmentId
    if (!equipmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: id",
        },
        { status: 400 }
      );
    }

    // Resolve single image
    const result = await resolveEquipmentImage(equipmentId);

    return NextResponse.json({
      success: result.success,
      equipmentId,
      imageUrl: result.imageUrl,
      thumbnailUrl: result.thumbnailUrl,
      cached: result.cached,
      source: result.source,
      timestamp: result.timestamp.toISOString(),
      error: result.error,
    });
  } catch (error) {
    console.error("[API] Image resolution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/equipment-images/resolve
 * Batch resolve multiple equipment images
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: string[] };

    // Validate input
    if (!body.ids || !Array.isArray(body.ids)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid parameter: ids (must be an array)",
        },
        { status: 400 }
      );
    }

    // Limit batch size
    if (body.ids.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Batch size exceeds limit (max 50 items)",
        },
        { status: 400 }
      );
    }

    // Batch resolve images
    console.log(`[API] Batch resolving ${body.ids.length} equipment images...`);
    const results = await batchResolveImages(body.ids);

    // Calculate summary stats
    const successful = results.filter((r) => r.result.success).length;
    const failed = results.filter((r) => !r.result.success).length;
    const cached = results.filter((r) => r.result.cached).length;

    return NextResponse.json({
      success: true,
      total: results.length,
      successful,
      failed,
      cached,
      results: results.map((r) => ({
        equipmentId: r.equipmentId,
        name: r.name,
        success: r.result.success,
        imageUrl: r.result.imageUrl,
        thumbnailUrl: r.result.thumbnailUrl,
        cached: r.result.cached,
        source: r.result.source,
        error: r.result.error,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Batch resolution error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
