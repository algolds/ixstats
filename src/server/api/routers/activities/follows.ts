// src/server/api/routers/activities.ts
// Activities router for live activity feed system

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createTRPCRouter, rateLimitedMutationProcedure } from "~/server/api/trpc";
import { notificationAPI } from "~/lib/notifications/api";
import { globalCache } from "~/lib/cache";
import {
  ensurePersonalAccount,
  findPersonalAccount,
} from "~/server/api/routers/thinkpages/personal-account";
import { assertCountryWriteAccess } from "~/server/shared/country-authorization";

/** Persona follow input: the persona to follow, and optionally which of the caller's personas follows. */
const PersonaFollowInput = z.object({
  accountId: z.string().min(1),
  // Defaults to the caller's personal persona ("you"), created on first use.
  followerAccountId: z.string().min(1).optional(),
});

/** A persona the caller owns and may act as. */
async function requireOwnedActivePersona(
  db: Pick<PrismaClient, "thinkpagesAccount">,
  clerkUserId: string,
  accountId: string
) {
  const account = await db.thinkpagesAccount.findUnique({ where: { id: accountId } });
  if (!account || account.clerkUserId !== clerkUserId || !account.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only follow from an active account you own",
    });
  }
  return account;
}

/** Drop the caller's cached Following feed so a follow shows up on the next load. */
async function invalidateFollowingFeed(clerkUserId: string) {
  try {
    await globalCache.deleteByPattern(`user_following_feed:${clerkUserId}:*`);
  } catch (error) {
    console.error("[Follows] Failed to invalidate following feed:", error);
  }
}

// Input schemas
export const activitiesFollowsRouter = createTRPCRouter({
  // Country Follow System
  // Follow a country
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

      // Cannot follow yourself
      if (input.followerCountryId === input.followedCountryId) {
        throw new Error("Cannot follow your own country");
      }

      // Check if already following
      const existing = await ctx.db.countryFollow.findUnique({
        where: {
          followerCountryId_followedCountryId: {
            followerCountryId: input.followerCountryId,
            followedCountryId: input.followedCountryId,
          },
        },
      });

      if (existing) {
        return { success: true, alreadyFollowing: true, follow: existing };
      }

      const follow = await ctx.db.countryFollow.create({
        data: {
          followerCountryId: input.followerCountryId,
          followedCountryId: input.followedCountryId,
        },
        include: {
          followedCountry: { select: { id: true, name: true, flag: true, slug: true } },
          followerCountry: { select: { id: true, name: true, flag: true, slug: true } },
        },
      });

      return { success: true, alreadyFollowing: false, follow };
    }),

  // Persona Follow System (ThinkPages)
  // Follow a persona. followerCount / followingCount move in the same transaction as the row.
  followPersona: rateLimitedMutationProcedure
    .input(PersonaFollowInput)
    .mutation(async ({ ctx, input }) => {
      const clerkUserId = ctx.auth.userId;
      const target = await ctx.db.thinkpagesAccount.findUnique({
        where: { id: input.accountId },
        select: { id: true, clerkUserId: true, username: true, isActive: true },
      });
      if (!target || !target.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }
      // Following your own personas would only inflate their counts.
      if (target.clerkUserId === clerkUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't follow your own accounts" });
      }

      const follower = input.followerAccountId
        ? await requireOwnedActivePersona(ctx.db, clerkUserId, input.followerAccountId)
        : await ensurePersonalAccount(ctx.db, clerkUserId);

      try {
        await ctx.db.$transaction(async (tx) => {
          await tx.thinkpagesFollow.create({
            data: {
              followerAccountId: follower.id,
              followedAccountId: target.id,
              followerClerkUserId: clerkUserId,
            },
          });
          await tx.thinkpagesAccount.update({
            where: { id: target.id },
            data: { followerCount: { increment: 1 } },
          });
          await tx.thinkpagesAccount.update({
            where: { id: follower.id },
            data: { followingCount: { increment: 1 } },
          });
        });
      } catch (error) {
        // The unique (follower, followed) pair: already following, and the counts were not touched.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { success: true, alreadyFollowing: true, followerAccountId: follower.id };
        }
        throw error;
      }

      await invalidateFollowingFeed(clerkUserId);

      // Notify the followed persona's owner (notifications are keyed by Clerk id). Imported
      // IxTwitter personas belong to "system_" ids with no user behind them.
      if (!target.clerkUserId.startsWith("system_")) {
        try {
          await notificationAPI.create({
            title: "New follower",
            message: `${follower.displayName} (@${follower.username}) followed @${target.username}`,
            userId: target.clerkUserId,
            category: "social",
            priority: "low",
            type: "info",
            href: `/thinkpages/profile/${follower.username}`,
            source: "thinkpages",
            actionable: false,
            metadata: { followerAccountId: follower.id, followedAccountId: target.id },
          });
        } catch (error) {
          console.error("[Follows] Failed to send follow notification:", error);
        }
      }

      return { success: true, alreadyFollowing: false, followerAccountId: follower.id };
    }),

  // Unfollow a persona (as the caller's personal persona unless another is given)
  unfollowPersona: rateLimitedMutationProcedure
    .input(PersonaFollowInput)
    .mutation(async ({ ctx, input }) => {
      const clerkUserId = ctx.auth.userId;
      const follower = input.followerAccountId
        ? await requireOwnedActivePersona(ctx.db, clerkUserId, input.followerAccountId)
        : await findPersonalAccount(ctx.db, clerkUserId);
      if (!follower) return { success: true, wasFollowing: false };

      const wasFollowing = await ctx.db.$transaction(async (tx) => {
        const removed = await tx.thinkpagesFollow.deleteMany({
          where: { followerAccountId: follower.id, followedAccountId: input.accountId },
        });
        if (removed.count === 0) return false;
        await tx.thinkpagesAccount.update({
          where: { id: input.accountId },
          data: { followerCount: { decrement: removed.count } },
        });
        await tx.thinkpagesAccount.update({
          where: { id: follower.id },
          data: { followingCount: { decrement: removed.count } },
        });
        return true;
      });

      if (wasFollowing) await invalidateFollowingFeed(clerkUserId);
      return { success: true, wasFollowing };
    }),
});
