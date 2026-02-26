/**
 * Public API: Forum User Cards
 *
 * GET /api/forum/user-cards?username=Caphiria&limit=50&sort=rarity
 *
 * Returns a user's card collection data for forum display.
 * No authentication required — read-only public data.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { computeRarityCounts, formatValue, rarityRank } from "~/lib/forum-widget-utils";

const CACHE_MAX_AGE = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const username = searchParams.get("username")?.trim();

  if (!username || username.length > 100) {
    return NextResponse.json(
      { error: "Missing or invalid username parameter" },
      { status: 400 }
    );
  }

  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1),
    100
  );
  const sort = searchParams.get("sort") || "rarity";

  try {
    // Look up user by forumUsername (case-insensitive)
    const user = await db.user.findFirst({
      where: {
        forumUsername: { equals: username, mode: "insensitive" },
      },
      select: {
        id: true,
        forumUsername: true,
        collectorLevel: true,
        country: { select: { name: true, flag: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch card ownerships with card details
    const ownerships = await db.cardOwnership.findMany({
      where: { ownerId: user.id },
      include: {
        cards: {
          select: {
            id: true,
            title: true,
            description: true,
            artwork: true,
            rarity: true,
            cardType: true,
            season: true,
            marketValue: true,
            stats: true,
            level: true,
            wikiArticleTitle: true,
            wikiSource: true,
          },
        },
      },
      take: limit,
    });

    // Sort in-memory (Prisma doesn't support ordering by relation fields in all cases)
    const sorted = ownerships.sort((a, b) => {
      if (sort === "value") return b.cards.marketValue - a.cards.marketValue;
      if (sort === "acquired")
        return new Date(b.acquiredAt).getTime() - new Date(a.acquiredAt).getTime();
      // Default: rarity (highest first)
      return rarityRank(b.cards.rarity) - rarityRank(a.cards.rarity);
    });

    // Compute summary
    const allCards = sorted.map((o) => o.cards);
    const totalValue = allCards.reduce((sum, c) => sum + c.marketValue, 0);
    const rarityCounts = computeRarityCounts(allCards);

    const response = NextResponse.json({
      user: {
        forumUsername: user.forumUsername,
        country: user.country?.name ?? null,
        countryFlag: user.country?.flag ?? null,
        collectorLevel: user.collectorLevel,
      },
      summary: {
        totalCards: ownerships.length,
        totalValue,
        totalValueFormatted: formatValue(totalValue),
        rarityCounts,
      },
      cards: sorted.map((o) => ({
        id: o.cards.id,
        title: o.cards.title,
        description: o.cards.description,
        artwork: o.cards.artwork,
        rarity: o.cards.rarity,
        cardType: o.cards.cardType,
        season: o.cards.season,
        marketValue: o.cards.marketValue,
        level: o.cards.level ?? 1,
        serialNumber: o.serialNumber,
        acquiredAt: o.acquiredAt.toISOString(),
      })),
    });

    response.headers.set(
      "Cache-Control",
      `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=600`
    );
    response.headers.set("Access-Control-Allow-Origin", "https://forum.ixwiki.com");

    return response;
  } catch (error) {
    console.error("[Forum API] Error fetching user cards:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
