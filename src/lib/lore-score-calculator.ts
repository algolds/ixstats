/**
 * lore-score-calculator.ts — Calculates a country's "Lore Score" (0-100)
 * based on wiki content depth, map features, and storytelling effort.
 *
 * The Lore Score creates a gameplay incentive to write wiki content.
 * It bridges the wiki (canonical truth) to the game (manifestation)
 * by rewarding worldbuilding with visible progress.
 *
 * Score Components:
 *   Wiki depth (50 points max)
 *   Map storytelling (25 points max)
 *   Platform engagement (25 points max)
 */

import type { PrismaClient } from "@prisma/client";

export interface LoreScoreBreakdown {
  /** Overall score 0-100 */
  total: number;
  /** Tier label */
  tier: string;
  /** Per-component scores */
  components: {
    wikiDepth: number; // 0-50
    mapStorytelling: number; // 0-25
    engagement: number; // 0-25
  };
  /** Detailed metrics for display */
  details: {
    wikiArticleLength: number;
    wikiSectionCount: number;
    satelliteArticleCount: number;
    storyPinCount: number;
    storylineCount: number;
    cityCount: number;
    loreCardCount: number;
  };
}

export const LORE_TIERS = [
  { min: 0, max: 20, label: "Newcomer", color: "#6b7280" },
  { min: 21, max: 40, label: "Established", color: "#3b82f6" },
  { min: 41, max: 60, label: "Distinguished", color: "#8b5cf6" },
  { min: 61, max: 80, label: "Master Worldbuilder", color: "#f59e0b" },
  { min: 81, max: 100, label: "Legendary", color: "#ef4444" },
] as const;

export function getLoreTier(score: number): (typeof LORE_TIERS)[number] {
  return LORE_TIERS.find((t) => score >= t.min && score <= t.max) ?? LORE_TIERS[0];
}

/**
 * Calculate lore score for a country.
 * This runs server-side and combines wiki data + database data.
 *
 * @param db - Prisma client
 * @param countryId - Country ID
 * @param wikiData - Optional pre-fetched wiki data to avoid redundant calls
 */
export async function calculateLoreScore(
  db: PrismaClient,
  countryId: string,
  wikiData?: {
    articleLength?: number;
    sectionCount?: number;
    satelliteCount?: number;
  }
): Promise<LoreScoreBreakdown> {
  // Fetch all needed data concurrently
  const [storyPins, storylines, cities, loreCards, country] = await Promise.all([
    db.storyPin.count({ where: { countryId, status: "approved" } }),
    db.storyline.count({ where: { countryId } }),
    db.city.count({ where: { countryId, status: "approved" } }),
    // Lore cards linked to this country
    db.card
      .count({
        where: {
          countryId: countryId,
          cardType: "LORE",
        },
      })
      .catch(() => 0), // Card model might not have ownerId = countryId pattern
    db.country.findUnique({
      where: { id: countryId },
      select: { wikiPageTitle: true, name: true },
    }),
  ]);

  const articleLength = wikiData?.articleLength ?? 0;
  const sectionCount = wikiData?.sectionCount ?? 0;
  const satelliteCount = wikiData?.satelliteCount ?? 0;

  // ─── Wiki Depth Score (0-50) ───────────────────────────────────────
  // Main article length: 0-20 points (100KB+ = max)
  const lengthScore = Math.min(20, Math.round((articleLength / 100_000) * 20));

  // Section count: 0-10 points (15+ sections = max)
  const sectionScore = Math.min(10, Math.round((sectionCount / 15) * 10));

  // Satellite articles: 0-20 points (20+ satellite articles = max)
  const satelliteScore = Math.min(20, Math.round((satelliteCount / 20) * 20));

  const wikiDepth = lengthScore + sectionScore + satelliteScore;

  // ─── Map Storytelling Score (0-25) ─────────────────────────────────
  // Story pins: 0-12 points (12+ pins = max)
  const pinScore = Math.min(12, storyPins);

  // Storylines: 0-5 points (3+ storylines = max)
  const storylineScore = Math.min(5, Math.round((storylines / 3) * 5));

  // Cities: 0-8 points (20+ cities = max)
  const cityScore = Math.min(8, Math.round((cities / 20) * 8));

  const mapStorytelling = pinScore + storylineScore + cityScore;

  // ─── Platform Engagement Score (0-25) ──────────────────────────────
  // Lore cards: 0-10 points (10+ cards = max)
  const cardScore = Math.min(10, loreCards);

  // Having a wiki page at all: 5 points
  const hasWiki = country?.wikiPageTitle ? 5 : 0;

  // Having story pins with storylines (narrative depth): 0-10 points
  const narrativeBonus =
    storylines > 0 && storyPins >= 3
      ? Math.min(10, Math.round(((storyPins * storylines) / 15) * 10))
      : 0;

  const engagement = cardScore + hasWiki + narrativeBonus;

  // ─── Total ─────────────────────────────────────────────────────────
  const total = Math.min(100, wikiDepth + mapStorytelling + engagement);
  const tier = getLoreTier(total).label;

  return {
    total,
    tier,
    components: {
      wikiDepth,
      mapStorytelling,
      engagement,
    },
    details: {
      wikiArticleLength: articleLength,
      wikiSectionCount: sectionCount,
      satelliteArticleCount: satelliteCount,
      storyPinCount: storyPins,
      storylineCount: storylines,
      cityCount: cities,
      loreCardCount: loreCards,
    },
  };
}
