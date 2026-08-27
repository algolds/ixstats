import { NextRequest, NextResponse } from "next/server";
import { syncSinglePage } from "~/lib/wiki-os/services/auto-sync-service";

/**
 * POST /api/wiki/sync-webhook
 *
 * Instant Webhook endpoint for MediaWiki PageSaveComplete hook or MariaDB change notifications.
 * Immediately syncs the edited page into PostgreSQL in <100ms.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = body?.title || body?.page || req.nextUrl.searchParams.get("title");

    if (!title) {
      return NextResponse.json({ error: "Missing 'title' parameter" }, { status: 400 });
    }

    const success = await syncSinglePage(String(title));

    return NextResponse.json({
      success,
      syncedTitle: title,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
