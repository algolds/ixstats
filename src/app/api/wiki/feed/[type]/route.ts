/**
 * src/app/api/wiki/feed/[type]/route.ts — WikiOS Atom XML & JSON Syndication Feeds
 *
 * Recent-changes feed for one realm, as Atom 1.0 (default) or JSON Feed 1.1
 * (`*.json` or `?format=json`).
 */

import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

const SITE_URL = "https://ixstats.com";

interface FeedItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  author: string;
  updated: string;
}

export async function GET(req: NextRequest, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  const search = req.nextUrl.searchParams;
  const isJson = type.endsWith(".json") || search.get("format") === "json";
  const requested = Number.parseInt(search.get("limit") ?? "", 10) || 50;
  const limit = Math.min(100, Math.max(1, requested));
  const realm = search.get("realm") || "ixwiki";

  const revisions = await db.wikiRevision.findMany({
    where: { source: realm },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      author: true,
      summary: true,
      minor: true,
      byteDelta: true,
      createdAt: true,
      article: { select: { title: true, slug: true } },
    },
  });

  const feedItems: FeedItem[] = revisions.map((r) => ({
    id: `tag:ixstats.com,${r.createdAt.toISOString().slice(0, 10)}:wiki:rev:${r.id}`,
    title: `${r.article.title} (${r.byteDelta >= 0 ? `+${r.byteDelta}` : r.byteDelta})`,
    link: `${SITE_URL}/wiki/${r.article.slug}`,
    summary: r.summary || (r.minor ? "Minor edit" : "Updated article content"),
    author: r.author || "WikiOS Contributor",
    updated: r.createdAt.toISOString(),
  }));

  if (isJson) {
    return NextResponse.json({
      version: "https://jsonfeed.org/version/1.1",
      title: "WikiOS Recent Changes Feed",
      home_page_url: `${SITE_URL}/wiki`,
      feed_url: req.url,
      description: "Live feed of recent edits, creations, and improvements in WikiOS.",
      items: feedItems.map((item) => ({
        id: item.id,
        url: item.link,
        title: item.title,
        content_text: item.summary,
        date_modified: item.updated,
        authors: [{ name: item.author }],
      })),
    });
  }

  const updatedIso = feedItems[0]?.updated ?? new Date().toISOString();
  const entries = feedItems
    .map(
      (item) => `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.link)}" />
    <id>${escapeXml(item.id)}</id>
    <updated>${item.updated}</updated>
    <summary>${escapeXml(item.summary)}</summary>
    <author>
      <name>${escapeXml(item.author)}</name>
    </author>
  </entry>`
    )
    .join("");
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>WikiOS Recent Changes (${escapeXml(realm)})</title>
  <subtitle>Live syndicate feed of encyclopedia revisions and lore documents.</subtitle>
  <link href="${SITE_URL}/wiki" />
  <link rel="self" href="${escapeXml(req.url)}" />
  <id>${SITE_URL}/wiki/feed/recent-changes</id>
  <updated>${updatedIso}</updated>${entries}
</feed>`;

  return new NextResponse(atomXml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60",
    },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
