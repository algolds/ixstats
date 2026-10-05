import { z } from "zod";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notifications/api";
// oxlint-disable-next-line typescript/no-unused-vars
import { vaultService } from "~/lib/vault/vault-service";
import { generateDiplomaticNews } from "~/lib/diplomacy/news-generator";
import { ActivityHooks } from "~/lib/activity";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

export const diplomaticEmbassiesEstablishRouter = createTRPCRouter({
  establishEmbassy: rateLimitedMutationProcedure
    .input(
      z.object({
        hostCountryId: z.string(),
        guestCountryId: z.string(),
        name: z.string(),
        location: z.string().optional(),
        ambassadorName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the guest country (the one establishing the embassy); any owned nation counts
      await assertCountryWriteAccess(ctx, input.guestCountryId);

      // One embassy per guest↔host pair (enforced by a composite unique). Guard here
      // so a re-try / double-submit returns a clear message instead of a raw P2002.
      const existing = await ctx.db.embassy.findUnique({
        where: {
          hostCountryId_guestCountryId: {
            hostCountryId: input.hostCountryId,
            guestCountryId: input.guestCountryId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an embassy in this country.",
        });
      }

      const embassy = await ctx.db.embassy.create({
        data: {
          hostCountryId: input.hostCountryId,
          guestCountryId: input.guestCountryId,
          name: input.name,
          location: input.location,
          ambassadorName: input.ambassadorName,
          status: "active",
        },
      });

      let hostCountryName: string | null = null;
      let guestCountryName: string | null = null;

      // 🔔 Notify both countries about embassy establishment
      try {
        // Get country names for better messaging
        const [hostCountry, guestCountry] = await Promise.all([
          ctx.db.country.findUnique({ where: { id: input.hostCountryId }, select: { name: true } }),
          ctx.db.country.findUnique({
            where: { id: input.guestCountryId },
            select: { name: true },
          }),
        ]);

        hostCountryName = hostCountry?.name ?? null;
        guestCountryName = guestCountry?.name ?? null;

        // Notify host country
        await notificationAPI.create({
          title: "🏛️ New Embassy Established",
          message: `${guestCountryName || "A country"} has established ${input.name} in your nation`,
          countryId: input.hostCountryId,
          category: "diplomatic",
          priority: "medium",
          href: "/mycountry/diplomacy",
          source: "diplomatic-system",
          actionable: true,
          metadata: { embassyId: embassy.id, guestCountryId: input.guestCountryId },
        });

        // Notify guest country (confirmation)
        await notificationAPI.create({
          title: "🏛️ Embassy Establishment Confirmed",
          message: `${input.name} has been successfully established in ${hostCountryName || "the host nation"}`,
          countryId: input.guestCountryId,
          category: "diplomatic",
          priority: "low",
          type: "success",
          href: "/mycountry/diplomacy",
          source: "diplomatic-system",
          actionable: false,
          metadata: { embassyId: embassy.id, hostCountryId: input.hostCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send embassy notifications:", error);
        // Don't fail the embassy creation if notifications fail
      }

      // 💰 Award IxCredits for embassy establishment
      let creditsEarned = 0;
      if (ctx.auth?.userId) {
        try {
          const creditReward = 15; // 15 IxC for establishing an embassy

          const earnResult = await vaultService.earnCredits(
            ctx.auth.userId,
            creditReward,
            "EARN_ACTIVE",
            "embassy_established",
            ctx.db,
            {
              embassyId: embassy.id,
              embassyName: input.name,
              hostCountryId: input.hostCountryId,
              guestCountryId: input.guestCountryId,
              hostCountryName,
              guestCountryName,
            }
          );

          if (earnResult.success) {
            creditsEarned = creditReward;
            console.log(
              `[Diplomatic] Awarded ${creditReward} IxC to ${ctx.auth.userId} for embassy establishment`
            );
          }
        } catch (error) {
          console.error("[Diplomatic] Failed to award embassy establishment credits:", error);
        }
      }

      // 🤝 Ensure a DiplomaticRelation exists between the two countries.
      // Establishing an embassy is what opens formal relations — without this,
      // the Relations list and the Foreign Policy target dropdown stay empty.
      try {
        const existingRelation = await ctx.db.diplomaticRelation.findFirst({
          where: {
            OR: [
              { country1: input.guestCountryId, country2: input.hostCountryId },
              { country1: input.hostCountryId, country2: input.guestCountryId },
            ],
          },
          select: { id: true },
        });

        if (!existingRelation) {
          await ctx.db.diplomaticRelation.create({
            data: {
              country1: input.guestCountryId,
              country2: input.hostCountryId,
              relationship: "neutral",
              strength: 25, // baseline goodwill from opening an embassy
              status: "active",
              lastContact: new Date(),
              diplomaticChannels: JSON.stringify(["embassy"]),
            },
          });
        } else {
          // Refresh contact + nudge strength up for re-engagement
          await ctx.db.diplomaticRelation.update({
            where: { id: existingRelation.id },
            data: { lastContact: new Date(), status: "active" },
          });
        }
      } catch (error) {
        console.error("[Diplomatic] Failed to upsert diplomatic relation:", error);
      }

      // 📰 In-world narrative: post the embassy news to ThinkPages + activity feed.
      void generateDiplomaticNews(ctx.db, input.guestCountryId, "embassy_established", {
        countryName: guestCountryName ?? "A nation",
        targetName: hostCountryName ?? "another nation",
      });
      void ActivityHooks.Diplomatic.onEmbassyEstablished(
        input.guestCountryId,
        input.hostCountryId,
        "basic",
        ctx.auth?.userId ?? undefined
      );

      return {
        ...embassy,
        hostCountryName,
        guestCountryName,
        creditsEarned,
      };
    }),
});
