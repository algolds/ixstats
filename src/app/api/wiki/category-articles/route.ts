// src/app/api/wiki/category-articles/route.ts
// List articles in a live wiki category with lightweight batched preview metadata.
// Returns the same shape as /api/wiki/random-articles so the admin tool consumes it directly.

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { invalidSourceResponse, parseWikiSource, toArticleCandidates } from "../article-candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = parseWikiSource(searchParams.get("source"));
    const category = searchParams.get("category") || "";
    const count = Math.min(Math.max(parseInt(searchParams.get("count") || "50"), 1), 200);
    const minQuality = parseInt(searchParams.get("minQuality") || "1");
    const preferImages = searchParams.get("preferImages") !== "false";

    if (!source) return invalidSourceResponse();
    if (!category.trim()) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    const titles = await wikiLoreCardGenerator.fetchCategoryMembers(category, source, count);
    if (titles.length === 0) {
      return NextResponse.json({ articles: [], count: 0, source, category });
    }

    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(titles, source);

    const articles = toArticleCandidates(previews, source, { minQuality, preferImages });

    return NextResponse.json({ articles, count: articles.length, source, category });
  } catch (error) {
    console.error("[Category Articles API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch category articles" }, { status: 500 });
  }
}
