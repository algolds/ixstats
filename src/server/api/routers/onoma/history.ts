// src/server/api/routers/onoma/history.ts
// Onoma — Generation History & Favorites sub-router

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const onomaHistoryRouter = createTRPCRouter({
  /**
   * Log a generation event with the actual generated names.
   * Extends the existing logGeneration by recording names + parameters.
   */
  logEvent: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        names: z.array(z.string()).max(1000),
        category: z.string().min(1),
        culturalProfile: z.string().nullable().optional(),
        trainingMode: z.string().min(1),
        parameters: z.record(z.string(), z.unknown()),
        count: z.number().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      return ctx.db.generationEvent.create({
        data: {
          userId,
          sessionId: input.sessionId,
          names: input.names,
          category: input.category,
          culturalProfile: input.culturalProfile ?? null,
          trainingMode: input.trainingMode,
          parameters: input.parameters as Prisma.InputJsonValue,
          count: input.count,
        },
      });
    }),

  /**
   * Paginated history of generation events for the current user.
   */
  getHistory: protectedProcedure
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.number().min(1).max(100).default(20),
          category: z.string().optional(),
          culturalProfile: z.string().optional(),
          favoritesOnly: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit ?? 20;
      const cursor = input?.cursor;

      const where: Record<string, unknown> = { userId };
      if (input?.category) where.category = input.category;
      if (input?.culturalProfile) where.culturalProfile = input.culturalProfile;
      if (input?.favoritesOnly) {
        where.favorites = { some: { userId } };
      }

      const events = await ctx.db.generationEvent.findMany({
        where,
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          favorites: {
            where: { userId },
          },
        },
      });

      let nextCursor: string | undefined;
      if (events.length > limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id;
      }

      return { events, nextCursor };
    }),

  /**
   * Generation statistics for the current user.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [totalEvents, totalFavorites, categoryBreakdown] = await Promise.all([
      ctx.db.generationEvent.count({ where: { userId } }),
      ctx.db.generationFavorite.count({ where: { userId } }),
      ctx.db.generationEvent.groupBy({
        by: ["category"],
        where: { userId },
        _sum: { count: true },
        orderBy: { _sum: { count: "desc" } },
      }),
    ]);

    const totalNames = categoryBreakdown.reduce((sum, group) => sum + (group._sum.count ?? 0), 0);

    return {
      totalEvents,
      totalNames,
      totalFavorites,
      categoryBreakdown: categoryBreakdown.map((g) => ({
        category: g.category,
        count: g._sum.count ?? 0,
      })),
    };
  }),

  /**
   * Toggle favorite on a specific name within a generation event.
   */
  toggleFavorite: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        name: z.string(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const existing = await ctx.db.generationFavorite.findUnique({
        where: {
          eventId_userId_name: {
            eventId: input.eventId,
            userId,
            name: input.name,
          },
        },
      });

      if (existing) {
        await ctx.db.generationFavorite.delete({
          where: { id: existing.id },
        });
        return { favorited: false };
      }

      await ctx.db.generationFavorite.create({
        data: {
          eventId: input.eventId,
          userId,
          name: input.name,
          note: input.note,
        },
      });
      return { favorited: true };
    }),

  /**
   * Get all favorited names for the current user.
   */
  getFavorites: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const limit = input?.limit ?? 50;

      const favorites = await ctx.db.generationFavorite.findMany({
        where: { userId },
        take: limit + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          event: {
            select: {
              category: true,
              culturalProfile: true,
              parameters: true,
              createdAt: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (favorites.length > limit) {
        const nextItem = favorites.pop();
        nextCursor = nextItem?.id;
      }

      return { favorites, nextCursor };
    }),
});
