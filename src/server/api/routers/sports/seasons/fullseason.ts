/**
 * MyLeague — Sports Router (Full Season Simulation)
 *
 * High-performance batched simulation router for IxStates sports engine.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import {
  resolveMatch,
  resolveRace,
  transitionToNextStage,
  simpleHash,
  computeTeamRatingVector,
  getTeamModifiers,
} from "~/lib/sports";
import {
  SIM_MATCH_INCLUDE,
  loadEffectsMap,
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

        if (currentSeason.league.archetype === "circuit") {
          // Simulate all remaining races
          const races = await ctx.db.sportRace.findMany({
            where: {
              seasonId: input.seasonId,
              status: { in: ["upcoming", "qualifying_complete"] },
            },
            orderBy: { raceNumber: "asc" },
          });

          // Fetch all drivers for the season's teams
          const teams = await ctx.db.sportTeam.findMany({
            where: {
              leagueId: currentSeason.leagueId,
              players: { some: { position: "driver", isActive: true } },
            },
            include: {
              players: {
                where: { position: "driver", isActive: true },
              },
            },
          });

          const allDrivers: Array<{
            driverId: string;
            teamId: string;
            pace: number;
            consistency: number;
            wetSkill: number;
            overtaking: number;
            tyreManagement: number;
            starts: number;
          }> = [];

          for (const team of teams) {
            for (const driver of team.players) {
              const r = (driver.ratings ?? {}) as Record<string, number>;
              allDrivers.push({
                driverId: driver.id,
                teamId: team.id,
                pace: r.pace ?? 50,
                consistency: r.consistency ?? 50,
                wetSkill: r.wetSkill ?? 50,
                overtaking: r.overtaking ?? 50,
                tyreManagement: r.tyreManagement ?? 50,
                starts: r.starts ?? 50,
              });
            }
          }

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
            include: {
              players: { where: { isActive: true } },
              coaches: { where: { isActive: true } },
            },
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
                await ctx.db.$transaction(async (tx) => {
                  for (const match of matches) {
                    await simulateAndPersistMatch(tx, { match, league, effectsMap });
                  }
                });
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
                for (let i = 0; i < pendingBrackets.length; i++) {
                  const bm = pendingBrackets[i];
                  if (!bm || !currentSeason) continue;
                  const seed = simpleHash(
                    input.seasonId,
                    currentRound * 100 + activeStage * 1000,
                    i
                  );

                  const f1 = teamsMap.get(bm.fighter1Id);
                  const f2 = teamsMap.get(bm.fighter2Id);

                  if (!f1 || !f2) continue;

                  const f1ratings = computeTeamRatingVector(
                    f1.players as any,
                    f1.coaches as any,
                    currentSeason.league.sportPreset
                  );
                  const f2ratings = computeTeamRatingVector(
                    f2.players as any,
                    f2.coaches as any,
                    currentSeason.league.sportPreset
                  );

                  const homeTeamModifiers = await getTeamModifiers(f1, ctx.db, effectsMap);
                  const awayTeamModifiers = await getTeamModifiers(f2, ctx.db, effectsMap);

                  const result = resolveMatch({
                    sport: currentSeason.league.sportPreset,
                    homeTeam: f1ratings,
                    awayTeam: f2ratings,
                    archetype: "bracket",
                    seed,
                    homeTeamModifiers,
                    awayTeamModifiers,
                    homeRoster: f1.players as any,
                    awayRoster: f2.players as any,
                  });

                  const resRec = result as any;
                  const homeScore = (resRec.homeScore as number) ?? 0;
                  const awayScore = (resRec.awayScore as number) ?? 0;
                  const winnerId = homeScore > awayScore ? bm.fighter1Id : bm.fighter2Id;

                  await ctx.db.sportBracket.update({
                    where: { id: bm.id },
                    data: {
                      winnerId,
                      status: "completed",
                      resolvedIxTime: IxTime.getCurrentIxTime(),
                      result: result as any,
                    },
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

              const winners = completedBrackets
                .map((b) => b.winnerId)
                .filter(Boolean) as string[];

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
