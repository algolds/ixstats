/**
 * src/app/api/wikios/inbound-sync/route.ts — Inbound MediaWiki Webhook Endpoint
 *
 * Receives notification pings from MediaWiki RecentChanges webhooks and runs one
 * recent-changes sync cycle — the same runAutoSyncCycle the `wiki-recentchanges` cron job runs.
 * Both methods require WIKI_SYNC_WEBHOOK_SECRET (header x-wiki-webhook-secret or
 * Authorization: Bearer), since each one triggers a poll.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { wikiWebhookAuthFailure } from "~/lib/security/wiki-webhook-auth";
import { runAutoSyncCycle } from "~/lib/wiki-os/services/auto-sync-service";

function authError(req: NextRequest): NextResponse | null {
  const failure = wikiWebhookAuthFailure(req.headers, env.WIKI_SYNC_WEBHOOK_SECRET);
  return failure ? NextResponse.json({ error: failure.error }, { status: failure.status }) : null;
}

export async function POST(req: NextRequest) {
  const denied = authError(req);
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
  const denied = authError(req);
  if (denied) return denied;

  const stats = await runAutoSyncCycle(25);
  return NextResponse.json({
    status: "active",
    stats,
  });
}
