// src/app/api/wiki/generate-lore-card/route.ts
// API endpoint to generate and save a lore card from a wiki article

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import { invalidSourceResponse, parseWikiSource } from "../article-candidates";
import { requireAdminSession } from "~/server/shared/route-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const denied = await requireAdminSession("Admin permissions required");
    if (denied instanceof NextResponse) return denied;

    const body = await request.json();
    const { articleTitle } = body;
    const wikiSource = parseWikiSource(body.wikiSource);

    if (!articleTitle || typeof articleTitle !== "string") {
      return NextResponse.json({ error: "Article title is required" }, { status: 400 });
    }

    if (!wikiSource) return invalidSourceResponse();

    // Generate card candidate (require image)
    const candidate = await wikiLoreCardGenerator.generateCard(articleTitle, wikiSource, {
      requireImage: true,
    });

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
