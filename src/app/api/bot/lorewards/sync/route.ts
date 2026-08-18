import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { recomputeUserStats } from "~/lib/lorewards";
import { invalidateCache } from "~/lib/trpc-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Authenticate with BOT_API_KEY
  const authHeader = request.headers.get("Authorization");
  const apiKeyHeader = request.headers.get("x-bot-api-key");
  const expectedApiKey = process.env.BOT_API_KEY;

  if (!expectedApiKey) {
    console.error("[Lorewards Sync Webhook] BOT_API_KEY env var not set.");
    return NextResponse.json(
      { error: "Webhook authentication misconfigured on server" },
      { status: 500 }
    );
  }

  let authorized = false;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token === expectedApiKey) {
      authorized = true;
    }
  }
  if (apiKeyHeader && apiKeyHeader.trim() === expectedApiKey) {
    authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  try {
    const payload = await request.json();
    const {
      date,
      type,
      winnerUser,
      winnerPage,
      winnerScore,
      winnerBytes,
      runnerUpUser,
      runnerUpPage,
      runnerUpScore,
      runnerUpBytes,
      status = "approved",
      metadata,
    } = payload;

    if (!date || !type) {
      return NextResponse.json({ error: "Missing required fields: date, type" }, { status: 400 });
    }

    // 3. Upsert LorewardEntry
    const entry = await db.lorewardEntry.upsert({
      where: {
        date_type: {
          date,
          type,
        },
      },
      create: {
        date,
        type,
        winnerUser: winnerUser ?? null,
        winnerPage: winnerPage ?? null,
        winnerScore: winnerScore !== undefined ? Number(winnerScore) : null,
        winnerBytes: winnerBytes !== undefined ? Number(winnerBytes) : null,
        runnerUpUser: runnerUpUser ?? null,
        runnerUpPage: runnerUpPage ?? null,
        runnerUpScore: runnerUpScore !== undefined ? Number(runnerUpScore) : null,
        runnerUpBytes: runnerUpBytes !== undefined ? Number(runnerUpBytes) : null,
        status,
        metadata: metadata ? String(metadata) : null,
      },
      update: {
        winnerUser: winnerUser ?? null,
        winnerPage: winnerPage ?? null,
        winnerScore: winnerScore !== undefined ? Number(winnerScore) : null,
        winnerBytes: winnerBytes !== undefined ? Number(winnerBytes) : null,
        runnerUpUser: runnerUpUser ?? null,
        runnerUpPage: runnerUpPage ?? null,
        runnerUpScore: runnerUpScore !== undefined ? Number(runnerUpScore) : null,
        runnerUpBytes: runnerUpBytes !== undefined ? Number(runnerUpBytes) : null,
        status,
        metadata: metadata ? String(metadata) : null,
        syncedAt: new Date(),
      },
    });

    // 4. Recompute user stats
    if (winnerUser) {
      await recomputeUserStats(winnerUser);
    }
    if (runnerUpUser) {
      await recomputeUserStats(runnerUpUser);
    }

    // 5. Invalidate tRPC cache
    await invalidateCache(["lorewards.", "wiki."]);

    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error("[Lorewards Sync Webhook] Error processing payload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
