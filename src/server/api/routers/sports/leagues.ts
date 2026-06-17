/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllPresets,
  getPreset,
  generateTeamRoster,
  generateCoach,
  generateSchedule,
  type SportPresetKey,
  type TeamRatingVector,
} from "~/lib/sports";
import { exchangeService } from "~/lib/exchange-service";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { IxTime } from "~/lib/ixtime";
import { generateMatchReport, generateMatchPreview } from "~/lib/sports/commentary/narrator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line unused-imports/no-unused-vars
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

async function recalculateStandings(db: any, seasonId: string) {
  const teams = await db.sportTeamSeason.findMany({
    where: { seasonId },
    select: { teamId: true },
  });

  const matches = await db.sportMatch.findMany({
    where: { seasonId, status: "completed" },
  });

  const statsMap: Record<string, { wins: number; losses: number; draws: number; points: number; pointsFor: number; pointsAgainst: number }> = {};
  for (const t of teams) {
    statsMap[t.teamId] = { wins: 0, losses: 0, draws: 0, points: 0, pointsFor: 0, pointsAgainst: 0 };
  }

  for (const m of matches) {
    const homeScore = m.homeScore ?? 0;
    const awayScore = m.awayScore ?? 0;
    
    if (!statsMap[m.homeTeamId]) {
      statsMap[m.homeTeamId] = { wins: 0, losses: 0, draws: 0, points: 0, pointsFor: 0, pointsAgainst: 0 };
    }
    if (!statsMap[m.awayTeamId]) {
      statsMap[m.awayTeamId] = { wins: 0, losses: 0, draws: 0, points: 0, pointsFor: 0, pointsAgainst: 0 };
    }

    statsMap[m.homeTeamId].pointsFor += homeScore;
    statsMap[m.homeTeamId].pointsAgainst += awayScore;
    statsMap[m.awayTeamId].pointsFor += awayScore;
    statsMap[m.awayTeamId].pointsAgainst += homeScore;

    if (homeScore > awayScore) {
      statsMap[m.homeTeamId].wins += 1;
      statsMap[m.homeTeamId].points += 3;
      statsMap[m.awayTeamId].losses += 1;
    } else if (awayScore > homeScore) {
      statsMap[m.awayTeamId].wins += 1;
      statsMap[m.awayTeamId].points += 3;
      statsMap[m.homeTeamId].losses += 1;
    } else {
      statsMap[m.homeTeamId].draws += 1;
      statsMap[m.homeTeamId].points += 1;
      statsMap[m.awayTeamId].draws += 1;
      statsMap[m.awayTeamId].points += 1;
    }
  }

  const standingsArray = Object.entries(statsMap).map(([teamId, stats]) => ({
    teamId,
    ...stats,
    diff: stats.pointsFor - stats.pointsAgainst,
  }));

  standingsArray.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.pointsFor - a.pointsFor;
  });

  for (let idx = 0; idx < standingsArray.length; idx++) {
    const item = standingsArray[idx];
    await db.sportStanding.upsert({
      where: { seasonId_teamId: { seasonId, teamId: item.teamId } },
      create: {
        seasonId,
        teamId: item.teamId,
        wins: item.wins,
        losses: item.losses,
        draws: item.draws,
        points: item.points,
        pointsFor: item.pointsFor,
        pointsAgainst: item.pointsAgainst,
        position: idx + 1,
      },
      update: {
        wins: item.wins,
        losses: item.losses,
        draws: item.draws,
        points: item.points,
        pointsFor: item.pointsFor,
        pointsAgainst: item.pointsAgainst,
        position: idx + 1,
      },
    });
  }
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

export const sportsLeaguesRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  getLeagues: publicProcedure
    .input(
      z.object({
        sport: z.string().optional(),
        archetype: z.string().optional(),
        isCanonical: z.boolean().optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const leagues = await ctx.db.sportLeague.findMany({
          where: {
            ...(input.sport && { sportPreset: input.sport }),
            ...(input.archetype && { archetype: input.archetype }),
            ...(input.isCanonical !== undefined && { isCanonical: input.isCanonical }),
            ...(input.status && { status: input.status }),
          },
          include: {
            _count: { select: { teams: true, seasons: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        return leagues.map((l) => ({
          ...l,
          teamCount: l._count.teams,
          seasonCount: l._count.seasons,
        }));
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch leagues",
        });
      }
    }),

  getDraftPicks: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await (ctx.db as any).sportDraftPick.findMany({
          where: { seasonId: input.seasonId },
          orderBy: [{ round: "asc" }, { pickNumber: "asc" }],
          include: {
            team: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            player: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                position: true,
                ratings: true,
              },
            },
          },
        });
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch draft picks",
        });
      }
    }),

  getLeague: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const league = await ctx.db.sportLeague.findUnique({
        where: { id: input.id },
        include: {
          teams: { orderBy: { name: "asc" } },
          seasons: {
            include: {
              champion: { select: { id: true, name: true } },
              matches: {
                where: {
                  season: { status: "in_progress" },
                },
                select: { id: true, status: true },
              },
              races: {
                where: {
                  season: { status: "in_progress" },
                },
                select: { id: true, status: true },
              },
              _count: {
                select: {
                  draftPicks: true,
                },
              },
            },
            orderBy: { seasonNumber: "desc" },
          },
        },
      });

      if (!league) {
        throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
      }

      return league;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch league",
      });
    }
  }),

  createLeague: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        sportPreset: z.string().min(1),
        teamCount: z.number().int().min(2).max(64),
        nationAffiliation: z.string().nullable().optional(),
        settings: z.record(z.string(), z.unknown()),
        isCanonical: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const preset = getPreset(input.sportPreset as SportPresetKey);
        if (!preset) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown sport preset: ${input.sportPreset}`,
          });
        }

        await exchangeService.spend(
          ctx.user.id,
          500,
          "CHARTER_FEE",
          `LEAGUE_CREATE:${input.name}`,
          ctx.db as any
        );

        const archetype = preset.archetype;

        // Only system owners may mint a canonical (official/canon) league.
        // Non-owners requesting isCanonical:true silently get a non-canonical league.
        const canonical = input.isCanonical === true && isSystemOwner(ctx.auth.userId);

        const league = await ctx.db.sportLeague.create({
          data: {
            name: input.name,
            sportPreset: input.sportPreset,
            archetype,
            teamCount: input.teamCount,
            nationAffiliation: input.nationAffiliation,
            isCanonical: canonical,
            settings: input.settings as any,
            createdByUserId: ctx.user.id,
            status: "active",
          },
        });

        const teams = [];
        for (let i = 0; i < input.teamCount; i++) {
          const team = await ctx.db.sportTeam.create({
            data: {
              leagueId: league.id,
              name: `${input.name} Team ${i + 1}`,
              shortName: `${input.name.slice(0, 3).toUpperCase()}${i + 1}`,
              color: `hsl(${(i * 360) / input.teamCount}, 70%, 50%)`,
              nationId: input.nationAffiliation ?? null,
            },
          });

          // Generate coach
          const seed = teamIndexHash(league.id, i, 0);
          const coachData = generateCoach({ seed });
          await ctx.db.sportCoach.create({
            data: {
              teamId: team.id,
              firstName: coachData.firstName,
              lastName: coachData.lastName,
              role: coachData.role ?? "Head Coach",
              age: coachData.age ?? 45,
              ratings: coachData.ratings as any,
              careerStage: coachData.careerStage ?? "prime",
              isActive: true,
            },
          });

          // Generate roster
          const roster = generateTeamRoster({
            sport: input.sportPreset as SportPresetKey,
            rosterSize: preset.rosterSize,
            seed,
          });
          for (let j = 0; j < roster.length; j++) {
            const p = roster[j];
            await ctx.db.sportPlayer.create({
              data: {
                teamId: team.id,
                firstName: p.firstName ?? `Player`,
                lastName: p.lastName ?? `${j + 1}`,
                position: p.position ?? "Unset",
                number: j + 1,
                age: p.age ?? 22,
                careerStage: p.careerStage ?? "rookie",
                ratings: (p.ratings as any) ?? {},
                isActive: true,
              },
            });
          }

          teams.push(team);
        }

        return {
          ...league,
          teams,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create league",
        });
      }
    }),

  updateLeague: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        status: z.string().optional(),
        logo: z.string().nullable().optional(),
        coverImage: z.string().nullable().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        tier: z.number().int().min(1).optional(),
        promotionCount: z.number().int().min(0).optional(),
        relegationCount: z.number().int().min(0).optional(),
        wikiSlug: z.string().nullable().optional(),
        isCanonical: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, settings, ...data } = input;

        const league = await ctx.db.sportLeague.findUnique({ where: { id } });
        if (!league) {
          throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
        }

        return ctx.db.sportLeague.update({
          where: { id },
          data: {
            ...data,
            ...(settings !== undefined ? { settings: settings as any } : {}),
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update league",
        });
      }
    }),

  deleteLeague: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: input.id },
          include: {
            seasons: { where: { status: "completed" }, take: 1 },
          },
        });

        if (!league) {
          throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
        }

        if (league.seasons.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete league with completed seasons",
          });
        }

        // Prisma cascade will handle teams > players > coaches
        await ctx.db.sportLeague.delete({ where: { id: input.id } });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete league",
        });
      }
    }),

  // ═══ Team Management ═════════════════════════════════════════════════════════

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  getSchedule: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: { select: { archetype: true } } },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        if (season.league.archetype === "circuit") {
          const races = await ctx.db.sportRace.findMany({
            where: { seasonId: input.seasonId },
            orderBy: { raceNumber: "asc" },
          });
          return { type: "circuit", races };
        }

        const matches = await ctx.db.sportMatch.findMany({
          where: { seasonId: input.seasonId },
          include: {
            homeTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true, wikiSlug: true } },
            awayTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true, wikiSlug: true } },
          },
          orderBy: [{ matchDay: "asc" }, { scheduledIxTime: "asc" }],
        });

        return { type: "fixture", matches };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch schedule",
        });
      }
    }),

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  // ═══ Utility ═════════════════════════════════════════════════════════════════

  searchSportsEntities: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const players = await (ctx.db as any).sportPlayer.findMany({
          where: {
            OR: [
              { firstName: { contains: input.query, mode: "insensitive" } },
              { lastName: { contains: input.query, mode: "insensitive" } },
            ],
          },
          include: { team: true, transferListing: true },
          take: 5,
        });
        const teams = await ctx.db.sportTeam.findMany({
          where: {
            name: { contains: input.query, mode: "insensitive" },
          },
          include: { league: true },
          take: 5,
        });
        return {
          players: players.map((p: any) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            position: p.position,
            teamName: p.team.name,
            listing: p.transferListing
              ? {
                  id: p.transferListing.id,
                  price: p.transferListing.price,
                  status: p.transferListing.status,
                }
              : null,
          })),
          teams: teams.map((t: any) => ({
            id: t.id,
            name: t.name,
            leagueName: t.league.name,
          })),
        };
        // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Search failed" });
      }
    }),

  getSportPresets: publicProcedure.query(async () => {
    try {
      return getAllPresets();
    } catch (_error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch sport presets",
      });
    }
  }),

  resetSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
        });
        if (!season) throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });

        await ctx.db.sportMatch.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportStanding.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportBracket.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportRace.deleteMany({ where: { seasonId: input.seasonId } });

        await ctx.db.sportSeason.update({
          where: { id: input.seasonId },
          data: { status: "upcoming", activeStage: 1, championTeamId: null },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to reset season" });
      }
    }),

  overrideMatchResult: protectedProcedure
    .input(
      z.object({
        matchId: z.string(),
        homeScore: z.number().int().min(0),
        awayScore: z.number().int().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
        });
        if (!match) throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });

        const updatedMatch = await ctx.db.sportMatch.update({
          where: { id: input.matchId },
          data: {
            homeScore: input.homeScore,
            awayScore: input.awayScore,
            status: "completed",
            resolvedIxTime: Date.now() / 1000,
          },
        });

        await recalculateStandings(ctx.db, match.seasonId);

        return updatedMatch;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to override match result",
        });
      }
    }),

  transferTeam: protectedProcedure
    .input(z.object({ teamId: z.string(), targetLeagueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });

        const targetLeague = await ctx.db.sportLeague.findUnique({
          where: { id: input.targetLeagueId },
        });
        if (!targetLeague) throw new TRPCError({ code: "NOT_FOUND", message: "Target league not found" });

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { leagueId: input.targetLeagueId },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to transfer team",
        });
      }
    }),

  exportLeagueData: publicProcedure
    .input(z.object({ leagueId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: input.leagueId },
          include: {
            teams: true,
            seasons: {
              include: {
                matches: true,
                standings: true,
              },
            },
          },
        });
        if (!league) throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
        return league;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export league data",
        });
      }
    }),

  regenerateSchedule: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: {
            league: {
              include: { teams: true },
            },
          },
        });
        if (!season) throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });

        const completedMatch = await ctx.db.sportMatch.findFirst({
          where: { seasonId: input.seasonId, status: "completed" },
        });
        if (completedMatch) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot regenerate schedule once games have been played",
          });
        }

        await ctx.db.sportMatch.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportRace.deleteMany({ where: { seasonId: input.seasonId } });
        await ctx.db.sportBracket.deleteMany({ where: { seasonId: input.seasonId } });

        const teamIds = season.league.teams.map((t) => t.id);
        const startIxTime = IxTime.getCurrentIxTime();

        if (season.league.archetype === "circuit") {
          const schedule = generateSchedule({
            archetype: season.league.archetype as any,
            teamCount: teamIds.length,
            raceCount: (season.league.settings as Record<string, unknown> | null)?.raceCount as
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
        } else if (season.league.archetype === "bracket") {
          const shuffled = [...season.league.teams].sort(() => Math.random() - 0.5);
          const pairs: Array<[any, any]> = [];
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
          const schedule = generateSchedule({
            archetype: season.league.archetype as any,
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

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to regenerate schedule",
        });
      }
    }),

  generateMatchReport: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            playerStats: {
              include: {
                player: { select: { firstName: true, lastName: true } }
              }
            },
            season: {
              include: {
                league: { select: { sportPreset: true } }
              }
            }
          }
        });

        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const stats = match.matchStats as any;
        const events = stats?.trace ?? [];
        
        const report = await generateMatchReport({
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          homeScore: match.homeScore ?? 0,
          awayScore: match.awayScore ?? 0,
          sport: match.season.league.sportPreset,
          events: events,
          playerStats: match.playerStats as any[]
        });

        return { report };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate match report",
        });
      }
    }),

  generateMatchPreview: publicProcedure
    .input(
      z.object({
        homeTeamId: z.string(),
        awayTeamId: z.string(),
        sport: z.string(),
        standingsContext: z.string().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [homeTeam, awayTeam] = await Promise.all([
          ctx.db.sportTeam.findUnique({ where: { id: input.homeTeamId } }),
          ctx.db.sportTeam.findUnique({ where: { id: input.awayTeamId } }),
        ]);

        if (!homeTeam || !awayTeam) {
          throw new TRPCError({ code: "NOT_FOUND", message: "One or both teams not found" });
        }

        const preview = await generateMatchPreview(
          { name: homeTeam.name },
          { name: awayTeam.name },
          input.sport,
          input.standingsContext
        );

        return { preview };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate match preview",
        });
      }
    }),

  getAdminGlobalStats: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const [totalMatches, totalPlayers, totalLeagues, llmPosts] = await Promise.all([
          ctx.db.sportMatch.count(),
          ctx.db.sportPlayer.count(),
          ctx.db.sportLeague.count(),
          ctx.db.thinkpagesPost.count({
            where: { account: { username: "SportsNews" } },
          }),
        ]);
        return {
          totalMatches,
          totalPlayers,
          totalLeagues,
          llmPosts,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch admin global stats",
        });
      }
    }),

  testLLMNarrator: protectedProcedure
    .input(
      z.object({
        sport: z.string(),
        events: z.array(z.string()),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { narrateEvents } = await import("~/lib/sports/commentary/narrator");
        const mappedEvents = input.events.map((desc, idx) => ({
          t: idx * 10,
          type: "goal" as const,
          description: desc,
          team: "home" as const,
        }));
        const outputs = await narrateEvents(mappedEvents, { sport: input.sport });
        return { outputs };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to run LLM narrator test",
        });
      }
    }),

  generateMatchCommentary: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: {
            season: {
              include: {
                league: { select: { sportPreset: true } },
              },
            },
          },
        });

        if (!match) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
        }

        const stats = (match.matchStats as Record<string, any>) ?? {};
        const events = stats.trace ?? [];

        if (events.length === 0) {
          return { commentary: [] };
        }

        const { narrateEvents } = await import("~/lib/sports/commentary/narrator");
        const commentary = await narrateEvents(events, {
          sport: match.season.league.sportPreset,
        });

        // Save back to database
        const updatedStats = {
          ...stats,
          commentary,
        };

        await ctx.db.sportMatch.update({
          where: { id: input.matchId },
          data: {
            matchStats: updatedStats,
          },
        });

        return { commentary };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate match commentary",
        });
      }
    }),
});
