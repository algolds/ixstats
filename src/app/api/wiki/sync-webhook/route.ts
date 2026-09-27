import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { wikiWebhookAuthFailure } from "~/lib/security/wiki-webhook-auth";
import { syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";

/**
 * POST /api/wiki/sync-webhook
 *
 * Instant Webhook endpoint for MediaWiki PageSaveComplete hook or MariaDB change notifications.
 * Immediately syncs the edited page into PostgreSQL in <100ms.
 * Requires WIKI_SYNC_WEBHOOK_SECRET (header x-wiki-webhook-secret or Authorization: Bearer).
 */
export async function POST(req: NextRequest) {
  const authFailure = wikiWebhookAuthFailure(req.headers, env.WIKI_SYNC_WEBHOOK_SECRET);
  if (authFailure) {
    return NextResponse.json({ error: authFailure.error }, { status: authFailure.status });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = await rateLimiter.check(clientIp, "wiki-sync-webhook");
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { title?: string; page?: string };
    const rawTitle = body.title || body.page || req.nextUrl.searchParams.get("title");
    const title = typeof rawTitle === "string" ? rawTitle.trim() : "";

    if (title.length < 1 || title.length > 255) {
      return NextResponse.json({ error: "Missing or invalid 'title' parameter" }, { status: 400 });
    }

    const success = await syncSinglePage(title);

    return NextResponse.json({
      success,
      syncedTitle: title,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[wiki/sync-webhook] Sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
