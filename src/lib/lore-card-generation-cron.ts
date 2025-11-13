/**
 * Lore Card Generation Cron Job
 *
 * Runs daily to automatically generate LORE cards from IxWiki and IIWiki articles.
 * Generates 10-20 cards per day (5-10 from each wiki) based on quality scoring.
 *
 * Schedule: Daily at 2:00 AM UTC
 *
 * Features:
 * - Multi-wiki support (IxWiki + IIWiki)
 * - Quality filtering (minimum score threshold)
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
import { wikiLoreCardGenerator, LORE_CATEGORIES } from "~/lib/wiki-lore-card-generator";
import type { WikiSource } from "~/lib/mediawiki-config";

/**
 * Generation result for monitoring
 */
export interface LoreCardGenerationResult {
  success: boolean;
  generated: number;
  ixwikiCount: number;
  iiwikiCount: number;
  failed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
  rarityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

/**
 * Configuration for lore card generation
 */
const GENERATION_CONFIG = {
  // Target cards per wiki per day
  targetPerWiki: 10,

  // Minimum quality score to generate card (RARE+ articles)
  minQualityScore: 41,

  // Maximum attempts per wiki
  maxAttempts: 30,

  // Timeout per card generation (ms)
  generationTimeout: 10000,
};

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
    categoryBreakdown: {},
  };

  try {
    // Generate cards from IxWiki
    const ixwikiResults = await generateCardsFromWiki(
      "ixwiki",
      GENERATION_CONFIG.targetPerWiki
    );
    result.ixwikiCount = ixwikiResults.generated;
    result.failed += ixwikiResults.failed;
    result.errors.push(...ixwikiResults.errors);

    // Merge breakdowns
    for (const [rarity, count] of Object.entries(ixwikiResults.rarityBreakdown)) {
      result.rarityBreakdown[rarity] = (result.rarityBreakdown[rarity] || 0) + count;
    }
    for (const [category, count] of Object.entries(ixwikiResults.categoryBreakdown)) {
      result.categoryBreakdown[category] = (result.categoryBreakdown[category] || 0) + count;
    }

    // Generate cards from IIWiki
    const iiwikiResults = await generateCardsFromWiki(
      "iiwiki",
      GENERATION_CONFIG.targetPerWiki
    );
    result.iiwikiCount = iiwikiResults.generated;
    result.failed += iiwikiResults.failed;
    result.errors.push(...iiwikiResults.errors);

    // Merge breakdowns
    for (const [rarity, count] of Object.entries(iiwikiResults.rarityBreakdown)) {
      result.rarityBreakdown[rarity] = (result.rarityBreakdown[rarity] || 0) + count;
    }
    for (const [category, count] of Object.entries(iiwikiResults.categoryBreakdown)) {
      result.categoryBreakdown[category] = (result.categoryBreakdown[category] || 0) + count;
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
      `  Rarity breakdown: ${JSON.stringify(result.rarityBreakdown)}\n` +
      `  Category breakdown: ${JSON.stringify(result.categoryBreakdown)}`
    );

    if (result.errors.length > 0) {
      console.error(`[Lore Card Cron] Errors (${result.errors.length}):`, result.errors.slice(0, 5));
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

/**
 * Generate cards from a specific wiki
 */
async function generateCardsFromWiki(
  wikiSource: WikiSource,
  targetCount: number
): Promise<{
  generated: number;
  failed: number;
  errors: string[];
  rarityBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}> {
  console.log(`[Lore Card Cron] Generating ${targetCount} cards from ${wikiSource}...`);

  const result: {
    generated: number;
    failed: number;
    errors: string[];
    rarityBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
  } = {
    generated: 0,
    failed: 0,
    errors: [],
    rarityBreakdown: {},
    categoryBreakdown: {},
  };

  let attempts = 0;

  while (result.generated < targetCount && attempts < GENERATION_CONFIG.maxAttempts) {
    attempts++;

    try {
      // Fetch random articles
      const articleTitles = await wikiLoreCardGenerator.fetchRandomArticles(5, wikiSource);

      if (articleTitles.length === 0) {
        console.warn(`[Lore Card Cron] No random articles returned from ${wikiSource}`);
        break;
      }

      // Process each article
      for (const articleTitle of articleTitles) {
        if (result.generated >= targetCount) break;

        try {
          // Generate card with timeout
          const candidate = await Promise.race([
            wikiLoreCardGenerator.generateCard(articleTitle, wikiSource),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Generation timeout")), GENERATION_CONFIG.generationTimeout)
            ),
          ]);

          if (!candidate) {
            // Card already exists or article not suitable
            continue;
          }

          // Check quality threshold
          if (candidate.qualityScore < GENERATION_CONFIG.minQualityScore) {
            console.log(
              `[Lore Card Cron] Skipping "${articleTitle}" - quality score ${candidate.qualityScore.toFixed(1)} ` +
              `below threshold ${GENERATION_CONFIG.minQualityScore}`
            );
            continue;
          }

          // Create card in database
          const cardId = await wikiLoreCardGenerator.createCard(candidate);

          result.generated++;

          // Track breakdowns
          result.rarityBreakdown[candidate.rarity] = (result.rarityBreakdown[candidate.rarity] || 0) + 1;
          result.categoryBreakdown[candidate.category] = (result.categoryBreakdown[candidate.category] || 0) + 1;

          console.log(
            `[Lore Card Cron] ✓ Generated ${candidate.rarity} card: "${candidate.title}" ` +
            `(${wikiSource}, quality: ${candidate.qualityScore.toFixed(1)})`
          );
        } catch (error) {
          result.failed++;
          const errorMsg = `Failed to generate card for "${articleTitle}": ${error}`;
          result.errors.push(errorMsg);
          console.error(`[Lore Card Cron] ${errorMsg}`);
        }
      }
    } catch (error) {
      const errorMsg = `Error fetching articles from ${wikiSource}: ${error}`;
      result.errors.push(errorMsg);
      console.error(`[Lore Card Cron] ${errorMsg}`);
    }
  }

  console.log(`[Lore Card Cron] ${wikiSource} complete: ${result.generated} generated, ${result.failed} failed`);
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
        metadata: JSON.stringify({
          ixwikiCount: result.ixwikiCount,
          iiwikiCount: result.iiwikiCount,
          rarityBreakdown: result.rarityBreakdown,
          categoryBreakdown: result.categoryBreakdown,
        }),
      },
    });

    console.log("[Lore Card Cron] ✓ Logged generation result to database");
  } catch (error) {
    console.error("[Lore Card Cron] Failed to log result to database:", error);
  }
}

/**
 * Get last generation result from database
 */
export async function getLastGenerationResult(): Promise<LoreCardGenerationResult | null> {
  try {
    const lastLog = await db.syncLog.findFirst({
      where: { syncType: "lore-card-generation" },
      orderBy: { startedAt: "desc" },
    });

    if (!lastLog) return null;

    const metadata = lastLog.metadata ? JSON.parse(lastLog.metadata as string) : {};
    const errors = lastLog.errorMessage ? JSON.parse(lastLog.errorMessage) : [];

    return {
      success: lastLog.status === "completed",
      generated: lastLog.itemsProcessed - lastLog.itemsFailed,
      ixwikiCount: metadata.ixwikiCount || 0,
      iiwikiCount: metadata.iiwikiCount || 0,
      failed: lastLog.itemsFailed,
      errors,
      duration: lastLog.completedAt && lastLog.startedAt
        ? lastLog.completedAt.getTime() - lastLog.startedAt.getTime()
        : 0,
      timestamp: lastLog.startedAt,
      rarityBreakdown: metadata.rarityBreakdown || {},
      categoryBreakdown: metadata.categoryBreakdown || {},
    };
  } catch (error) {
    console.error("[Lore Card Cron] Error fetching last generation result:", error);
    return null;
  }
}

/**
 * Validate generation health (check if running on schedule)
 */
export async function validateGenerationHealth(): Promise<{
  healthy: boolean;
  lastGeneration?: Date;
  hoursSinceGeneration?: number;
  status: "healthy" | "warning" | "critical";
  message: string;
}> {
  const lastResult = await getLastGenerationResult();

  if (!lastResult) {
    return {
      healthy: false,
      status: "critical",
      message: "No lore card generation has ever run",
    };
  }

  const hoursSince = (Date.now() - lastResult.timestamp.getTime()) / (1000 * 60 * 60);

  if (hoursSince < 25) {
    return {
      healthy: true,
      lastGeneration: lastResult.timestamp,
      hoursSinceGeneration: Math.round(hoursSince * 10) / 10,
      status: "healthy",
      message: `Last generation: ${lastResult.generated} cards ${hoursSince.toFixed(1)}h ago`,
    };
  } else if (hoursSince < 48) {
    return {
      healthy: false,
      lastGeneration: lastResult.timestamp,
      hoursSinceGeneration: Math.round(hoursSince * 10) / 10,
      status: "warning",
      message: `Generation overdue (${hoursSince.toFixed(1)}h since last run)`,
    };
  } else {
    return {
      healthy: false,
      lastGeneration: lastResult.timestamp,
      hoursSinceGeneration: Math.round(hoursSince * 10) / 10,
      status: "critical",
      message: `Generation critical (${hoursSince.toFixed(1)}h since last run - expected <25h)`,
    };
  }
}
