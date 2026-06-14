// src/app/api/wiki/random-articles/route.ts
// API endpoint to fetch random wiki articles for batch lore card generation

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-lore-card-generator";
import type { WikiSource } from "~/lib/mediawiki-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as WikiSource | null;
    const count = parseInt(searchParams.get("count") || "20");
    const minQuality = parseInt(searchParams.get("minQuality") || "60");
    const preferImages = searchParams.get("preferImages") !== "false";

    if (!source || !["ixwiki", "iiwiki"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }

    if (count < 10 || count > 100) {
      return NextResponse.json({ error: "Count must be between 10 and 100" }, { status: 400 });
    }

    // Fetch a larger pool and preview/filter server-side to avoid many failing client previews
    const MULTIPLIER = 3;
    const poolSize = Math.max(count * MULTIPLIER, 20);
    const titles = await wikiLoreCardGenerator.fetchRandomArticles(poolSize, source);

    // Concurrency helper
    const mapWithConcurrency = async <T, R>(
      items: T[],
      limit: number,
      fn: (item: T) => Promise<R>
    ) => {
      const results: R[] = new Array(items.length);
      let i = 0;
      const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
        while (true) {
          const idx = i++;
          if (idx >= items.length) break;
          try {
            results[idx] = await fn(items[idx]);
            // eslint-disable-next-line unused-imports/no-unused-vars
          } catch (e) {
            results[idx] = null as unknown as R;
          }
        }
      });
      await Promise.all(workers);
      return results;
    };

    // Preview/generate candidates concurrently and collect viable ones
    const concurrency = 6;
    const previewResults = await mapWithConcurrency(titles, concurrency, async (title) => {
      try {
        const candidate = await wikiLoreCardGenerator.generateCard(title, source);
        if (!candidate) return null;
        const q = candidate.qualityScore ?? 0;
        if (q < minQuality) return null;
        const hasImage = !!candidate.artwork && !candidate.artwork.includes("placeholder");
        return {
          title: title,
          excerpt: candidate.description || candidate.fullExcerpt || "",
          qualityScore: q,
          estimatedRarity: candidate.rarity,
          wikiSource: candidate.wikiSource || source,
          artwork: candidate.artwork || null,
          hasImage,
        };
      } catch (error) {
        console.error("[Random Articles API] preview error:", error);
        return null;
      }
    });

    const viable = (previewResults.filter(Boolean) as any[])
      // prefer images first if requested
      .sort((a, b) => {
        if (preferImages) {
          if ((b.hasImage ? 1 : 0) !== (a.hasImage ? 1 : 0))
            return (b.hasImage ? 1 : 0) - (a.hasImage ? 1 : 0);
        }
        return b.qualityScore - a.qualityScore;
      })
      .slice(0, count);

    return NextResponse.json({ articles: viable, count: viable.length, source });
  } catch (error) {
    console.error("[Random Articles API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch random articles" }, { status: 500 });
  }
}
