/**
 * MyLeague — Sports Router (Full Season Simulation)
 *
 * High-performance batched simulation router for IxStates sports engine.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { assertCanManageLeague } from "~/server/api/routers/sports/league-access";
import { IxTime } from "~/lib/ixtime";
import { resolveRace, loadLeagueDrivers, transitionToNextStage, simpleHash } from "~/lib/sports";
import { outcomeFromScores, resolveMatchPredictions } from "~/lib/sports/predictions";
import {
  SIM_MATCH_INCLUDE,
  SIM_TEAM_INCLUDE,
  loadEffectsMap,
  simulateAndPersistBout,
  simulateAndPersistMatch,
} from "~/lib/sports/simulate-and-persist";

export const sportsSeasonsFullseasonRouter = createTRPCRouter({
  simulateFullSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        let currentSeason = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!currentSeason) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }
        assertCanManageLeague(ctx, currentSeason.league);

        if (currentSeason.league.archetype === "circuit") {
          // Simulate all remaining races
          const races = await ctx.db.sportRace.findMany({
            where: {
              seasonId: input.seasonId,
              status: { in: ["upcoming", "qualifying_complete"] },
            },
            orderBy: { raceNumber: "asc" },
          });

          const allDrivers = await loadLeagueDrivers(ctx.db, currentSeason.leagueId);

          for (const race of races) {
            const raceResult = resolveRace({
              drivers: allDrivers,
              seed: simpleHash(input.seasonId, race.raceNumber, 0),
              isWet: false,
            });

            await ctx.db.sportRace.update({
              where: { id: race.id },
              data: {
                status: "completed",
                results: raceResult.positions as any,
              },
            });

            // Update standings for top 10 positions
            for (const r of raceResult.positions.slice(0, 10)) {
              if (r.points > 0) {
                await ctx.db.sportStanding.updateMany({
                  where: { seasonId: input.seasonId, teamId: r.teamId },
                  data: {
                    points: { increment: r.points },
                    pointsFor: { increment: r.points },
                  },
                });
              }
            }
          }
        } else {
          // League, Knockout, or Multi-Stage Tournament Simulation
          const allTeams = await ctx.db.sportTeam.findMany({
            where: { leagueId: currentSeason.leagueId },
            include: SIM_TEAM_INCLUDE,
          });
          const teamsMap = new Map(allTeams.map((t) => [t.id, t]));

          // Pre-fetch storyteller effects for all involved teams
          const effectsMap = await loadEffectsMap(
            ctx.db,
            allTeams.map((t) => t.nationId)
          );

          let seasonInProgress = true;

          while (seasonInProgress && currentSeason) {
            const activeStage = currentSeason.activeStage ?? 1;

            // 1. Simulate matches of this stage day-by-day (batched in transactions)
            const scheduledMatches = await ctx.db.sportMatch.findMany({
              where: {
                seasonId: input.seasonId,
                stage: activeStage,
                status: "scheduled",
              },
              select: { matchDay: true },
              distinct: ["matchDay"],
              orderBy: { matchDay: "asc" },
            });

            if (scheduledMatches.length > 0) {
              const matchDays = scheduledMatches.map((m) => m.matchDay);

              for (const matchDay of matchDays) {
                const matches = await ctx.db.sportMatch.findMany({
                  where: {
                    seasonId: input.seasonId,
                    stage: activeStage,
                    matchDay,
                    status: "scheduled",
                  },
                  include: SIM_MATCH_INCLUDE,
                });

                // Batch matchday database operations atomically
                const league = currentSeason.league;
                const completed = await ctx.db.$transaction(async (tx) => {
                  const done: Array<{ matchId: string; homeScore: number; awayScore: number }> = [];
                  for (const match of matches) {
                    const sim = await simulateAndPersistMatch(tx, { match, league, effectsMap });
                    if (!sim) continue; // completed by a concurrent run
                    done.push({
                      matchId: match.id,
                      homeScore: sim.homeScore,
                      awayScore: sim.awayScore,
                    });
                  }
                  return done;
                });

                // Settle predictions on every match this day completed (as match day does).
                for (const m of completed) {
                  await resolveMatchPredictions(
                    ctx.db,
                    m.matchId,
                    outcomeFromScores(m.homeScore, m.awayScore)
                  );
                }
              }
            }

            // 2. Simulate brackets of this stage (if bracket or tournament)
            let currentRound = 1;
            let hasMoreBracketsInStage = true;
            while (hasMoreBracketsInStage) {
              const pendingBrackets = await ctx.db.sportBracket.findMany({
                where: {
                  seasonId: input.seasonId,
                  stage: activeStage,
                  round: currentRound,
                  status: "scheduled",
                },
              });

              if (pendingBrackets.length === 0) {
                const completedInRound = await ctx.db.sportBracket.count({
                  where: {
                    seasonId: input.seasonId,
                    stage: activeStage,
                    round: currentRound,
                    status: "completed",
                  },
                });
                if (completedInRound === 0) {
                  hasMoreBracketsInStage = false;
                  break;
                }
              } else {
                // Same seeded, snapshotted, atomically-claimed bout path as the IxTime cron.
                const sportPreset = currentSeason.league.sportPreset;
                for (const bout of pendingBrackets) {
                  const fighter1 = teamsMap.get(bout.fighter1Id);
                  const fighter2 = teamsMap.get(bout.fighter2Id);
                  if (!fighter1 || !fighter2) continue;
                  await simulateAndPersistBout(ctx.db, {
                    bout,
                    fighter1,
                    fighter2,
                    sportPreset,
                    effectsMap,
                  });
                }
              }

              // After resolving currentRound, check if we can generate the next round's matchups
              const completedBrackets = await ctx.db.sportBracket.findMany({
                where: {
                  seasonId: input.seasonId,
                  stage: activeStage,
                  round: currentRound,
                  status: "completed",
                },
                select: { winnerId: true },
              });

              const winners = completedBrackets.map((b) => b.winnerId).filter(Boolean) as string[];

              if (winners.length >= 2) {
                const nextRound = currentRound + 1;
                const nextRoundCount = await ctx.db.sportBracket.count({
                  where: { seasonId: input.seasonId, stage: activeStage, round: nextRound },
                });

                if (nextRoundCount === 0) {
                  const ixNow = IxTime.getCurrentIxTime();
                  const pow2 = Math.pow(2, Math.ceil(Math.log2(winners.length)));
                  const half = pow2 / 2;
                  for (let i = 0; i < half; i++) {
                    const a = i < winners.length ? winners[i]! : null;
                    const b = pow2 - 1 - i < winners.length ? winners[pow2 - 1 - i]! : null;
                    if (a && b) {
                      await ctx.db.sportBracket.create({
                        data: {
                          seasonId: input.seasonId,
                          round: nextRound,
                          stage: activeStage,
                          weightClass: "heavyweight",
                          fighter1Id: a,
                          fighter2Id: b,
                          status: "scheduled",
                          scheduledIxTime: ixNow,
                        },
                      });
                    }
                  }
                }
                currentRound = nextRound;
              } else {
                hasMoreBracketsInStage = false;
              }
            }

            // 3. Evaluate if activeStage has completed and transition to next stage
            const transitioned = await transitionToNextStage(ctx.db as any, input.seasonId);
            if (transitioned) {
              currentSeason = await ctx.db.sportSeason.findUnique({
                where: { id: input.seasonId },
                include: { league: true },
              });
              if (!currentSeason) break;
            } else {
              seasonInProgress = false;
            }
          }
        }

        if (!currentSeason) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found at finalization" });
        }

        // Determine champion
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: currentSeason.leagueId },
          include: {
            teams: { select: { id: true, name: true } },
          },
        });

        let championTeamId: string | null = null;

        if (currentSeason.league.archetype === "bracket") {
          const finalRound = await ctx.db.sportBracket.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: { round: "desc" },
          });
          championTeamId = finalRound?.winnerId ?? null;
        } else {
          const topStanding = await ctx.db.sportStanding.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
          });
          championTeamId = topStanding?.teamId ?? null;
        }

        await ctx.db.sportSeason.update({
          where: { id: input.seasonId },
          data: {
            status: "completed",
            endIxTime: IxTime.getCurrentIxTime(),
            championTeamId,
          },
        });

        const championTeam = league?.teams.find((t) => t.id === championTeamId);

        return {
          seasonId: input.seasonId,
          status: "completed",
          championTeamId,
          championTeamName: championTeam?.name ?? null,
        };
      } catch (error) {
        console.error("Full season simulation error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate full season: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),
});
