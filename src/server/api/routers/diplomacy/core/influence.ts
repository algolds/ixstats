import { z } from "zod";
import { createTRPCRouter, publicProcedure, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notifications/api";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

// Helper functions for cultural exchange <-> embassy mission integration
export const diplomaticCoreInfluenceRouter = createTRPCRouter({
  // Follow/Unfollow system for countries
  getFollowStatus: publicProcedure
    .input(
      z.object({
        viewerCountryId: z.string(),
        targetCountryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const follow = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.viewerCountryId,
            followedCountryId: input.targetCountryId,
          },
        },
      });

      return {
        isFollowing: !!follow,
        followedAt: follow?.createdAt || null,
      };
    }),

  followCountry: rateLimitedMutationProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      await assertCountryWriteAccess(ctx, input.followerCountryId);

      // Create follow relationship
      const follow = await ctx.db.countryFollow.create({
        data: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId,
        },
      });

      // 🔔 Notify followed country about new follower
      try {
        const followerCountry = await ctx.db.country.findUnique({
          where: { id: input.followerCountryId },
          select: { name: true, slug: true },
        });

        await notificationAPI.create({
          title: "👁️ New Country Following",
          message: `${followerCountry?.name || "A country"} is now following your country`,
          countryId: input.followedCountryId,
          category: "social",
          priority: "low",
          type: "info",
          href: followerCountry?.slug
            ? `/countries/${followerCountry.slug}`
            : `/countries/${input.followerCountryId}`,
          source: "diplomatic-system",
          actionable: false,
          metadata: { followerCountryId: input.followerCountryId },
        });
      } catch (error) {
        console.error("[Diplomatic] Failed to send follow notification:", error);
      }

      return { success: true, follow };
    }),

  unfollowCountry: rateLimitedMutationProcedure
    .input(
      z.object({
        followerCountryId: z.string(),
        followedCountryId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the follower country
      await assertCountryWriteAccess(ctx, input.followerCountryId);

      // Delete follow relationship
      await ctx.db.countryFollow.delete({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId,
          },
        },
      });

      return { success: true };
    }),
});
