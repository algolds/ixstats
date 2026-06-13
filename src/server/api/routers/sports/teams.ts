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
  getPreset,
  type SportPresetKey,
  type TeamRatingVector,
} from "~/lib/sports";
import { exchangeService } from "~/lib/exchange-service";

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

export const sportsTeamsRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  getTeams: publicProcedure
    .input(
      z.object({
        leagueId: z.string().optional(),
        nationId: z.string().optional(),
        ownerUserId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const teams = await ctx.db.sportTeam.findMany({
          where: {
            ...(input.leagueId && { leagueId: input.leagueId }),
            ...(input.nationId && { nationId: input.nationId }),
            ...(input.ownerUserId && { ownerUserId: input.ownerUserId }),
          },
          include: {
            league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
          },
          orderBy: { name: "asc" },
        });

        return teams;
      } catch (_error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch teams",
        });
      }
    }),

  getTeam: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    try {
      const team = await ctx.db.sportTeam.findUnique({
        where: { id: input.id },
        include: {
          league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
          players: { where: { isActive: true }, orderBy: { position: "asc" } },
          coaches: { where: { isActive: true } },
          seasons: {
            include: {
              season: { select: { id: true, seasonNumber: true, status: true } },
            },
            orderBy: { season: { seasonNumber: "desc" } },
          },
          nation: { select: { id: true, name: true } },
        },
      });

      if (!team) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      }

      return team;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch team",
      });
    }
  }),

  updateTeam: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        color: z.string().optional(),
        nationId: z.string().optional(),
        logo: z.string().nullable().optional(),
        coverImage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const team = await ctx.db.sportTeam.findUnique({ where: { id } });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }

        return ctx.db.sportTeam.update({ where: { id }, data });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update team",
        });
      }
    }),

  claimTeam: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }

        if (team.ownerUserId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Team is already claimed",
          });
        }

        await exchangeService.spend(
          ctx.user.id,
          50,
          "CHARTER_FEE",
          `TEAM_CLAIM:${input.teamId}`,
          ctx.db as any
        );

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { ownerUserId: ctx.user.id },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to claim team",
        });
      }
    }),

  updateTeamTactics: protectedProcedure
    .input(z.object({ teamId: z.string(), tacticalIntent: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }
        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { tacticalIntent: input.tacticalIntent },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update tactics" });
      }
    }),

  selectSponsor: protectedProcedure
    .input(z.object({ teamId: z.string(), sponsorType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const sponsors: Record<string, { name: string; baseFee: number; winBonus: number }> = {
          conservative: { name: "SafeState Insurance", baseFee: 100, winBonus: 0 },
          aggressive: { name: "Apex Energy Drink", baseFee: 10, winBonus: 25 },
          corporate: { name: "Globex Logistics", baseFee: 50, winBonus: 10 },
        };
        const sponsorData = sponsors[input.sponsorType];
        if (!sponsorData) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid sponsor type" });
        }

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { sponsor: sponsorData },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to select sponsor",
        });
      }
    }),

  trainPlayer: protectedProcedure
    .input(z.object({ playerId: z.string(), attributeFocus: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.playerId },
          include: { team: true },
        });
        if (!player) throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        if (!player.team || player.team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        await exchangeService.spend(ctx.user.id, 25, "TRAINING_FEE", `PLAYER:${input.playerId}`, ctx.db as any);

        const ratings = (player.ratings as Record<string, number>) ?? {};
        const current = ratings[input.attributeFocus] ?? 50;
        const gain = Math.random() < 0.4 ? Math.floor(Math.random() * 3) + 1 : 1;
        const newVal = Math.min(99, current + gain);

        return ctx.db.sportPlayer.update({
          where: { id: input.playerId },
          data: { ratings: { ...ratings, [input.attributeFocus]: newVal } },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Training failed" });
      }
    }),

  teamTraining: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        await exchangeService.spend(ctx.user.id, 100, "TEAM_TRAINING", `TEAM:${input.teamId}`, ctx.db as any);

        const players = await ctx.db.sportPlayer.findMany({
          where: { teamId: input.teamId, isActive: true },
        });
        for (const player of players) {
          const ratings = (player.ratings as Record<string, number>) ?? {};
          const keys = Object.keys(ratings).filter((k) => k !== "overall");
          if (keys.length === 0) continue;
          const attr = keys[Math.floor(Math.random() * keys.length)];
          const gain = Math.random() < 0.3 ? 1 : 0;
          if (gain > 0) {
            await ctx.db.sportPlayer.update({
              where: { id: player.id },
              data: { ratings: { ...ratings, [attr]: Math.min(99, (ratings[attr] ?? 50) + gain) } },
            });
          }
        }
        return { trained: players.length };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Team training failed" });
      }
    }),

  setLineup: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        starters: z.array(z.string()),
        captainId: z.string().optional(),
        formation: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }
        const lineup = {
          starters: input.starters,
          captainId: input.captainId ?? null,
          formation: input.formation ?? "4-4-2",
        };
        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { lineup },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to set lineup" });
      }
    }),

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

  getMyClubs: protectedProcedure.query(async ({ ctx }) => {
    try {
      const teams = await ctx.db.sportTeam.findMany({
        where: { ownerUserId: ctx.user.id },
        include: {
          league: {
            select: { id: true, name: true, sportPreset: true, archetype: true, status: true },
          },
        },
        orderBy: { name: "asc" },
      });

      const teamsWithSeasons = await Promise.all(
        teams.map(async (t) => {
          const activeSeason = await ctx.db.sportSeason.findFirst({
            where: { leagueId: t.leagueId, status: "in_progress" },
            select: { id: true, seasonNumber: true },
          });

          return {
            ...t,
            activeSeason,
          };
        })
      );

      return teamsWithSeasons;
    } catch (_error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch my clubs",
      });
    }
  }),

  getMyClubOverview: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId, ownerUserId: ctx.user.id },
          include: {
            players: { where: { isActive: true }, orderBy: { position: "asc" } },
            coaches: { where: { isActive: true } },
          },
        });

        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Club not found or not owned by you" });
        }

        // Current season standings
        const activeSeason = await ctx.db.sportSeason.findFirst({
          where: { leagueId: team.leagueId, status: "in_progress" },
          select: { id: true, seasonNumber: true },
        });

        let currentStandings = null;
        let upcomingMatches: Array<unknown> = [];

        if (activeSeason) {
          currentStandings = await ctx.db.sportStanding.findUnique({
            where: { seasonId_teamId: { seasonId: activeSeason.id, teamId: team.id } },
          });

          upcomingMatches = await ctx.db.sportMatch.findMany({
            where: {
              seasonId: activeSeason.id,
              status: "scheduled",
              OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
            },
            include: {
              homeTeam: { select: { id: true, name: true, shortName: true } },
              awayTeam: { select: { id: true, name: true, shortName: true } },
            },
            orderBy: { matchDay: "asc" },
            take: 5,
          });
        }

        // Team history summary
        const seasonsCount = await ctx.db.sportTeamSeason.count({
          where: { teamId: team.id },
        });

        const championships = await ctx.db.sportSeason.count({
          where: { championTeamId: team.id, status: "completed" },
        });

        return {
          team,
          activeSeason,
          currentStandings,
          upcomingMatches,
          seasonsCount,
          championships,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch club overview",
        });
      }
    }),

  // ═══ Utility ═════════════════════════════════════════════════════════════════
});
