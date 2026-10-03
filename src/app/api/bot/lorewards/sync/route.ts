import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { recomputeUserStats } from "~/lib/lorewards";
import { invalidateCache } from "~/lib/cache";
import { safeEqual } from "~/lib/security/safe-equal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Accepts `Authorization: Bearer <key>` or `x-bot-api-key: <key>`. */
function hasValidBotKey(request: Request, expectedApiKey: string) {
  const bearer = request.headers.get("Authorization");
  const token = bearer?.startsWith("Bearer ") ? bearer.substring(7).trim() : null;
  const apiKeyHeader = request.headers.get("x-bot-api-key")?.trim();
  return [token, apiKeyHeader].some(
    (candidate) => candidate && safeEqual(candidate, expectedApiKey)
  );
}

const toNumberOrNull = (value: unknown) => (value !== undefined ? Number(value) : null);

export async function POST(request: Request) {
  const expectedApiKey = process.env.BOT_API_KEY;
  if (!expectedApiKey) {
    console.error("[Lorewards Sync Webhook] BOT_API_KEY env var not set.");
    return NextResponse.json(
      { error: "Webhook authentication misconfigured on server" },
      { status: 500 }
    );
  }
  if (!hasValidBotKey(request, expectedApiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { date, type, winnerUser, runnerUpUser, status = "approved", metadata } = payload;

    if (!date || !type) {
      return NextResponse.json({ error: "Missing required fields: date, type" }, { status: 400 });
    }

    const data = {
      winnerUser: winnerUser ?? null,
      winnerPage: payload.winnerPage ?? null,
      winnerScore: toNumberOrNull(payload.winnerScore),
      winnerBytes: toNumberOrNull(payload.winnerBytes),
      runnerUpUser: runnerUpUser ?? null,
      runnerUpPage: payload.runnerUpPage ?? null,
      runnerUpScore: toNumberOrNull(payload.runnerUpScore),
      runnerUpBytes: toNumberOrNull(payload.runnerUpBytes),
      status,
      metadata: metadata ? String(metadata) : null,
    };
    const entry = await db.lorewardEntry.upsert({
      where: { date_type: { date, type } },
      create: { date, type, ...data },
      update: { ...data, syncedAt: new Date() },
    });

    if (winnerUser) await recomputeUserStats(winnerUser);
    if (runnerUpUser) await recomputeUserStats(runnerUpUser);

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
