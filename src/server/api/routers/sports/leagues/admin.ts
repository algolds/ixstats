/**
 * Sports Leagues — Admin & System Settings Router
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const leaguesAdminRouter = createTRPCRouter({
  getAdminGlobalStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const [totalMatches, totalPlayers, totalLeagues, llmPosts] = await Promise.all([
        ctx.db.sportMatch.count(),
        ctx.db.sportPlayer.count(),
        ctx.db.sportLeague.count(),
        ctx.db.thinkpagesPost.count({
          where: { account: { username: "SportsNews" } },
        }),
      ]);
      return {
        totalMatches,
        totalPlayers,
        totalLeagues,
        llmPosts,
      };
    } catch (_error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch admin global stats",
      });
    }
  }),

  reseedSportsData: adminProcedure
    .input(
      z.object({
        clearExisting: z.boolean().default(true),
        seedCaphirianSoccer: z.boolean().default(true),
        seedYonderreSoccer: z.boolean().default(true),
        seedOHLHockey: z.boolean().default(true),
        seedF1: z.boolean().default(true),
        seedBoxing: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const prisma = ctx.db;
        const userId = ctx.user.id;

        // Find a fallback country if none exists
        const firstCountry = await prisma.country.findFirst({ select: { id: true } });
        const countryId = firstCountry?.id ?? "unknown";

        let deletedCount = 0;
        if (input.clearExisting) {
          // Find canonical leagues to delete
          const canonicalLeagues = await prisma.sportLeague.findMany({
            where: { isCanonical: true },
            select: { id: true },
          });

          if (canonicalLeagues.length > 0) {
            const leagueIds = canonicalLeagues.map((l) => l.id);
            // Cascade delete will automatically clean up associated records
            const deleted = await prisma.sportLeague.deleteMany({
              where: { id: { in: leagueIds } },
            });
            deletedCount = deleted.count;
          }
        }

        const { seedSportsLeagues } = await import("~/lib/demo-seed/seed-sports");
        const seededCount = await seedSportsLeagues(prisma, countryId, userId, {
          seedCaphirianSoccer: input.seedCaphirianSoccer,
          seedYonderreSoccer: input.seedYonderreSoccer,
          seedOHLHockey: input.seedOHLHockey,
          seedF1: input.seedF1,
          seedBoxing: input.seedBoxing,
        });

        // Invalidate sports tRPC query caches
        try {
          const { invalidateCache } = await import("~/lib/cache");
          await invalidateCache(["sports."]);
        } catch (cacheErr) {
          console.warn("Failed to invalidate sports cache:", cacheErr);
        }

        return {
          success: true,
          deletedCount,
          seededCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to re-seed sports data",
        });
      }
    }),

  testLLMNarrator: protectedProcedure
    .input(
      z.object({
        sport: z.string(),
        events: z.array(z.string()),
        config: z
          .object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiUrl: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            reasoning: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { narrateEvents } = await import("~/lib/sports/commentary/narrator");
        const mappedEvents = input.events.map((desc, idx) => ({
          t: idx * 10,
          type: "goal" as const,
          description: desc,
          team: "home" as const,
        }));
        const outputs = await narrateEvents(mappedEvents, {
          sport: input.sport,
          config: input.config,
        });
        return { outputs };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to run LLM narrator test",
        });
      }
    }),

  saveGlobalAINarratorSettings: adminProcedure
    .input(
      z.object({
        provider: z.string().optional(),
        apiKey: z.string().optional(),
        apiUrl: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.number().optional(),
        reasoning: z.boolean().optional(),
        applyGlobally: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const keys = [
          { key: "sports:llm:provider", value: input.provider || "" },
          { key: "sports:llm:apiKey", value: input.apiKey || "" },
          { key: "sports:llm:apiUrl", value: input.apiUrl || "" },
          { key: "sports:llm:modelName", value: input.modelName || "" },
          {
            key: "sports:llm:temperature",
            value: input.temperature !== undefined ? String(input.temperature) : "",
          },
          { key: "sports:llm:applyGlobally", value: String(input.applyGlobally) },
          { key: "sports:llm:reasoning", value: String(input.reasoning === true) },
        ];

        for (const item of keys) {
          await ctx.db.systemConfig.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: { key: item.key, value: item.value, description: "AI Narrator global setting" },
          });
        }

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to save global AI settings",
        });
      }
    }),

  getGlobalAINarratorSettings: adminProcedure.query(async ({ ctx }) => {
    try {
      const configs = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "sports:llm:provider",
              "sports:llm:apiKey",
              "sports:llm:apiUrl",
              "sports:llm:modelName",
              "sports:llm:temperature",
              "sports:llm:applyGlobally",
              "sports:llm:reasoning",
            ],
          },
        },
      });

      return {
        provider: configs.find((c) => c.key === "sports:llm:provider")?.value || undefined,
        apiKey: configs.find((c) => c.key === "sports:llm:apiKey")?.value || undefined,
        apiUrl: configs.find((c) => c.key === "sports:llm:apiUrl")?.value || undefined,
        modelName: configs.find((c) => c.key === "sports:llm:modelName")?.value || undefined,
        temperature: configs.find((c) => c.key === "sports:llm:temperature")?.value
          ? parseFloat(configs.find((c) => c.key === "sports:llm:temperature")!.value)
          : undefined,
        applyGlobally: configs.find((c) => c.key === "sports:llm:applyGlobally")?.value === "true",
        reasoning: configs.find((c) => c.key === "sports:llm:reasoning")?.value === "true",
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to load global AI settings",
      });
    }
  }),

  getNotificationSettings: adminProcedure.query(async ({ ctx }) => {
    const { getSportsNotifyConfig } = await import("~/lib/sports/notify-config");
    return getSportsNotifyConfig(ctx.db);
  }),

  saveNotificationSettings: adminProcedure
    .input(
      z.object({
        matchdayBulletins: z.boolean(),
        llmNarration: z.boolean(),
        seasonBulletins: z.boolean(),
        clubDms: z.boolean(),
        discordMirror: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { SPORTS_NOTIFY_KEYS } = await import("~/lib/sports/notify-config");
      for (const k of Object.keys(SPORTS_NOTIFY_KEYS) as (keyof typeof SPORTS_NOTIFY_KEYS)[]) {
        const key = SPORTS_NOTIFY_KEYS[k];
        await ctx.db.systemConfig.upsert({
          where: { key },
          update: { value: String(input[k]) },
          create: { key, value: String(input[k]), description: "Sports auto-notification toggle" },
        });
      }
      return { success: true };
    }),

  getFeaturedLeagueId: publicProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.systemConfig.findUnique({
      where: { key: "sports:featuredLeagueId" },
    });
    return row?.value || null;
  }),

  setFeaturedLeague: adminProcedure
    .input(z.object({ leagueId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.leagueId) {
          const league = await ctx.db.sportLeague.findUnique({ where: { id: input.leagueId } });
          if (!league) {
            throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
          }
        }
        await ctx.db.systemConfig.upsert({
          where: { key: "sports:featuredLeagueId" },
          update: { value: input.leagueId ?? "" },
          create: {
            key: "sports:featuredLeagueId",
            value: input.leagueId ?? "",
            description: "MyLeague lobby featured (hero) league",
          },
        });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to set featured league",
        });
      }
    }),

  clearSportsCache: adminProcedure.mutation(async () => {
    try {
      const { invalidateCache } = await import("~/lib/cache");
      await invalidateCache(["sports."]);
      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to clear sports cache",
      });
    }
  }),
});
