// src/app/api/wiki/categories/route.ts
// Search live wiki categories by prefix — feeds the admin lore-card category picker.

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-lore-card-generator";
import type { WikiSource } from "~/lib/mediawiki-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as WikiSource | null;
    const prefix = searchParams.get("prefix") || "";

    if (!source || !["ixwiki", "iiwiki"].includes(source)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }

    const categories = await wikiLoreCardGenerator.searchCategories(prefix, source, 25);
    return NextResponse.json({ categories, source });
  } catch (error) {
    console.error("[Wiki Categories API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
