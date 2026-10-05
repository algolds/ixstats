/**
 * Sports — match prediction market (placing side).
 *
 * Settlement lives in `~/lib/sports/predictions` (`resolveMatchPredictions`, parimutuel pool paid
 * in Sovereigns through the exchange ledger). This router lets a signed-in user place the stake:
 * one prediction per user per match, only while the match is still scheduled and before kickoff.
 * The stake is debited from the caller's Sovereign wallet (`PREDICTION_STAKE`) in the same
 * transaction that records the prediction, so a failed debit never leaves a free bet behind.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import { exchangeService } from "~/lib/vault/exchange-service";
import { MAX_PREDICTION_STAKE, MIN_PREDICTION_STAKE } from "~/lib/sports/predictions";

const outcomeSchema = z.enum(["home", "away", "draw"]);

export const sportsPredictionsRouter = createTRPCRouter({
  /** Pool totals per outcome for a match, plus the caller's own prediction when signed in. */
  getMatchPredictions: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const predictions = await ctx.db.sportPrediction.findMany({
        where: { matchId: input.matchId },
        select: { userId: true, outcome: true, stake: true, status: true, payout: true },
      });

      const pool = { home: 0, away: 0, draw: 0 };
      for (const p of predictions) {
        if (p.outcome === "home" || p.outcome === "away" || p.outcome === "draw") {
          pool[p.outcome] += p.stake;
        }
      }

      const callerId = ctx.auth?.userId;
      const mine = callerId ? predictions.find((p) => p.userId === callerId) : undefined;

      return {
        pool,
        totalPool: pool.home + pool.away + pool.draw,
        entries: predictions.length,
        mine: mine
          ? {
              outcome: mine.outcome,
              stake: mine.stake,
              status: mine.status,
              payout: mine.payout,
            }
          : null,
        minStake: MIN_PREDICTION_STAKE,
        maxStake: MAX_PREDICTION_STAKE,
      };
    }),

  /** Place a stake on a match outcome. One prediction per user per match, before kickoff. */
  placePrediction: rateLimitedMutationProcedure
    .input(
      z.object({
        matchId: z.string().min(1),
        outcome: outcomeSchema,
        stake: z.number().int().min(MIN_PREDICTION_STAKE).max(MAX_PREDICTION_STAKE),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.userId;

      if (ctx.user && ctx.user.isActive === false) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Your account is inactive" });
      }

      return ctx.db.$transaction(async (tx) => {
        // Serialize this user's placements so two parallel requests can't both pass the
        // one-per-match check (or both pass the wallet balance check).
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`sport-prediction:${userId}`}))`;

        const match = await tx.sportMatch.findUnique({
          where: { id: input.matchId },
          select: { id: true, seasonId: true, status: true, scheduledIxTime: true },
        });
        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const now = IxTime.getCurrentIxTime();
        if (match.status !== "scheduled" || match.scheduledIxTime <= now) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Predictions are closed: this match has already kicked off",
          });
        }

        const existing = await tx.sportPrediction.findFirst({
          where: { matchId: match.id, userId },
          select: { id: true },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already placed a prediction on this match",
          });
        }

        const spend = await exchangeService.spend(
          userId,
          input.stake,
          "PREDICTION_STAKE",
          `PREDICTION_STAKE:${match.id}`,
          tx,
          { matchId: match.id, outcome: input.outcome }
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Could not debit your Sovereigns",
          });
        }

        const prediction = await tx.sportPrediction.create({
          data: {
            matchId: match.id,
            seasonId: match.seasonId,
            userId,
            outcome: input.outcome,
            stake: input.stake,
            createdIxTime: now,
          },
          select: { id: true, outcome: true, stake: true, status: true },
        });

        return { prediction, newBalance: spend.newBalance };
      });
    }),
});
