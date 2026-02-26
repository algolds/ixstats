// src/app/api/wiki/generate-lore-card/route.ts
// API endpoint to generate and save a lore card from a wiki article

import { NextResponse } from "next/server";
import { wikiLoreCardGenerator } from "~/lib/wiki-lore-card-generator";
import type { WikiSource } from "~/lib/mediawiki-config";
import { auth } from "@clerk/nextjs/server";
import { isSystemOwner } from "~/lib/system-owner-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check admin permissions
    const allowedRoles = new Set(["admin", "owner", "staff"]);
    const isOwner = isSystemOwner(userId);
    const hasAdminRole =
      session?.sessionClaims?.metadata &&
      typeof session.sessionClaims.metadata === "object" &&
      "role" in session.sessionClaims.metadata &&
      typeof session.sessionClaims.metadata.role === "string" &&
      allowedRoles.has(session.sessionClaims.metadata.role);

    if (!isOwner && !hasAdminRole) {
      return NextResponse.json(
        { error: "Admin permissions required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { articleTitle, wikiSource } = body;

    if (!articleTitle || typeof articleTitle !== "string") {
      return NextResponse.json(
        { error: "Article title is required" },
        { status: 400 }
      );
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
