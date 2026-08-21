/**
 * Sports Leagues — CRUD & Entities Router
 */

import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  getPreset,
  generateTeamRoster,
  generateCoach,
  teamIndexHash,
  type SportPresetKey,
} from "~/lib/sports";
import { exchangeService } from "~/lib/vault/exchange-service";
import { isSystemOwner } from "~/lib/auth";

export const leaguesCrudRouter = createTRPCRouter({
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

        const spend = await exchangeService.spend(
          ctx.user.id,
          500,
          "CHARTER_FEE",
          `LEAGUE_CREATE:${input.name}`,
          ctx.db as any
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance to charter a league",
          });
        }

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
        if (league.createdByUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this league" });
        }

        // Only system owners can modify isCanonical
        const isCanonical =
          input.isCanonical !== undefined
            ? input.isCanonical && isSystemOwner(ctx.auth.userId)
            : league.isCanonical;

        return ctx.db.sportLeague.update({
          where: { id },
          data: {
            ...data,
            isCanonical,
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
        if (league.createdByUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this league" });
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
        const leagues = await ctx.db.sportLeague.findMany({
          where: {
            name: { contains: input.query, mode: "insensitive" },
          },
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
          leagues: leagues.map((l: any) => ({
            id: l.id,
            name: l.name,
            sportPreset: l.sportPreset,
          })),
        };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Search failed" });
      }
    }),

  transferTeam: protectedProcedure
    .input(z.object({ teamId: z.string(), targetLeagueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
        }

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
});
