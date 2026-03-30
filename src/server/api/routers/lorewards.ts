/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fullSync } from "~/lib/lorewards-sync";
import { scoreDailyWikiOS } from "~/lib/lorewards-scoring";

export const lorewardsRouter = createTRPCRouter({
  /** Leaderboard by period. */
  getLeaderboard: publicProcedure
    .input(z.object({
      period: z.enum(["daily", "weekly", "monthly", "alltime"]).default("alltime"),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const orderField =
        input.period === "daily" ? "dailyWins" as const :
        input.period === "weekly" ? "weeklyWins" as const :
        input.period === "monthly" ? "monthlyWins" as const :
        "totalScore" as const;

      const stats = await db.lorewardUserStats.findMany({
        orderBy: { [orderField]: "desc" },
        take: input.limit,
      });

      return stats.map((s, i) => ({
        rank: i + 1,
        username: s.username,
        dailyWins: s.dailyWins,
        dailyRunnerUps: s.dailyRunnerUps,
        weeklyWins: s.weeklyWins,
        monthlyWins: s.monthlyWins,
        totalScore: s.totalScore,
        totalBytes: s.totalBytes,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
      }));
    }),

  /** Recent winners feed. */
  getRecentWinners: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      type: z.enum(["daily", "weekly", "monthly"]).optional(),
    }))
    .query(async ({ input }) => {
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
        type: e.type,
        winnerUser: e.winnerUser,
        winnerPage: e.winnerPage,
        winnerScore: e.winnerScore,
        winnerBytes: e.winnerBytes,
        runnerUpUser: e.runnerUpUser,
        runnerUpPage: e.runnerUpPage,
      }));
    }),

  /** Stats for a specific user. */
  getUserStats: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const stats = await db.lorewardUserStats.findUnique({
        where: { username: input.username },
      });

      // Recent entries (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

      const recentEntries = await db.lorewardEntry.findMany({
        where: {
          OR: [
            { winnerUser: input.username },
            { runnerUpUser: input.username },
          ],
          date: { gte: dateStr },
          status: "approved",
        },
        orderBy: { date: "desc" },
      });

      // Rank position
      const rank = stats ? await db.lorewardUserStats.count({
        where: { totalScore: { gt: stats.totalScore } },
      }) + 1 : null;

      return {
        stats: stats ? {
          dailyWins: stats.dailyWins,
          dailyRunnerUps: stats.dailyRunnerUps,
          weeklyWins: stats.weeklyWins,
          monthlyWins: stats.monthlyWins,
          currentStreak: stats.currentStreak,
          longestStreak: stats.longestStreak,
          totalScore: stats.totalScore,
          totalBytes: stats.totalBytes,
          lastWinDate: stats.lastWinDate,
        } : null,
        rank,
        recentEntries: recentEntries.map((e) => ({
          date: e.date,
          type: e.type,
          role: e.winnerUser === input.username ? "winner" as const : "runner-up" as const,
          page: e.winnerUser === input.username ? e.winnerPage : e.runnerUpPage,
          score: e.winnerUser === input.username ? e.winnerScore : e.runnerUpScore,
        })),
      };
    }),

  /** Paginated award history for a user. */
  getUserAwardHistory: publicProcedure
    .input(z.object({
      username: z.string().min(1).max(200),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const entries = await db.lorewardEntry.findMany({
        where: {
          OR: [
            { winnerUser: input.username },
            { runnerUpUser: input.username },
          ],
          status: "approved",
        },
        orderBy: { date: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await db.lorewardEntry.count({
        where: {
          OR: [
            { winnerUser: input.username },
            { runnerUpUser: input.username },
          ],
          status: "approved",
        },
      });

      return {
        entries: entries.map((e) => ({
          date: e.date,
          type: e.type,
          role: e.winnerUser === input.username ? "winner" as const : "runner-up" as const,
          page: e.winnerUser === input.username ? e.winnerPage : e.runnerUpPage,
          score: e.winnerUser === input.username ? e.winnerScore : e.runnerUpScore,
          bytes: e.winnerUser === input.username ? e.winnerBytes : e.runnerUpBytes,
        })),
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /** Streak calendar — day-by-day award status for a month. */
  getStreakCalendar: publicProcedure
    .input(z.object({
      username: z.string().min(1).max(200),
      year: z.number().min(2020).max(2030),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ input }) => {
      const monthStr = String(input.month).padStart(2, "0");
      const prefix = `${input.year}-${monthStr}`;

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { startsWith: prefix },
          type: "daily",
          status: "approved",
          OR: [
            { winnerUser: input.username },
            { runnerUpUser: input.username },
          ],
        },
      });

      const days: Record<number, "winner" | "runner-up"> = {};
      for (const e of entries) {
        const day = parseInt(e.date.slice(8, 10), 10);
        if (e.winnerUser === input.username) {
          days[day] = "winner";
        } else if (!days[day]) {
          days[day] = "runner-up";
        }
      }

      return { year: input.year, month: input.month, days };
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

  /** Admin: trigger full sync from state file + OOL page. */
  triggerSync: protectedProcedure
    .mutation(async () => {
      const result = await fullSync();
      return result;
    }),

  // ---------------------------------------------------------------------------
  // WikiOS Scoring Engine + Cross-Validation
  // ---------------------------------------------------------------------------

  /** Run WikiOS scoring for a specific date. Returns full candidate breakdowns. */
  scoreDay: publicProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const result = await scoreDailyWikiOS(input.date);
      return {
        date: result.date,
        editCount: result.editCount,
        winner: result.winner ? {
          user: result.winner.user,
          page: result.winner.page,
          finalScore: result.winner.finalScore,
          bytesAdded: result.winner.bytesAdded,
          scoreBreakdown: result.winner.scoreBreakdown,
          proseRatio: result.winner.proseRatio,
          isCollaborative: result.winner.isCollaborative,
          editDepth: result.winner.editDepth,
          isNewArticle: result.winner.isNewArticle,
          inlinkCount: result.winner.inlinkCount,
        } : null,
        runnerUp: result.runnerUp ? {
          user: result.runnerUp.user,
          page: result.runnerUp.page,
          finalScore: result.runnerUp.finalScore,
          scoreBreakdown: result.runnerUp.scoreBreakdown,
        } : null,
        candidates: result.candidates.map((c) => ({
          user: c.user,
          page: c.page,
          finalScore: c.finalScore,
          bytesAdded: c.bytesAdded,
          scoreBreakdown: c.scoreBreakdown,
        })),
      };
    }),

  /** Cross-validate: compare bot picks vs WikiOS picks for a date. */
  crossValidate: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      // Get bot result from database
      const botEntry = await db.lorewardEntry.findUnique({
        where: { date_type: { date: input.date, type: "daily" } },
      });

      // Run WikiOS scoring
      const wikios = await scoreDailyWikiOS(input.date);

      const winnersAgree = (botEntry?.winnerUser ?? null) === (wikios.winner?.user ?? null);
      const runnerUpsAgree = (botEntry?.runnerUpUser ?? null) === (wikios.runnerUp?.user ?? null);

      // Store cross-validation result
      await db.lorewardCrossValidation.upsert({
        where: { date: input.date },
        create: {
          date: input.date,
          botWinner: botEntry?.winnerUser ?? null,
          botWinnerPage: botEntry?.winnerPage ?? null,
          botWinnerScore: botEntry?.winnerScore ?? null,
          botRunnerUp: botEntry?.runnerUpUser ?? null,
          wikiosWinner: wikios.winner?.user ?? null,
          wikiosWinnerPage: wikios.winner?.page ?? null,
          wikiosWinnerScore: wikios.winner?.finalScore ?? null,
          wikiosRunnerUp: wikios.runnerUp?.user ?? null,
          winnersAgree,
          runnerUpsAgree,
          wikiosCandidates: JSON.stringify(wikios.candidates.map((c) => ({
            user: c.user, page: c.page, score: c.finalScore, breakdown: c.scoreBreakdown,
          }))),
          botCandidates: botEntry?.metadata ?? null,
        },
        update: {
          wikiosWinner: wikios.winner?.user ?? null,
          wikiosWinnerPage: wikios.winner?.page ?? null,
          wikiosWinnerScore: wikios.winner?.finalScore ?? null,
          wikiosRunnerUp: wikios.runnerUp?.user ?? null,
          winnersAgree,
          runnerUpsAgree,
          wikiosCandidates: JSON.stringify(wikios.candidates.map((c) => ({
            user: c.user, page: c.page, score: c.finalScore, breakdown: c.scoreBreakdown,
          }))),
        },
      });

      return {
        date: input.date,
        winnersAgree,
        runnerUpsAgree,
        bot: {
          winner: botEntry?.winnerUser ?? null,
          winnerPage: botEntry?.winnerPage ?? null,
          score: botEntry?.winnerScore ?? null,
          runnerUp: botEntry?.runnerUpUser ?? null,
        },
        wikios: {
          winner: wikios.winner?.user ?? null,
          winnerPage: wikios.winner?.page ?? null,
          score: wikios.winner?.finalScore ?? null,
          runnerUp: wikios.runnerUp?.user ?? null,
          breakdown: wikios.winner?.scoreBreakdown ?? null,
        },
        candidates: wikios.candidates.slice(0, 5).map((c) => ({
          user: c.user, page: c.page, score: c.finalScore, breakdown: c.scoreBreakdown,
        })),
      };
    }),

  /** Cross-validation history with agreement rate. */
  getCrossValidationHistory: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(30),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const [results, total, agrees] = await Promise.all([
        db.lorewardCrossValidation.findMany({
          orderBy: { date: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        db.lorewardCrossValidation.count(),
        db.lorewardCrossValidation.count({ where: { winnersAgree: true } }),
      ]);

      return {
        results: results.map((r) => ({
          date: r.date,
          botWinner: r.botWinner,
          botWinnerPage: r.botWinnerPage,
          wikiosWinner: r.wikiosWinner,
          wikiosWinnerPage: r.wikiosWinnerPage,
          winnersAgree: r.winnersAgree,
          runnerUpsAgree: r.runnerUpsAgree,
        })),
        total,
        agreementRate: total > 0 ? Math.round((agrees / total) * 100) : 0,
      };
    }),
});
