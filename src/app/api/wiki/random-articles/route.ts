// src/app/api/wiki/random-articles/route.ts
// API endpoint to fetch random wiki articles for batch lore card generation.
// Uses lightweight batched metadata (one request per <=50 titles) instead of running a
// full generateCard per candidate, which previously tripped the wiki's rate limit.

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { invalidSourceResponse, parseWikiSource, toArticleCandidates } from "../article-candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = parseWikiSource(searchParams.get("source"));
    const count = parseInt(searchParams.get("count") || "20");
    const minQuality = parseInt(searchParams.get("minQuality") || "1");
    const preferImages = searchParams.get("preferImages") !== "false";

    if (!source) return invalidSourceResponse();

    const validatedCount = Math.min(Math.max(count, 10), 300);

    // Over-fetch random titles to cover pages without images, then preview in batch.
    const poolSize = Math.min(Math.max(validatedCount * 2, 20), 500);
    const titles = await wikiLoreCardGenerator.fetchRandomArticles(poolSize, source);
    const previews = await wikiLoreCardGenerator.fetchArticleMetadataBatch(titles, source);

    const articles = toArticleCandidates(previews, source, { minQuality, preferImages }).slice(
      0,
      validatedCount
    );

    return NextResponse.json({ articles, count: articles.length, source });
  } catch (error) {
    console.error("[Random Articles API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch random articles" }, { status: 500 });
  }
}
