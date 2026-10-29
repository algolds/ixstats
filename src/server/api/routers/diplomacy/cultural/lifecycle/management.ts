import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";
import { applyExchangeCancellation } from "~/lib/diplomacy/exchange-cancellation";

/** Exchanges the host may still edit. */
const EDITABLE_STATUSES = ["planning", "active"];

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

      // The host nation's owner (any nation they own), as when creating it.
      await assertCountryWriteAccess(ctx, exchange.hostCountryId);
      if (!EDITABLE_STATUSES.includes(exchange.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A cancelled or completed exchange can no longer be edited.",
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

      await assertCountryWriteAccess(ctx, exchange.hostCountryId);

      if (exchange.status !== "planning") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only exchanges in planning status can be cancelled",
        });
      }

      // Conditional, so two concurrent cancels apply the penalties once.
      const cancelled = await ctx.db.culturalExchange.updateMany({
        where: { id: input.exchangeId, status: "planning" },
        data: { status: "cancelled", updatedAt: new Date() },
      });
      if (cancelled.count !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only exchanges in planning status can be cancelled",
        });
      }

      const penalties = await applyExchangeCancellation(ctx.db, exchange);
      return { success: true, penalties };
    }),
});
