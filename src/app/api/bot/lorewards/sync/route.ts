import { NextResponse } from "next/server";
import {
  applyBotResult,
  BotWeekConflict,
  parseBotResult,
  type BotLorewardPayload,
} from "~/lib/lorewards/bot-result";
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

/** The bot pushes one result: 400 when it cannot be read, 409 when its week's key holds another week. */
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
    const payload: BotLorewardPayload = await request.json();
    const parsed = parseBotResult(payload);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { entry, settled } = await applyBotResult(parsed.result);
    return NextResponse.json({ success: true, entry, settled });
  } catch (error) {
    if (error instanceof BotWeekConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Lorewards Sync Webhook] Error processing payload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
