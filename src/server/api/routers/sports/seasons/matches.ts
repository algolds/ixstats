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

// eslint-disable-next-line unused-imports/no-unused-vars
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

        // Best-effort feed bulletin — must never fail the simulation
        try {
          const acct = await ctx.db.thinkpagesAccount.findUnique({
            where: { username: "SportsNews" },
          });
          if (acct) {
            const { getSportEmoji } = await import("~/lib/sports/presets");
            const { formatMatchDayBulletin } = await import("~/lib/sports/feed-bulletins");

            const resultLines = matches.map((match, index) => {
              const res = results[index] as { homeScore: number; awayScore: number };
              return {
                homeName: match.homeTeam.name as string,
                awayName: match.awayTeam.name as string,
                homeScore: res.homeScore,
                awayScore: res.awayScore,
              };
            });

            const content = formatMatchDayBulletin({
              leagueName: season.league.name,
              sportEmoji: getSportEmoji(season.league.sportPreset),
              matchDay: input.matchDay,
              results: resultLines,
            });

            const post = await ctx.db.thinkpagesPost.create({
              data: {
                accountId: acct.id,
                content,
                isAutoGenerated: true,
                ixTimeTimestamp: IxTime.timestampToDate(IxTime.getCurrentIxTime()),
              },
            });

            // Fire-and-forget call to append LLM narration
            (async () => {
              try {
                const { narrateBulletin } = await import("~/lib/sports/commentary/narrator");
                const { getGlobalLLMConfig } = await import("~/lib/sports/commentary/db-config");
                const dbConfig = await getGlobalLLMConfig(ctx.db);
                const summary = await narrateBulletin(resultLines, {
                  sport: season.league.sportPreset,
                  leagueName: season.league.name,
                  matchDay: input.matchDay,
                  config: dbConfig,
                });

                if (summary) {
                  const updatedContent = formatMatchDayBulletin({
                    leagueName: season.league.name,
                    sportEmoji: getSportEmoji(season.league.sportPreset),
                    matchDay: input.matchDay,
                    results: resultLines,
                    llmSummary: summary,
                  });

                  await ctx.db.thinkpagesPost.update({
                    where: { id: post.id },
                    data: { content: updatedContent },
                  });
                }
              } catch (narrateErr) {
                console.error("[simulateMatchDay] Async narration failed:", narrateErr);
              } finally {
                try {
                  const { mirrorThinkPagesPostToDiscordFeed } =
                    await import("~/lib/thinkpages-discord-feed");
                  await mirrorThinkPagesPostToDiscordFeed(ctx.db as any, post.id);
                } catch (mirrorErr) {
                  console.error(
                    "[simulateMatchDay] Failed to mirror sports post to Discord:",
                    mirrorErr
                  );
                }
              }
            })();
          }
        } catch (err) {
          console.error("[simulateMatchDay] feed bulletin failed:", err);
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

          await (ctx.db as any).sportBracket.update({
            where: { id: bm.id },
            data: {
              winnerId,
              status: "completed",
              resolvedIxTime: IxTime.getCurrentIxTime(),
              result: result as any,
            },
          });

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

        const updated = await ctx.db.sportRace.update({
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
