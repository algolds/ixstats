/**
 * Sports Seasons — Match Day Simulation Router
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import {
  resolveMatch,
  transitionToNextStage,
  simpleHash,
  computeTeamRatingVector,
  getTeamModifiers,
} from "~/lib/sports";

export const matchDaySimulationRouter = createTRPCRouter({
  simulateMatchDay: protectedProcedure
    .input(z.object({ seasonId: z.string(), matchDay: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await (ctx.db as any).sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        const activeStage = (season as any).activeStage ?? 1;

        const matches = (await (ctx.db as any).sportMatch.findMany({
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
        })) as any[];

        if (matches.length === 0) {
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
            homeLineup: match.homeTeam.lineup,
            awayLineup: match.awayTeam.lineup,
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

          const status = winner ? (homeScore > awayScore ? "home_win" : "away_win") : "draw";

          // Atomically claim the match: only one caller can flip scheduled→completed,
          // so a double-click / concurrent sim can't double-apply standings below.
          const claimed = await (ctx.db as any).sportMatch.updateMany({
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
          await (ctx.db as any).sportTeamSeason.updateMany({
            where: { seasonId: input.seasonId, teamId: match.homeTeamId },
            data: { ratingVector: { ...homeRatingAfter } },
          });
          await (ctx.db as any).sportTeamSeason.updateMany({
            where: { seasonId: input.seasonId, teamId: match.awayTeamId },
            data: { ratingVector: { ...awayRatingAfter } },
          });

          // Update standings
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
            // Draw
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
            where: { id: { in: [...homePlayerIds, ...awayPlayerIds] }, morale: { gt: 100 } },
            data: { morale: 100 },
          });
          await (ctx.db as any).sportPlayer.updateMany({
            where: { id: { in: [...homePlayerIds, ...awayPlayerIds] }, morale: { lt: 0 } },
            data: { morale: 0 },
          });

          // Create match stats for key player performances
          let playerStats = resRec.playerStats as Array<Record<string, unknown>> | undefined;

          if (!playerStats && Array.isArray(result.trace)) {
            const playerMap = new Map<string, { goals: number; assists: number; shots: number }>();
            const homeIds = new Set(match.homeTeam.players.map((p: any) => p.id));

            for (const event of result.trace) {
              const actorId = event.actorId;
              if (!actorId) continue;

              if (!playerMap.has(actorId)) {
                playerMap.set(actorId, { goals: 0, assists: 0, shots: 0 });
              }

              const pStat = playerMap.get(actorId)!;

              if (event.type === "goal") {
                pStat.goals++;
              } else if (
                event.type === "tactic_shift" &&
                typeof event.description === "string" &&
                event.description.toLowerCase().includes("shot")
              ) {
                pStat.shots++;
              }
            }

            // Assign assists to teammates for goals
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
                await (ctx.db as any).sportMatchStat.create({
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
              homeScore: res.homeScore,
              awayScore: res.awayScore,
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
          await resolveMatchPredictions(
            ctx.db,
            res.matchId,
            outcomeFromScores(res.homeScore, res.awayScore)
          );
        }

        // Try to transition to next stage if this stage matches are complete
        await transitionToNextStage(ctx.db as any, input.seasonId);

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
});
