// src/app/api/wiki/preview-article/route.ts
// API endpoint to preview article quality and estimated rarity

import { NextResponse } from "next/server";
import { wikiProxyRateLimitResponse } from "~/app/api/mediawiki/_rate-limit";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import type { WikiSource } from "~/lib/wiki-os/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await wikiProxyRateLimitResponse(request, "wiki preview-article");
  if (limited) return limited;

  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as WikiSource | null;
    const title = searchParams.get("title");

    if (!source || !["ixwiki", "iiwiki"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json({ error: "Article title is required" }, { status: 400 });
    }

    // Generate card candidate (doesn't save to DB)
    const candidate = await wikiLoreCardGenerator.generateCard(title, source);

    if (!candidate) {
      return NextResponse.json({ error: "Article not found or quality too low" }, { status: 404 });
    }

    return NextResponse.json({
      title: candidate.title,
      excerpt: candidate.description,
      qualityScore: candidate.qualityScore,
      estimatedRarity: candidate.rarity,
      category: candidate.category,
      wikiSource: candidate.wikiSource,
      artwork: candidate.artwork,
      hasImage: !!candidate.artwork && !candidate.artwork.includes("placeholder"),
      stats: candidate.stats,
    });
  } catch (error) {
    console.error("[Preview Article API] Error:", error);
    return NextResponse.json({ error: "Failed to preview article" }, { status: 500 });
  }
}
