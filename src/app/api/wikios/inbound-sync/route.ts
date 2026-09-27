/**
 * src/app/api/wikios/inbound-sync/route.ts — Inbound MediaWiki Webhook Endpoint
 *
 * Receives real-time notification pings from MediaWiki RecentChanges webhooks
 * and triggers immediate synchronization into PostgreSQL.
 * Both methods require WIKI_SYNC_WEBHOOK_SECRET (header x-wiki-webhook-secret or
 * Authorization: Bearer), since each one triggers a poll.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { wikiWebhookAuthFailure } from "~/lib/security/wiki-webhook-auth";
import { InboundMediaWikiSyncService } from "~/lib/wiki-os/adapters/mediawiki/inbound-sync";

function authError(req: NextRequest): NextResponse | null {
  const failure = wikiWebhookAuthFailure(req.headers, env.WIKI_SYNC_WEBHOOK_SECRET);
  return failure ? NextResponse.json({ error: failure.error }, { status: failure.status }) : null;
}

export async function POST(req: NextRequest) {
  const denied = authError(req);
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as { realm?: string };
    const realm = typeof body.realm === "string" && body.realm ? body.realm : "ixwiki";

    const stats = await InboundMediaWikiSyncService.pollRecentChanges(realm, 50);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (err) {
    console.error("[wikios/inbound-sync] Sync failed:", err);
    return NextResponse.json({ success: false, error: "Failed to process sync" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const denied = authError(req);
  if (denied) return denied;

  const stats = await InboundMediaWikiSyncService.pollRecentChanges("ixwiki", 25);
  return NextResponse.json({
    status: "active",
    stats,
  });
}
