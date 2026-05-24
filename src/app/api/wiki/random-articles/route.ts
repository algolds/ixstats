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

    if (!source || !["ixwiki", "iiwiki"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }

    if (count < 10 || count > 100) {
      return NextResponse.json({ error: "Count must be between 10 and 100" }, { status: 400 });
    }

    const articles = await wikiLoreCardGenerator.fetchRandomArticles(count, source);

    return NextResponse.json({
      articles,
      count: articles.length,
      source,
    });
  } catch (error) {
    console.error("[Random Articles API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch random articles" }, { status: 500 });
  }
}
