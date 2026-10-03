// src/app/api/wiki/categories/route.ts
// Search live wiki categories by prefix — feeds the admin lore-card category picker.

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { invalidSourceResponse, parseWikiSource } from "../article-candidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = parseWikiSource(searchParams.get("source"));
    const prefix = searchParams.get("prefix") || "";

    if (!source) return invalidSourceResponse();

    const categories = await wikiLoreCardGenerator.searchCategories(prefix, source, 25);
    return NextResponse.json({ categories, source });
  } catch (error) {
    console.error("[Wiki Categories API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
