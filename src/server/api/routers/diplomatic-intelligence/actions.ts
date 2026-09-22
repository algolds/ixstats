import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

// Intelligence Classification Schema
// Diplomatic Intelligence Types
export const diplomaticIntelligenceActionsRouter = createTRPCRouter({
  // Get diplomatic intelligence briefing for a country

  // Get diplomatic network analysis

  // Get activity intelligence feed

  // Create diplomatic action
  createDiplomaticAction: protectedProcedure
    .input(
      z.object({
        targetCountryId: z.string(),
        actionType: z.enum(["follow", "message", "propose", "congratulate"]),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
      }

      if (!ctx.user?.countryId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Country context required" });
      }

      const action = await ctx.db.diplomaticAction.create({
        data: {
          fromCountryId: ctx.user.countryId,
          toCountryId: input.targetCountryId,
          actionType: input.actionType,
          description: input.message,
          status: "pending",
        },
      });

      return {
        ...action,
        timestamp: action.createdAt,
      };
    }),

  // Get strategic assessment (CONFIDENTIAL clearance only)
});
