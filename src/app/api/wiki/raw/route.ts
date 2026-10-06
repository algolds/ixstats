/**
 * src/app/api/wiki/raw/route.ts — `/wiki/<title>?action=raw`: the page's wikitext as MediaWiki's
 * raw action serves it (`text/x-wiki`), for bots and editors. `src/proxy.ts` rewrites
 * `/wiki/<title>?action=raw[&oldid=<ref>]` here (the path after `/wiki/` arrives in the
 * `x-wikios-raw-path` header; a direct request passes `?path=`).
 * Only Postgres is read: a missing page is a 404, MediaWiki is never asked.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { archivedTitlesAmong } from "~/lib/wiki-os/core/archived-titles";
import { ArticleRepository } from "~/lib/wiki-os/core";
import { RAW_PATH_HEADER } from "~/lib/wiki-os/raw-path";
import { resolveWikiPath } from "~/lib/wiki-os/wiki-path";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bots read many pages in a run: a generous budget per caller. */
const RAW_RATE_LIMIT = { maxRequests: 300, windowMs: 60_000 } as const;

const plain = (body: string, status: number) =>
  new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** The wikitext of `title`'s revision `ref`, or of its current text; null when there is none to show. */
async function wikitextOf(title: string, ref: string | null): Promise<string | null> {
  if (ref) {
    const revision = await getRevisionWikitext(ref);
    // A revision of another page is not this page's text; a null text is hidden or never imported.
    if (!revision || revision.title !== title) return null;
    // The raw route knows no session: a deleted page's revisions are hidden from everyone.
    return (await archivedTitlesAmong([title])).size > 0 ? null : revision.wikitext;
  }
  // `findBySlug` leaves a deleted page out.
  return (await ArticleRepository.findBySlug(title))?.wikitext ?? null;
}

/**
 * The page the request names, as the path after `/wiki/`: the proxy's header for a rewritten
 * `/wiki/<title>?action=raw` (accepted only for a request that carries `action=raw`; the proxy sets
 * it and strips a client's own), else `?path=` of a direct request.
 */
function pathOf(req: NextRequest): string {
  const { searchParams } = req.nextUrl;
  const proxied = searchParams.get("action") === "raw" ? req.headers.get(RAW_PATH_HEADER) : null;
  return proxied ?? searchParams.get("path") ?? "";
}

export async function GET(req: NextRequest) {
  const path = pathOf(req);
  const target = resolveWikiPath(path.split("/"), req.nextUrl.searchParams);
  if (target.kind !== "raw" || target.canon.namespaceId < 0) return plain("Bad request", 400);

  const limit = await rateLimiter.check(
    resolveRateLimitIdentifier(req.headers, null),
    "wiki_raw",
    RAW_RATE_LIMIT
  );
  if (!limit.success) return plain("Too many requests, try again shortly", 429);

  const wikitext = await wikitextOf(target.canon.title, target.ref);
  if (wikitext === null) return plain("Not found", 404);

  return new NextResponse(wikitext, {
    headers: {
      "Content-Type": "text/x-wiki; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      // A revision never changes; the current text is cached briefly, for bots reading in bulk.
      "Cache-Control": target.ref ? "public, max-age=86400" : "public, max-age=60",
    },
  });
}
