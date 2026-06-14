/**
 * lorewards.ts — Lorewards tRPC router.
 * Public endpoints for leaderboards, user stats, award history, and article badges.
 */

import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import * as fs from "fs";
import { fullSync } from "~/lib/lorewards-sync";
import { scoreDailyWikiOS } from "~/lib/lorewards-scoring";

export const lorewardsAdminRouter = createTRPCRouter({
  /** Admin: trigger full sync from state file + OOL page. */
  triggerSync: protectedProcedure.mutation(async () => {
    const result = await fullSync();
    return result;
  }),

  // ---------------------------------------------------------------------------
  // WikiOS Scoring Engine + Cross-Validation
  // ---------------------------------------------------------------------------

  /** Run WikiOS scoring for a specific date. Returns full candidate breakdowns. */
  scoreDay: adminProcedure
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
  updateBlacklist: adminProcedure
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
  overrideWinner: adminProcedure
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
