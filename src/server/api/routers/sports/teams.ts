/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/exchange-service";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { teamWageBill } from "~/lib/sports";

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
        wikiSlug: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;

        const team = await ctx.db.sportTeam.findUnique({ where: { id } });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
        if (team.ownerUserId !== ctx.user.id && !isSystemOwner(ctx.auth.userId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
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
    .input(
      z.object({
        teamId: z.string(),
        tacticalIntent: z.string(),
        attackFocus: z.number().min(0).max(100).optional(),
        teamIntensity: z.number().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const team = await ctx.db.sportTeam.findUnique({ where: { id: input.teamId } });
        if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        if (team.ownerUserId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this team" });
        }

        const lineup = (team.lineup as Record<string, any>) ?? {};
        const updatedLineup = {
          ...lineup,
          attackFocus:
            input.attackFocus !== undefined ? input.attackFocus : (lineup.attackFocus ?? 50),
          teamIntensity:
            input.teamIntensity !== undefined ? input.teamIntensity : (lineup.teamIntensity ?? 50),
        };

        return ctx.db.sportTeam.update({
          where: { id: input.teamId },
          data: {
            tacticalIntent: input.tacticalIntent,
            lineup: updatedLineup,
          },
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

        await exchangeService.spend(
          ctx.user.id,
          25,
          "TRAINING_FEE",
          `PLAYER:${input.playerId}`,
          ctx.db as any
        );

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

        await exchangeService.spend(
          ctx.user.id,
          100,
          "TEAM_TRAINING",
          `TEAM:${input.teamId}`,
          ctx.db as any
        );

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

      const teamsWithDetails = await Promise.all(
        teams.map(async (t) => {
          const activeSeason = await ctx.db.sportSeason.findFirst({
            where: { leagueId: t.leagueId, status: "in_progress" },
            select: { id: true, seasonNumber: true },
          });

          let currentStandings = null;
          if (activeSeason) {
            const allStandings = await ctx.db.sportStanding.findMany({
              where: { seasonId: activeSeason.id },
              orderBy: [{ points: "desc" }, { pointsFor: "desc" }, { pointsAgainst: "asc" }],
              select: {
                teamId: true,
                wins: true,
                losses: true,
                draws: true,
                points: true,
                rank: true,
                id: true,
                seasonId: true,
              },
            });

            const index = allStandings.findIndex((s) => s.teamId === t.id);
            if (index !== -1) {
              const standing = allStandings[index]!;
              currentStandings = {
                ...standing,
                position: index + 1,
                rank: standing.rank ?? index + 1,
              };
            }
          }

          const championships = await ctx.db.sportSeason.count({
            where: { championTeamId: t.id, status: "completed" },
          });

          return {
            ...t,
            activeSeason,
            currentStandings,
            championships,
          };
        })
      );

      return teamsWithDetails;
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
            league: { select: { id: true, name: true, sportPreset: true, archetype: true } },
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
          wageBill: teamWageBill(team.players as any[]),
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
