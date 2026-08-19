/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { syncCurrentWinners } from "~/lib/lorewards";
import type { LorewardEntry, WikiArticleAward } from "@prisma/client";

export const lorewardsAwardsRouter = createTRPCRouter({
  /** Recent winners feed. */
  getRecentWinners: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        type: z.enum(["daily", "weekly", "monthly"]).optional(),
      })
    )
    .query(async ({ input }) => {
      await syncCurrentWinners();
      const entries = await db.lorewardEntry.findMany({
        where: {
          status: "approved",
          winnerUser: { not: null },
          ...(input.type && { type: input.type }),
        },
        orderBy: { date: "desc" },
        take: input.limit,
      });

      return entries.map((e) => ({
        date: e.date,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        type: e.type,
        winnerUser: e.winnerUser,
        winnerPage: e.winnerPage,
        winnerScore: e.winnerScore,
        winnerBytes: e.winnerBytes,
        runnerUpUser: e.runnerUpUser,
        runnerUpPage: e.runnerUpPage,
      }));
    }),

  /** Check if an article has won any awards. */
  isAwardWinningArticle: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const entries = await db.lorewardEntry.findMany({
        where: { winnerPage: input.title, status: "approved" },
        orderBy: { date: "desc" },
        take: 5,
      });

      return {
        isAward: entries.length > 0,
        entries: entries.map((e) => ({
          date: e.date,
          type: e.type,
          user: e.winnerUser,
        })),
      };
    }),

  /** Get all consolidated awards and achievements for an article. */
  getArticleAwardsAndAchievements: publicProcedure
    .input(z.object({ title: z.string().min(1).max(500) }))
    .query(async ({ input }) => {
      const slug = input.title.replace(/ /g, "_");

      const [lorewardEntries, wikiAwards] = await Promise.all([
        db.lorewardEntry.findMany({
          where: { winnerPage: input.title, status: "approved" },
          orderBy: { date: "desc" },
        }),
        (db as any).wikiArticleAward.findMany({
          where: {
            OR: [{ pageTitle: input.title }, { pageSlug: slug }],
          },
          orderBy: { awardedAt: "desc" },
        }),
      ]);

      const normalizedLorewards = (lorewardEntries as LorewardEntry[]).map((e: LorewardEntry) => {
        let label = "Daily Loreward";
        if (e.type === "weekly") label = "Weekly Loreward";
        if (e.type === "monthly") label = "Monthly Loreward";

        return {
          id: e.id,
          category: "LOREWARD",
          name: `${label} Winner`,
          description: e.winnerUser
            ? `Awarded to ${e.winnerUser} for outstanding contributions.`
            : "Awarded for outstanding contributions.",
          recipientUsers: e.winnerUser ? [e.winnerUser] : [],
          awardedAt: new Date(e.date),
          metadata: e.metadata ?? null,
        };
      });

      const normalizedWikiAwards = (wikiAwards as WikiArticleAward[]).map(
        (w: WikiArticleAward) => ({
          id: w.id,
          category: w.category,
          name: w.name,
          description: w.description ?? null,
          recipientUsers: (w.recipientUsers as string[]) || [],
          awardedAt: w.awardedAt,
          metadata: w.metadata ?? null,
        })
      );

      const allAwards = [...normalizedLorewards, ...normalizedWikiAwards].sort(
        (a, b) => b.awardedAt.getTime() - a.awardedAt.getTime()
      );

      return {
        hasAwards: allAwards.length > 0,
        hasLoreward: normalizedLorewards.length > 0,
        awards: allAwards.map((a) => ({
          ...a,
          awardedAt: a.awardedAt.toISOString(),
        })),
      };
    }),

  /** Get all wiki article awards and milestones. */
  getAllArticleAwards: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
        category: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const where: any = {};
      if (input.category && input.category !== "ALL") {
        where.category = input.category;
      }
      if (input.search) {
        where.OR = [
          { pageTitle: { contains: input.search, mode: "insensitive" } },
          { name: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const awards = await (db as any).wikiArticleAward.findMany({
        where,
        orderBy: { awardedAt: "desc" },
        take: input.limit,
      });
      return (awards as any[]).map((w) => ({
        id: w.id,
        pageTitle: w.pageTitle,
        pageSlug: w.pageSlug,
        category: w.category,
        name: w.name,
        description: w.description ?? null,
        recipientUsers: (w.recipientUsers as string[]) || [],
        awardedAt: w.awardedAt.toISOString(),
        metadata: w.metadata ?? null,
      }));
    }),

  /** Batch check articles for award status. */
  getAwardWinningArticles: publicProcedure
    .input(z.object({ titles: z.array(z.string().max(500)).max(50) }))
    .query(async ({ input }) => {
      if (input.titles.length === 0) return {};

      const entries = await db.lorewardEntry.findMany({
        where: { winnerPage: { in: input.titles }, status: "approved" },
        select: { winnerPage: true, date: true, type: true },
      });

      const result: Record<string, { date: string; type: string }[]> = {};
      for (const e of entries) {
        if (!e.winnerPage) continue;
        if (!result[e.winnerPage]) result[e.winnerPage] = [];
        result[e.winnerPage].push({ date: e.date, type: e.type });
      }
      return result;
    }),

  /** Monthly award frequency for sparkline charts. Returns cumulative awards per month. */
  getAwardFrequency: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const entries = await db.lorewardEntry.findMany({
        where: {
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
          status: "approved",
          type: "daily",
        },
        select: { date: true, winnerUser: true },
        orderBy: { date: "asc" },
      });

      // Group by month: "2023-01" → count
      const monthly = new Map<string, number>();
      for (const e of entries) {
        const month = e.date.slice(0, 7); // "YYYY-MM"
        monthly.set(month, (monthly.get(month) ?? 0) + (e.winnerUser === input.username ? 1 : 0));
      }

      // Convert to sorted array of cumulative totals
      const sorted = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      let cumulative = 0;
      return sorted.map(([month, count]) => {
        cumulative += count;
        return { month, count, cumulative };
      });
    }),

  // ---------------------------------------------------------------------------
  // WikiOS Scoring Engine + Cross-Validation
  // ---------------------------------------------------------------------------
});
