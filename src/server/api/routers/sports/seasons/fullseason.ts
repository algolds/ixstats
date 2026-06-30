/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
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

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsSeasonsFullseasonRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  simulateFullSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        let currentSeason = await (ctx.db as any).sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!currentSeason) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        if (currentSeason.league.archetype === "circuit") {
          // Simulate all remaining races
          const races = await (ctx.db as any).sportRace.findMany({
            where: {
              seasonId: input.seasonId,
              status: { in: ["upcoming", "qualifying_complete"] },
            },
            orderBy: { raceNumber: "asc" },
          });

          // Fetch all drivers for the season's teams
          const teams = await (ctx.db as any).sportTeam.findMany({
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

            await (ctx.db as any).sportRace.update({
              where: { id: race.id },
              data: {
                grid: allDrivers.map((d, idx) => ({
                  driverId: d.driverId,
                  teamId: d.teamId,
                  gridPosition: idx + 1,
                })) as any,
                results: raceResult.positions as any,
                status: "completed",
                raceIxTime: IxTime.getCurrentIxTime(),
              },
            });

            // Update standings from race results
            const results = raceResult.positions;
            if (Array.isArray(results)) {
              for (const r of results) {
                if (r.teamId && r.points !== undefined) {
                  await (ctx.db as any).sportStanding.updateMany({
                    where: { seasonId: input.seasonId, teamId: r.teamId as string },
                    data: { points: { increment: (r.points as number) ?? 0 } },
                  });
                }
              }
            }
          }
        } else {
          // League, bracket, or multi-stage tournament
          // Pre-fetch all teams with rosters for the entire league to avoid N+1 queries
          const leagueTeams = await ctx.db.sportTeam.findMany({
            where: { leagueId: currentSeason.leagueId },
            include: {
              players: { where: { isActive: true } },
              coaches: { where: { isActive: true } },
            },
          });

          const teamsMap = new Map<string, any>();
          const nationIds = new Set<string>();
          for (const t of leagueTeams) {
            teamsMap.set(t.id, t);
            if (t.nationId) nationIds.add(t.nationId);
          }

          // Pre-fetch storyteller effects
          const effectsMap = new Map<string, any[]>();
          if (nationIds.size > 0) {
            const effects = await ctx.db.storytellerEffect.findMany({
              where: {
                countryId: { in: Array.from(nationIds) },
                isActive: true,
              },
            });
            for (const e of effects) {
              if (e.countryId) {
                const list = effectsMap.get(e.countryId) ?? [];
                list.push(e);
                effectsMap.set(e.countryId, list);
              }
            }
          }

          let seasonInProgress = true;
          while (seasonInProgress) {
            const activeStage = (currentSeason as any).activeStage ?? 1;

            // 1. Simulate matches of this stage
            const pendingMatches = await (ctx.db as any).sportMatch.findMany({
              where: { seasonId: input.seasonId, stage: activeStage, status: "scheduled" },
            });

            if (pendingMatches.length > 0) {
              // Get match days
              const matchDays = Array.from(
                new Set(pendingMatches.map((m: any) => m.matchDay))
              ).sort((a: any, b: any) => a - b) as number[];
              for (const matchDay of matchDays) {
                // Simulate all matches on this matchDay in this stage
                const matches = (await (ctx.db as any).sportMatch.findMany({
                  where: {
                    seasonId: input.seasonId,
                    stage: activeStage,
                    matchDay,
                    status: "scheduled",
                  },
                  include: {
                    homeTeam: {
                      include: {
                        players: { where: { isActive: true } },
                        coaches: { where: { isActive: true } },
                      },
                    },
                    awayTeam: {
                      include: {
                        players: { where: { isActive: true } },
                        coaches: { where: { isActive: true } },
                      },
                    },
                  },
                })) as any[];

                for (let i = 0; i < matches.length; i++) {
                  const match = matches[i];
                  const seed = simpleHash(input.seasonId, matchDay + activeStage * 100, i);

                  const homeRatings = computeTeamRatingVector(
                    match.homeTeam.players as any[],
                    match.homeTeam.coaches as any[],
                    currentSeason.league.sportPreset
                  );
                  const awayRatings = computeTeamRatingVector(
                    match.awayTeam.players as any[],
                    match.awayTeam.coaches as any[],
                    currentSeason.league.sportPreset
                  );

                  const homeTeamModifiers = await getTeamModifiers(
                    match.homeTeam,
                    ctx.db,
                    effectsMap
                  );
                  const awayTeamModifiers = await getTeamModifiers(
                    match.awayTeam,
                    ctx.db,
                    effectsMap
                  );

                  const rivalry = await (ctx.db as any).sportRivalry.findFirst({
                    where: {
                      OR: [
                        { team1Id: match.homeTeamId, team2Id: match.awayTeamId },
                        { team1Id: match.awayTeamId, team2Id: match.homeTeamId },
                      ],
                    },
                  });
                  const rivalryIntensity = rivalry?.intensity ?? 0;
                  const homeAdvantage = rivalryIntensity > 70 ? 65 : 55;

                  const result = resolveMatch({
                    sport: currentSeason.league.sportPreset,
                    homeTeam: homeRatings,
                    awayTeam: awayRatings,
                    archetype: currentSeason.league.archetype,
                    seed,
                    homeTeamModifiers,
                    awayTeamModifiers,
                    homeRoster: match.homeTeam.players as any,
                    awayRoster: match.awayTeam.players as any,
                    context: { homeAdvantage },
                  });

                  const resRec = result as any;
                  const homeScore = (resRec.homeScore as number) ?? 0;
                  const awayScore = (resRec.awayScore as number) ?? 0;
                  const homeRatingDelta = (resRec.homeRatingDelta as number) ?? 0;
                  const awayRatingDelta = (resRec.awayRatingDelta as number) ?? 0;

                  const homeRatingAfter = {
                    ...homeRatings,
                    overall:
                      Math.round(((homeRatings.overall as number) + homeRatingDelta) * 100) / 100,
                  };
                  const awayRatingAfter = {
                    ...awayRatings,
                    overall:
                      Math.round(((awayRatings.overall as number) + awayRatingDelta) * 100) / 100,
                  };

                  const winner =
                    homeScore > awayScore
                      ? match.homeTeamId
                      : awayScore > homeScore
                        ? match.awayTeamId
                        : null;
                  const status = winner
                    ? homeScore > awayScore
                      ? "home_win"
                      : "away_win"
                    : "draw";

                  await (ctx.db as any).sportMatch.update({
                    where: { id: match.id },
                    data: {
                      homeScore,
                      awayScore,
                      status: "completed",
                      resolvedIxTime: IxTime.getCurrentIxTime(),
                      matchStats: {
                        keyStats: result.keyStats,
                        evaluation: result.evaluation,
                        trace: result.trace,
                      } as any,
                      homeRatingBefore: { ...homeRatings },
                      awayRatingBefore: { ...awayRatings },
                      homeRatingAfter: { ...homeRatingAfter },
                      awayRatingAfter: { ...awayRatingAfter },
                    },
                  });

                  // Update team season rating vectors
                  await (ctx.db as any).sportTeamSeason.updateMany({
                    where: { seasonId: input.seasonId, teamId: match.homeTeamId },
                    data: { ratingVector: { ...homeRatingAfter } },
                  });
                  await (ctx.db as any).sportTeamSeason.updateMany({
                    where: { seasonId: input.seasonId, teamId: match.awayTeamId },
                    data: { ratingVector: { ...awayRatingAfter } },
                  });

                  // Update standings (for group stage or round robin)
                  if (status === "home_win") {
                    await (ctx.db as any).sportStanding.updateMany({
                      where: { seasonId: input.seasonId, teamId: match.homeTeamId },
                      data: {
                        wins: { increment: 1 },
                        points: { increment: 3 },
                        pointsFor: { increment: homeScore },
                        pointsAgainst: { increment: awayScore },
                      },
                    });
                    await (ctx.db as any).sportStanding.updateMany({
                      where: { seasonId: input.seasonId, teamId: match.awayTeamId },
                      data: {
                        losses: { increment: 1 },
                        pointsFor: { increment: awayScore },
                        pointsAgainst: { increment: homeScore },
                      },
                    });
                  } else if (status === "away_win") {
                    await (ctx.db as any).sportStanding.updateMany({
                      where: { seasonId: input.seasonId, teamId: match.awayTeamId },
                      data: {
                        wins: { increment: 1 },
                        points: { increment: 3 },
                        pointsFor: { increment: awayScore },
                        pointsAgainst: { increment: homeScore },
                      },
                    });
                    await (ctx.db as any).sportStanding.updateMany({
                      where: { seasonId: input.seasonId, teamId: match.homeTeamId },
                      data: {
                        losses: { increment: 1 },
                        pointsFor: { increment: homeScore },
                        pointsAgainst: { increment: awayScore },
                      },
                    });
                  } else {
                    await (ctx.db as any).sportStanding.updateMany({
                      where: { seasonId: input.seasonId, teamId: match.homeTeamId },
                      data: {
                        draws: { increment: 1 },
                        points: { increment: 1 },
                        pointsFor: { increment: homeScore },
                        pointsAgainst: { increment: awayScore },
                      },
                    });
                    await (ctx.db as any).sportStanding.updateMany({
                      where: { seasonId: input.seasonId, teamId: match.awayTeamId },
                      data: {
                        draws: { increment: 1 },
                        points: { increment: 1 },
                        pointsFor: { increment: awayScore },
                        pointsAgainst: { increment: homeScore },
                      },
                    });
                  }

                  // Update player morale
                  const homePlayerIds = (match.homeTeam.players as any[]).map((p) => p.id);
                  const awayPlayerIds = (match.awayTeam.players as any[]).map((p) => p.id);

                  if (status === "home_win") {
                    await (ctx.db as any).sportPlayer.updateMany({
                      where: { id: { in: homePlayerIds } },
                      data: { morale: { increment: 5 } },
                    });
                    await (ctx.db as any).sportPlayer.updateMany({
                      where: { id: { in: awayPlayerIds } },
                      data: { morale: { decrement: 5 } },
                    });
                  } else if (status === "away_win") {
                    await (ctx.db as any).sportPlayer.updateMany({
                      where: { id: { in: awayPlayerIds } },
                      data: { morale: { increment: 5 } },
                    });
                    await (ctx.db as any).sportPlayer.updateMany({
                      where: { id: { in: homePlayerIds } },
                      data: { morale: { decrement: 5 } },
                    });
                  }

                  // Cap morale at [0, 100]
                  await (ctx.db as any).sportPlayer.updateMany({
                    where: {
                      id: { in: [...homePlayerIds, ...awayPlayerIds] },
                      morale: { gt: 100 },
                    },
                    data: { morale: 100 },
                  });
                  await (ctx.db as any).sportPlayer.updateMany({
                    where: { id: { in: [...homePlayerIds, ...awayPlayerIds] }, morale: { lt: 0 } },
                    data: { morale: 0 },
                  });
                }
              }
            }

            // 2. Simulate brackets of this stage (if bracket or golden box)
            let currentRound = 1;
            let hasMoreBracketsInStage = true;
            while (hasMoreBracketsInStage) {
              const pendingBrackets = await (ctx.db as any).sportBracket.findMany({
                where: {
                  seasonId: input.seasonId,
                  stage: activeStage,
                  round: currentRound,
                  status: "scheduled",
                },
              });

              if (pendingBrackets.length === 0) {
                const completedInRound = await (ctx.db as any).sportBracket.count({
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
                  const seed = simpleHash(
                    input.seasonId,
                    currentRound * 100 + activeStage * 1000,
                    i
                  );

                  const f1 = teamsMap.get(bm.fighter1Id);
                  const f2 = teamsMap.get(bm.fighter2Id);

                  if (!f1 || !f2) continue;

                  const f1ratings = computeTeamRatingVector(
                    f1.players as any[],
                    f1.coaches as any[],
                    currentSeason.league.sportPreset
                  );
                  const f2ratings = computeTeamRatingVector(
                    f2.players as any[],
                    f2.coaches as any[],
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

                  await (ctx.db as any).sportBracket.update({
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

              // After resolving currentRound, check if we can generate the next round's matchups within this stage
              const completedBrackets = await (ctx.db as any).sportBracket.findMany({
                where: {
                  seasonId: input.seasonId,
                  stage: activeStage,
                  round: currentRound,
                  status: "completed",
                },
                select: { winnerId: true },
              });

              const winners = completedBrackets
                .map((b: any) => b.winnerId)
                .filter(Boolean) as string[];

              if (winners.length >= 2) {
                const nextRound = currentRound + 1;
                const nextRoundCount = await (ctx.db as any).sportBracket.count({
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
                      await (ctx.db as any).sportBracket.create({
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

            // 3. Evaluate if activeStage has completed and try to transition to the next stage
            const transitioned = await transitionToNextStage(ctx.db as any, input.seasonId);
            if (transitioned) {
              // Fetch updated currentSeason to get new activeStage
              currentSeason = await (ctx.db as any).sportSeason.findUnique({
                where: { id: input.seasonId },
                include: { league: true },
              });
            } else {
              // No more transitions means we are done!
              seasonInProgress = false;
            }
          }
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
          // Winner of the final round
          const finalRound = await (ctx.db as any).sportBracket.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: { round: "desc" },
          });
          championTeamId = finalRound?.winnerId ?? null;
        } else if (currentSeason.league.archetype === "circuit") {
          // Team with most points from race results
          const topStanding = await ctx.db.sportStanding.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
          });
          championTeamId = topStanding?.teamId ?? null;
        } else {
          // League: top of the standings
          const topStanding = await ctx.db.sportStanding.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
          });
          championTeamId = topStanding?.teamId ?? null;
        }

        await (ctx.db as any).sportSeason.update({
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

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
