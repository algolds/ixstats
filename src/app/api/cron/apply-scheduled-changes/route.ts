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
