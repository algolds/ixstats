import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { applyExchangeCancellation } from "~/lib/diplomacy/exchange-cancellation";

export const diplomaticCulturalLifecycleManagementRouter = createTRPCRouter({
  // Update cultural exchange (only title and description)
  updateCulturalExchange: rateLimitedMutationProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        title: z.string().min(1).max(100),
        description: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exchange not found",
        });
      }

      if (!ctx.user?.countryId || exchange.hostCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the host country can edit this exchange",
        });
      }

      // Update exchange
      const updated = await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: {
          title: input.title,
          description: input.description,
          updatedAt: new Date(),
        },
      });

      return updated;
    }),

  // Cancel cultural exchange (with diplomatic penalties)
  cancelCulturalExchange: rateLimitedMutationProcedure
    .input(z.object({ exchangeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const exchange = await ctx.db.culturalExchange.findUnique({
        where: { id: input.exchangeId },
        include: {
          participatingCountries: true,
        },
      });

      if (!exchange) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Exchange not found",
        });
      }

      if (!ctx.user?.countryId || exchange.hostCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the host country can cancel this exchange",
        });
      }

      if (exchange.status !== "planning") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only exchanges in planning status can be cancelled",
        });
      }

      await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: { status: "cancelled", updatedAt: new Date() },
      });

      const penalties = await applyExchangeCancellation(ctx.db, exchange);
      return { success: true, penalties };
    }),
});
