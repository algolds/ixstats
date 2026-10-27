// src/server/api/routers/users.ts
// Simplified users router with profile management and country linking

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  adminProcedure,
  lightMutationProcedure,
} from "~/server/api/trpc";
import { notificationHooks } from "~/lib/notifications/hooks";
import { globalCache } from "~/lib/cache";
import { hasPremiumTier } from "~/lib/auth/premium";
import { activateOwnedNation } from "~/server/modules/realms";

export const usersCountryLinkingRouter = createTRPCRouter({
  /** "Play as": act as another nation the caller owns, e.g. one in another realm (ruling F-1). */
  setActiveNation: lightMutationProcedure
    .input(z.object({ countryId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const activated = await ctx.db.$transaction((tx) =>
        activateOwnedNation(tx, { userId: ctx.user.id, countryId: input.countryId })
      );
      if (!activated) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only play as a nation you own",
        });
      }
      await globalCache.delete(`user_profile:${ctx.user.clerkUserId}`);
      return { success: true };
    }),

  // Get user's membership status
  getMembershipStatus: publicProcedure.query(async ({ ctx }) => {
    try {
      // Check if user is authenticated
      if (!ctx.auth?.userId) {
        return {
          tier: "basic" as const,
          isPremium: false,
          features: {
            intelligence: false,
            defense: false,
            advancedAnalytics: false,
          },
        };
      }

      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: ctx.auth.userId },
        select: { membershipTier: true },
      });

      const tier = (user?.membershipTier as "basic" | "mycountry_premium") ?? "basic";
      const isPremium = hasPremiumTier(tier);

      return {
        tier,
        isPremium,
        features: {
          intelligence: isPremium,
          defense: isPremium,
          advancedAnalytics: isPremium,
        },
      };
    } catch (error) {
      console.error("Error fetching membership status:", error);
      return {
        tier: "basic" as const,
        isPremium: false,
        features: {
          intelligence: false,
          defense: false,
          advancedAnalytics: false,
        },
      };
    }
  }),

  // Update user's membership tier (for admin use)
  updateMembershipTier: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        tier: z.enum(["basic", "mycountry_premium"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.user.upsert({
          where: { clerkUserId: input.userId },
          update: { membershipTier: input.tier },
          create: {
            clerkUserId: input.userId,
            membershipTier: input.tier,
          },
        });

        // Send notification to user about tier change
        try {
          const tierNames = {
            basic: "Basic",
            mycountry_premium: "MyCountry Premium",
          };

          const isUpgrade = input.tier === "mycountry_premium";
          const message = isUpgrade
            ? "You now have access to Intelligence and advanced analytics features."
            : "Your membership has been changed to Basic tier.";

          await notificationHooks.onUserAccountChange({
            userId: input.userId,
            changeType: "role_changed",
            title: `Membership Updated: ${tierNames[input.tier]}`,
            description: message,
            priority: isUpgrade ? "high" : "medium",
            metadata: {
              tier: input.tier,
              isUpgrade,
            },
          });
        } catch (notifError) {
          console.error("Failed to send membership tier notification:", notifError);
        }

        return {
          success: true,
          message: `Membership tier updated to ${input.tier}`,
        };
      } catch (error) {
        console.error("Error updating membership tier:", error);
        throw new Error("Failed to update membership tier", { cause: error });
      }
    }),
});
