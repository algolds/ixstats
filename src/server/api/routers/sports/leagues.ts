/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  adminProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllPresets,
  getPreset,
  generateTeamRoster,
  generateCoach,
  generateSchedule,
  matchIntervalMs,
  raceIntervalMs,
  teamIndexHash,
  type SportPresetKey,
} from "~/lib/sports";
import { exchangeService } from "~/lib/exchange-service";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { IxTime } from "~/lib/ixtime";
import { generateMatchReport, generateMatchPreview } from "~/lib/sports/commentary/narrator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recompute a season's standings from scratch off completed matches (idempotent). */
async function recalculateStandings(db: any, seasonId: string) {
  const teams = await db.sportTeamSeason.findMany({
    where: { seasonId },
    select: { teamId: true },
  });

  const matches = await db.sportMatch.findMany({
    where: { seasonId, status: "completed" },
  });

  const statsMap: Record<
    string,
    {
      wins: number;
      losses: number;
      draws: number;
      points: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  > = {};
  for (const t of teams) {
    statsMap[t.teamId] = {
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
  }

  for (const m of matches) {
    const homeScore = m.homeScore ?? 0;
    const awayScore = m.awayScore ?? 0;

    if (!statsMap[m.homeTeamId]) {
      statsMap[m.homeTeamId] = {
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    }
    if (!statsMap[m.awayTeamId]) {
      statsMap[m.awayTeamId] = {
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
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
            homeTeam: {
              select: {
                id: true,
                name: true,
                shortName: true,
                color: true,
                logo: true,
                wikiSlug: true,
              },
            },
            awayTeam: {
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
        if (!targetLeague)
          throw new TRPCError({ code: "NOT_FOUND", message: "Target league not found" });

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
                raceIxTime:
                  startIxTime +
                  (rRec.raceNumber as number) * raceIntervalMs(season.league.settings),
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
                scheduledIxTime:
                  startIxTime +
                  ((mRec.matchDay as number) ?? 1) * matchIntervalMs(season.league.settings),
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
    .input(
      z.object({
        matchId: z.string(),
        config: z
          .object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiUrl: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            reasoning: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const match = await ctx.db.sportMatch.findUnique({
          where: { id: input.matchId },
          include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            playerStats: {
              include: {
                player: { select: { firstName: true, lastName: true } },
              },
            },
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

        const stats = match.matchStats as any;
        const events = stats?.trace ?? [];

        const report = await generateMatchReport({
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          homeScore: match.homeScore ?? 0,
          awayScore: match.awayScore ?? 0,
          sport: match.season.league.sportPreset,
          events: events,
          playerStats: match.playerStats as any[],
          config: input.config,
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
        standingsContext: z.string().optional(),
        config: z
          .object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiUrl: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            reasoning: z.boolean().optional(),
          })
          .optional(),
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
          input.standingsContext,
          input.config
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

  getAdminGlobalStats: protectedProcedure.query(async ({ ctx }) => {
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
    } catch (_error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch admin global stats",
      });
    }
  }),

  reseedSportsData: adminProcedure
    .input(
      z.object({
        clearExisting: z.boolean().default(true),
        seedCaphirianSoccer: z.boolean().default(true),
        seedYonderreSoccer: z.boolean().default(true),
        seedOHLHockey: z.boolean().default(true),
        seedF1: z.boolean().default(true),
        seedBoxing: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const prisma = ctx.db;
        const userId = ctx.user.id;

        // Find a fallback country if none exists
        const firstCountry = await prisma.country.findFirst({ select: { id: true } });
        const countryId = firstCountry?.id ?? "unknown";

        let deletedCount = 0;
        if (input.clearExisting) {
          // Find canonical leagues to delete
          const canonicalLeagues = await prisma.sportLeague.findMany({
            where: { isCanonical: true },
            select: { id: true },
          });

          if (canonicalLeagues.length > 0) {
            const leagueIds = canonicalLeagues.map((l) => l.id);
            // Cascade delete will automatically clean up associated records
            const deleted = await prisma.sportLeague.deleteMany({
              where: { id: { in: leagueIds } },
            });
            deletedCount = deleted.count;
          }
        }

        const { seedSportsLeagues } = await import("~/lib/demo-seed/seed-sports");
        const seededCount = await seedSportsLeagues(prisma, countryId, userId, {
          seedCaphirianSoccer: input.seedCaphirianSoccer,
          seedYonderreSoccer: input.seedYonderreSoccer,
          seedOHLHockey: input.seedOHLHockey,
          seedF1: input.seedF1,
          seedBoxing: input.seedBoxing,
        });

        // Invalidate sports tRPC query caches
        try {
          const { invalidateCache } = await import("~/lib/trpc-cache");
          await invalidateCache(["sports."]);
        } catch (cacheErr) {
          console.warn("Failed to invalidate sports cache:", cacheErr);
        }

        return {
          success: true,
          deletedCount,
          seededCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to re-seed sports data",
        });
      }
    }),

  testLLMNarrator: protectedProcedure
    .input(
      z.object({
        sport: z.string(),
        events: z.array(z.string()),
        config: z
          .object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiUrl: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            reasoning: z.boolean().optional(),
          })
          .optional(),
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
        const outputs = await narrateEvents(mappedEvents, {
          sport: input.sport,
          config: input.config,
        });
        return { outputs };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to run LLM narrator test",
        });
      }
    }),

  generateMatchCommentary: publicProcedure
    .input(
      z.object({
        matchId: z.string(),
        config: z
          .object({
            provider: z.string().optional(),
            apiKey: z.string().optional(),
            apiUrl: z.string().optional(),
            modelName: z.string().optional(),
            temperature: z.number().optional(),
            reasoning: z.boolean().optional(),
          })
          .optional(),
      })
    )
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
          config: input.config,
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

  saveGlobalAINarratorSettings: adminProcedure
    .input(
      z.object({
        provider: z.string().optional(),
        apiKey: z.string().optional(),
        apiUrl: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.number().optional(),
        reasoning: z.boolean().optional(),
        applyGlobally: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const keys = [
          { key: "sports:llm:provider", value: input.provider || "" },
          { key: "sports:llm:apiKey", value: input.apiKey || "" },
          { key: "sports:llm:apiUrl", value: input.apiUrl || "" },
          { key: "sports:llm:modelName", value: input.modelName || "" },
          {
            key: "sports:llm:temperature",
            value: input.temperature !== undefined ? String(input.temperature) : "",
          },
          { key: "sports:llm:applyGlobally", value: String(input.applyGlobally) },
          { key: "sports:llm:reasoning", value: String(input.reasoning === true) },
        ];

        for (const item of keys) {
          await ctx.db.systemConfig.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: { key: item.key, value: item.value, description: "AI Narrator global setting" },
          });
        }

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to save global AI settings",
        });
      }
    }),

  getGlobalAINarratorSettings: adminProcedure.query(async ({ ctx }) => {
    try {
      const configs = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "sports:llm:provider",
              "sports:llm:apiKey",
              "sports:llm:apiUrl",
              "sports:llm:modelName",
              "sports:llm:temperature",
              "sports:llm:applyGlobally",
              "sports:llm:reasoning",
            ],
          },
        },
      });

      return {
        provider: configs.find((c) => c.key === "sports:llm:provider")?.value || undefined,
        apiKey: configs.find((c) => c.key === "sports:llm:apiKey")?.value || undefined,
        apiUrl: configs.find((c) => c.key === "sports:llm:apiUrl")?.value || undefined,
        modelName: configs.find((c) => c.key === "sports:llm:modelName")?.value || undefined,
        temperature: configs.find((c) => c.key === "sports:llm:temperature")?.value
          ? parseFloat(configs.find((c) => c.key === "sports:llm:temperature")!.value)
          : undefined,
        applyGlobally: configs.find((c) => c.key === "sports:llm:applyGlobally")?.value === "true",
        reasoning: configs.find((c) => c.key === "sports:llm:reasoning")?.value === "true",
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to load global AI settings",
      });
    }
  }),

  // Which league is pinned as the lobby hero. Stored in systemConfig (no schema column).
  getFeaturedLeagueId: publicProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.systemConfig.findUnique({
      where: { key: "sports:featuredLeagueId" },
    });
    return row?.value || null;
  }),

  setFeaturedLeague: adminProcedure
    .input(z.object({ leagueId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.leagueId) {
          const league = await ctx.db.sportLeague.findUnique({ where: { id: input.leagueId } });
          if (!league) {
            throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
          }
        }
        await ctx.db.systemConfig.upsert({
          where: { key: "sports:featuredLeagueId" },
          update: { value: input.leagueId ?? "" },
          create: {
            key: "sports:featuredLeagueId",
            value: input.leagueId ?? "",
            description: "MyLeague lobby featured (hero) league",
          },
        });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to set featured league",
        });
      }
    }),

  clearSportsCache: adminProcedure.mutation(async () => {
    try {
      const { invalidateCache } = await import("~/lib/trpc-cache");
      await invalidateCache(["sports."]);
      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to clear sports cache",
      });
    }
  }),
});
