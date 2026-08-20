/**
 * Sports Seasons — Playoff & Bracket Simulation Router
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import {
  resolveMatch,
  simpleHash,
  computeTeamRatingVector,
  getTeamModifiers,
} from "~/lib/sports";

export const playoffsSimulationRouter = createTRPCRouter({
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

          const rivalry = await (ctx.db as any).sportRivalry.findFirst({
            where: {
              OR: [
                { team1Id: bm.fighter1Id, team2Id: bm.fighter2Id },
                { team1Id: bm.fighter2Id, team2Id: bm.fighter1Id },
              ],
            },
          });
          const rivalryIntensity = rivalry?.intensity ?? 0;
          const homeAdvantage = rivalryIntensity > 70 ? 65 : 55;

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
            context: { homeAdvantage },
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

          // Update player morale for bracket matches
          const f1PlayerIds = (fighter1Team.players as any[]).map((p) => p.id);
          const f2PlayerIds = (fighter2Team.players as any[]).map((p) => p.id);

          if (f1Score > f2Score) {
            await (ctx.db as any).sportPlayer.updateMany({
              where: { id: { in: f1PlayerIds } },
              data: { morale: { increment: 5 } },
            });
            await (ctx.db as any).sportPlayer.updateMany({
              where: { id: { in: f2PlayerIds } },
              data: { morale: { decrement: 5 } },
            });
          } else if (f2Score > f1Score) {
            await (ctx.db as any).sportPlayer.updateMany({
              where: { id: { in: f2PlayerIds } },
              data: { morale: { increment: 5 } },
            });
            await (ctx.db as any).sportPlayer.updateMany({
              where: { id: { in: f1PlayerIds } },
              data: { morale: { decrement: 5 } },
            });
          }

          // Cap morale at [0, 100]
          await (ctx.db as any).sportPlayer.updateMany({
            where: { id: { in: [...f1PlayerIds, ...f2PlayerIds] }, morale: { gt: 100 } },
            data: { morale: 100 },
          });
          await (ctx.db as any).sportPlayer.updateMany({
            where: { id: { in: [...f1PlayerIds, ...f2PlayerIds] }, morale: { lt: 0 } },
            data: { morale: 0 },
          });

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
                      ...(broadcastAudio && { broadcastAudio }),
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
});
