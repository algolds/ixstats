/**
 * src/app/api/wikios/inbound-sync/route.ts — Inbound MediaWiki Webhook Endpoint
 *
 * Receives notification pings from MediaWiki RecentChanges webhooks and runs one
 * recent-changes sync cycle — the same runAutoSyncCycle the `wiki-recentchanges` cron job runs.
 * Both methods require WIKI_SYNC_WEBHOOK_SECRET (header x-wiki-webhook-secret or
 * Authorization: Bearer), since each one triggers a poll.
 *
 * Rate limiting follows authentication, exactly like /api/wiki/sync-webhook: a request with the
 * valid secret counts against a per-secret bucket with a high ceiling; any other request counts
 * against a strict bucket keyed by the trusted client identity (never x-forwarded-for) and is then
 * answered 401/503.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { webhookRateLimitScope, wikiWebhookAuthFailure } from "~/lib/security/wiki-webhook-auth";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";
import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";

/** The response that turns this request away (429, 401 or 503), or null when it may run a cycle. */
async function denial(req: NextRequest): Promise<NextResponse | null> {
  const failure = wikiWebhookAuthFailure(req.headers, env.WIKI_SYNC_WEBHOOK_SECRET);
  const scope = webhookRateLimitScope(
    failure,
    env.WIKI_SYNC_WEBHOOK_SECRET,
    resolveRateLimitIdentifier(req.headers, null)
  );
  const rateLimit = await rateLimiter.check(scope.identifier, "wikios-inbound-sync", scope.limits);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return failure ? NextResponse.json({ error: failure.error }, { status: failure.status }) : null;
}

export async function POST(req: NextRequest) {
  const denied = await denial(req);
  if (denied) return denied;

  // runAutoSyncCycle never throws; a failed cycle is retried by the next one
  const stats = await runAutoSyncCycle(50);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    stats,
  });
}

export async function GET(req: NextRequest) {
  const denied = await denial(req);
  if (denied) return denied;

  const stats = await runAutoSyncCycle(25);
  return NextResponse.json({
    status: "active",
    stats,
  });
}
