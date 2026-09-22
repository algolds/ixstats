/**
 * Sports Seasons — Match Day Simulation Router
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import type { Prisma } from "@prisma/client";
import {
  resolveMatch,
  transitionToNextStage,
  simpleHash,
  computeTeamRatingVector,
  getTeamModifiers,
  generateMatchAnalysisFacts,
} from "~/lib/sports";

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

        const activeStage = (season as any).activeStage ?? 1;

        const matches = await ctx.db.sportMatch.findMany({
          where: {
            seasonId: input.seasonId,
            matchDay: input.matchDay,
            stage: activeStage,
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

        const results: Array<Record<string, unknown>> = [];

        // Pre-fetch storyteller effects for all involved team nationIds
        const nationIds = new Set<string>();
        for (const m of matches) {
          if (m.homeTeam.nationId) nationIds.add(m.homeTeam.nationId);
          if (m.awayTeam.nationId) nationIds.add(m.awayTeam.nationId);
        }

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

        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const seed = simpleHash(input.seasonId, input.matchDay, i);

          const homeRatings = computeTeamRatingVector(
            match.homeTeam.players as any[],
            match.homeTeam.coaches as any[],
            season.league.sportPreset
          );
          const awayRatings = computeTeamRatingVector(
            match.awayTeam.players as any[],
            match.awayTeam.coaches as any[],
            season.league.sportPreset
          );

          const homeTeamModifiers = await getTeamModifiers(match.homeTeam, ctx.db, effectsMap);
          const awayTeamModifiers = await getTeamModifiers(match.awayTeam, ctx.db, effectsMap);

          const rivalry = await ctx.db.sportRivalry.findFirst({
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
            sport: season.league.sportPreset,
            homeTeam: homeRatings,
            awayTeam: awayRatings,
            archetype: season.league.archetype,
            seed,
            homeTeamModifiers,
            awayTeamModifiers,
            homeRoster: match.homeTeam.players as any,
            awayRoster: match.awayTeam.players as any,
            homeTacticalIntent: match.homeTeam.tacticalIntent,
            awayTacticalIntent: match.awayTeam.tacticalIntent,
            homeLineup: (match.homeTeam.lineup as Record<string, unknown> | null) ?? undefined,
            awayLineup: (match.awayTeam.lineup as Record<string, unknown> | null) ?? undefined,
            context: { homeAdvantage },
          });

          const resRec = result as any;
          const homeScore = (resRec.homeScore as number) ?? 0;
          const awayScore = (resRec.awayScore as number) ?? 0;
          const homeRatingDelta = (resRec.homeRatingDelta as number) ?? 0;
          const awayRatingDelta = (resRec.awayRatingDelta as number) ?? 0;

          const homeRatingAfter = {
            ...homeRatings,
            overall: Math.round(((homeRatings.overall as number) + homeRatingDelta) * 100) / 100,
          };
          const awayRatingAfter = {
            ...awayRatings,
            overall: Math.round(((awayRatings.overall as number) + awayRatingDelta) * 100) / 100,
          };

          const winner =
            homeScore > awayScore
              ? match.homeTeamId
              : awayScore > homeScore
                ? match.awayTeamId
                : null;

          const status = winner ? (homeScore > awayScore ? "home_win" : "away_win") : "draw";          const simulationSnapshot = {
            seed,
            resolverVersion: "2.1.0",
            ruleVersion: "1.0.0",
            homeRatings: { ...homeRatings },
            awayRatings: { ...awayRatings },
            homeAdvantage,
            homeTacticalIntent: match.homeTeam.tacticalIntent ?? "Balanced",
            awayTacticalIntent: match.awayTeam.tacticalIntent ?? "Balanced",
            capturedAt: new Date().toISOString(),
          };

          const analysisFacts = generateMatchAnalysisFacts({
            homeTeamName: match.homeTeam.name,
            awayTeamName: match.awayTeam.name,
            homeScore,
            awayScore,
            sportPreset: season.league.sportPreset,
            events: (result.trace as any[]) || [],
            homeRatings: homeRatings as any,
            awayRatings: awayRatings as any,
            homeTactics: match.homeTeam.tacticalIntent || "Balanced",
            awayTactics: match.awayTeam.tacticalIntent || "Balanced",
          });

          // Atomically claim the match: only one caller can flip scheduled→completed,
          // so a double-click / concurrent sim can't double-apply standings below.
          const claimed = await ctx.db.sportMatch.updateMany({
            where: { id: match.id, status: "scheduled" },
            data: {
              homeScore,
              awayScore,
              status: "completed",
              resolvedIxTime: IxTime.getCurrentIxTime(),
              matchStats: {
                keyStats: result.keyStats,
                evaluation: result.evaluation,
                trace: result.trace,
                simulationSnapshot,
                analysisFacts,
              } as any,
              homeRatingBefore: { ...homeRatings },
              awayRatingBefore: { ...awayRatings },
              homeRatingAfter: { ...homeRatingAfter },
              awayRatingAfter: { ...awayRatingAfter },
            },
          });
          if (claimed.count === 0) continue; // already simulated by another call

          void (async () => {
            try {
              const { narrateEvents, generateAudioBroadcast } =
                await import("~/lib/sports/commentary/narrator");
              const { getGlobalLLMConfig } = await import("~/lib/sports/commentary/db-config");
              const dbConfig = await getGlobalLLMConfig(ctx.db);
              const commentary = await narrateEvents(result.trace as any[], {
                sport: season.league.sportPreset,
                config: dbConfig,
              });
              if (commentary && commentary.length > 0) {
                const broadcastAudio = await generateAudioBroadcast(commentary, dbConfig);
                const latestMatch = await ctx.db.sportMatch.findUnique({
                  where: { id: match.id },
                  select: { matchStats: true },
                });
                const existingStats = (latestMatch?.matchStats as any) || {};
                await ctx.db.sportMatch.update({
                  where: { id: match.id },
                  data: {
                    matchStats: {
                      ...existingStats,
                      commentary,
                      ...(broadcastAudio && { broadcastAudio }),
                    } as any,
                  },
                });
              }
            } catch (err) {
              console.error("[simulateMatchDay] background commentary failed:", err);
            }
          })();

          // Update team season rating vectors
          await ctx.db.sportTeamSeason.updateMany({
            where: { seasonId: input.seasonId, teamId: match.homeTeamId },
            data: { ratingVector: { ...homeRatingAfter } },
          });
          await ctx.db.sportTeamSeason.updateMany({
            where: { seasonId: input.seasonId, teamId: match.awayTeamId },
            data: { ratingVector: { ...awayRatingAfter } },
          });

          // Standings update
          const isDraw = homeScore === awayScore;
          const homeWin = homeScore > awayScore;

          if (homeWin) {
            await ctx.db.sportStanding.updateMany({
              where: { seasonId: input.seasonId, teamId: match.homeTeamId },
              data: {
                wins: { increment: 1 },
                points: { increment: 3 },
                pointsFor: { increment: homeScore },
                pointsAgainst: { increment: awayScore },
              },
            });
            await ctx.db.sportStanding.updateMany({
              where: { seasonId: input.seasonId, teamId: match.awayTeamId },
              data: {
                losses: { increment: 1 },
                pointsFor: { increment: awayScore },
                pointsAgainst: { increment: homeScore },
              },
            });
          } else if (!isDraw) {
            await ctx.db.sportStanding.updateMany({
              where: { seasonId: input.seasonId, teamId: match.awayTeamId },
              data: {
                wins: { increment: 1 },
                points: { increment: 3 },
                pointsFor: { increment: awayScore },
                pointsAgainst: { increment: homeScore },
              },
            });
            await ctx.db.sportStanding.updateMany({
              where: { seasonId: input.seasonId, teamId: match.homeTeamId },
              data: {
                losses: { increment: 1 },
                pointsFor: { increment: homeScore },
                pointsAgainst: { increment: awayScore },
              },
            });
          } else {
            await ctx.db.sportStanding.updateMany({
              where: { seasonId: input.seasonId, teamId: match.homeTeamId },
              data: {
                draws: { increment: 1 },
                points: { increment: 1 },
                pointsFor: { increment: homeScore },
                pointsAgainst: { increment: awayScore },
              },
            });
            await ctx.db.sportStanding.updateMany({
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
          const homePlayerIds = (match.homeTeam.players as Array<{ id: string }>).map((p) => p.id);
          const awayPlayerIds = (match.awayTeam.players as Array<{ id: string }>).map((p) => p.id);

          if (homeWin) {
            await ctx.db.sportPlayer.updateMany({
              where: { id: { in: homePlayerIds } },
              data: { morale: { increment: 3 } },
            });
            await ctx.db.sportPlayer.updateMany({
              where: { id: { in: awayPlayerIds } },
              data: { morale: { decrement: 2 } },
            });
          } else if (!isDraw) {
            await ctx.db.sportPlayer.updateMany({
              where: { id: { in: awayPlayerIds } },
              data: { morale: { increment: 3 } },
            });
            await ctx.db.sportPlayer.updateMany({
              where: { id: { in: homePlayerIds } },
              data: { morale: { decrement: 2 } },
            });
          }

          // Individual player match stats
          let playerStats = resRec.playerStats;
          if (!playerStats && Array.isArray(result.trace)) {
            const playerMap = new Map<string, { goals: number; assists: number; shots: number }>();
            const homeIds = new Set(homePlayerIds);

            for (const event of result.trace) {
              const scorerId = event.actorId;
              if (event.type === "goal" && scorerId) {
                if (!playerMap.has(scorerId)) {
                  playerMap.set(scorerId, { goals: 0, assists: 0, shots: 0 });
                }
                playerMap.get(scorerId)!.goals++;
              }
              if ((event.type as string) === "shot" && scorerId) {
                if (!playerMap.has(scorerId)) {
                  playerMap.set(scorerId, { goals: 0, assists: 0, shots: 0 });
                }
                playerMap.get(scorerId)!.shots++;
              }
            }

            for (let idx = 0; idx < result.trace.length; idx++) {
              const event = result.trace[idx];
              if (event.type === "goal" && event.actorId) {
                const scorerId = event.actorId;
                const isHome = homeIds.has(scorerId);
                const teammates = isHome
                  ? match.homeTeam.players.filter((p: any) => p.id !== scorerId)
                  : match.awayTeam.players.filter((p: any) => p.id !== scorerId);

                if (teammates.length > 0 && Math.random() < 0.7) {
                  const assister = teammates[Math.floor(Math.random() * teammates.length)];
                  if (!playerMap.has(assister.id)) {
                    playerMap.set(assister.id, { goals: 0, assists: 0, shots: 0 });
                  }
                  playerMap.get(assister.id)!.assists++;
                }
              }
            }

            playerStats = Array.from(playerMap.entries()).map(([playerId, stats]) => ({
              playerId,
              stats,
            })) as any;
          }

          if (Array.isArray(playerStats)) {
            for (const ps of playerStats) {
              if (ps.playerId) {
                await ctx.db.sportMatchStat.create({
                  data: {
                    matchId: match.id,
                    playerId: ps.playerId as string,
                    stats: ps.stats as any,
                  },
                });
              }
            }
          }

          results.push({
            matchId: match.id,
            homeScore,
            awayScore,
            status,
            analysisFacts,
          });
        }

        // Post the matchday result bulletin to the feed (shared with the cron path).
        const { postMatchDayBulletin } = await import("~/lib/sports/feed-post");
        await postMatchDayBulletin(ctx.db, {
          leagueName: season.league.name,
          leagueId: season.leagueId,
          sportPreset: season.league.sportPreset,
          matchDay: input.matchDay,
          results: matches.map((match, index) => {
            const res = results[index] as { homeScore: number; awayScore: number };
            return {
              homeName: match.homeTeam.name as string,
              awayName: match.awayTeam.name as string,
              homeScore: res?.homeScore ?? 0,
              awayScore: res?.awayScore ?? 0,
              homeId: match.homeTeamId as string,
              awayId: match.awayTeamId as string,
            };
          }),
        });

        // Settle matchday predictions on every match resolved this day.
        const { resolveMatchPredictions, outcomeFromScores } =
          await import("~/lib/sports/predictions");
        for (let i = 0; i < matches.length; i++) {
          const res = results[i] as { matchId: string; homeScore: number; awayScore: number };
          if (res) {
            await resolveMatchPredictions(
              ctx.db,
              res.matchId,
              outcomeFromScores(res.homeScore, res.awayScore)
            );
          }
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
          include: {
            season: { include: { league: true } },
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

        const season = match.season;
        const matchIndex = Math.abs(
          match.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
        );
        const seed = simpleHash(match.seasonId, match.matchDay ?? 1, matchIndex);

        const homeRatings = computeTeamRatingVector(
          match.homeTeam.players as any[],
          match.homeTeam.coaches as any[],
          season.league.sportPreset
        );
        const awayRatings = computeTeamRatingVector(
          match.awayTeam.players as any[],
          match.awayTeam.coaches as any[],
          season.league.sportPreset
        );

        const effectsMap = new Map<string, any[]>();
        const homeTeamModifiers = await getTeamModifiers(match.homeTeam, ctx.db, effectsMap);
        const awayTeamModifiers = await getTeamModifiers(match.awayTeam, ctx.db, effectsMap);

        const result = resolveMatch({
          sport: season.league.sportPreset,
          homeTeam: homeRatings,
          awayTeam: awayRatings,
          archetype: season.league.archetype,
          seed,
          homeTeamModifiers,
          awayTeamModifiers,
          homeRoster: match.homeTeam.players as any,
          awayRoster: match.awayTeam.players as any,
          homeTacticalIntent: match.homeTeam.tacticalIntent,
          awayTacticalIntent: match.awayTeam.tacticalIntent,
          homeLineup: (match.homeTeam.lineup as Record<string, unknown> | null) ?? undefined,
          awayLineup: (match.awayTeam.lineup as Record<string, unknown> | null) ?? undefined,
          context: { homeAdvantage: 55 },
        });

        const resRec = result as any;
        const homeScore = (resRec.homeScore as number) ?? 0;
        const awayScore = (resRec.awayScore as number) ?? 0;
        const homeRatingDelta = (resRec.homeRatingDelta as number) ?? 0;
        const awayRatingDelta = (resRec.awayRatingDelta as number) ?? 0;

        const homeRatingAfter = {
          ...homeRatings,
          overall: Math.round(((homeRatings.overall as number) + homeRatingDelta) * 100) / 100,
        };
        const awayRatingAfter = {
          ...awayRatings,
          overall: Math.round(((awayRatings.overall as number) + awayRatingDelta) * 100) / 100,
        };

        const simulationSnapshot = {
          seed,
          resolverVersion: "2.1.0",
          ruleVersion: "1.0.0",
          homeRatings: { ...homeRatings },
          awayRatings: { ...awayRatings },
          homeAdvantage: 55,
          homeTacticalIntent: match.homeTeam.tacticalIntent ?? "Balanced",
          awayTacticalIntent: match.awayTeam.tacticalIntent ?? "Balanced",
          capturedAt: new Date().toISOString(),
        };

        const analysisFacts = generateMatchAnalysisFacts({
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          homeScore,
          awayScore,
          sportPreset: season.league.sportPreset,
          events: (result.trace as any[]) || [],
          homeRatings: homeRatings as any,
          awayRatings: awayRatings as any,
          homeTactics: match.homeTeam.tacticalIntent || "Balanced",
          awayTactics: match.awayTeam.tacticalIntent || "Balanced",
        });

        const updated = await ctx.db.sportMatch.update({
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
              simulationSnapshot,
              analysisFacts,
            } as unknown as Prisma.InputJsonValue,
            homeRatingBefore: { ...homeRatings },
            awayRatingBefore: { ...awayRatings },
            homeRatingAfter: { ...homeRatingAfter },
            awayRatingAfter: { ...awayRatingAfter },
          },
        });

        // Standings update
        const isDraw = homeScore === awayScore;
        const homeWin = homeScore > awayScore;

        if (homeWin) {
          await ctx.db.sportStanding.updateMany({
            where: { seasonId: match.seasonId, teamId: match.homeTeamId },
            data: {
              wins: { increment: 1 },
              points: { increment: 3 },
              pointsFor: { increment: homeScore },
              pointsAgainst: { increment: awayScore },
            },
          });
          await ctx.db.sportStanding.updateMany({
            where: { seasonId: match.seasonId, teamId: match.awayTeamId },
            data: {
              losses: { increment: 1 },
              pointsFor: { increment: awayScore },
              pointsAgainst: { increment: homeScore },
            },
          });
        } else if (!isDraw) {
          await ctx.db.sportStanding.updateMany({
            where: { seasonId: match.seasonId, teamId: match.awayTeamId },
            data: {
              wins: { increment: 1 },
              points: { increment: 3 },
              pointsFor: { increment: awayScore },
              pointsAgainst: { increment: homeScore },
            },
          });
          await ctx.db.sportStanding.updateMany({
            where: { seasonId: match.seasonId, teamId: match.homeTeamId },
            data: {
              losses: { increment: 1 },
              pointsFor: { increment: homeScore },
              pointsAgainst: { increment: awayScore },
            },
          });
        } else {
          await ctx.db.sportStanding.updateMany({
            where: { seasonId: match.seasonId, teamId: match.homeTeamId },
            data: {
              draws: { increment: 1 },
              points: { increment: 1 },
              pointsFor: { increment: homeScore },
              pointsAgainst: { increment: awayScore },
            },
          });
          await ctx.db.sportStanding.updateMany({
            where: { seasonId: match.seasonId, teamId: match.awayTeamId },
            data: {
              draws: { increment: 1 },
              points: { increment: 1 },
              pointsFor: { increment: awayScore },
              pointsAgainst: { increment: homeScore },
            },
          });
        }

        return {
          matchId: match.id,
          homeScore,
          awayScore,
          matchStats: updated.matchStats,
          analysisFacts,
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
