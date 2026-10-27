/**
 * src/app/wiki-sitemap/route.ts — the sitemap index of the IxWiki pages (plan 412, D12: WikiOS owns
 * SEO). Each listed file is `/wiki-sitemap/<n>`, at most 50,000 URLs, see [page]/route.ts.
 */

import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import { countSitemapPages, SITEMAP_PAGE_SIZE } from "~/lib/wiki-os/core/sitemap-service";
import { sitemapIndexXml, XML_HEADERS } from "~/lib/wiki-os/sitemap-xml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pageCount = Math.max(1, Math.ceil((await countSitemapPages()) / SITEMAP_PAGE_SIZE));
  const origin = getWikiBaseUrl("ixwiki").replace(/\/+$/, "");
  return new Response(sitemapIndexXml(origin, pageCount), { headers: XML_HEADERS });
}
