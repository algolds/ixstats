import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";

export const diplomaticEmbassiesLifecycleSeveranceRouter = createTRPCRouter({
  deleteEmbassy: rateLimitedMutationProcedure
    .input(
      z.object({
        embassyId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.countryId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You must be associated with a country to sever relations.",
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

      if (
        embassy.guestCountryId !== ctx.user.countryId &&
        embassy.hostCountryId !== ctx.user.countryId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only sever relations for your own embassies.",
        });
      }

      // Delete the embassy
      await ctx.db.embassy.delete({
        where: { id: input.embassyId },
      });

      // Create diplomatic event
      await ctx.db.diplomaticEvent.create({
        data: {
          country1Id: embassy.guestCountryId,
          country2Id: embassy.hostCountryId,
          eventType: "embassy_severed",
          title: "Diplomatic Relations Severed",
          description: `${embassy.name} has been permanently dismantled and diplomatic relations severed.`,
          ixTimeTimestamp: IxTime.getCurrentIxTime(),
          relationshipImpact: -30,
          severity: "critical",
        },
      });

      // Notify the other country
      const otherCountryId =
        embassy.guestCountryId === ctx.user.countryId
          ? embassy.hostCountryId
          : embassy.guestCountryId;
      const myCountryName =
        embassy.guestCountryId === ctx.user.countryId
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
