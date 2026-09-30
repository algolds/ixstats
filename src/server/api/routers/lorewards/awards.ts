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
});
