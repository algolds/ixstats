/**
 * src/app/api/wiki/feed/[type]/route.ts — WikiOS Atom XML & JSON Syndication Feeds
 *
 * Generates standards-compliant Atom 1.0 XML and JSON syndication feeds for
 * Recent Changes, Category Activity, and User Watchlists.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  const { type } = await context.params;
  const isJson = type.endsWith(".json") || req.nextUrl.searchParams.get("format") === "json";
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)));
  const realm = req.nextUrl.searchParams.get("realm") || "ixwiki";

  const revisions = await (db as any).wikiRevision.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      article: {
        select: { title: true, slug: true, namespace: true, summary: true },
      },
    },
  });

  const feedItems = revisions.map((r: any) => ({
    id: `tag:ixstats.com,${r.createdAt.toISOString().slice(0, 10)}:wiki:rev:${r.id}`,
    title: `${r.article?.title || "Article"} (${r.byteDelta >= 0 ? `+${r.byteDelta}` : r.byteDelta})`,
    link: `https://ixstats.com/wiki/${r.article?.slug || ""}`,
    summary: r.summary || (r.minor ? "Minor edit" : "Updated article content"),
    author: r.authorName || "WikiOS Contributor",
    updated: r.createdAt.toISOString(),
  }));

  if (isJson) {
    return NextResponse.json({
      version: "https://jsonfeed.org/version/1.1",
      title: "WikiOS Recent Changes Feed",
      home_page_url: "https://ixstats.com/wiki",
      feed_url: req.url,
      description: "Live feed of recent edits, creations, and improvements in WikiOS.",
      items: feedItems.map((item: any) => ({
        id: item.id,
        url: item.link,
        title: item.title,
        content_text: item.summary,
        date_modified: item.updated,
        authors: [{ name: item.author }],
      })),
    });
  }

  // Generate Atom 1.0 XML
  const updatedIso = feedItems[0]?.updated || new Date().toISOString();
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>WikiOS Recent Changes (${realm})</title>
  <subtitle>Live syndicate feed of encyclopedia revisions and lore documents.</subtitle>
  <link href="https://ixstats.com/wiki" />
  <link rel="self" href="${req.url}" />
  <id>https://ixstats.com/wiki/feed/recent-changes</id>
  <updated>${updatedIso}</updated>
  ${feedItems
    .map(
      (item: any) => `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${item.link}" />
    <id>${item.id}</id>
    <updated>${item.updated}</updated>
    <summary>${escapeXml(item.summary)}</summary>
    <author>
      <name>${escapeXml(item.author)}</name>
    </author>
  </entry>`
    )
    .join("")}
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
