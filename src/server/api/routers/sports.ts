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
  type SportPresetKey,
  type ArchetypeType,
  type TeamRatingVector,
} from "~/lib/sports";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function simpleHash(seasonId: string, matchDay: number, matchIndex: number): number {
  return (
    seasonId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 31 +
    matchDay * 7 +
    matchIndex
  );
}

function teamIndexHash(leagueId: string, teamIndex: number, playerIndex: number): number {
  return (
    leagueId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 17 +
    teamIndex * 13 +
    playerIndex * 3
  );
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
  players: Array<{ isActive: boolean; ratings: Record<string, unknown> | null; careerStage: string }>,
  coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }>,
): TeamRatingVector {
  const activePlayers = players.filter((p) => p.isActive && p.ratings);
  const ratingSums: Record<string, number> = {};
  const ratingCounts: Record<string, number> = {};

  for (const player of activePlayers) {
    const mult = careerStageMultiplier[player.careerStage] ?? 0.8;
    const ratings = player.ratings as Record<string, number>;
    for (const [key, value] of Object.entries(ratings)) {
      if (typeof value === "number") {
        ratingSums[key] = (ratingSums[key] ?? 0) + value * mult;
        ratingCounts[key] = (ratingCounts[key] ?? 0) + 1;
      }
    }
  }

  const avg: Record<string, number> = {};
  for (const key of Object.keys(ratingSums)) {
    avg[key] = ratingSums[key] / (ratingCounts[key] || 1);
  }

  for (const coach of coaches) {
    if (coach.isActive && coach.ratings) {
      const cRatings = coach.ratings as Record<string, number>;
      for (const [key, value] of Object.entries(cRatings)) {
        if (typeof value === "number") {
          avg[key] = (avg[key] ?? 0) + value * 0.3;
        }
      }
    }
  }

  const defaultVector: TeamRatingVector = {
    overall: 60,
    offense: 60,
    defense: 60,
    form: 60,
    depth: 60,
    coaching: 60,
  };

  const finalVector: TeamRatingVector = {
    overall: typeof avg.overall === "number" && !isNaN(avg.overall) ? avg.overall : defaultVector.overall,
    offense: typeof avg.offense === "number" && !isNaN(avg.offense) ? avg.offense : defaultVector.offense,
    defense: typeof avg.defense === "number" && !isNaN(avg.defense) ? avg.defense : defaultVector.defense,
    form: typeof avg.form === "number" && !isNaN(avg.form) ? avg.form : defaultVector.form,
    depth: typeof avg.depth === "number" && !isNaN(avg.depth) ? avg.depth : defaultVector.depth,
    coaching: typeof avg.coaching === "number" && !isNaN(avg.coaching) ? avg.coaching : defaultVector.coaching,
  };

  return finalVector;
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
      }),
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

  getLeague: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: input.id },
          include: {
            teams: { orderBy: { name: "asc" } },
            seasons: {
              include: { champion: { select: { id: true, name: true } } },
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
      }),
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
                ratings: p.ratings as any ?? {},
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
        settings: z.record(z.string(), z.unknown()).optional(),
      }),
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
      }),
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

  getTeam: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
        logo: z.string().optional(),
      }),
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
            raceCount: (league.settings as Record<string, unknown> | null)?.raceCount as number | undefined,
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
          const pairs: Array<[typeof league.teams[0], typeof league.teams[0]]> = [];
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

  getSeason: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        const matches = await ctx.db.sportMatch.findMany({
          where: { seasonId: input.seasonId, matchDay: input.matchDay, status: "scheduled" },
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No scheduled matches for this match day",
          });
        }

        const results: Array<Record<string, unknown>> = [];

        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const seed = simpleHash(input.seasonId, input.matchDay, i);

          const homeRatings = computeTeamRatingVector(
            (match as unknown as { homeTeam: { players: Array<{ isActive: boolean; ratings: Record<string, unknown> | null; careerStage: string }>; coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).homeTeam.players,
            (match as unknown as { homeTeam: { coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).homeTeam.coaches,
          );
          const awayRatings = computeTeamRatingVector(
            (match as unknown as { awayTeam: { players: Array<{ isActive: boolean; ratings: Record<string, unknown> | null; careerStage: string }>; coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).awayTeam.players,
            (match as unknown as { awayTeam: { coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).awayTeam.coaches,
          );

          const result = resolveMatch({
            sport: season.league.sportPreset,
            homeTeam: homeRatings,
            awayTeam: awayRatings,
            archetype: season.league.archetype,
            seed,
          });

          const resRec = result as any;
          const homeScore = (resRec.homeScore as number) ?? 0;
          const awayScore = (resRec.awayScore as number) ?? 0;
          const homeRatingDelta = (resRec.homeRatingDelta as number) ?? 0;
          const awayRatingDelta = (resRec.awayRatingDelta as number) ?? 0;

          const homeRatingAfter = {
            ...homeRatings,
            overall: Math.round(( (homeRatings.overall as number) + homeRatingDelta) * 100) / 100,
          };
          const awayRatingAfter = {
            ...awayRatings,
            overall: Math.round(( (awayRatings.overall as number) + awayRatingDelta) * 100) / 100,
          };

          const winner =
            homeScore > awayScore ? match.homeTeamId : awayScore > homeScore ? match.awayTeamId : null;

          const status = winner ? (homeScore > awayScore ? "home_win" : "away_win") : "draw";

          await ctx.db.sportMatch.update({
            where: { id: match.id },
            data: {
              homeScore,
              awayScore,
              status: "completed",
              resolvedIxTime: Date.now(),
              matchStats: resRec.matchStats as any,
              homeRatingBefore: { ...homeRatings },
              awayRatingBefore: { ...awayRatings },
              homeRatingAfter: { ...homeRatingAfter },
              awayRatingAfter: { ...awayRatingAfter },
            },
          });

          // Update team season rating vectors
          await ctx.db.sportTeamSeason.updateMany({
            where: { seasonId: input.seasonId, teamId: match.homeTeamId },
            data: { ratingVector: { ...homeRatingAfter } },
          });
          await ctx.db.sportTeamSeason.updateMany({
            where: { seasonId: input.seasonId, teamId: match.awayTeamId },
            data: { ratingVector: { ...awayRatingAfter } },
          });

          // Update standings
          if (status === "home_win") {
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
          } else if (status === "away_win") {
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
            // Draw
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

          // Create match stats for key player performances
          const playerStats = resRec.playerStats as Array<Record<string, unknown>> | undefined;
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
          });
        }

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
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        // Find bracket matches for this round that are still scheduled
        const bracketMatches = await ctx.db.sportBracket.findMany({
          where: { seasonId: input.seasonId, round: input.round, status: "scheduled" },
        });

        if (bracketMatches.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No scheduled bracket matches for this round",
          });
        }

        const results: Array<Record<string, unknown>> = [];

        for (let i = 0; i < bracketMatches.length; i++) {
          const bm = bracketMatches[i];
          const seed = simpleHash(input.seasonId, input.round * 100, i);

          // Get both teams (fighters) with their rosters
          const fighter1Team = await ctx.db.sportTeam.findUnique({
            where: { id: bm.fighter1Id },
            include: {
              players: { where: { isActive: true } },
              coaches: { where: { isActive: true } },
            },
          });
          const fighter2Team = await ctx.db.sportTeam.findUnique({
            where: { id: bm.fighter2Id },
            include: {
              players: { where: { isActive: true } },
              coaches: { where: { isActive: true } },
            },
          });

          if (!fighter1Team || !fighter2Team) continue;

          const f1Ratings = computeTeamRatingVector(fighter1Team.players as any[], fighter1Team.coaches as any[]);
          const f2Ratings = computeTeamRatingVector(fighter2Team.players as any[], fighter2Team.coaches as any[]);

          const result = resolveMatch({
            sport: season.league.sportPreset,
            homeTeam: f1Ratings,
            awayTeam: f2Ratings,
            archetype: "bracket",
            seed,
          });

          const resRec = result as any;
          const f1Score = (resRec.homeScore as number) ?? 0;
          const f2Score = (resRec.awayScore as number) ?? 0;
          const winnerId = f1Score > f2Score ? bm.fighter1Id : bm.fighter2Id;

          await ctx.db.sportBracket.update({
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
        const stillScheduled = await ctx.db.sportBracket.count({
          where: { seasonId: input.seasonId, round: input.round, status: "scheduled" },
        });

        if (stillScheduled === 0) {
          const completedBrackets = await ctx.db.sportBracket.findMany({
            where: { seasonId: input.seasonId, round: input.round, status: "completed" },
            select: { winnerId: true },
          });

          const winners = completedBrackets.map((b) => b.winnerId).filter(Boolean) as string[];

          if (winners.length >= 2) {
            const nextRound = input.round + 1;
            const ixNow = Date.now();
            const pow2 = Math.pow(2, Math.ceil(Math.log2(winners.length)));
            const half = pow2 / 2;
            for (let i = 0; i < half; i++) {
              const a = i < winners.length ? winners[i]! : null;
              const b = (pow2 - 1 - i) < winners.length ? winners[pow2 - 1 - i]! : null;
              if (a && b) {
                await ctx.db.sportBracket.create({
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
            await ctx.db.sportSeason.update({
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

  simulateFullSeason: protectedProcedure
    .input(z.object({ seasonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const season = await ctx.db.sportSeason.findUnique({
          where: { id: input.seasonId },
          include: { league: true },
        });

        if (!season) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
        }

        if (season.league.archetype === "circuit") {
          // Simulate all remaining races
          const races = await ctx.db.sportRace.findMany({
            where: { seasonId: input.seasonId, status: { in: ["upcoming", "qualifying_complete"] } },
            orderBy: { raceNumber: "asc" },
          });

          // Fetch all drivers for the season's teams
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

          for (const race of races) {
            const raceResult = resolveRace({
              drivers: allDrivers,
              seed: simpleHash(input.seasonId, race.raceNumber, 0),
              isWet: false,
            });

            await ctx.db.sportRace.update({
              where: { id: race.id },
              data: {
                grid: allDrivers.map((d, idx) => ({ driverId: d.driverId, teamId: d.teamId, gridPosition: idx + 1 })) as any,
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
          }
        } else if (season.league.archetype === "bracket") {
          // Simulate all bracket rounds iteratively
          let currentRound = 1;
          let hasMoreRounds = true;

          while (hasMoreRounds) {
            const bracketMatches = await ctx.db.sportBracket.findMany({
              where: { seasonId: input.seasonId, round: currentRound, status: "scheduled" },
            });

            if (bracketMatches.length === 0) {
              const completedInRound = await ctx.db.sportBracket.count({
                where: { seasonId: input.seasonId, round: currentRound, status: "completed" },
              });
              if (completedInRound === 0) {
                hasMoreRounds = false;
                break;
              }
            } else {
              for (let i = 0; i < bracketMatches.length; i++) {
                const bm = bracketMatches[i];
                const seed = simpleHash(input.seasonId, currentRound * 100, i);

                const f1 = await ctx.db.sportTeam.findUnique({
                  where: { id: bm.fighter1Id },
                  include: {
                    players: { where: { isActive: true } },
                    coaches: { where: { isActive: true } },
                  },
                });
                const f2 = await ctx.db.sportTeam.findUnique({
                  where: { id: bm.fighter2Id },
                  include: {
                    players: { where: { isActive: true } },
                    coaches: { where: { isActive: true } },
                  },
                });

                if (!f1 || !f2) continue;

                const f1ratings = computeTeamRatingVector(f1.players as any[], f1.coaches as any[]);
                const f2ratings = computeTeamRatingVector(f2.players as any[], f2.coaches as any[]);

                const result = resolveMatch({
                  sport: season.league.sportPreset,
                  homeTeam: f1ratings,
                  awayTeam: f2ratings,
                  archetype: "bracket",
                  seed,
                });
                const resRec = result as any;
                const f1Score = (resRec.homeScore as number) ?? 0;
                const f2Score = (resRec.awayScore as number) ?? 0;
                const winnerId = f1Score > f2Score ? bm.fighter1Id : bm.fighter2Id;

                await ctx.db.sportBracket.update({
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

            const completedBrackets = await ctx.db.sportBracket.findMany({
              where: { seasonId: input.seasonId, round: currentRound, status: "completed" },
              select: { winnerId: true },
            });

            const winners = completedBrackets.map((b) => b.winnerId).filter(Boolean) as string[];

            if (winners.length >= 2) {
              const nextRound = currentRound + 1;
              const nextRoundCount = await ctx.db.sportBracket.count({
                where: { seasonId: input.seasonId, round: nextRound },
              });

              if (nextRoundCount === 0) {
                const ixNow = Date.now();
                const pow2 = Math.pow(2, Math.ceil(Math.log2(winners.length)));
                const half = pow2 / 2;
                for (let i = 0; i < half; i++) {
                  const a = i < winners.length ? winners[i]! : null;
                  const b = (pow2 - 1 - i) < winners.length ? winners[pow2 - 1 - i]! : null;
                  if (a && b) {
                    await ctx.db.sportBracket.create({
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
              }
              currentRound = nextRound;
            } else {
              hasMoreRounds = false;
            }
          }
        } else {
          // League / division_conference: simulate all remaining match days
          const maxMatchDay = await ctx.db.sportMatch.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: { matchDay: "desc" },
            select: { matchDay: true },
          });

          if (maxMatchDay) {
            for (let matchDay = 1; matchDay <= maxMatchDay.matchDay; matchDay++) {
              const pending = await ctx.db.sportMatch.findFirst({
                where: { seasonId: input.seasonId, matchDay, status: "scheduled" },
              });
              if (!pending) continue;

              const matches = await ctx.db.sportMatch.findMany({
                where: { seasonId: input.seasonId, matchDay, status: "scheduled" },
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

              for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const seed = simpleHash(input.seasonId, matchDay, i);

                const homeRatings = computeTeamRatingVector(
                  (match as unknown as { homeTeam: { players: Array<{ isActive: boolean; ratings: Record<string, unknown> | null; careerStage: string }>; coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).homeTeam.players,
                  (match as unknown as { homeTeam: { coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).homeTeam.coaches,
                );
                const awayRatings = computeTeamRatingVector(
                  (match as unknown as { awayTeam: { players: Array<{ isActive: boolean; ratings: Record<string, unknown> | null; careerStage: string }>; coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).awayTeam.players,
                  (match as unknown as { awayTeam: { coaches: Array<{ isActive: boolean; ratings: Record<string, unknown> | null }> } }).awayTeam.coaches,
                );

                const result = resolveMatch({
                  sport: season.league.sportPreset,
                  homeTeam: homeRatings,
                  awayTeam: awayRatings,
                  archetype: season.league.archetype,
                  seed,
                });
                const resRec = result as any;
                const homeScore = (resRec.homeScore as number) ?? 0;
                const awayScore = (resRec.awayScore as number) ?? 0;

                const status =
                  homeScore > awayScore
                    ? "home_win"
                    : awayScore > homeScore
                      ? "away_win"
                      : "draw";

                const homeRatingDelta = (resRec.homeRatingDelta as number) ?? 0;
                const awayRatingDelta = (resRec.awayRatingDelta as number) ?? 0;

                const homeRatingAfter = {
                  ...homeRatings,
                  overall: Math.round(( (homeRatings.overall as number) + homeRatingDelta) * 100) / 100,
                };
                const awayRatingAfter = {
                  ...awayRatings,
                  overall: Math.round(( (awayRatings.overall as number) + awayRatingDelta) * 100) / 100,
                };

                await ctx.db.sportMatch.update({
                  where: { id: match.id },
                  data: {
                    homeScore,
                    awayScore,
                    status: "completed",
                    resolvedIxTime: Date.now(),
                    matchStats: resRec.matchStats as any,
                    homeRatingBefore: { ...homeRatings },
                    awayRatingBefore: { ...awayRatings },
                    homeRatingAfter: { ...homeRatingAfter },
                    awayRatingAfter: { ...awayRatingAfter },
                  },
                });

                // Update team season rating vectors
                await ctx.db.sportTeamSeason.updateMany({
                  where: { seasonId: input.seasonId, teamId: match.homeTeamId },
                  data: { ratingVector: { ...homeRatingAfter } },
                });
                await ctx.db.sportTeamSeason.updateMany({
                  where: { seasonId: input.seasonId, teamId: match.awayTeamId },
                  data: { ratingVector: { ...awayRatingAfter } },
                });

                // Create match stats for key player performances
                const playerStats = resRec.playerStats as Array<Record<string, unknown>> | undefined;
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

                // Update standings
                if (status === "home_win") {
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
                } else if (status === "away_win") {
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
              }
            }
          }
        }

        // Determine champion
        const league = await ctx.db.sportLeague.findUnique({
          where: { id: season.leagueId },
          include: {
            teams: { select: { id: true, name: true } },
          },
        });

        let championTeamId: string | null = null;

        if (season.league.archetype === "bracket") {
          // Winner of the final round
          const finalRound = await ctx.db.sportBracket.findFirst({
            where: { seasonId: input.seasonId },
            orderBy: { round: "desc" },
          });
          championTeamId = finalRound?.winnerId ?? null;
        } else if (season.league.archetype === "circuit") {
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

        await ctx.db.sportSeason.update({
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
            grid: allDrivers.map((d, idx) => ({ driverId: d.driverId, teamId: d.teamId, gridPosition: idx + 1 })) as any,
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
            season: { select: { id: true, seasonNumber: true, status: true, championTeamId: true } },
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
          }),
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

          const mostWins = Object.values(teamWins).sort((a, b) => b.wins - a.wins).slice(0, 5);

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
            totalSeasons: standings.length > 0
              ? new Set(standings.map((s) => s.seasonId)).size
              : 0,
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
        }),
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
