/**
 * NationStates Import Router
 *
 * Handles importing NS trading cards into IxCards system
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { SyncHealthMonitor } from "~/lib/nationstates/sync-monitor";
import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";

import { activeRunningJobs, processRegionCardsFromDump } from "~/lib/nationstates/sync-processor";

/**
 * Default set of NS trading-card seasons to include when none are specified.
 * Region syncs are sourced from the official season card dumps
 * (`cardlist_S{season}.xml.gz`) rather than per-nation API calls, per the
 * NationStates API terms. Admins can override with an explicit list.
 */
const DEFAULT_SYNC_SEASONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function normalizeSeasons(input: number[] | undefined): number[] {
  if (!input || input.length === 0) return DEFAULT_SYNC_SEASONS;
  return Array.from(new Set(input.filter((n) => Number.isInteger(n) && n > 0 && n <= 100))).sort(
    (a, b) => a - b
  );
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

  /**
   * Admin: Get cards imported or updated during a specific sync run
   */
  getSyncLogCards: adminProcedure
    .input(
      z.object({
        syncLogId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const syncLog = await ctx.db.syncLog.findUnique({
        where: { id: input.syncLogId },
      });

      if (!syncLog) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sync log not found",
        });
      }

      // Extract region and nations from metadata or syncType
      const meta = (syncLog.metadata as Record<string, any>) || {};
      let regionName: string | null = null;
      if (meta.regionName && typeof meta.regionName === "string") {
        regionName = meta.regionName.trim().toLowerCase();
      } else if (Array.isArray(meta.regionNames) && meta.regionNames[0]) {
        regionName = String(meta.regionNames[0]).trim().toLowerCase();
      } else if (syncLog.syncType.startsWith("NS_REGION_")) {
        regionName = syncLog.syncType.replace("NS_REGION_", "").trim().toLowerCase();
      }

      const nationsList: string[] = Array.isArray(meta.nations)
        ? meta.nations.map((n: any) => String(n).trim()).filter(Boolean)
        : [];

      const orConditions: any[] = [];

      if (regionName) {
        const spaced = regionName.replace(/_/g, " ");
        const underscored = regionName.replace(/\s+/g, "_");
        const titleCase = spaced
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const upper = regionName.toUpperCase();

        const regionVariants = Array.from(
          new Set([regionName, spaced, underscored, titleCase, upper])
        );

        for (const variant of regionVariants) {
          orConditions.push(
            { stats: { path: ["region"], equals: variant } },
            { stats: { path: ["region"], string_contains: variant } },
            { metadata: { path: ["importedFrom"], equals: `region:${variant}` } },
            { metadata: { path: ["importedFrom"], string_contains: variant } }
          );
        }
      }

      if (nationsList.length > 0) {
        const nationVariants: string[] = [];
        for (const nation of nationsList.slice(0, 300)) {
          nationVariants.push(nation);
          nationVariants.push(nation.replace(/_/g, " "));
          nationVariants.push(
            nation
              .split("_")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")
          );
        }
        orConditions.push({
          title: { in: Array.from(new Set(nationVariants)), mode: "insensitive" },
        });
      }

      if (syncLog.startedAt) {
        const start = new Date(syncLog.startedAt.getTime() - 10 * 60 * 1000);
        const end = syncLog.completedAt
          ? new Date(syncLog.completedAt.getTime() + 10 * 60 * 1000)
          : new Date(syncLog.startedAt.getTime() + 60 * 60 * 1000);

        orConditions.push({
          createdAt: { gte: start, lte: end },
        });
        orConditions.push({
          updatedAt: { gte: start, lte: end },
        });
      }

      const where: any = {
        cardType: "NS_IMPORT",
      };

      if (orConditions.length > 0) {
        where.OR = orConditions;
      }

      if (input.search?.trim()) {
        where.title = { contains: input.search.trim(), mode: "insensitive" };
      }

      const [cards, total] = await Promise.all([
        ctx.db.card.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.card.count({ where }),
      ]);

      return {
        syncLog,
        cards,
        total,
        regionName,
      };
    }),



  // ─── Bulk Import Endpoints ────────────────────────────────────────

  /**
   * Admin: Fetch and import all cards from a specific NS region
   * Returns immediately — processing runs in the background
   */
  /**
   * Admin: Fetch and import all cards from specific NS regions (comma-separated names)
   * Returns immediately — processing runs in parallel in the background
   *
   * Card definitions are sourced from the official Trading Cards Daily Dumps,
   * filtered to the requested regions, not from per-nation API calls.
   */
  fetchRegionCards: adminProcedure
    .input(
      z.object({
        regionNames: z.string().min(1),
        seasons: z.array(z.number().int().min(1).max(100)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const regions = input.regionNames
        .split(/[\n,]+/)
        .map((r) => r.trim())
        .filter((r) => r.length > 0);

      if (regions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid region names provided",
        });
      }

      const seasons = normalizeSeasons(input.seasons);

      const results = [];
      for (const regionName of regions) {
        // Create sync log entry for tracking (nations are no longer enumerated;
        // the card dump is filtered by region instead).
        const syncLog = await ctx.db.syncLog.create({
          data: {
            syncType: `NS_REGION_${regionName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
            status: "IN_PROGRESS",
            season: null,
            itemsProcessed: 0,
            itemsFailed: 0,
            metadata: {
              regionNames: regions,
              seasons,
              totalCards: 0,
              cardsProcessed: 0,
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
        processRegionCardsFromDump(
          ctx.db as unknown as PrismaClient,
          syncLog.id,
          regions,
          seasons
        ).catch((error) => {
          console.error(`[NS Import] Background region sync failed:`, error);
        });

        results.push({
          regionName,
          syncLogId: syncLog.id,
          seasons,
        });
      }

      if (results.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No valid regions provided",
        });
      }

      return {
        success: true,
        results,
        message: `Started syncing card data for ${results
          .map((r) => `"${r.regionName}" (seasons ${r.seasons.join(",")})`)
          .join(", ")} from the NationStates card dumps.`,
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
        totalCards: (meta.totalCards as number) ?? 0,
        regionNames: (meta.regionNames as string[]) ?? [],
        seasons: (meta.seasons as number[]) ?? [],
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
      const regionNames = (meta.regionNames as string[]) ?? [];
      return {
        id: job.id,
        syncType: job.syncType,
        regionName: regionNames[0] ?? "Unknown",
        regionNames,
        seasons: (meta.seasons as number[]) ?? [],
        totalCards: (meta.totalCards as number) ?? 0,
        cardsProcessed: job.itemsProcessed ?? 0,
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
        message: "Pause requested. The job will pause after the current card finishes processing.",
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
      const regionNames = meta?.regionNames as string[] | undefined;
      const seasons = normalizeSeasons(meta?.seasons as number[] | undefined);

      if (!regionNames || !Array.isArray(regionNames) || regionNames.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job metadata is missing the region list — cannot resume.",
        });
      }

      const lastProcessedIndex = (meta?.lastProcessedIndex as number) ?? -1;
      const resumeFromIndex = lastProcessedIndex + 1;

      // The dump filter rebuilds the card list up-front; if the prior job
      // already completed its card count, treat it as done (re-running is a
      // no-op because cards are upserted by nsCardId+nsSeason).
      const totalCards = (meta?.totalCards as number) ?? 0;
      if (resumeFromIndex >= totalCards && totalCards > 0) {
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
        `[NS Import] Resuming region sync "${regionNames.join(",")}" from card ${resumeFromIndex}/${totalCards}`
      );

      // Fire-and-forget background processing
      processRegionCardsFromDump(
        ctx.db as unknown as PrismaClient,
        syncLog.id,
        regionNames,
        seasons,
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
        message: `Resumed card sync for region "${regionNames.join(", ")}".`,
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
    .mutation(async ({ input }) => {
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
