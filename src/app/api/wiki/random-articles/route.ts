// src/app/api/wiki/random-articles/route.ts
// API endpoint to fetch random wiki articles for batch lore card generation.
// Uses lightweight batched metadata (one request per <=50 titles) instead of running a
// full generateCard per candidate, which previously tripped the wiki's rate limit.

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki/lore-card-generator";
import type { WikiSource } from "~/lib/wiki/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as WikiSource | null;
    const count = parseInt(searchParams.get("count") || "20");
    const minQuality = parseInt(searchParams.get("minQuality") || "1");
    const preferImages = searchParams.get("preferImages") !== "false";

    if (!source || !["ixwiki", "iiwiki"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }

    const validatedCount = Math.min(Math.max(count, 10), 300);

    // Over-fetch random titles to cover pages without images, then preview in batch.
    const poolSize = Math.min(Math.max(validatedCount * 2, 20), 500);
    const titles = await wikiLoreCardGenerator.fetchRandomArticles(poolSize, source);
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
        estimatedValue: p.estimatedValue,
      }))
      .sort((a, b) => {
        if (preferImages && (b.hasImage ? 1 : 0) !== (a.hasImage ? 1 : 0)) {
          return (b.hasImage ? 1 : 0) - (a.hasImage ? 1 : 0);
        }
        return b.qualityScore - a.qualityScore;
      })
      .slice(0, validatedCount);

    return NextResponse.json({ articles, count: articles.length, source });
  } catch (error) {
    console.error("[Random Articles API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch random articles" }, { status: 500 });
  }
}
