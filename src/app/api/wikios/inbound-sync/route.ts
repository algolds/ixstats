/**
 * src/app/api/wikios/inbound-sync/route.ts — Inbound MediaWiki Webhook Endpoint
 *
 * Receives real-time notification pings from MediaWiki RecentChanges webhooks
 * and triggers immediate synchronization into PostgreSQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { InboundMediaWikiSyncService } from "~/lib/wiki-os/adapters/mediawiki/inbound-sync";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.BOT_API_KEY || "dev-bot-secret-key-12345";

    if (authHeader && !authHeader.includes(expectedToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const realm = body.realm || "ixwiki";

    const stats = await InboundMediaWikiSyncService.pollRecentChanges(realm, 50);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process sync" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const stats = await InboundMediaWikiSyncService.pollRecentChanges("ixwiki", 25);
  return NextResponse.json({
    status: "active",
    stats,
  });
}
