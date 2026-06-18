/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { getPreset, type SportPresetKey, type TeamRatingVector } from "~/lib/sports";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line unused-imports/no-unused-vars
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

// eslint-disable-next-line unused-imports/no-unused-vars
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

// eslint-disable-next-line unused-imports/no-unused-vars
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

export const sportsStandingsRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  getStandings: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const standings = await ctx.db.sportStanding.findMany({
          where: { seasonId: input.seasonId },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                color: true,
                logo: true,
                wikiSlug: true,
              },
            },
          },
          orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
        });

        return standings.map((s, i) => ({ ...s, position: i + 1 }));
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch standings",
        });
      }
    }),

  getBracket: publicProcedure
    .input(z.object({ seasonId: z.string(), weightClass: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const brackets = await ctx.db.sportBracket.findMany({
          where: {
            seasonId: input.seasonId,
            ...(input.weightClass && { weightClass: input.weightClass }),
          },
          orderBy: { round: "asc" },
        });

        return brackets;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch bracket",
        });
      }
    }),

  getRaceResults: publicProcedure
    .input(z.object({ seasonId: z.string(), raceNumber: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const races = await ctx.db.sportRace.findMany({
          where: {
            seasonId: input.seasonId,
            ...(input.raceNumber !== undefined && { raceNumber: input.raceNumber }),
          },
          orderBy: { raceNumber: "asc" },
        });

        return races;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch race results",
        });
      }
    }),

  // ═══ History & Records ══════════════════════════════════════════════════════

  getLeagueHistory: publicProcedure
    .input(z.object({ leagueId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const seasons = await ctx.db.sportSeason.findMany({
          where: { leagueId: input.leagueId, status: "completed" },
          include: {
            champion: { select: { id: true, name: true } },
          },
          orderBy: { seasonNumber: "desc" },
        });

        return seasons.map((s) => ({
          seasonId: s.id,
          seasonNumber: s.seasonNumber,
          championTeamId: s.championTeamId,
          championTeamName: s.champion?.name ?? null,
          startIxTime: s.startIxTime,
          endIxTime: s.endIxTime,
        }));
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch league history",
        });
      }
    }),

  getTeamHistory: publicProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const teamSeasons = await ctx.db.sportTeamSeason.findMany({
          where: { teamId: input.teamId },
          include: {
            season: {
              select: { id: true, seasonNumber: true, status: true, championTeamId: true },
            },
          },
          orderBy: { season: { seasonNumber: "desc" } },
        });

        const history = await Promise.all(
          teamSeasons.map(async (ts) => {
            const standing = await ctx.db.sportStanding.findUnique({
              where: { seasonId_teamId: { seasonId: ts.seasonId, teamId: input.teamId } },
            });

            const allStandings = await ctx.db.sportStanding.findMany({
              where: { seasonId: ts.seasonId },
              orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
              select: { teamId: true },
            });

            const position = allStandings.findIndex((s) => s.teamId === input.teamId) + 1;

            return {
              seasonNumber: ts.season.seasonNumber,
              seasonId: ts.seasonId,
              status: ts.season.status,
              wins: standing?.wins ?? 0,
              losses: standing?.losses ?? 0,
              draws: standing?.draws ?? 0,
              points: standing?.points ?? 0,
              pointsFor: standing?.pointsFor ?? 0,
              pointsAgainst: standing?.pointsAgainst ?? 0,
              position: position > 0 ? position : null,
              isChampion: ts.season.championTeamId === input.teamId,
            };
          })
        );

        return history;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team history",
        });
      }
    }),

  getRecords: publicProcedure
    .input(z.object({ leagueId: z.string(), recordType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const records = await ctx.db.sportSeasonRecord.findMany({
          where: {
            leagueId: input.leagueId,
            ...(input.recordType && { recordType: input.recordType }),
          },
          include: {
            season: { select: { seasonNumber: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        if (records.length === 0) {
          // Compute live records if none exist in DB
          const standings = await ctx.db.sportStanding.findMany({
            where: {
              season: {
                leagueId: input.leagueId,
                status: "completed",
              },
            },
            include: {
              team: { select: { id: true, name: true } },
              season: { select: { seasonNumber: true } },
            },
          });

          const teamWins: Record<string, { teamId: string; teamName: string; wins: number }> = {};
          for (const s of standings) {
            const key = s.teamId;
            if (!teamWins[key]) {
              teamWins[key] = { teamId: s.teamId, teamName: s.team.name, wins: 0 };
            }
            teamWins[key].wins += s.wins;
          }

          const mostWins = Object.values(teamWins)
            .sort((a, b) => b.wins - a.wins)
            .slice(0, 5);

          // Count championships
          const seasons = await ctx.db.sportSeason.findMany({
            where: { leagueId: input.leagueId, status: "completed", championTeamId: { not: null } },
            select: { championTeamId: true },
          });
          const champCount: Record<string, number> = {};
          for (const s of seasons) {
            if (s.championTeamId) {
              champCount[s.championTeamId] = (champCount[s.championTeamId] ?? 0) + 1;
            }
          }
          const mostChampionships = Object.entries(champCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([teamId, count]) => ({ teamId, championships: count }));

          return {
            mostWins,
            mostChampionships,
            totalSeasons: standings.length > 0 ? new Set(standings.map((s) => s.seasonId)).size : 0,
          };
        }

        return records;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch records",
        });
      }
    }),

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
