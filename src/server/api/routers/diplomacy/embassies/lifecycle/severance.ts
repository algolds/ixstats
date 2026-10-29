import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertCountryWriteAccess,
  hasCountryWriteAccess,
} from "~/server/shared/country-authorization";
import { clockForCountry } from "~/server/shared/realm-time";
import { notificationAPI } from "~/lib/notifications/api";
import { applyRelationshipImpact } from "~/lib/diplomacy/relationship-impact";

/** Severing relations costs this much relation strength. */
const SEVER_RELATIONSHIP_IMPACT = -30;

export const diplomaticEmbassiesLifecycleSeveranceRouter = createTRPCRouter({
  deleteEmbassy: rateLimitedMutationProcedure
    .input(
      z.object({
        embassyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      // Either side's owner may sever (any nation they own, as when establishing).
      const severingCountryId = (await hasCountryWriteAccess(ctx, embassy.guestCountryId))
        ? embassy.guestCountryId
        : embassy.hostCountryId;
      await assertCountryWriteAccess(ctx, severingCountryId);

      // Conditional, so two concurrent severs apply the relationship penalty once.
      const deleted = await ctx.db.embassy.deleteMany({ where: { id: input.embassyId } });
      if (deleted.count !== 1) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embassy not found" });
      }

      await applyRelationshipImpact(
        ctx.db,
        embassy.guestCountryId,
        embassy.hostCountryId,
        SEVER_RELATIONSHIP_IMPACT
      );

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_severed",
          title: "Diplomatic Relations Severed",
          description: `${embassy.name} has been permanently dismantled and diplomatic relations severed.`,
          // The severing nation's clock. Severing is not guarded, so an embassy from before the realm rule can go.
          ixTimeTimestamp: (await clockForCountry(ctx.db, severingCountryId)).now(),
          relationshipImpact: SEVER_RELATIONSHIP_IMPACT,
          severity: "critical",
        },
      });

      // Notify the other country
      const otherCountryId =
        embassy.guestCountryId === severingCountryId
          ? embassy.hostCountryId
          : embassy.guestCountryId;
      const myCountryName =
        embassy.guestCountryId === severingCountryId
          ? embassy.guestCountry?.name
          : embassy.hostCountry?.name;

      try {
        await notificationAPI.create({
          title: "❌ Diplomatic Relations Severed",
          message: `${myCountryName || "A country"} has permanently dismantled the embassy and severed relations.`,
          countryId: otherCountryId,
          category: "diplomatic",
          priority: "high",
          href: "/mycountry/diplomacy",
          source: "diplomatic-system",
          actionable: false,
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy sever notification:", error);
      }

      return {
        success: true,
      };
    }),
});
