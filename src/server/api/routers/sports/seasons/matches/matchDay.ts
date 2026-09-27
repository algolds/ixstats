/**
 * Sports Seasons — Match Day Simulation Router
 *
 * Both procedures go through simulateAndPersistMatch (seeded, snapshotted, atomically
 * claimed) — the same path as the full-season sim and the IxTime cron.
 */

import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { transitionToNextStage } from "~/lib/sports";
import type { EventTraceStep } from "~/lib/sports/types";
import type { MatchDayResultLine } from "~/lib/sports/feed-bulletins";
import {
  SIM_MATCH_INCLUDE,
  loadEffectsMap,
  simulateAndPersistMatch,
  type SimulatedMatch,
} from "~/lib/sports/simulate-and-persist";

type MatchDayResult = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: "home_win" | "away_win" | "draw";
  analysisFacts: SimulatedMatch["analysisFacts"];
};

function resultStatus(winner: SimulatedMatch["winner"]): MatchDayResult["status"] {
  if (winner === "home") return "home_win";
  if (winner === "away") return "away_win";
  return "draw";
}

/** Fire-and-forget LLM commentary + audio, merged into matchStats once ready. */
function narrateInBackground(
  db: PrismaClient,
  matchId: string,
  sport: string,
  trace: EventTraceStep[]
): void {
  void (async () => {
    try {
      const { narrateEvents, generateAudioBroadcast } =
        await import("~/lib/sports/commentary/narrator");
      const { getGlobalLLMConfig } = await import("~/lib/sports/commentary/db-config");
      const dbConfig = await getGlobalLLMConfig(db);
      const commentary = await narrateEvents(trace, { sport, config: dbConfig });
      if (!commentary || commentary.length === 0) return;
      const broadcastAudio = await generateAudioBroadcast(commentary, dbConfig);
      const latest = await db.sportMatch.findUnique({
        where: { id: matchId },
        select: { matchStats: true },
      });
      const existing = latest?.matchStats;
      const existingStats =
        existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
      await db.sportMatch.update({
        where: { id: matchId },
        data: {
          matchStats: {
            ...existingStats,
            commentary,
            ...(broadcastAudio ? { broadcastAudio } : {}),
          },
        },
      });
    } catch (err) {
      console.error("[simulateMatchDay] background commentary failed:", err);
    }
  })();
}

export const matchDaySimulationRouter = createTRPCRouter({
  simulateMatchDay: protectedProcedure
    .input(z.object({ seasonId: z.string(), matchDay: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        const activeStage = season.activeStage;

        const matches = await ctx.db.sportMatch.findMany({
          where: {
            seasonId: input.seasonId,
            matchDay: input.matchDay,
            stage: activeStage,
            status: "scheduled",
          },
          include: SIM_MATCH_INCLUDE,
        });

        if (matches.length === 0) {
          // Idempotency check: if all matches for this matchday were already completed, return existing results
          const existingMatches = await ctx.db.sportMatch.findMany({
            where: {
              seasonId: input.seasonId,
              matchDay: input.matchDay,
              stage: activeStage,
            },
            select: { id: true, homeScore: true, awayScore: true, status: true, matchStats: true },
          });

          if (existingMatches.length > 0 && existingMatches.every((m) => m.status === "completed")) {
            return {
              matchDay: input.matchDay,
              results: existingMatches.map((m) => ({
                matchId: m.id,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                status: m.status,
              })),
              alreadyResolved: true,
            };
          }

          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No scheduled matches for this match day in this stage",
          });
        }

        const effectsMap = await loadEffectsMap(
          ctx.db,
          matches.flatMap((m) => [m.homeTeam.nationId, m.awayTeam.nationId])
        );

        const results: MatchDayResult[] = [];
        const lines: MatchDayResultLine[] = [];
        for (const match of matches) {
          const sim = await ctx.db.$transaction((tx) =>
            simulateAndPersistMatch(tx, { match, league: season.league, effectsMap })
          );
          if (!sim) continue; // already simulated by another call

          narrateInBackground(ctx.db, match.id, season.league.sportPreset, sim.trace);
          results.push({
            matchId: match.id,
            homeScore: sim.homeScore,
            awayScore: sim.awayScore,
            status: resultStatus(sim.winner),
            analysisFacts: sim.analysisFacts,
          });
          lines.push({
            homeName: match.homeTeam.name,
            awayName: match.awayTeam.name,
            homeScore: sim.homeScore,
            awayScore: sim.awayScore,
            homeId: match.homeTeamId,
            awayId: match.awayTeamId,
          });
        }

        // Post the matchday result bulletin to the feed (shared with the cron path).
        if (lines.length > 0) {
          const { postMatchDayBulletin } = await import("~/lib/sports/feed-post");
          await postMatchDayBulletin(ctx.db, {
            leagueName: season.league.name,
            leagueId: season.leagueId,
            sportPreset: season.league.sportPreset,
            matchDay: input.matchDay,
            results: lines,
          });
        }

        // Settle matchday predictions on every match resolved this day.
        const { resolveMatchPredictions, outcomeFromScores } =
          await import("~/lib/sports/predictions");
        for (const res of results) {
          await resolveMatchPredictions(
            ctx.db,
            res.matchId,
            outcomeFromScores(res.homeScore, res.awayScore)
          );
        }

        // Try to transition to next stage if this stage matches are complete
        await transitionToNextStage(ctx.db, input.seasonId);

        return { matchDay: input.matchDay, results };
      } catch (error) {
        console.error("Match day simulation error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate match day: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  simulateSingleMatch: protectedProcedure
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: { ...SIM_MATCH_INCLUDE, season: { include: { league: true } } },
        });

        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        if (match.status === "completed") {
          return {
            matchId: match.id,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            matchStats: match.matchStats,
            alreadyResolved: true,
          };
        }

        const sim = await ctx.db.$transaction((tx) =>
          simulateAndPersistMatch(tx, { match, league: match.season.league })
        );

        if (!sim) {
          // Lost the atomic claim to a concurrent sim: return what that call persisted.
          const done = await ctx.db.sportMatch.findUnique({
            where: { id: match.id },
            select: { homeScore: true, awayScore: true, matchStats: true },
          });
          return {
            matchId: match.id,
            homeScore: done?.homeScore ?? null,
            awayScore: done?.awayScore ?? null,
            matchStats: done?.matchStats ?? null,
            alreadyResolved: true,
          };
        }

        const { resolveMatchPredictions, outcomeFromScores } =
          await import("~/lib/sports/predictions");
        await resolveMatchPredictions(
          ctx.db,
          match.id,
          outcomeFromScores(sim.homeScore, sim.awayScore)
        );
        await transitionToNextStage(ctx.db, match.seasonId);

        return {
          matchId: match.id,
          homeScore: sim.homeScore,
          awayScore: sim.awayScore,
          matchStats: sim.matchStats,
          analysisFacts: sim.analysisFacts,
        };
      } catch (error) {
        console.error("Single match simulation error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate match: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
});
