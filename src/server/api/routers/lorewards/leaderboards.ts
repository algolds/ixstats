/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

export const lorewardsLeaderboardsRouter = createTRPCRouter({
  /** Stats for a specific user. */
  getUserStats: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const stats = await db.lorewardUserStats.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
      });

      // Recent entries (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

      const recentEntries = await db.lorewardEntry.findMany({
        where: {
          OR: [
            { winnerUser: { equals: input.username, mode: "insensitive" } },
            { runnerUpUser: { equals: input.username, mode: "insensitive" } },
          ],
          date: { gte: dateStr },
          status: "approved",
        },
        orderBy: { date: "desc" },
      });

      // Rank position
      const rank = stats
        ? (await db.lorewardUserStats.count({
            where: { totalScore: { gt: stats.totalScore } },
          })) + 1
        : null;

      return {
        stats: stats
          ? {
              dailyWins: stats.dailyWins,
              dailyRunnerUps: stats.dailyRunnerUps,
              weeklyWins: stats.weeklyWins,
              monthlyWins: stats.monthlyWins,
              currentStreak: stats.currentStreak,
              longestStreak: stats.longestStreak,
              totalScore: stats.totalScore,
              totalBytes: stats.totalBytes,
              lastWinDate: stats.lastWinDate,
            }
          : null,
        rank,
        recentEntries: recentEntries.map((e) => ({
          date: e.date,
          type: e.type,
          role: e.winnerUser === input.username ? ("winner" as const) : ("runner-up" as const),
          page: e.winnerUser === input.username ? e.winnerPage : e.runnerUpPage,
          score: e.winnerUser === input.username ? e.winnerScore : e.runnerUpScore,
        })),
      };
    }),

  /** Paginated award history for a user. */
  getUserAwardHistory: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const entries = await db.lorewardEntry.findMany({
        where: {
          OR: [
            { winnerUser: { equals: input.username, mode: "insensitive" } },
            { runnerUpUser: { equals: input.username, mode: "insensitive" } },
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
            { winnerUser: { equals: input.username, mode: "insensitive" } },
            { runnerUpUser: { equals: input.username, mode: "insensitive" } },
          ],
          status: "approved",
        },
      });

      return {
        entries: entries.map((e) => {
          const isWinner = e.winnerUser?.toLowerCase() === input.username.toLowerCase();
          return {
            date: e.date,
            type: e.type,
            role: isWinner ? ("winner" as const) : ("runner-up" as const),
            page: isWinner ? e.winnerPage : e.runnerUpPage,
            score: isWinner ? e.winnerScore : e.runnerUpScore,
            bytes: isWinner ? e.winnerBytes : e.runnerUpBytes,
          };
        }),
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),
});
