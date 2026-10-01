/**
 * src/app/wiki-sitemap/[page]/route.ts — one sitemap file: up to 50,000 published main-namespace
 * pages (redirects, told by their text, left out) with the time of their newest revision as `lastmod`.
 */

import { getWikiBaseUrl } from "~/lib/wiki-os/config";
import {
  countSitemapPages,
  listSitemapPage,
  SITEMAP_PAGE_SIZE,
} from "~/lib/wiki-os/core/sitemap-service";
import { sitemapPageXml, XML_HEADERS } from "~/lib/wiki-os/sitemap-xml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `1`, or `1.xml`: pages count from 1. */
const PAGE_PARAM = /^([1-9]\d{0,5})(?:\.xml)?$/;

export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const match = PAGE_PARAM.exec((await params).page);
  if (!match) return new Response("Not found", { status: 404 });

  // The index lists as many files as the pages need (one at least): a number past the last is a 404.
  const page = Number(match[1]);
  const pageCount = Math.max(1, Math.ceil((await countSitemapPages()) / SITEMAP_PAGE_SIZE));
  if (page > pageCount) return new Response("Not found", { status: 404 });

  const entries = await listSitemapPage(page);
  const origin = getWikiBaseUrl("ixwiki").replace(/\/+$/, "");
  return new Response(sitemapPageXml(origin, entries), { headers: XML_HEADERS });
}
