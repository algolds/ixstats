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
  getPreset,
  resolveMatch,
  resolveRace,
  transitionToNextStage,
  type SportPresetKey,
  type TeamRatingVector,
} from "~/lib/sports";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(seasonId: string, matchDay: number, matchIndex: number): number {
  return (
    seasonId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 31 + matchDay * 7 + matchIndex
  );
}

function teamIndexHash(leagueId: string, teamIndex: number, playerIndex: number): number {
  return (
    leagueId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17 +
    teamIndex * 13 +
    playerIndex * 3
  );
}

async function getTeamModifiers(team: any, db: any, effectsMap?: Map<string, any[]>) {
  if (!team.nationId) return undefined;

  let effects: any[] = [];
  if (effectsMap) {
    effects = effectsMap.get(team.nationId) ?? [];
  } else {
    effects = await db.storytellerEffect.findMany({
      where: {
        countryId: team.nationId,
        isActive: true,
      },
    });
  }

  let saintBlessing = 0;
  let countryScandal = 0;
  for (const e of effects) {
    if (e.inputType === "sports_saint_blessing") {
      saintBlessing += Math.abs(e.value);
    } else if (e.inputType === "sports_scandal") {
      countryScandal += Math.abs(e.value);
    }
  }

  return {
    saintName: (team as any).patronSaint || undefined,
    saintBlessing: saintBlessing > 0 ? saintBlessing : undefined,
    countryScandal: countryScandal > 0 ? countryScandal : undefined,
  };
}

const careerStageMultiplier: Record<string, number> = {
  rookie: 0.7,
  developing: 0.85,
  prime: 1.0,
  plateau: 0.95,
  declining: 0.75,
  retired: 0,
};

function computeTeamRatingVector(
  players: Array<{
    isActive: boolean;
    ratings: Record<string, unknown> | null;
    careerStage: string;
    position?: string;
    id?: string;
  }>,
  coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }>,
  sportPresetKey: string = "soccer",
  formAdjustment = 0
): TeamRatingVector {
  const activePlayers = players.filter((p) => p.isActive && p.ratings);
  const preset = getPreset(sportPresetKey as SportPresetKey) || getPreset("soccer");

  // 1. Group players by position
  const positionGroups: Record<string, typeof activePlayers> = {};
  for (const player of activePlayers) {
    const pos = player.position || preset.positions[0] || "GK";
    positionGroups[pos] = positionGroups[pos] || [];
    positionGroups[pos].push(player);
  }

  // Sort each group by overall rating descending
  const getPlayerOverall = (p: any): number => {
    const ratings = p.ratings as Record<string, number>;
    if (!ratings) return 50;
    if (typeof ratings.overall === "number") return ratings.overall;
    const values = Object.values(ratings).filter((v) => typeof v === "number") as number[];
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  for (const pos of Object.keys(positionGroups)) {
    positionGroups[pos].sort((a, b) => getPlayerOverall(b) - getPlayerOverall(a));
  }

  // 2. Select starters based on startingSlots
  const starters: typeof activePlayers = [];
  const bench: typeof activePlayers = [];
  const slotsConfig = preset.startingSlots || {};

  const assignedPlayerIds = new Set<string>();

  // Assign players to their primary starting positions
  for (const [pos, count] of Object.entries(slotsConfig)) {
    const available = positionGroups[pos] || [];
    const startersForPos = available.slice(0, count as number);
    starters.push(...startersForPos);
    startersForPos.forEach((p) => p.id && assignedPlayerIds.add(p.id));
  }

  // Any active player not assigned is bench
  for (const player of activePlayers) {
    if (player.id && !assignedPlayerIds.has(player.id)) {
      bench.push(player);
    }
  }

  // 3. Compute ratings averages
  const computeAverageAttribute = (
    playerSet: typeof activePlayers,
    attributes: string[]
  ): number => {
    if (playerSet.length === 0) return 60;
    let sum = 0;
    let count = 0;
    for (const p of playerSet) {
      const mult = careerStageMultiplier[p.careerStage] ?? 0.8;
      const ratings = p.ratings as Record<string, number>;
      for (const attr of attributes) {
        if (ratings && typeof ratings[attr] === "number") {
          sum += ratings[attr] * mult;
          count++;
        }
      }
    }
    return count > 0 ? Math.round(sum / count) : 60;
  };

  const computeAverageOverall = (playerSet: typeof activePlayers): number => {
    if (playerSet.length === 0) return 60;
    let sum = 0;
    for (const p of playerSet) {
      const mult = careerStageMultiplier[p.careerStage] ?? 0.8;
      sum += getPlayerOverall(p) * mult;
    }
    return Math.round(sum / playerSet.length);
  };

  const overall = computeAverageOverall(starters);
  const offense = computeAverageAttribute(starters, preset.offenseAttributes);
  const defense = computeAverageAttribute(starters, preset.defenseAttributes);
  const depth = computeAverageOverall(bench);

  // Coach rating
  const activeCoaches = coaches.filter((c) => c.isActive && c.ratings);
  let coaching = 50;
  if (activeCoaches.length > 0) {
    const sum = activeCoaches.reduce((acc, c) => {
      const r = c.ratings as Record<string, number>;
      return acc + (r.strategy ?? 50);
    }, 0);
    coaching = Math.round(sum / activeCoaches.length);
  }

  return {
    overall,
    offense,
    defense,
    form: 50 + formAdjustment,
    depth,
    coaching,
  };
}

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
