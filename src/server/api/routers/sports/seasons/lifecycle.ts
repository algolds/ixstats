/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import {
  getPreset,
  generateSchedule,
  transitionSeasonAction,
  type SportPresetKey,
  type ArchetypeType,
  type TeamRatingVector,
} from "~/lib/sports";

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

export const sportsSeasonsLifecycleRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  collectMatchRevenue: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const ticketRevenue =
          team.stadiumCapacity * team.ticketPrice * 0.6 * (team.popularity / 100);
        const sponsorIncome = (team.sponsor as any)?.baseFee ?? 0;
        const totalIncome = Math.round(ticketRevenue + sponsorIncome);

        const currentBudget = team.budget ?? 0;
        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { budget: currentBudget + totalIncome },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to collect revenue",
        });
      }
    }),

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  startSeason: protectedProcedure
    .input(z.object({ leagueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: input.leagueId },
          include: { teams: true },
        });

        if (!league) {
          throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
        }

        if (league.teams.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "League has no teams",
          });
        }

        // Check for in-progress seasons
        const activeSeason = await ctx.db.sportSeason.findFirst({
          where: { leagueId: input.leagueId, status: "in_progress" },
        });
        if (activeSeason) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "League already has an in-progress season",
          });
        }

        const maxSeason = await ctx.db.sportSeason.findFirst({
          where: { leagueId: input.leagueId },
          orderBy: { seasonNumber: "desc" },
          select: { seasonNumber: true },
        });
        const seasonNumber = (maxSeason?.seasonNumber ?? 0) + 1;

        const startIxTime = IxTime.getCurrentIxTime();

        const season = await ctx.db.sportSeason.create({
          data: {
            leagueId: input.leagueId,
            seasonNumber,
            status: "in_progress",
            startIxTime,
          },
        });

        // Create standings records
        const teamIds = league.teams.map((t) => t.id);
        await ctx.db.sportStanding.createMany({
          data: league.teams.map((t) => ({
            seasonId: season.id,
            teamId: t.id,
          })),
        });

        // Create team season records
        await ctx.db.sportTeamSeason.createMany({
          data: teamIds.map((teamId) => ({
            seasonId: season.id,
            teamId,
          })),
        });

        if (league.archetype === "circuit") {
          // Generate race calendar
          const schedule = generateSchedule({
            archetype: league.archetype as ArchetypeType,
            teamCount: teamIds.length,
            raceCount: (league.settings as Record<string, unknown> | null)?.raceCount as
              | number
              | undefined,
          });
          const races = Array.isArray(schedule) ? schedule : [];
          for (const race of races) {
            const rRec = race as any;
            await ctx.db.sportRace.create({
              data: {
                seasonId: season.id,
                raceNumber: rRec.raceNumber as number,
                circuitName: (rRec.circuitName as string) ?? `Race ${rRec.raceNumber}`,
                status: "upcoming",
                raceIxTime: startIxTime + (rRec.raceNumber as number) * 3 * 86400000,
              },
            });
          }
        } else if (league.archetype === "bracket") {
          // Create initial bracket matchups: seed teams by index, pair 1vN, 2v(N-1), etc.
          const shuffled = [...league.teams].sort(() => Math.random() - 0.5);
          const pairs: Array<[(typeof league.teams)[0], (typeof league.teams)[0]]> = [];
          for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
              pairs.push([shuffled[i], shuffled[i + 1]]);
            }
          }

          for (const [fighter1, fighter2] of pairs) {
            await ctx.db.sportBracket.create({
              data: {
                seasonId: season.id,
                round: 1,
                fighter1Id: fighter1.id,
                fighter2Id: fighter2.id,
                status: "scheduled",
                scheduledIxTime: startIxTime,
              },
            });
          }
        } else {
          // League or division_conference archetype: generate match schedule
          const schedule = generateSchedule({
            archetype: league.archetype as ArchetypeType,
            teamCount: teamIds.length,
          });
          const matches = Array.isArray(schedule) ? schedule : [];
          for (const m of matches) {
            const mRec = m as any;
            await ctx.db.sportMatch.create({
              data: {
                seasonId: season.id,
                matchDay: (mRec.matchDay as number) ?? 1,
                homeTeamId: teamIds[(mRec.homeTeamIndex as number) ?? 0] ?? teamIds[0],
                awayTeamId:
                  teamIds[(mRec.awayTeamIndex as number) ?? 1] ?? teamIds[1] ?? teamIds[0],
                status: "scheduled",
                scheduledIxTime: startIxTime + ((mRec.matchDay as number) ?? 1) * 86400000,
              },
            });
          }
        }

        return season;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start season",
        });
      }
    }),

  getSeason: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const season = await ctx.db.sportSeason.findUnique({
        where: { id: input.id },
        include: {
          league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
          standings: {
            include: { team: { select: { id: true, name: true, shortName: true } } },
            orderBy: [{ points: "desc" }, { pointsFor: "desc" }],
          },
          matches: {
            include: {
              homeTeam: { select: { id: true, name: true, shortName: true, color: true } },
              awayTeam: { select: { id: true, name: true, shortName: true, color: true } },
            },
            orderBy: [{ matchDay: "asc" }, { scheduledIxTime: "asc" }],
          },
          brackets: {
            orderBy: { round: "asc" },
          },
          races: {
            orderBy: { raceNumber: "asc" },
          },
          champion: { select: { id: true, name: true } },
        },
      });

      if (!season) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
      }

      return season;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch season",
      });
    }
  }),

  getMatchDetails: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: {
            homeTeam: {
              select: { id: true, name: true, shortName: true, logo: true, color: true },
            },
            awayTeam: {
              select: { id: true, name: true, shortName: true, logo: true, color: true },
            },
          },
        });

        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const stats = match.matchStats as any;
        return {
          ...match,
          evaluation: stats?.evaluation ?? null,
          trace: stats?.trace ?? null,
          commentary: stats?.commentary ?? null,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch match details",
        });
      }
    }),

  transitionToNextSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await transitionSeasonAction(ctx.db as any, input.seasonId);
        return result;
      } catch (error) {
        console.error("Transition to next season error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to transition season",
        });
      }
    }),

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
