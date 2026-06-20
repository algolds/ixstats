/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/ns-api-client";
import { SyncHealthMonitor } from "~/lib/ns-sync-monitor";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

const SYNC_TYPE = "NS_CARD_SYNC";
const activeRunningJobs = new Set<string>();

// ─── Background Processing Functions ──────────────────────────────

/**
 * Process a single nation's deck: fetch cards, deduplicate, upsert into DB.
 * Returns counts of created/updated cards and any errors.
 */
async function processNationDeck(
  db: PrismaClient,
  nationName: string,
  regionName: string
): Promise<{ cardsCreated: number; cardsUpdated: number; errors: string[] }> {
  let cardsCreated = 0;
  let cardsUpdated = 0;
  const errors: string[] = [];

  const deckData = await nsApiClient.fetchDeck(nationName);
  if (!deckData || deckData.cards.length === 0) {
    return { cardsCreated, cardsUpdated, errors };
  }

  // Deduplicate cards in the deck
  const uniqueCards = new Map<string, (typeof deckData.cards)[0]>();
  for (const card of deckData.cards) {
    const key = `${card.id}-${card.season}`;
    if (!uniqueCards.has(key)) uniqueCards.set(key, card);
  }

  for (const [, nsCard] of uniqueCards) {
    try {
      const nsCardId = parseInt(nsCard.id);
      const nsSeason = parseInt(nsCard.season);
      if (isNaN(nsCardId) || isNaN(nsSeason)) continue;

      const existing = await db.card.findFirst({
        where: { nsCardId, nsSeason },
      });

      if (existing) {
        const newMarketValue = Math.max(1, parseFloat(nsCard.market_value || "0"));
        if (Math.abs(existing.marketValue - newMarketValue) > 0.01) {
          await db.card.update({
            where: { id: existing.id },
            data: {
              marketValue: newMarketValue,
              stats: {
                ...((existing.stats as Record<string, unknown>) || {}),
                region: nsCard.region || (existing.stats as any)?.region,
                marketValue: nsCard.market_value,
              },
            },
          });
          cardsUpdated++;
        }
        continue;
      }

      // Fetch detailed info for new cards missing a name
      if (!nsCard.name) {
        const info = await nsApiClient.fetchCardInfo(nsCard.id, nsCard.season);
        if (info) Object.assign(nsCard, info);
      }

      const name = nsCard.name;
      if (!name) continue;

      const description =
        nsCard.description ||
        nsCard.slogan ||
        nsCard.motto ||
        `${nsCard.category || "Unknown"} from ${nsCard.region || "Unknown"}`;
      const artwork = nsCard.flag || "/images/cards/placeholder-nation.png";

      await db.card.create({
        data: {
          id: `card_ns_${nsCard.id}_s${nsCard.season}`,
          title: name,
          description,
          artwork,
          artworkVariants: nsCard.flag
            ? {
                original: nsCard.flag,
                thumbnail: nsCard.flag,
                large: nsCard.flag,
                flagUrl: nsCard.flag,
              }
            : undefined,
          cardType: "NS_IMPORT",
          rarity: nsCard.rarity || "COMMON",
          season: nsSeason,
          nsCardId,
          nsSeason,
          stats: {
            region: nsCard.region,
            category: nsCard.category,
            govt: nsCard.govt,
            cardcategory: nsCard.cardcategory,
            marketValue: nsCard.market_value,
            badge: nsCard.badge,
            trophies: nsCard.trophies,
          },
          metadata: {
            nsData: { ...nsCard },
            importedFrom: `region:${regionName}`,
            importedAt: new Date().toISOString(),
          },
          marketValue: Math.max(1, parseFloat(nsCard.market_value || "0")),
          totalSupply: 1,
          level: 1,
        },
      });
      cardsCreated++;
    } catch (cardError) {
      const msg = cardError instanceof Error ? cardError.message : String(cardError);
      if (!msg.includes("Unique constraint")) {
        errors.push(`Card ${nsCard.id}: ${msg}`);
      }
    }
  }

  return { cardsCreated, cardsUpdated, errors };
}

/**
 * Process nations in a region in the background.
 * Saves progress to SyncLog after every nation so it can be resumed
 * if the server restarts. The full nation list is stored in metadata.
 *
 * @param startFromIndex - Index into the nations array to resume from (0 = start)
 * @param initialCounts  - Accumulated counts to resume from
 */
async function processRegionNationsInBackground(
  db: PrismaClient,
  syncLogId: string,
  nations: string[],
  regionName: string,
  startFromIndex = 0,
  initialCounts = { cardsCreated: 0, cardsUpdated: 0, errors: [] as string[] }
) {
  activeRunningJobs.add(syncLogId);
  try {
    let nationsProcessed = startFromIndex;
    let cardsCreated = initialCounts.cardsCreated;
    let cardsUpdated = initialCounts.cardsUpdated;
    const errors: string[] = [...initialCounts.errors];

    if (startFromIndex > 0) {
      console.log(
        `[NS Import] Resuming region ${regionName} from nation ${startFromIndex}/${nations.length} (${cardsCreated} cards already created)`
      );
    }

    for (let i = startFromIndex; i < nations.length; i++) {
      // Check if the job was paused or stopped/cancelled in the DB
      const currentJob = await db.syncLog.findUnique({
        where: { id: syncLogId },
        select: { status: true },
      });
      if (currentJob?.status === "PAUSED") {
        console.log(
          `[NS Import] Region ${regionName} fetch paused at nation index ${i}/${nations.length}`
        );
        return; // Exit graceful pause
      }
      if (currentJob?.status === "FAILED") {
        console.log(
          `[NS Import] Region ${regionName} fetch stopped at nation index ${i}/${nations.length}`
        );
        return; // Exit stopped job
      }

      const nationName = nations[i]!;
      try {
        const result = await processNationDeck(db, nationName, regionName);
        cardsCreated += result.cardsCreated;
        cardsUpdated += result.cardsUpdated;
        errors.push(...result.errors);
      } catch (nationError) {
        const msg = nationError instanceof Error ? nationError.message : String(nationError);
        errors.push(`Nation ${nationName}: ${msg}`);
      }

      nationsProcessed = i + 1;

      // Save progress after EVERY nation so we can resume precisely
      await db.syncLog.update({
        where: { id: syncLogId },
        data: {
          itemsProcessed: nationsProcessed,
          cardsProcessed: cardsCreated + cardsUpdated,
          cardsCreated,
          cardsUpdated,
          metadata: {
            regionName,
            totalNations: nations.length,
            nations, // Full nation list stored for resume
            nationsProcessed,
            cardsCreated,
            cardsUpdated,
            errorCount: errors.length,
            lastProcessedIndex: i,
          },
        },
      });
    }

    // Final update — mark complete
    await db.syncLog.update({
      where: { id: syncLogId },
      data: {
        status: errors.length > nations.length / 2 ? "FAILED" : "SUCCESS",
        itemsProcessed: nationsProcessed,
        itemsFailed: errors.length,
        cardsProcessed: cardsCreated + cardsUpdated,
        cardsCreated,
        cardsUpdated,
        errorMessage: errors.length > 0 ? errors.slice(0, 20).join("; ") : null,
        completedAt: new Date(),
        metadata: {
          regionName,
          totalNations: nations.length,
          nations, // Keep for reference
          nationsProcessed,
          cardsCreated,
          cardsUpdated,
          errorCount: errors.length,
        },
      },
    });

    console.log(
      `[NS Import] Region ${regionName} complete: ${nationsProcessed} nations, ${cardsCreated} created, ${cardsUpdated} updated, ${errors.length} errors`
    );
  } finally {
    activeRunningJobs.delete(syncLogId);
  }
}

export const nsImportSyncRouter = createTRPCRouter({
  /**
   * Admin: Get comprehensive sync health across all NS import operations
   */
  getSyncHealth: adminProcedure.query(async () => {
    return await SyncHealthMonitor.getHealthStats();
  }),

  /**
   * Admin: Get recent sync logs
   */
  getSyncLogs: adminProcedure
    .input(
      z.object({
        syncTypeFilter: z.enum(["all", "region"]).optional().default("all"),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      let where: Record<string, unknown>;
      if (input.syncTypeFilter === "region") {
        where = { syncType: { startsWith: "NS_REGION_" } };
      } else {
        where = { syncType: { startsWith: "NS_" } };
      }

      const logs = await ctx.db.syncLog.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: input.limit,
      });

      return logs.map((log) => ({
        id: log.id,
        syncType: log.syncType,
        season: log.season,
        status: log.status,
        cardsProcessed: log.cardsProcessed ?? 0,
        cardsCreated: log.cardsCreated ?? 0,
        cardsUpdated: log.cardsUpdated ?? 0,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        duration: log.completedAt ? log.completedAt.getTime() - log.startedAt.getTime() : null,
      }));
    }),

  // ─── Bulk Import Endpoints ────────────────────────────────────────

  /**
   * Admin: Fetch and import all cards from a specific NS region
   * Returns immediately — processing runs in the background
   */
  /**
   * Admin: Fetch and import all cards from specific NS regions (comma-separated names)
   * Returns immediately — processing runs in parallel in the background
   */
  fetchRegionCards: adminProcedure
    .input(
      z.object({
        regionNames: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const regions = input.regionNames
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      if (regions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid region names provided",
        });
      }

      const results = [];
      for (const regionName of regions) {
        let nations;
        try {
          nations = await nsApiClient.fetchRegionNations(regionName);
        } catch (err) {
          console.error(`Failed to fetch nations for region ${regionName}:`, err);
          continue;
        }

        if (!nations || nations.length === 0) {
          continue;
        }

        // Create sync log entry for tracking
        const syncLog = await ctx.db.syncLog.create({
          data: {
            syncType: `NS_REGION_${regionName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
            status: "IN_PROGRESS",
            season: null,
            itemsProcessed: 0,
            itemsFailed: 0,
            metadata: {
              regionName,
              totalNations: nations.length,
              nations, // Store full list so we can resume
              nationsProcessed: 0,
              cardsCreated: 0,
              cardsUpdated: 0,
              errorCount: 0,
              lastProcessedIndex: -1,
              startedBy: ctx.user.id,
            },
            startedAt: new Date(),
          },
        });

        // Fire-and-forget background processing
        processRegionNationsInBackground(
          ctx.db as unknown as PrismaClient,
          syncLog.id,
          nations,
          regionName
        ).catch((error) => {
          console.error(`[NS Import] Background region fetch failed:`, error);
        });

        results.push({
          regionName,
          syncLogId: syncLog.id,
          nationsFound: nations.length,
        });
      }

      if (results.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No nations found in any of the specified regions",
        });
      }

      return {
        success: true,
        results,
        message: `Started importing cards for ${results.map((r) => `"${r.regionName}" (${r.nationsFound} nations)`).join(", ")}`,
      };
    }),

  /**
   * Admin: Get status of a specific sync operation
   * Used by frontend to poll progress of background jobs
   */
  getRegionSyncStatus: adminProcedure
    .input(
      z.object({
        syncLogId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const log = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!log) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sync log not found",
        });
      }

      const meta = (log.metadata as Record<string, unknown>) || {};
      return {
        id: log.id,
        syncType: log.syncType,
        status: log.status,
        itemsProcessed: log.itemsProcessed,
        cardsProcessed: log.cardsProcessed ?? 0,
        cardsCreated: log.cardsCreated ?? 0,
        cardsUpdated: log.cardsUpdated ?? 0,
        errorCount: log.itemsFailed,
        totalNations: (meta.totalNations as number) ?? 0,
        regionName: (meta.regionName as string) ?? null,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        errorMessage: log.errorMessage,
      };
    }),

  // ─── Pause / Play / Stop controls ───

  /**
   * Get all active (IN_PROGRESS or PAUSED) region import jobs.
   */
  getActiveJobs: adminProcedure.query(async ({ ctx }) => {
    const jobs = await ctx.db.syncLog.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "PAUSED"] },
        syncType: { startsWith: "NS_REGION_" },
      },
      orderBy: { startedAt: "desc" },
    });

    return jobs.map((job) => {
      const meta = (job.metadata as Record<string, any>) || {};
      return {
        id: job.id,
        syncType: job.syncType,
        regionName: (meta.regionName as string) ?? "Unknown",
        totalNations: (meta.totalNations as number) ?? 0,
        nationsProcessed: job.itemsProcessed ?? 0,
        cardsCreated: job.cardsCreated ?? 0,
        cardsUpdated: job.cardsUpdated ?? 0,
        errorCount: job.itemsFailed ?? 0,
        startedAt: job.startedAt,
        status: job.status,
        lastProcessedIndex: (meta.lastProcessedIndex as number) ?? -1,
      };
    });
  }),

  /**
   * Admin: Pause an active region import job.
   */
  pauseRegionFetch: adminProcedure
    .input(z.object({ syncLogId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const syncLog = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!syncLog) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sync job not found" });
      }

      if (syncLog.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job is already ${syncLog.status}, only running jobs can be paused`,
        });
      }

      await ctx.db.syncLog.update({
        where: { id: input.syncLogId },
        data: { status: "PAUSED" },
      });

      return {
        success: true,
        message:
          "Pause requested. The job will pause after the current nation finishes processing.",
      };
    }),

  /**
   * Admin: Resume a paused or interrupted region import job.
   */
  resumeRegionFetch: adminProcedure
    .input(z.object({ syncLogId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const syncLog = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!syncLog) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sync job not found" });
      }

      if (syncLog.status !== "IN_PROGRESS" && syncLog.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job is already ${syncLog.status}, cannot resume`,
        });
      }

      // If it is already running in memory, skip starting another loop.
      if (activeRunningJobs.has(syncLog.id)) {
        return {
          success: true,
          syncLogId: syncLog.id,
          message: "Job is already running.",
          resumed: false,
        };
      }

      const meta = syncLog.metadata as Record<string, any> | null;
      const nations = meta?.nations as string[] | undefined;
      const regionName = meta?.regionName as string | undefined;

      if (!nations || !Array.isArray(nations) || nations.length === 0 || !regionName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job metadata is missing the nation list — cannot resume.",
        });
      }

      const lastProcessedIndex = (meta?.lastProcessedIndex as number) ?? -1;
      const resumeFromIndex = lastProcessedIndex + 1;

      if (resumeFromIndex >= nations.length) {
        await ctx.db.syncLog.update({
          where: { id: syncLog.id },
          data: { status: "SUCCESS", completedAt: new Date() },
        });
        return {
          success: true,
          syncLogId: syncLog.id,
          message: `Job was already complete.`,
          resumed: false,
        };
      }

      // Update DB status to IN_PROGRESS
      await ctx.db.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "IN_PROGRESS" },
      });

      console.log(
        `[NS Import] Resuming region "${regionName}" from nation ${resumeFromIndex}/${nations.length}`
      );

      // Fire-and-forget background processing
      processRegionNationsInBackground(
        ctx.db as unknown as PrismaClient,
        syncLog.id,
        nations,
        regionName,
        resumeFromIndex,
        {
          cardsCreated: syncLog.cardsCreated ?? 0,
          cardsUpdated: syncLog.cardsUpdated ?? 0,
          errors: [],
        }
      ).catch((error) => {
        console.error(`[NS Import] Background resume failed:`, error);
      });

      return {
        success: true,
        syncLogId: syncLog.id,
        message: `Resumed import for region "${regionName}".`,
        resumed: true,
      };
    }),

  /**
   * Admin: Stop/cancel a running or paused region import job.
   */
  stopRegionFetch: adminProcedure
    .input(z.object({ syncLogId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const syncLog = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!syncLog) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sync job not found" });
      }

      if (syncLog.status !== "IN_PROGRESS" && syncLog.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job status is ${syncLog.status}, cannot stop`,
        });
      }

      await ctx.db.syncLog.update({
        where: { id: input.syncLogId },
        data: {
          status: "FAILED",
          errorMessage: "Stopped by administrator",
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Job stopped successfully.",
      };
    }),

  // ─── Region Discovery ────────────────────────────────────────────

  /**
   * Discover the largest NS regions by nation count.
   * Fetches regions tagged "massive" and "enormous" from the World API,
   * then queries each for nation count. Returns top N sorted by size.
   */
  discoverTopRegions: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(15),
        tag: z.string().min(1).default("gargantuan"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { limit, tag } = input;

      console.log(`[NS Import] Discovering top regions matching tag "${tag}" (limit: ${limit})...`);

      const tagsToFetch = [tag === "massive" ? "gargantuan" : tag];

      const allRegionNames = new Set<string>();
      for (const t of tagsToFetch) {
        try {
          const regions = await nsApiClient.fetchRegionsByTag(t);
          if (regions) {
            regions.forEach((r) => allRegionNames.add(r));
          }
        } catch (err) {
          console.error(`Failed to fetch regions by tag "${t}":`, err);
        }
      }

      if (allRegionNames.size === 0) {
        console.warn(`[NS Import] No regions found matching tag "${tag}"`);
        return {
          regions: [],
          totalScanned: 0,
        };
      }

      console.log(
        `[NS Import] Found ${allRegionNames.size} matching regions, querying nation counts...`
      );

      // Query nation counts - limit concurrent requests to stay within rate limits
      const regionData: { id: string; name: string; numnations: number }[] = [];

      // Query first 30 candidates to prevent hitting API rate limits
      const candidates = Array.from(allRegionNames).slice(0, 30);

      for (const regionId of candidates) {
        const info = await nsApiClient.fetchRegionNationCount(regionId);
        if (info) {
          regionData.push({
            id: regionId,
            name: info.name,
            numnations: info.numnations,
          });
        }
      }

      // Sort by nation count descending and take top N
      regionData.sort((a, b) => b.numnations - a.numnations);
      const topRegions = regionData.slice(0, limit);

      console.log(
        `[NS Import] Top ${topRegions.length} regions:`,
        topRegions.map((r) => `${r.name} (${r.numnations})`).join(", ")
      );

      return {
        regions: topRegions,
        totalScanned: regionData.length,
      };
    }),
});
