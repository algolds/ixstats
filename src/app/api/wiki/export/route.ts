/**
 * src/app/api/wiki/export/route.ts — WikiOS Snapshot & Article Export Service
 *
 * `format=markdown` (default) and `format=json` export one published article (`slug`) as a
 * portable Markdown (.mdx) file with YAML frontmatter or as a JSON dump.
 *
 * `format=xml` exports MediaWiki's XML dump format (export-0.11), streamed, for the titles in
 * `pages=<title>|<title>…` (at most 500): the current revision of each, or with `history=1` (or `true`) every
 * revision (signed-in users only, at most 50 pages). Only PUBLISHED articles are ever exported.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "~/lib/cache/rate-limiter";
import { writeExport, type ExportSelection } from "~/lib/wiki-os/xml/exporter";
import { MAX_HISTORY_PAGES, MAX_XML_PAGES, parseTitleList } from "~/lib/wiki-os/xml/export-request";
import { db } from "~/server/db";
import { resolveRateLimitIdentifier } from "~/server/api/trpc/rate-limit-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One export can read a lot of rows: a handful per minute and caller. */
const EXPORT_RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 } as const;
const SOURCE_PATTERN = /^[a-z0-9_-]{1,32}$/i;
const encoder = new TextEncoder();

/** A file name that is safe inside a Content-Disposition header. */
function safeFileName(base: string, extension: string): string {
  const stem = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "export";
  return `${stem}.${extension}`;
}

const badRequest = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Stream `writeExport` into a response body, honouring back-pressure; a failure aborts the body. */
function streamExport(selection: ExportSelection, fileName: string): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  void (async () => {
    try {
      await writeExport((chunk) => writer.write(encoder.encode(chunk)), selection);
      await writer.close();
    } catch (error) {
      console.error("[wiki/export] XML export failed:", error);
      await writer.abort(error).catch(() => undefined);
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function xmlExport(req: NextRequest, source: string): Promise<Response> {
  const params = req.nextUrl.searchParams;
  const titles = parseTitleList(params.get("pages") ?? "");
  const history = ["1", "true"].includes(params.get("history")?.toLowerCase() ?? "");

  if (titles.length === 0) return badRequest("Missing required query param: pages");
  if (titles.length > MAX_XML_PAGES) {
    return badRequest(`Too many pages: at most ${MAX_XML_PAGES} per export`);
  }
  if (!SOURCE_PATTERN.test(source)) return badRequest("Invalid source");

  const { userId } = await auth();
  if (history && !userId) return badRequest("Sign in to export page histories", 401);
  if (history && titles.length > MAX_HISTORY_PAGES) {
    return badRequest(`Too many pages: at most ${MAX_HISTORY_PAGES} per export with history`);
  }

  const limit = await rateLimiter.check(
    resolveRateLimitIdentifier(req.headers, userId),
    "wiki_export",
    EXPORT_RATE_LIMIT
  );
  if (!limit.success) return badRequest("Too many export requests, try again shortly", 429);

  const fileName = safeFileName(
    titles.length === 1 ? (titles[0] ?? "") : `${source}-export`,
    "xml"
  );
  return streamExport({ source, titles, history }, fileName);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const format = req.nextUrl.searchParams.get("format") || "markdown";
  const realm =
    req.nextUrl.searchParams.get("source") ?? req.nextUrl.searchParams.get("realm") ?? "ixwiki";

  if (format === "xml") return xmlExport(req, realm);

  if (!slug) {
    return NextResponse.json({ error: "Missing required query param: slug" }, { status: 400 });
  }

  const article = await db.wikiArticle.findFirst({
    where: {
      source: realm,
      status: "PUBLISHED",
      OR: [{ slug }, { title: slug.replace(/_/g, " ") }],
    },
  });

  if (!article) {
    return NextResponse.json({ error: `Article "${slug}" not found` }, { status: 404 });
  }

  if (format === "json") {
    return NextResponse.json({
      title: article.title,
      slug: article.slug,
      source: article.source,
      namespace: article.namespace,
      status: article.status,
      format: article.format,
      summary: article.summary,
      wordCount: article.wordCount,
      readingTime: article.readingTime,
      wikitext: article.wikitext,
      contentHtml: article.contentHtml,
      exportedAt: new Date().toISOString(),
    });
  }

  // Generate Markdown with YAML frontmatter. JSON strings are valid YAML double-quoted scalars,
  // so a title or slug with quotes, colons or line breaks cannot break out of its value.
  const mdxContent = `---
title: ${JSON.stringify(article.title)}
slug: ${JSON.stringify(article.slug)}
realm: ${JSON.stringify(article.source)}
status: ${JSON.stringify(article.status)}
readingTime: ${article.readingTime}
wordCount: ${article.wordCount}
exportedAt: ${JSON.stringify(new Date().toISOString())}
---

${article.wikitext || ""}`;

  return new NextResponse(mdxContent, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFileName(article.slug || article.title, "mdx")}"`,
    },
  });
}
