/**
 * MyLeague — Predictions (parimutuel matchday betting with Sovereigns).
 *
 * Stake is escrowed out of the wallet on placement; the pool is settled when the
 * match resolves (see `resolveMatchPredictions`, called from both sim paths).
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/vault";
import { IxTime } from "~/lib/ixtime";

const OUTCOME = z.enum(["home", "away", "draw"]);

export const sportsPredictionsRouter = createTRPCRouter({
  placePrediction: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        outcome: OUTCOME,
        stake: z.number().int().min(1).max(100_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          select: { id: true, seasonId: true, status: true, scheduledIxTime: true },
        });
        if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

        const now = IxTime.getCurrentIxTime();
        if (match.status !== "scheduled" || match.scheduledIxTime <= now) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Betting is closed — this match has kicked off.",
          });
        }

        // Escrow the stake out of the wallet.
        const spend = await exchangeService.spend(
          ctx.user.id,
          input.stake,
          "PREDICTION_STAKE",
          `PREDICTION:${input.matchId}:${input.outcome}`,
          ctx.db as never
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance",
          });
        }

        return ctx.db.sportPrediction.create({
          data: {
            matchId: input.matchId,
            seasonId: match.seasonId,
            userId: ctx.user.id,
            outcome: input.outcome,
            stake: input.stake,
            status: "open",
            createdIxTime: now,
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to place prediction",
        });
      }
    }),

  /** Live pool totals + the caller's own open pick (for odds display). */
  getMatchPool: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const open = await ctx.db.sportPrediction.findMany({
        where: { matchId: input.matchId, status: "open" },
        select: { outcome: true, stake: true, userId: true },
      });
      const pool = { home: 0, away: 0, draw: 0 };
      for (const p of open) {
        if (p.outcome in pool) pool[p.outcome as keyof typeof pool] += p.stake;
      }
      const total = pool.home + pool.away + pool.draw;
      const uid = ctx.user?.id;
      const myPick = uid ? (open.find((p) => p.userId === uid)?.outcome ?? null) : null;
      return { pool, total, count: open.length, myPick };
    }),

  getMyPredictions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.sportPrediction.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        match: {
          select: {
            matchDay: true,
            homeScore: true,
            awayScore: true,
            status: true,
            homeTeam: { select: { name: true, color: true } },
            awayTeam: { select: { name: true, color: true } },
          },
        },
      },
    });
  }),
});
