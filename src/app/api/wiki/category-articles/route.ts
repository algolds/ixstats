// src/app/api/wiki/category-articles/route.ts
// List articles in a live wiki category with lightweight batched preview metadata.
// Returns the same shape as /api/wiki/random-articles so the admin tool consumes it directly.

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-lore-card-generator";
import type { WikiSource } from "~/lib/mediawiki-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as WikiSource | null;
    const category = searchParams.get("category") || "";
    const count = Math.min(Math.max(parseInt(searchParams.get("count") || "50"), 1), 200);
    const minQuality = parseInt(searchParams.get("minQuality") || "1");
    const preferImages = searchParams.get("preferImages") !== "false";

    if (!source || !["ixwiki", "iiwiki"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }
    if (!category.trim()) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    const titles = await wikiLoreCardGenerator.fetchCategoryMembers(category, source, count);
    if (titles.length === 0) {
      return NextResponse.json({ articles: [], count: 0, source, category });
    }

    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(titles, source);

    const articles = previews
      .filter((p) => p.estimatedQuality >= minQuality)
      .map((p) => ({
        title: p.title,
        excerpt: p.extract,
        qualityScore: p.estimatedQuality,
        estimatedRarity: p.estimatedRarity,
        wikiSource: source,
        artwork: p.imageUrl,
        hasImage: p.hasImage,
        length: p.length,
        categoryCount: p.categoryCount,
      }))
      .sort((a, b) => {
        if (preferImages && (b.hasImage ? 1 : 0) !== (a.hasImage ? 1 : 0)) {
          return (b.hasImage ? 1 : 0) - (a.hasImage ? 1 : 0);
        }
        return b.qualityScore - a.qualityScore;
      });

    return NextResponse.json({ articles, count: articles.length, source, category });
  } catch (error) {
    console.error("[Category Articles API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch category articles" }, { status: 500 });
  }
}
