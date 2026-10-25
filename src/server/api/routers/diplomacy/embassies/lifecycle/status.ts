import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { clockForCountry } from "~/server/shared/realm-time";
import { assertSameRealm } from "~/server/shared/same-realm-guard";
import { notificationAPI } from "~/lib/notifications/api";
import { applyRelationshipImpact } from "~/lib/diplomacy/relationship-impact";

/** Closing an active embassy costs relation strength; reopening one wins a little back. */
const CLOSE_RELATIONSHIP_IMPACT = -15;
const REOPEN_RELATIONSHIP_IMPACT = 5;

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

      // Closing an active embassy costs relation strength, reputation and half its influence
      // (losses are positive magnitudes: decrementing a negative number raised reputation).
      const wasActive = embassy.status === "active";
      const penalties = {
        relationshipPenalty: wasActive ? CLOSE_RELATIONSHIP_IMPACT : 0,
        reputationLoss: wasActive ? Math.min(10, embassy.reputation) : 0,
        influenceLoss: wasActive ? embassy.influence * 0.5 : 0,
      };

      const closedEmbassy = await ctx.db.embassy.update({
        where: { id: input.embassyId },
        data: {
          status: "closed",
          influence: { decrement: penalties.influenceLoss },
          reputation: { decrement: penalties.reputationLoss },
        },
      });

      if (wasActive) {
        await applyRelationshipImpact(
          ctx.db,
          embassy.guestCountryId,
          embassy.hostCountryId,
          CLOSE_RELATIONSHIP_IMPACT
        );
      }

      // Record diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_closed",
          title: "Embassy Closed",
          description: input.reason || `${embassy.name} has been closed`,
          embassyId: embassy.id,
          relationshipImpact: penalties.relationshipPenalty,
          // The guest nation's clock. Closing is not guarded, so an embassy from before the realm rule can close.
          ixTimeTimestamp: (await clockForCountry(ctx.db, embassy.guestCountryId)).now(),
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
      await assertSameRealm(ctx.db, embassy.guestCountryId, embassy.hostCountryId);

      // Conditional on it still being closed, so a double click reopens (and moves the relation) once.
      const reopened = await ctx.db.embassy.updateMany({
        where: { id: input.embassyId, status: "closed" },
        data: { status: "active" },
      });
      if (reopened.count !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Embassy is not closed." });
      }
      const reopenedEmbassy = await ctx.db.embassy.findUniqueOrThrow({
        where: { id: input.embassyId },
      });
      await applyRelationshipImpact(
        ctx.db,
        embassy.guestCountryId,
        embassy.hostCountryId,
        REOPEN_RELATIONSHIP_IMPACT
      );

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_reopened",
          title: "Embassy Reopened",
          description: `${embassy.name} has been reopened.`,
          embassyId: embassy.id,
          ixTimeTimestamp: (await clockForCountry(ctx.db, embassy.guestCountryId)).now(),
          relationshipImpact: REOPEN_RELATIONSHIP_IMPACT,
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
