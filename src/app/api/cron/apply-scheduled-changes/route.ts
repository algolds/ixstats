/**
 * Cron endpoint for applying scheduled changes
 *
 * This endpoint should be called daily (or every IxDay) to apply pending changes.
 *
 * For Vercel Cron:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/apply-scheduled-changes",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 *
 * For manual trigger:
 * POST /api/cron/apply-scheduled-changes
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import {
  applyScheduledChangesJob,
  getScheduledChangesStats,
} from "~/server/cron/apply-scheduled-changes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify authorization - REQUIRED in production
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    // In production, CRON_SECRET is mandatory
    if (isProduction && !cronSecret) {
      console.error(
        "[SECURITY] CRON_SECRET not configured in production - cron endpoint disabled"
      );
      return NextResponse.json(
        { error: "Cron endpoint not configured" },
        { status: 503 }
      );
    }

    // Require valid Bearer token if CRON_SECRET is set
    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.warn(
          `[SECURITY] Unauthorized cron access attempt from ${request.headers.get("x-forwarded-for") || "unknown"}`
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Check if this is a status check
    const url = new URL(request.url);
    if (url.searchParams.get("status") === "true") {
      const stats = await getScheduledChangesStats();
      return NextResponse.json({
        status: "ok",
        stats,
        timestamp: new Date().toISOString(),
      });
    }

    // Run the cron job
    console.log("[API] Starting scheduled changes cron job...");
    const result = await applyScheduledChangesJob();

    return NextResponse.json({
      success: result.success,
      message: `Applied ${result.appliedCount} changes with ${result.errorCount} errors`,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Cron job failed:", error);
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
