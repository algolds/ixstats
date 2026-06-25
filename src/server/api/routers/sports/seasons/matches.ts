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

export const sportsSeasonsMatchesRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  // ═══ Season & Simulation ════════════════════════════════════════════════════

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
              const { narrateEvents } = await import("~/lib/sports/commentary/narrator");
              const { getGlobalLLMConfig } = await import("~/lib/sports/commentary/db-config");
              const dbConfig = await getGlobalLLMConfig(ctx.db);
              const commentary = await narrateEvents(result.trace as any[], {
                sport: season.league.sportPreset,
                config: dbConfig,
              });
              if (commentary && commentary.length > 0) {
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
        const { resolveMatchPredictions, outcomeFromScores } = await import(
          "~/lib/sports/predictions"
        );
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

  simulatePlayoffRound: protectedProcedure
    .input(z.object({ seasonId: z.string(), round: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await (ctx.db as any).sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        // Find bracket matches for this round that are still scheduled
        const bracketMatches = await (ctx.db as any).sportBracket.findMany({
          where: { seasonId: input.seasonId, round: input.round, status: "scheduled" },
        });

        if (bracketMatches.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No scheduled bracket matches for this round",
          });
        }

        const results: Array<Record<string, unknown>> = [];

        // Pre-fetch all teams with rosters
        const teamIds = new Set<string>();
        for (const bm of bracketMatches) {
          if (bm.fighter1Id) teamIds.add(bm.fighter1Id);
          if (bm.fighter2Id) teamIds.add(bm.fighter2Id);
        }

        const teams = await ctx.db.sportTeam.findMany({
          where: { id: { in: Array.from(teamIds) } },
          include: {
            players: { where: { isActive: true } },
            coaches: { where: { isActive: true } },
          },
        });

        const teamsMap = new Map<string, any>();
        const nationIds = new Set<string>();
        for (const t of teams) {
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

        for (let i = 0; i < bracketMatches.length; i++) {
          const bm = bracketMatches[i];
          const seed = simpleHash(input.seasonId, input.round * 100, i);

          // Get both teams (fighters) with their rosters from pre-fetched map
          const fighter1Team = teamsMap.get(bm.fighter1Id);
          const fighter2Team = teamsMap.get(bm.fighter2Id);

          if (!fighter1Team || !fighter2Team) continue;

          const f1Ratings = computeTeamRatingVector(
            fighter1Team.players as any[],
            fighter1Team.coaches as any[],
            season.league.sportPreset
          );
          const f2Ratings = computeTeamRatingVector(
            fighter2Team.players as any[],
            fighter2Team.coaches as any[],
            season.league.sportPreset
          );

          const homeTeamModifiers = await getTeamModifiers(fighter1Team, ctx.db, effectsMap);
          const awayTeamModifiers = await getTeamModifiers(fighter2Team, ctx.db, effectsMap);

          const result = resolveMatch({
            sport: season.league.sportPreset,
            homeTeam: f1Ratings,
            awayTeam: f2Ratings,
            archetype: "bracket",
            seed,
            homeTeamModifiers,
            awayTeamModifiers,
            homeRoster: fighter1Team.players as any,
            awayRoster: fighter2Team.players as any,
            homeTacticalIntent: fighter1Team.tacticalIntent,
            awayTacticalIntent: fighter2Team.tacticalIntent,
            homeLineup: fighter1Team.lineup,
            awayLineup: fighter2Team.lineup,
          });

          const resRec = result as any;
          const f1Score = (resRec.homeScore as number) ?? 0;
          const f2Score = (resRec.awayScore as number) ?? 0;
          const winnerId = f1Score > f2Score ? bm.fighter1Id : bm.fighter2Id;

          const claimedBracket = await (ctx.db as any).sportBracket.updateMany({
            where: { id: bm.id, status: "scheduled" },
            data: {
              winnerId,
              status: "completed",
              resolvedIxTime: IxTime.getCurrentIxTime(),
              result: result as any,
            },
          });
          if (claimedBracket.count === 0) continue; // already simulated by another call

          void (async () => {
            try {
              const { narrateEvents } = await import("~/lib/sports/commentary/narrator");
              const { getGlobalLLMConfig } = await import("~/lib/sports/commentary/db-config");
              const dbConfig = await getGlobalLLMConfig(ctx.db);
              const commentary = await narrateEvents(result.trace as any[], {
                sport: season.league.sportPreset,
                config: dbConfig,
              });
              if (commentary && commentary.length > 0) {
                const latestBracket = await (ctx.db as any).sportBracket.findUnique({
                  where: { id: bm.id },
                  select: { result: true },
                });
                const existingResult = (latestBracket?.result as any) || {};
                await (ctx.db as any).sportBracket.update({
                  where: { id: bm.id },
                  data: {
                    result: {
                      ...existingResult,
                      commentary,
                    } as any,
                  },
                });
              }
            } catch (err) {
              console.error("[simulatePlayoffRound] background commentary failed:", err);
            }
          })();

          results.push({ bracketId: bm.id, winnerId, f1Score, f2Score });
        }

        // When all brackets in current round are done, create next round brackets
        const stillScheduled = await (ctx.db as any).sportBracket.count({
          where: { seasonId: input.seasonId, round: input.round, status: "scheduled" },
        });

        if (stillScheduled === 0) {
          const completedBrackets = await (ctx.db as any).sportBracket.findMany({
            where: { seasonId: input.seasonId, round: input.round, status: "completed" },
            select: { winnerId: true },
          });

          const winners = completedBrackets.map((b: any) => b.winnerId).filter(Boolean) as string[];

          if (winners.length >= 2) {
            const nextRound = input.round + 1;
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
                    weightClass: "heavyweight",
                    fighter1Id: a,
                    fighter2Id: b,
                    status: "scheduled",
                    scheduledIxTime: ixNow,
                  },
                });
              }
            }
          } else if (winners.length === 1) {
            const championTeamId = winners[0]!;
            await (ctx.db as any).sportSeason.update({
              where: { id: input.seasonId },
              data: {
                status: "completed",
                endIxTime: IxTime.getCurrentIxTime(),
                championTeamId,
              },
            });
          }
        }

        return { round: input.round, results };
      } catch (error) {
        console.error("Playoff round simulation error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate playoff round: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  simulateRace: protectedProcedure
    .input(z.object({ seasonId: z.string(), raceNumber: z.number().int().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        if (season.league.archetype !== "circuit") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Race simulation only available for circuit archetype",
          });
        }

        const race = await ctx.db.sportRace.findFirst({
          where: { seasonId: input.seasonId, raceNumber: input.raceNumber },
        });

        if (!race) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Race not found" });
        }

        if (race.status === "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Race already simulated",
          });
        }

        const teams = await ctx.db.sportTeam.findMany({
          where: {
            leagueId: season.leagueId,
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

        const raceResult = resolveRace({
          drivers: allDrivers,
          seed: simpleHash(input.seasonId, input.raceNumber, 0),
          isWet: false,
        });

        // Atomically claim the race so a concurrent call can't double-count points.
        const claimedRace = await ctx.db.sportRace.updateMany({
          where: { id: race.id, status: { not: "completed" } },
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
        if (claimedRace.count === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Race already simulated" });
        }
        const updated = await ctx.db.sportRace.findUnique({ where: { id: race.id } });

        // Update standings from race results
        const results = raceResult.positions;
        if (Array.isArray(results)) {
          for (const r of results) {
            if (r.teamId && r.points !== undefined) {
              await ctx.db.sportStanding.updateMany({
                where: { seasonId: input.seasonId, teamId: r.teamId as string },
                data: { points: { increment: (r.points as number) ?? 0 } },
              });
            }
          }
        }

        return updated;
      } catch (error) {
        console.error("Race simulation error:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate race: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }),

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
