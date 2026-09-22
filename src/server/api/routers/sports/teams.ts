/**
 * MyLeague — Sports Teams Router
 *
 * tRPC router for team directory, profiles, claims, and edits.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/vault/exchange-service";
import { isSystemOwner } from "~/lib/auth";

export const sportsTeamsRouter = createTRPCRouter({
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

        const team = await ctx.db.sportTeam.findUnique({
          where: { id },
          include: { league: { select: { createdByUserId: true } } },
        });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }
        // Team owner, the league creator, or a system admin may edit a team.
        const canEdit =
          team.ownerUserId === ctx.user.id ||
          team.league?.createdByUserId === ctx.user.id ||
          isSystemOwner(ctx.auth.userId);
        if (!canEdit) {
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
        const team = await ctx.db.sportTeam.findUnique({
          where: { id: input.teamId },
          include: { league: true },
        });
        if (!team) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
        }

        if (team.ownerUserId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Team is already claimed",
          });
        }

        // Fetch user's SPEND_BOOST transactions to verify purchased store upgrades
        const userTxs = await ctx.db.vaultTransaction.findMany({
          where: {
            vault: { userId: ctx.user.id },
            type: "SPEND_BOOST",
          },
        });

        const checkUpgradeOwned = (upgradeId: string): boolean => {
          return userTxs.some((tx) => {
            let meta = tx.metadata;
            if (typeof meta === "string") {
              try {
                meta = JSON.parse(meta);
              } catch {}
            }
            return meta && typeof meta === "object" && (meta as { itemId?: string }).itemId === upgradeId;
          });
        };

        // 1. Verify MyClub Team License
        const ownsClubLicense = checkUpgradeOwned("upgrade_myclub_license");
        if (!ownsClubLicense) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You must purchase the MyClub Team License Token (5,000 Vault Credits) from the Vault Store to claim a team.",
          });
        }

        // 2. Verify MyLeague Franchise Pass for canonical leagues
        if (team.league?.isCanonical) {
          const ownsFranchisePass = checkUpgradeOwned("upgrade_myleague_franchise");
          if (!ownsFranchisePass) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "You must purchase the MyLeague Franchise Pass (2,500 Vault Credits) from the Vault Store to claim a team in an official canonical league.",
            });
          }
        }

        const spend = await exchangeService.spend(
          ctx.user.id,
          50,
          "CHARTER_FEE",
          `TEAM_CLAIM:${input.teamId}`,
          ctx.db
        );
        if (!spend.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: spend.message ?? "Insufficient balance to claim team",
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

  getPlayer: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const player = await ctx.db.sportPlayer.findUnique({
          where: { id: input.id },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                color: true,
                logo: true,
                leagueId: true,
                league: { select: { id: true, name: true, sportPreset: true } },
              },
            },
          },
        });

        if (!player) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Player not found" });
        }

        return player;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch athlete",
        });
      }
    }),
});

