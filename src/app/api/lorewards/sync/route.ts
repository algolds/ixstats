// /api/lorewards/sync — Cron-safe endpoint to sync lorewards from Discord bot state file.
// Called daily by cron (1:00 AM ET) or manually. Requires API key or admin auth.

import { NextRequest, NextResponse } from "next/server";
import { syncFromStateFile, grantLorewardBonuses } from "~/lib/lorewards-sync";

const CRON_SECRET = process.env.CRON_SECRET ?? process.env.XENFORO_API_KEY;

export async function POST(req: NextRequest) {
  // Auth: accept either Bearer token matching CRON_SECRET or x-api-key header
  const authHeader = req.headers.get("authorization");
  const apiKey = req.headers.get("x-api-key");
  const token = authHeader?.replace("Bearer ", "") ?? apiKey;

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const synced = await syncFromStateFile();
    const bonusesGranted = await grantLorewardBonuses();
    return NextResponse.json({
      success: true,
      syncedEntries: synced,
      bonusesGranted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Lorewards Sync] Cron sync failed:", error);
    return NextResponse.json(
      { error: "Sync failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Also accept GET for simple cron services
export async function GET(req: NextRequest) {
  return POST(req);
}
