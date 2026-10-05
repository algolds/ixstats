import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";

export const diplomaticEmbassiesLifecycleStatusRouter = createTRPCRouter({
  /**
   * Close an embassy (soft delete - sets status to 'closed')
   * Applies diplomatic penalties for closing active embassies
   */
  closeEmbassy: rateLimitedMutationProcedure
    .input(
      z.object({
        embassyId: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to close embassies.",
        });
      }

      // Verify embassy exists and user owns it
      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          hostCountry: { select: { name: true } },
          guestCountry: { select: { name: true } },
        },
      });

      if (!embassy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
      }

      if (embassy.guestCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only close your own embassies.",
        });
      }

      // Calculate diplomatic penalties for closing active embassy
      const penalties = {
        relationshipPenalty: 0,
        reputationLoss: 0,
        influenceLoss: 0,
      };

      if (embassy.status === "active") {
        penalties.relationshipPenalty = -15; // -15% relationship strength
        penalties.reputationLoss = -10; // -10 reputation points
        penalties.influenceLoss = embassy.influence * 0.5; // Lose 50% of embassy influence
      }

      // Close the embassy
      const closedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          status: "closed",
          influence: { decrement: penalties.influenceLoss },
          reputation: { decrement: penalties.reputationLoss },
        },
      });

      // Apply relationship penalty
      if (penalties.relationshipPenalty < 0) {
        const relation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: embassy.guestCountryId, country2: embassy.hostCountryId },
              { country1: embassy.hostCountryId, country2: embassy.guestCountryId },
            ],
          },
        });

        if (relation) {
          await ctx.db.diplomaticRelation.update({
            where: { id: relation.id },
            data: {
              strength: { increment: penalties.relationshipPenalty },
            },
          });
        }
      }

      // Record diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_closed",
          title: "Embassy Closed",
          description: input.reason || `${embassy.name} has been closed`,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
        },
      });

      // Notify host country
      try {
        await notificationAPI.create({
          title: "🏛️ Embassy Closed",
          message: `${embassy.guestCountry?.name || "A country"} has closed ${embassy.name}${input.reason ? `: ${input.reason}` : ""}`,
          countryId: embassy.hostCountryId,
          category: "diplomatic",
          priority: "medium",
          href: "/mycountry/diplomacy",
          source: "diplomatic-system",
          actionable: false,
          metadata: { embassyId: embassy.id, guestCountryId: embassy.guestCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy closure notification:", error);
      }

      return {
        success: true,
        embassy: closedEmbassy,
        penalties,
        message:
          embassy.status === "active"
            ? "Embassy closed. Diplomatic penalties applied."
            : "Embassy closed successfully.",
      };
    }),

  reopenEmbassy: rateLimitedMutationProcedure
    .input(
      z.object({
        embassyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to reopen embassies.",
        });
      }

      const embassy = await ctx.db.embassy.findUnique({
        where: { id: input.embassyId },
        include: {
          hostCountry: { select: { name: true } },
          guestCountry: { select: { name: true } },
        },
      });

      if (!embassy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
      }

      if (embassy.guestCountryId !== ctx.user.countryId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only reopen your own embassies.",
        });
      }

      if (embassy.status !== "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Embassy is not closed.",
        });
      }

      const reopenedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          status: "active",
        },
      });

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_reopened",
          title: "Embassy Reopened",
          description: `${embassy.name} has been reopened.`,
          embassyId: embassy.id,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relationshipImpact: 5,
          severity: "positive",
        },
      });

      // Notify host country
      try {
        await notificationAPI.create({
          title: "🏛️ Embassy Reopened",
          message: `${embassy.guestCountry?.name || "A country"} has reopened ${embassy.name}`,
          countryId: embassy.hostCountryId,
          category: "diplomatic",
          priority: "medium",
          href: "/mycountry/diplomacy",
          source: "diplomatic-system",
          actionable: true,
          metadata: { embassyId: embassy.id, guestCountryId: embassy.guestCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy reopen notification:", error);
      }

      return {
        success: true,
        embassy: reopenedEmbassy,
      };
    }),
});
