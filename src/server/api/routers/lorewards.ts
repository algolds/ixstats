/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import * as fs from "fs";
import * as mysql from "mysql2/promise";
import { getWikiDbPool } from "~/lib/wiki-bridge";
import { fullSync } from "~/lib/lorewards-sync";
import { scoreDailyWikiOS } from "~/lib/lorewards-scoring";
import type { LorewardEntry, WikiArticleAward } from "@prisma/client";

export const lorewardsRouter = createTRPCRouter({
  /** Leaderboard by period. */
  getLeaderboard: publicProcedure
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly", "alltime"]).default("alltime"),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      if (input.period === "weekly") {
        // Calculate the current week Monday-Sunday range in UTC
        const today = new Date();
        const day = today.getUTCDay();
        const diff = today.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
        const monday = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), diff, 0, 0, 0, 0)
        );

        const formatDate = (d: Date) => {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, "0");
          const r = String(d.getUTCDate()).padStart(2, "0");
          return `${y}-${m}-${r}`;
        };
        const startOfWeekStr = formatDate(monday);

        // Fetch approved daily entries since the start of the week
        const dailyEntries = await db.lorewardEntry.findMany({
          where: {
            type: "daily",
            status: "approved",
            date: { gte: startOfWeekStr },
          },
        });

        let entries = dailyEntries;
        if (entries.length === 0) {
          const fallbackDate = new Date();
          fallbackDate.setUTCDate(fallbackDate.getUTCDate() - 7);
          const fallbackStr = formatDate(fallbackDate);
          entries = await db.lorewardEntry.findMany({
            where: {
              type: "daily",
              status: "approved",
              date: { gte: fallbackStr },
            },
          });
        }

        const userMap = new Map<
          string,
          {
            username: string;
            dailyWins: number;
            dailyRunnerUps: number;
            totalBytes: number;
            totalScore: number;
          }
        >();

        for (const entry of entries) {
          // Track winner/runner-up flags
          if (entry.winnerUser) {
            const u = entry.winnerUser;
            const current = userMap.get(u) || {
              username: u,
              dailyWins: 0,
              dailyRunnerUps: 0,
              totalBytes: 0,
              totalScore: 0,
            };
            current.dailyWins += 1;
            userMap.set(u, current);
          }
          if (entry.runnerUpUser) {
            const u = entry.runnerUpUser;
            const current = userMap.get(u) || {
              username: u,
              dailyWins: 0,
              dailyRunnerUps: 0,
              totalBytes: 0,
              totalScore: 0,
            };
            current.dailyRunnerUps += 1;
            userMap.set(u, current);
          }

          // Parse metadata candidates to count all active users
          if (entry.metadata) {
            try {
              const candidates = JSON.parse(entry.metadata) as Array<{
                user: string;
                bytesAdded?: number;
                score?: number;
              }>;
              if (Array.isArray(candidates)) {
                for (const cand of candidates) {
                  if (cand.user) {
                    const u = cand.user;
                    const current = userMap.get(u) || {
                      username: u,
                      dailyWins: 0,
                      dailyRunnerUps: 0,
                      totalBytes: 0,
                      totalScore: 0,
                    };
                    current.totalBytes += cand.bytesAdded || 0;
                    current.totalScore += cand.score || 0;
                    userMap.set(u, current);
                  }
                }
              }
            } catch (e) {
              console.error("Error parsing loreward entry metadata:", e);
            }
          } else {
            // Fallback if metadata is null but we have winner/runner-up info
            if (entry.winnerUser) {
              const u = entry.winnerUser;
              const current = userMap.get(u) || {
                username: u,
                dailyWins: 0,
                dailyRunnerUps: 0,
                totalBytes: 0,
                totalScore: 0,
              };
              current.totalBytes += entry.winnerBytes || 0;
              current.totalScore += entry.winnerScore || 0;
              userMap.set(u, current);
            }
            if (entry.runnerUpUser) {
              const u = entry.runnerUpUser;
              const current = userMap.get(u) || {
                username: u,
                dailyWins: 0,
                dailyRunnerUps: 0,
                totalBytes: 0,
                totalScore: 0,
              };
              current.totalBytes += entry.runnerUpBytes || 0;
              current.totalScore += entry.runnerUpScore || 0;
              userMap.set(u, current);
            }
          }
        }

        const aggregated = Array.from(userMap.values());
        aggregated.sort((a, b) => {
          if (b.dailyWins !== a.dailyWins) return b.dailyWins - a.dailyWins;
          if (b.dailyRunnerUps !== a.dailyRunnerUps) return b.dailyRunnerUps - a.dailyRunnerUps;
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return b.totalBytes - a.totalBytes;
        });

        const result = aggregated.slice(0, input.limit);
        const usernames = result.map((r) => r.username);
        const userStats = await db.lorewardUserStats.findMany({
          where: { username: { in: usernames } },
        });

        return result.map((r, i) => {
          const stats = userStats.find((s) => s.username === r.username);
          return {
            rank: i + 1,
            username: r.username,
            dailyWins: r.dailyWins,
            dailyRunnerUps: r.dailyRunnerUps,
            weeklyWins: r.dailyWins,
            monthlyWins: 0,
            totalScore: r.totalScore, // weekly score
            totalBytes: r.totalBytes,
            currentStreak: stats?.currentStreak ?? 0,
            longestStreak: stats?.longestStreak ?? 0,
          };
        });
      }

      const orderField =
        input.period === "daily"
          ? ("dailyWins" as const)
          : input.period === "monthly"
            ? ("monthlyWins" as const)
            : ("totalScore" as const);

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
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        type: z.enum(["daily", "weekly", "monthly"]).optional(),
      })
    )
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
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
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
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
          status: "approved",
        },
        orderBy: { date: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await db.lorewardEntry.count({
        where: {
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
          status: "approved",
        },
      });

      return {
        entries: entries.map((e) => ({
          date: e.date,
          type: e.type,
          role: e.winnerUser === input.username ? ("winner" as const) : ("runner-up" as const),
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
    .input(
      z.object({
        username: z.string().min(1).max(200),
        year: z.number().min(2020).max(2030),
        month: z.number().min(1).max(12),
      })
    )
    .query(async ({ input }) => {
      const monthStr = String(input.month).padStart(2, "0");
      const prefix = `${input.year}-${monthStr}`;

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { startsWith: prefix },
          type: "daily",
          status: "approved",
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
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

  /** Admin: trigger full sync from state file + OOL page. */
  triggerSync: protectedProcedure.mutation(async () => {
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
        winner: result.winner
          ? {
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
            }
          : null,
        runnerUp: result.runnerUp
          ? {
              user: result.runnerUp.user,
              page: result.runnerUp.page,
              finalScore: result.runnerUp.finalScore,
              scoreBreakdown: result.runnerUp.scoreBreakdown,
            }
          : null,
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
          wikiosCandidates: JSON.stringify(
            wikios.candidates.map((c) => ({
              user: c.user,
              page: c.page,
              score: c.finalScore,
              breakdown: c.scoreBreakdown,
            }))
          ),
          botCandidates: botEntry?.metadata ?? null,
        },
        update: {
          wikiosWinner: wikios.winner?.user ?? null,
          wikiosWinnerPage: wikios.winner?.page ?? null,
          wikiosWinnerScore: wikios.winner?.finalScore ?? null,
          wikiosRunnerUp: wikios.runnerUp?.user ?? null,
          winnersAgree,
          runnerUpsAgree,
          wikiosCandidates: JSON.stringify(
            wikios.candidates.map((c) => ({
              user: c.user,
              page: c.page,
              score: c.finalScore,
              breakdown: c.scoreBreakdown,
            }))
          ),
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
          user: c.user,
          page: c.page,
          score: c.finalScore,
          breakdown: c.scoreBreakdown,
        })),
      };
    }),

  /** Cross-validation history with agreement rate. */
  getCrossValidationHistory: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
      })
    )
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

  /** Rolling 12-month calendar for a user. */
  getRollingStreakCalendar: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ input }) => {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const dateStr = oneYearAgo.toISOString().slice(0, 10);

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { gte: dateStr },
          type: "daily",
          status: "approved",
          OR: [{ winnerUser: input.username }, { runnerUpUser: input.username }],
        },
        orderBy: { date: "asc" },
      });

      const days: Record<
        string,
        { role: "winner" | "runner-up"; page: string | null; score: number }
      > = {};
      for (const e of entries) {
        if (e.winnerUser === input.username) {
          days[e.date] = {
            role: "winner",
            page: e.winnerPage,
            score: e.winnerScore || 0,
          };
        } else if (e.runnerUpUser === input.username) {
          days[e.date] = {
            role: "runner-up",
            page: e.runnerUpPage,
            score: e.runnerUpScore || 0,
          };
        }
      }

      return days;
    }),

  /** UFC-Style Top 15 Leaderboard */
  getUfcLeaderboard: publicProcedure.query(async () => {
    const stats = await db.lorewardUserStats.findMany();
    const usernames = stats.map((s) => s.username);
    if (usernames.length === 0) return [];

    const oolPool = getWikiDbPool();
    try {
      const [careerRows] = await oolPool.execute<mysql.RowDataPacket[]>(
        `SELECT a.actor_name,
                COUNT(r.rev_id) as total_edits,
                MAX(CAST(r.rev_len AS SIGNED) - COALESCE(CAST(p2.rev_len AS SIGNED), 0)) as largest_edit,
                SUM(CASE WHEN CAST(r.rev_len AS SIGNED) - COALESCE(CAST(p2.rev_len AS SIGNED), 0) > 0 
                         THEN CAST(r.rev_len AS SIGNED) - COALESCE(CAST(p2.rev_len AS SIGNED), 0) 
                         ELSE 0 END) as total_bytes,
                SUM(CASE WHEN CAST(r.rev_len AS SIGNED) - COALESCE(CAST(p2.rev_len AS SIGNED), 0) >= 5000 
                         THEN 1 ELSE 0 END) as major_edits
         FROM revision r
         JOIN actor a ON a.actor_id = r.rev_actor
         LEFT JOIN revision p2 ON p2.rev_id = r.rev_parent_id
         WHERE a.actor_name IN (${usernames.map(() => "?").join(",")})
         GROUP BY a.actor_name`,
        usernames
      );

      const careerMap = new Map<
        string,
        {
          totalEdits: number;
          largestEdit: number;
          totalBytes: number;
          majorEdits: number;
        }
      >();

      for (const row of careerRows) {
        const u = row.actor_name.toString();
        careerMap.set(u, {
          totalEdits: Number(row.total_edits) || 0,
          largestEdit: Number(row.largest_edit) || 0,
          totalBytes: Number(row.total_bytes) || 0,
          majorEdits: Number(row.major_edits) || 0,
        });
      }

      const [specialtyRows] = await oolPool.execute<mysql.RowDataPacket[]>(
        `SELECT a.actor_name, lt.lt_title, COUNT(*) as cnt
         FROM revision r
         JOIN actor a ON a.actor_id = r.rev_actor
         JOIN page p ON p.page_id = r.rev_page
         JOIN categorylinks cl ON cl.cl_from = p.page_id
         JOIN linktarget lt ON lt.lt_id = cl.cl_target_id AND lt.lt_namespace = 14
         WHERE a.actor_name IN (${usernames.map(() => "?").join(",")})
           AND p.page_namespace = 0
           AND lt.lt_title NOT REGEXP '^(Pages_|Articles_|IXWB|All_|Lorewards)'
         GROUP BY a.actor_name, lt.lt_title
         ORDER BY cnt DESC`,
        usernames
      );

      const specialtyMap = new Map<string, string>();
      for (const row of specialtyRows) {
        const u = row.actor_name.toString();
        if (!specialtyMap.has(u)) {
          const cat = row.lt_title.toString().replace(/_/g, " ");
          specialtyMap.set(u, cat);
        }
      }

      const lastEdits = new Map<string, { page: string; date: string }>();
      for (const username of usernames) {
        const [editRows] = await oolPool.execute<mysql.RowDataPacket[]>(
          `SELECT r.rev_timestamp, p.page_title
           FROM revision r
           JOIN actor a ON a.actor_id = r.rev_actor
           JOIN page p ON p.page_id = r.rev_page
           WHERE a.actor_name = ? AND p.page_namespace = 0
           ORDER BY r.rev_timestamp DESC
           LIMIT 1`,
          [username]
        );
        if (editRows[0]) {
          const ts = editRows[0].rev_timestamp.toString();
          const date = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
          lastEdits.set(username, {
            page: editRows[0].page_title.toString().replace(/_/g, " "),
            date,
          });
        }
      }

      // Map wiki usernames to country names using db.user and db.country
      const dbUsers = await db.user.findMany({
        where: {
          wikiUsername: {
            in: usernames,
          },
        },
        select: {
          wikiUsername: true,
          country: {
            select: {
              name: true,
            },
          },
        },
      });

      const countryMap = new Map<string, string>();
      for (const u of dbUsers) {
        if (u.wikiUsername && u.country?.name) {
          countryMap.set(u.wikiUsername.toLowerCase(), u.country.name);
        }
      }

      const cleanNames = usernames.map((u) => u.replace(/_/g, " "));
      const directCountries = await db.country.findMany({
        where: {
          name: {
            in: [...usernames, ...cleanNames],
          },
        },
        select: {
          name: true,
        },
      });

      for (const c of directCountries) {
        const matchedUser = usernames.find(
          (u) =>
            u.toLowerCase() === c.name.toLowerCase() ||
            u.replace(/_/g, " ").toLowerCase() === c.name.toLowerCase()
        );
        if (matchedUser && !countryMap.has(matchedUser.toLowerCase())) {
          countryMap.set(matchedUser.toLowerCase(), c.name);
        }
      }

      const scoredUsers = stats.map((s) => {
        const career = careerMap.get(s.username) || {
          totalEdits: 0,
          largestEdit: 0,
          totalBytes: 0,
          majorEdits: 0,
        };
        const specialty = specialtyMap.get(s.username) || "General Contributor";
        const lastEdit = lastEdits.get(s.username) || { page: "None", date: "—" };

        const rankScore =
          s.dailyWins * 100 +
          s.dailyRunnerUps * 40 +
          s.currentStreak * 15 +
          career.totalBytes * 0.01 +
          career.largestEdit * 0.05;

        return {
          username: s.username,
          countryName: countryMap.get(s.username.toLowerCase()) || null,
          dailyWins: s.dailyWins,
          dailyRunnerUps: s.dailyRunnerUps,
          totalScore: s.totalScore,
          currentStreak: s.currentStreak,
          longestStreak: s.longestStreak,
          specialty,
          totalEdits: career.totalEdits,
          totalBytes: career.totalBytes,
          largestEdit: career.largestEdit,
          majorEdits: career.majorEdits,
          majorEditRate: career.totalEdits > 0 ? career.majorEdits / career.totalEdits : 0,
          avgBytesPerEdit:
            career.totalEdits > 0 ? Math.round(career.totalBytes / career.totalEdits) : 0,
          lastEditPage: lastEdit.page,
          lastEditDate: lastEdit.date,
          rankScore,
        };
      });

      scoredUsers.sort((a, b) => b.rankScore - a.rankScore);

      let prevRanks = new Map<string, number>();
      try {
        const statePath = "/ixwiki/shared/bots/discord/lorewards-state.json";
        if (fs.existsSync(statePath)) {
          const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
          const weeklyResults = state.weeklyResults || {};
          const weekKeys = Object.keys(weeklyResults).sort();
          const prevWeekKey = weekKeys[weekKeys.length - 1];
          if (prevWeekKey && weeklyResults[prevWeekKey]?.allRanked) {
            const allRanked = weeklyResults[prevWeekKey].allRanked as Array<{ user: string }>;
            allRanked.forEach((r, idx) => {
              prevRanks.set(r.user, idx + 1);
            });
          }
        }
      } catch (err) {
        console.error("Failed to load prev ranks from state file:", err);
      }

      return scoredUsers.slice(0, 15).map((user, index) => {
        const currentRank = index + 1;
        const prevRank = prevRanks.get(user.username);
        let rankMovement: number | "new" = "new";

        if (prevRank !== undefined) {
          rankMovement = prevRank - currentRank;
        }

        return {
          rank: currentRank,
          username: user.username,
          countryName: user.countryName,
          dailyWins: user.dailyWins,
          dailyRunnerUps: user.dailyRunnerUps,
          totalScore: user.totalScore,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          specialty: user.specialty,
          totalEdits: user.totalEdits,
          totalBytes: user.totalBytes,
          largestEdit: user.largestEdit,
          majorEdits: user.majorEdits,
          majorEditRate: user.majorEditRate,
          avgBytesPerEdit: user.avgBytesPerEdit,
          rankScore: user.rankScore,
          lastEditPage: user.lastEditPage,
          lastEditDate: user.lastEditDate,
          rankMovement,
        };
      });
    } catch (err) {
      console.error("UFC leaderboard db error:", err);
      return [];
    }
  }),

  /** Monthly Winners Calendar */
  getWinnersCalendar: publicProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number(),
      })
    )
    .query(async ({ input }) => {
      const monthStr = String(input.month).padStart(2, "0");
      const prefix = `${input.year}-${monthStr}`;

      const entries = await db.lorewardEntry.findMany({
        where: {
          date: { startsWith: prefix },
          type: "daily",
          status: "approved",
        },
      });

      // Gather all usernames for batch lookup
      const usernamesSet = new Set<string>();
      for (const e of entries) {
        if (e.winnerUser) usernamesSet.add(e.winnerUser);
        if (e.runnerUpUser) usernamesSet.add(e.runnerUpUser);
      }
      const usernames = Array.from(usernamesSet);

      const countryMap = new Map<string, string>();
      if (usernames.length > 0) {
        const dbUsers = await db.user.findMany({
          where: {
            wikiUsername: {
              in: usernames,
            },
          },
          select: {
            wikiUsername: true,
            country: {
              select: {
                name: true,
              },
            },
          },
        });

        for (const u of dbUsers) {
          if (u.wikiUsername && u.country?.name) {
            countryMap.set(u.wikiUsername.toLowerCase(), u.country.name);
          }
        }

        const cleanNames = usernames.map((u) => u.replace(/_/g, " "));
        const directCountries = await db.country.findMany({
          where: {
            name: {
              in: [...usernames, ...cleanNames],
            },
          },
          select: {
            name: true,
          },
        });

        for (const c of directCountries) {
          const matchedUser = usernames.find(
            (u) =>
              u.toLowerCase() === c.name.toLowerCase() ||
              u.replace(/_/g, " ").toLowerCase() === c.name.toLowerCase()
          );
          if (matchedUser && !countryMap.has(matchedUser.toLowerCase())) {
            countryMap.set(matchedUser.toLowerCase(), c.name);
          }
        }
      }

      const calendar: Record<
        number,
        {
          winnerUser: string | null;
          winnerCountryName: string | null;
          winnerPage: string | null;
          winnerScore: number | null;
          winnerBytes: number | null;
          runnerUpUser: string | null;
          runnerUpCountryName: string | null;
          runnerUpPage: string | null;
          runnerUpScore: number | null;
          runnerUpBytes: number | null;
          candidates: any[];
        }
      > = {};

      for (const e of entries) {
        const day = parseInt(e.date.slice(8, 10), 10);
        let candidates = [];
        if (e.metadata) {
          try {
            candidates = JSON.parse(e.metadata);
          } catch (_) {}
        }
        calendar[day] = {
          winnerUser: e.winnerUser,
          winnerCountryName: e.winnerUser
            ? countryMap.get(e.winnerUser.toLowerCase()) || null
            : null,
          winnerPage: e.winnerPage,
          winnerScore: e.winnerScore,
          winnerBytes: e.winnerBytes,
          runnerUpUser: e.runnerUpUser,
          runnerUpCountryName: e.runnerUpUser
            ? countryMap.get(e.runnerUpUser.toLowerCase()) || null
            : null,
          runnerUpPage: e.runnerUpPage,
          runnerUpScore: e.runnerUpScore,
          runnerUpBytes: e.runnerUpBytes,
          candidates,
        };
      }

      return calendar;
    }),

  /** Active Blacklist configuration */
  getBlacklist: publicProcedure.query(async () => {
    try {
      const statePath = "/ixwiki/shared/bots/discord/lorewards-state.json";
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
        return state.blacklist || {};
      }
    } catch (err) {
      console.error("Failed to read blacklist from state file:", err);
    }
    return {};
  }),

  /** Update user blacklist status */
  updateBlacklist: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        action: z.enum(["add", "remove"]),
        expiryDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      try {
        const res = await fetch(`${botUrl}/lorewards/blacklist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(`Bot returned status ${res.status}`);
        }
        return await res.json();
      } catch (err: any) {
        throw new Error(`Failed to sync blacklist with Discord bot: ${err.message}`);
      }
    }),

  /** Override past winner or runner-up */
  overrideWinner: publicProcedure
    .input(
      z.object({
        date: z.string().min(1),
        type: z.enum(["daily", "weekly", "monthly"]),
        winnerUser: z.string().nullable().optional(),
        winnerPage: z.string().nullable().optional(),
        winnerScore: z.number().nullable().optional(),
        winnerBytes: z.number().nullable().optional(),
        runnerUpUser: z.string().nullable().optional(),
        runnerUpPage: z.string().nullable().optional(),
        runnerUpScore: z.number().nullable().optional(),
        runnerUpBytes: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.lorewardEntry.upsert({
        where: { date_type: { date: input.date, type: input.type } },
        create: {
          date: input.date,
          type: input.type,
          winnerUser: input.winnerUser || null,
          winnerPage: input.winnerPage || null,
          winnerScore: input.winnerScore || null,
          winnerBytes: input.winnerBytes || null,
          runnerUpUser: input.runnerUpUser || null,
          runnerUpPage: input.runnerUpPage || null,
          runnerUpScore: input.runnerUpScore || null,
          runnerUpBytes: input.runnerUpBytes || null,
          status: "approved",
        },
        update: {
          winnerUser: input.winnerUser || null,
          winnerPage: input.winnerPage || null,
          winnerScore: input.winnerScore || null,
          winnerBytes: input.winnerBytes || null,
          runnerUpUser: input.runnerUpUser || null,
          runnerUpPage: input.runnerUpPage || null,
          runnerUpScore: input.runnerUpScore || null,
          runnerUpBytes: input.runnerUpBytes || null,
        },
      });

      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      try {
        const res = await fetch(`${botUrl}/lorewards/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(`Bot returned status ${res.status}`);
        }
        return { success: true };
      } catch (err: any) {
        throw new Error(`Failed to sync override with Discord bot: ${err.message}`);
      }
    }),
});
