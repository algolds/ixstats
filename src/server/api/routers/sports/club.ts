/**
 * MyLeague — Sports Router
 *
 * tRPC router for the IxStates sports & competition engine.
 * Manages leagues, teams, seasons, simulations, and historical records.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { exchangeService } from "~/lib/exchange-service";
import { IxTime } from "~/lib/ixtime";

// ─── Router ───────────────────────────────────────────────────────────────────

export const sportsClubRouter = createTRPCRouter({
  // ═══ League Management ══════════════════════════════════════════════════════

  // ═══ Team Management ═════════════════════════════════════════════════════════

  // ═══ Season & Simulation ════════════════════════════════════════════════════

  // ═══ History & Records ══════════════════════════════════════════════════════

  // ═══ MyClub ══════════════════════════════════════════════════════════════════

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

  setClubNotifications: protectedProcedure
    .input(z.object({ teamId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.db.sportTeam.findUnique({
        where: { id: input.teamId },
        select: { ownerUserId: true },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      if (team.ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this team" });
      }
      return ctx.db.sportTeam.update({
        where: { id: input.teamId },
        data: { notifyResults: input.enabled },
        select: { id: true, notifyResults: true },
      });
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
              ixTimeTimestamp: IxTime.timestampToDate(IxTime.getCurrentIxTime()),
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
});
