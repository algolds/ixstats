/**
 * Cron endpoint for validating equipment images
 *
 * This endpoint should be called weekly to validate equipment images
 * and attempt auto-resolution for broken URLs.
 *
 * For Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/validate-images",
 *     "schedule": "0 2 * * 0"
 *   }]
 * }
 *
 * For manual trigger:
 * POST /api/cron/validate-images
 * Header: Authorization: Bearer <CRON_SECRET>
 *
 * For status check:
 * GET /api/cron/validate-images?status=true
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateEquipmentImagesJob,
  getValidationStats,
} from "~/server/cron/validate-equipment-images";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    // Verify authorization (optional but recommended)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require it for authentication
    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Check if this is a status check
    const url = new URL(request.url);
    if (url.searchParams.get("status") === "true") {
      const stats = await getValidationStats();
      return NextResponse.json({
        status: "ok",
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    // Run the cron job
    console.log("[API] Starting equipment image validation cron job...");
    const result = await validateEquipmentImagesJob();

    return NextResponse.json({
      success: result.success,
      message: `Validated ${result.total} images: ${result.validated} valid, ${result.broken} broken, ${result.fixed} fixed, ${result.failed} failed`,
      result: {
        total: result.total,
        validated: result.validated,
        broken: result.broken,
        fixed: result.fixed,
        failed: result.failed,
        errorCount: result.errors.length,
        errors: result.errors.slice(0, 10), // Limit errors in response
      },
      timestamp: result.timestamp.toISOString(),
    });
  } catch (error) {
    console.error("[API] Image validation cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Same logic as GET for compatibility
  return GET(request);
}
