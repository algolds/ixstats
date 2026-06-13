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
  resolveMatch,
  resolveRace,
  generateTeamRoster,
  generateCoach,
  generateSchedule,
  createRNG,
  transitionToNextStage,
  transitionSeasonAction,
  type SportPresetKey,
  type ArchetypeType,
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

export const sportsRouter = createTRPCRouter({
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

        const league = await ctx.db.sportLeague.create({
          data: {
            name: input.name,
            sportPreset: input.sportPreset,
            archetype,
            teamCount: input.teamCount,
            nationAffiliation: input.nationAffiliation,
            isCanonical: input.isCanonical,
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

  collectMatchRevenue: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const ticketRevenue = (team.stadiumCapacity * team.ticketPrice * 0.6 * (team.popularity / 100));
        const sponsorIncome = (team.sponsor as any)?.baseFee ?? 0;
        const totalIncome = Math.round(ticketRevenue + sponsorIncome);

        const currentBudget = team.budget ?? 0;
        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { budget: currentBudget + totalIncome },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to collect revenue" });
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

        const startIxTime = Date.now();

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
              resolvedIxTime: Date.now(),
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
          const playerStats = resRec.playerStats as Array<Record<string, unknown>> | undefined;
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
              resolvedIxTime: Date.now(),
              result: result as any,
            },
          });

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
            const ixNow = Date.now();
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
                endIxTime: Date.now(),
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

  getStandings: publicProcedure
    .input(z.object({ seasonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const standings = await ctx.db.sportStanding.findMany({
          where: { seasonId: input.seasonId },
          include: {
            team: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
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
            homeTeam: { select: { id: true, name: true, shortName: true } },
            awayTeam: { select: { id: true, name: true, shortName: true } },
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
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch match details",
        });
      }
    }),

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
                raceIxTime: Date.now(),
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

                  const homeTeamModifiers = await getTeamModifiers(match.homeTeam, ctx.db, effectsMap);
                  const awayTeamModifiers = await getTeamModifiers(match.awayTeam, ctx.db, effectsMap);

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
                      resolvedIxTime: Date.now(),
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
                      resolvedIxTime: Date.now(),
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
                  const ixNow = Date.now();
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
            endIxTime: Date.now(),
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
            raceIxTime: Date.now(),
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

  upgradeStadium: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId },
        });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }
        await exchangeService.spend(
          ctx.user.id,
          1000,
          "ADMIN_ADJUSTMENT",
          `STADIUM_UPGRADE:${input.teamId}`,
          ctx.db as any
        );
        return (ctx.db as any).sportTeam.update({
          where: { id: input.teamId },
          data: { stadiumCapacity: { increment: 1000 } },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to upgrade stadium",
        });
      }
    }),

  setTicketPrice: protectedProcedure
    .input(z.object({ teamId: z.string(), price: z.number().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId },
        });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }
        return (ctx.db as any).sportTeam.update({
          where: { id: input.teamId },
          data: { ticketPrice: input.price },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to set ticket price",
        });
      }
    }),

  listPlayerForTransfer: protectedProcedure
    .input(z.object({ playerId: z.string(), price: z.number().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.playerId },
          include: { team: true },
        });
        if (!player) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        }
        if (player.team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this player" });
        }
        return await (ctx.db as any).sportTransferListing.upsert({
          where: { playerId: input.playerId },
          update: { price: input.price, status: "open", teamId: player.teamId },
          create: {
            playerId: input.playerId,
            teamId: player.teamId,
            price: input.price,
            status: "open",
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list player",
        });
      }
    }),

  placeTransferBid: protectedProcedure
    .input(z.object({ listingId: z.string(), amount: z.number().min(1), bidderTeamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const listing = await (ctx.db as any).sportTransferListing.findUnique({
          where: { id: input.listingId },
        });
        if (!listing || listing.status !== "open") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Listing not active" });
        }
        const bidderTeam = await ctx.db.sportTeam.findUnique({
          where: { id: input.bidderTeamId },
        });
        if (!bidderTeam || bidderTeam.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own the bidding team" });
        }
        await exchangeService.spend(
          ctx.user.id,
          input.amount,
          "SHARE_BUY",
          `TRANSFER_BID_ESCROW:${input.listingId}`,
          ctx.db as any
        );
        return await (ctx.db as any).sportTransferBid.create({
          data: {
            listingId: input.listingId,
            bidderTeamId: input.bidderTeamId,
            bidderUserId: ctx.user.id,
            amount: input.amount,
            status: "pending",
          },
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to place bid",
        });
      }
    }),

  respondToTransferBid: protectedProcedure
    .input(z.object({ bidId: z.string(), action: z.enum(["accept", "reject"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const bid = await (ctx.db as any).sportTransferBid.findUnique({
          where: { id: input.bidId },
          include: {
            listing: {
              include: {
                player: {
                  include: { team: true },
                },
              },
            },
          },
        });
        if (!bid || bid.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bid not active" });
        }
        const sellerTeam = bid.listing.player.team;
        if (sellerTeam.ownerUserId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not own this listing's player",
          });
        }
        if (input.action === "accept") {
          // Pay out seller
          await exchangeService.earn(
            ctx.user.id,
            bid.amount,
            "SHARE_SELL",
            `TRANSFER_ACCEPT:${bid.id}`,
            ctx.db as any
          );
          // Transfer player ownership
          await ctx.db.sportPlayer.update({
            where: { id: bid.listing.playerId },
            data: { teamId: bid.bidderTeamId },
          });
          // Update listing status
          await (ctx.db as any).sportTransferListing.update({
            where: { id: bid.listingId },
            data: { status: "completed" },
          });
          // Accept the bid
          await (ctx.db as any).sportTransferBid.update({
            where: { id: bid.id },
            data: { status: "accepted" },
          });
          // Reject other bids and refund escrow
          const otherBids = await (ctx.db as any).sportTransferBid.findMany({
            where: { listingId: bid.listingId, id: { not: bid.id }, status: "pending" },
          });
          for (const other of otherBids) {
            await exchangeService.earn(
              other.bidderUserId,
              other.amount,
              "ADMIN_ADJUSTMENT",
              `TRANSFER_BID_REFUND:${other.id}`,
              ctx.db as any
            );
            await (ctx.db as any).sportTransferBid.update({
              where: { id: other.id },
              data: { status: "rejected" },
            });
          }
          return { success: true, message: "Transfer completed successfully." };
        } else {
          // Reject bid and refund bidder
          await (ctx.db as any).sportTransferBid.update({
            where: { id: bid.id },
            data: { status: "rejected" },
          });
          await exchangeService.earn(
            bid.bidderUserId,
            bid.amount,
            "ADMIN_ADJUSTMENT",
            `TRANSFER_BID_REFUND:${bid.id}`,
            ctx.db as any
          );
          return { success: true, message: "Bid rejected and bidder refunded." };
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to respond to bid",
        });
      }
    }),

  getPlayerValuation: publicProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.playerId },
        });
        if (!player) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        }
        const ratings = (player.ratings as Record<string, any>) || {};
        const overall = ratings.overall || 50;
        const form = ratings.form || 50;
        const value = Math.max(100, Math.min(10000, overall * 50 * (1 + (form - 50) / 100)));
        return { valuation: Math.round(value) };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to calculate player value",
        });
      }
    }),

  getOpenTransferListings: publicProcedure.query(async ({ ctx }) => {
    try {
      return await (ctx.db as any).sportTransferListing.findMany({
        where: { status: "open" },
        include: {
          player: {
            include: { team: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch transfer listings",
      });
    }
  }),

  getTeamBids: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId, ownerUserId: ctx.user.id },
        });
        if (!team) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }
        const inboundBids = await (ctx.db as any).sportTransferBid.findMany({
          where: {
            listing: {
              teamId: input.teamId,
              status: "open",
            },
            status: "pending",
          },
          include: {
            listing: {
              include: {
                player: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        const outboundBids = await (ctx.db as any).sportTransferBid.findMany({
          where: {
            bidderTeamId: input.teamId,
          },
          include: {
            listing: {
              include: {
                player: {
                  include: {
                    team: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });
        return { inboundBids, outboundBids };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch team bids",
        });
      }
    }),

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
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Search failed" });
      }
    }),

  invokePatronSaint: protectedProcedure
    .input(z.object({ teamId: z.string(), saintName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId },
        });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }
        // Spend fee
        await exchangeService.spend(
          ctx.user.id,
          100,
          "CHARTER_FEE",
          `SAINT_INVOCATION:${input.teamId}:${input.saintName}`,
          ctx.db as any
        );

        // Update the team's saint
        await ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: { patronSaint: input.saintName } as any,
        });

        // Create storyteller effect targeting country
        if (team.nationId) {
          await ctx.db.storytellerEffect.create({
            data: {
              countryId: team.nationId,
              ixTimeTimestamp: new Date(),
              inputType: "sports_saint_blessing",
              value: 5.0,
              description: `The home crowd echoes the Invocation of ${input.saintName}. Blessings descend upon the pitch!`,
              isActive: true,
              duration: 1,
            },
          });
        }

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to invoke patron saint",
        });
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
});
