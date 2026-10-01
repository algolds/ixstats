/**
 * src/app/api/wiki/raw/route.ts — `/wiki/<title>?action=raw`: the page's wikitext as MediaWiki's
 * raw action serves it (`text/x-wiki`), for bots and editors. `src/proxy.ts` rewrites
 * `/wiki/<title>?action=raw[&oldid=<ref>]` here (the title arrives as `path`, as in the URL).
 * Only Postgres is read: a missing page is a 404, MediaWiki is never asked.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { ArticleRepository } from "~/lib/wiki-os/core";
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
    return revision && revision.title === title ? revision.wikitext : null;
  }
  return (await ArticleRepository.findBySlug(title))?.wikitext ?? null;
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "";
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
