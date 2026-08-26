/**
 * src/app/api/wiki/export/route.ts — WikiOS Snapshot & Article Export Service
 *
 * Exports individual articles or collections as portable Markdown (.mdx) files
 * with YAML frontmatter metadata or JSON AST dumps.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const format = req.nextUrl.searchParams.get("format") || "markdown";
  const realm = req.nextUrl.searchParams.get("realm") || "ixwiki";

  if (!slug) {
    return NextResponse.json({ error: "Missing required query param: slug" }, { status: 400 });
  }

  const article: any = await (db as any).wikiArticle.findFirst({
    where: {
      source: realm,
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

  // Generate Markdown with YAML Frontmatter
  const mdxContent = `---
title: "${article.title.replace(/"/g, '\\"')}"
slug: "${article.slug}"
realm: "${article.source}"
status: "${article.status}"
readingTime: ${article.readingTime}
wordCount: ${article.wordCount}
exportedAt: "${new Date().toISOString()}"
---

${article.wikitext || ""}`;

  return new NextResponse(mdxContent, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${article.slug}.mdx"`,
    },
  });
}
