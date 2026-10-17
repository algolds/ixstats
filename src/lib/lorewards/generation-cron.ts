/**
 * Lore Card Generation Cron Job
 *
 * Runs daily to stage LORE cards from random IxWiki and IIWiki articles that have an image. Every card
 * goes through the importer (cards.importer.ts): rarity from the rarity engine, PENDING review, art licence
 * recorded. Up to 20 cards per wiki per day.
 *
 * Schedule: Daily at 2:00 AM UTC
 *
 * Features:
 * - Multi-wiki support (IxWiki + IIWiki)
 * - Duplicate prevention
 * - Balanced wiki sourcing (50/50 split)
 * - Comprehensive logging
 * - Error recovery
 *
 * Usage:
 *   import { generateDailyLoreCards } from '~/lib/lore-card-generation-cron';
 *   await generateDailyLoreCards();
 */

import { db } from "~/server/db";
import type { CardArticleSource } from "~/lib/cards/card-sources";
import { loreCardDiscovery } from "~/lib/cards/lore-card-discovery";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import {
  oneOffImportContext,
  stageArticleCard,
  type StageOutcome,
} from "~/server/modules/cards/cards.importer";

/**
 * Generation result for monitoring
 */
interface LoreCardGenerationResult {
  success: boolean;
  generated: number;
  ixwikiCount: number;
  iiwikiCount: number;
  failed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
  rarityBreakdown: Record<string, number>;
}

/**
 * Configuration for lore card generation
 */
const GENERATION_CONFIG = {
  // Target cards per wiki per day
  targetPerWiki: 20,

  // Maximum attempts per wiki
  maxAttempts: 30,

  // Random articles asked for per attempt
  articlesPerAttempt: 5,
};

// Licence reads per wiki: at most two (file info, then the File page) for every article a run looks at.
const LICENCE_REQUESTS_PER_WIKI =
  GENERATION_CONFIG.maxAttempts * GENERATION_CONFIG.articlesPerAttempt * 2;

/**
 * Main daily lore card generation function
 *
 * Generates balanced set of lore cards from both IxWiki and IIWiki
 */
export async function generateDailyLoreCards(): Promise<LoreCardGenerationResult> {
  const startTime = Date.now();
  console.log("[Lore Card Cron] Starting daily lore card generation...");

  const result: LoreCardGenerationResult = {
    success: false,
    generated: 0,
    ixwikiCount: 0,
    iiwikiCount: 0,
    failed: 0,
    errors: [],
    duration: 0,
    timestamp: new Date(),
    rarityBreakdown: {},
  };

  try {
    // Generate cards from IxWiki
    const ixwikiResults = await generateCardsFromWiki("ixwiki", GENERATION_CONFIG.targetPerWiki);
    result.ixwikiCount = ixwikiResults.generated;
    result.failed += ixwikiResults.failed;
    result.errors.push(...ixwikiResults.errors);

    // Merge breakdowns
    for (const [rarity, count] of Object.entries(ixwikiResults.rarityBreakdown)) {
      result.rarityBreakdown[rarity] = (result.rarityBreakdown[rarity] || 0) + count;
    }

    // Generate cards from IIWiki
    const iiwikiResults = await generateCardsFromWiki("iiwiki", GENERATION_CONFIG.targetPerWiki);
    result.iiwikiCount = iiwikiResults.generated;
    result.failed += iiwikiResults.failed;
    result.errors.push(...iiwikiResults.errors);

    // Merge breakdowns
    for (const [rarity, count] of Object.entries(iiwikiResults.rarityBreakdown)) {
      result.rarityBreakdown[rarity] = (result.rarityBreakdown[rarity] || 0) + count;
    }

    result.generated = result.ixwikiCount + result.iiwikiCount;
    result.success = result.generated > 0;
    result.duration = Date.now() - startTime;

    // Log summary
    console.log(
      `[Lore Card Cron] Generation complete:\n` +
        `  Generated: ${result.generated} cards (IxWiki: ${result.ixwikiCount}, IIWiki: ${result.iiwikiCount})\n` +
        `  Failed: ${result.failed}\n` +
        `  Duration: ${(result.duration / 1000).toFixed(2)}s\n` +
        `  Rarity breakdown: ${JSON.stringify(result.rarityBreakdown)}`
    );

    if (result.errors.length > 0) {
      console.error(
        `[Lore Card Cron] Errors (${result.errors.length}):`,
        result.errors.slice(0, 5)
      );
    }

    // Log to database
    await logGenerationResult(result);

    return result;
  } catch (error) {
    console.error("[Lore Card Cron] Fatal error during generation:", error);
    result.errors.push(`Fatal error: ${error}`);
    result.duration = Date.now() - startTime;

    await logGenerationResult(result);
    return result;
  }
}

/** One wiki's run. */
interface WikiRunResult {
  generated: number;
  failed: number;
  errors: string[];
  rarityBreakdown: Record<string, number>;
}

/** Adds one article's outcome to the run: a staged card, or a failure (a skip or a block is neither). */
function tally(result: WikiRunResult, articleTitle: string, outcome: StageOutcome): void {
  if (outcome.status === "STAGED") {
    result.generated++;
    result.rarityBreakdown[outcome.rarity] = (result.rarityBreakdown[outcome.rarity] || 0) + 1;
  } else if (outcome.status === "FAILED") {
    const message = `Failed to stage "${articleTitle}": ${outcome.reason}`;
    result.failed++;
    result.errors.push(message);
    console.error(`[Lore Card Cron] ${message}`);
  }
}

/**
 * Stage cards from a specific wiki; a wiki that stops answering the licence reads ends its run
 */
async function generateCardsFromWiki(
  wikiSource: CardArticleSource,
  targetCount: number
): Promise<WikiRunResult> {
  console.log(`[Lore Card Cron] Generating ${targetCount} cards from ${wikiSource}...`);

  const result: WikiRunResult = { generated: 0, failed: 0, errors: [], rarityBreakdown: {} };
  const context = await oneOffImportContext(db, wikiSource, LICENCE_REQUESTS_PER_WIKI);
  let attempts = 0;

  while (result.generated < targetCount && attempts < GENERATION_CONFIG.maxAttempts) {
    attempts++;

    try {
      // Fetch random articles
      const articleTitles = await loreCardDiscovery.fetchRandomArticlesWithImages(
        GENERATION_CONFIG.articlesPerAttempt,
        wikiSource
      );

      if (articleTitles.length === 0) {
        console.warn(`[Lore Card Cron] No random articles returned from ${wikiSource}`);
        break;
      }

      // Process each article
      for (const articleTitle of articleTitles) {
        if (result.generated >= targetCount) break;
        const outcome = await stageArticleCard(
          db,
          wikiSource,
          { title: articleTitle, requestedBy: null, jobId: null, requireImage: true },
          context
        );
        tally(result, articleTitle, outcome);
      }
    } catch (error) {
      const errorMsg = `Error staging cards from ${wikiSource}: ${error}`;
      result.errors.push(errorMsg);
      console.error(`[Lore Card Cron] ${errorMsg}`);
      if (error instanceof DiscoveryStopped) break;
      result.failed++;
    }
  }

  console.log(
    `[Lore Card Cron] ${wikiSource} complete: ${result.generated} generated, ${result.failed} failed`
  );
  return result;
}

/**
 * Log generation result to database for historical tracking
 */
async function logGenerationResult(result: LoreCardGenerationResult): Promise<void> {
  try {
    await db.syncLog.create({
      data: {
        syncType: "lore-card-generation",
        status: result.success ? "completed" : "failed",
        itemsProcessed: result.generated + result.failed,
        itemsFailed: result.failed,
        errorMessage: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        startedAt: new Date(result.timestamp.getTime() - result.duration),
        completedAt: result.timestamp,
      },
    });

    console.log("[Lore Card Cron] ✓ Logged generation result to database");
  } catch (error) {
    console.error("[Lore Card Cron] Failed to log result to database:", error);
  }
}
