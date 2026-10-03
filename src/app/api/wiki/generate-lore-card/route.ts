// src/app/api/wiki/generate-lore-card/route.ts
// API endpoint to generate and save a lore card from a wiki article

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import type { WikiSource } from "~/lib/wiki-os/config";
import { requireAdminSession } from "~/server/shared/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const denied = await requireAdminSession("Admin permissions required");
    if (denied instanceof NextResponse) return denied;

    const body = await request.json();
    const { articleTitle, wikiSource } = body;

    if (!articleTitle || typeof articleTitle !== "string") {
      return NextResponse.json({ error: "Article title is required" }, { status: 400 });
    }

    if (!wikiSource || !["ixwiki", "iiwiki"].includes(wikiSource)) {
      return NextResponse.json(
        { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
        { status: 400 }
      );
    }

    // Generate card candidate (require image)
    const candidate = await wikiLoreCardGenerator.generateCard(
      articleTitle,
      wikiSource as WikiSource,
      { requireImage: true }
    );

    if (!candidate) {
      return NextResponse.json(
        { error: "Article not found, quality too low, or card already exists" },
        { status: 400 }
      );
    }

    // Create card in database
    const cardId = await wikiLoreCardGenerator.createCard(candidate);

    return NextResponse.json({
      success: true,
      cardId,
      card: {
        title: candidate.title,
        rarity: candidate.rarity,
        category: candidate.category,
        qualityScore: candidate.qualityScore,
      },
    });
  } catch (error) {
    console.error("[Generate Lore Card API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate lore card" },
      { status: 500 }
    );
  }
}
