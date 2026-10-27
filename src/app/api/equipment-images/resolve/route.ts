/**
 * Equipment Image Resolution API
 *
 * Dynamically resolves military equipment images from Wikimedia Commons.
 * Supports both single and batch resolution.
 *
 * GET  /api/equipment-images/resolve?id=<equipmentId> - Resolve single image
 * POST /api/equipment-images/resolve - Batch resolve (body: {ids: string[]})
 *
 * Admin-only and rate limited: a resolution writes `militaryEquipmentCatalog.imageUrl` and calls Wikimedia, and no
 * page calls this route (the validate-images cron uses the resolver directly). A stored image that still loads is
 * never replaced.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache";
import { requireAdminSession } from "~/server/shared/route-auth";
import {
  resolveEquipmentImage,
  batchResolveImages,
  getImageCacheStats,
} from "~/server/services/wikimedia-equipment-image-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds

const MAX_BATCH = 20;
const RESOLVE_LIMIT = { maxRequests: 10, windowMs: 60_000 } as const;

/** The admin's id, or the 401/403/429 response to return as is. */
async function guard(): Promise<string | NextResponse> {
  const admin = await requireAdminSession();
  if (admin instanceof NextResponse) return admin;
  const rateLimit = await rateLimiter.check(admin.userId, "equipment_image_resolve", RESOLVE_LIMIT);
  if (!rateLimit.success) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000))
          ),
        },
      }
    );
  }
  return admin.userId;
}

/**
 * GET /api/equipment-images/resolve
 * Resolve a single equipment image or get cache stats
 */
export async function GET(request: NextRequest) {
  const denied = await guard();
  if (denied instanceof NextResponse) return denied;
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
  const denied = await guard();
  if (denied instanceof NextResponse) return denied;
  try {
    const body = (await request.json()) as { ids?: string[] };

    // Validate input
    if (
      !body.ids ||
      !Array.isArray(body.ids) ||
      !body.ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid parameter: ids (must be an array)",
        },
        { status: 400 }
      );
    }

    // Limit batch size
    if (body.ids.length > MAX_BATCH) {
      return NextResponse.json(
        {
          success: false,
          error: `Batch size exceeds limit (max ${MAX_BATCH} items)`,
        },
        { status: 400 }
      );
    }

    // Batch resolve images
    console.log(`[API] Batch resolving ${body.ids.length} equipment images...`);
    const results = await batchResolveImages([...new Set(body.ids)]);

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
