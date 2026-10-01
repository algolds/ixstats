/**
 * src/app/robots.txt/route.ts — robots.txt for the public IxWiki host (plan 412, D12). Articles are
 * indexable; tools, APIs and every non-reading view of a page (edit, history, diffs, old revisions,
 * raw text) are not; the sitemap is listed.
 */

import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { robotsTxt } from "~/lib/wiki-os/sitemap-xml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const origin = getWikiBaseUrl("ixwiki").replace(/\/+$/, "");
  return new Response(robotsTxt(origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
