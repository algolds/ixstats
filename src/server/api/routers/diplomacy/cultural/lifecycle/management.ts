import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const diplomaticCulturalLifecycleManagementRouter = createTRPCRouter({
  // Update cultural exchange (only title and description)
  updateCulturalExchange: protectedProcedure
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
  cancelCulturalExchange: protectedProcedure
    .input(
      z.object({
        exchangeId: z.string(),
        hostCountryId: z.string(),
      })
    )
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

      // Calculate penalties based on participants and status
      const participantCount = exchange.participatingCountries.length;
      const baseReputationLoss = -10;
      const perParticipantPenalty = -5;
      const reputationLoss = baseReputationLoss + participantCount * perParticipantPenalty;

      // Relationship penalty for each participant
      const relationshipPenalty = Math.min(20, 5 + participantCount * 3);

      // Update exchange status to cancelled
      await ctx.db.culturalExchange.update({
        where: { id: input.exchangeId },
        data: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      });

      // Apply relationship penalties to all participating countries
      for (const participant of exchange.participatingCountries) {
        try {
          // Find or create relationship
          const relationship = await ctx.db.diplomaticRelation.findFirst({
            where: {
              OR: [
                { country1: input.hostCountryId, country2: participant.countryId },
                { country1: participant.countryId, country2: input.hostCountryId },
              ],
            },
          });

          if (relationship) {
            // Apply penalty
            await ctx.db.diplomaticRelation.update({
              where: { id: relationship.id },
              data: {
                strength: Math.max(0, relationship.strength - relationshipPenalty),
                culturalExchange:
                  relationship.culturalExchange === "High"
                    ? "Medium"
                    : relationship.culturalExchange,
                updatedAt: new Date(),
              },
            });
          }
        } catch (error) {
          console.error(`Failed to apply penalty to ${participant.countryId}:`, error);
        }
      }

      // Send notifications to participants
      for (const participant of exchange.participatingCountries) {
        try {
          // Note: Notification system would go here
          console.log(`Should notify ${participant.countryId} about cancellation`);
        } catch (error) {
          console.error(`Failed to notify ${participant.countryId}:`, error);
        }
      }

      return {
        success: true,
        penalties: {
          reputationLoss,
          relationshipPenalty,
          affectedCountries: participantCount,
        },
      };
    }),
});
