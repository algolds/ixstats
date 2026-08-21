/**
 * Canonical linked-user resolution for Forum integration.
 * Explicitly distinguishes internal `User.id` from `clerkUserId`.
 */

import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { lookupForumUser } from "./xenforo-user-sync";

/**
 * Resolves the user's linked XenForo user ID by internal `User.id`,
 * backfilling if `forumUsername` is set but `forumUserId` is missing,
 * or throwing TRPCError PRECONDITION_FAILED.
 */
export async function requireForumUser(userId: string, db?: PrismaClient): Promise<number> {
  const database = db ?? (await import("~/server/db")).db;
  const user = await database.user.findUnique({
    where: { id: userId },
    select: { forumUserId: true, forumUsername: true },
  });

  if (user?.forumUserId) return user.forumUserId;

  // Fallback: if forumUsername is set but forumUserId is missing, look it up and backfill
  if (user?.forumUsername) {
    const xfUser = await lookupForumUser(user.forumUsername);
    if (xfUser) {
      await database.user.update({
        where: { id: userId },
        data: { forumUserId: xfUser.userId },
      });
      return xfUser.userId;
    }
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "You must link your forum account first. Go to Profile → IxnayID to connect your accounts.",
  });
}

/**
 * Resolves linked Forum info by Clerk user ID (`clerkUserId`).
 * Used for ThinkShare / message bridge operations.
 */
export async function getForumUserByClerkId(
  clerkUserId: string,
  db?: PrismaClient
): Promise<{ forumUserId: number | null; forumUsername: string | null } | null> {
  const database = db ?? (await import("~/server/db")).db;
  return await database.user.findFirst({
    where: { clerkUserId },
    select: { forumUserId: true, forumUsername: true },
  });
}

/**
 * Resolves linked Forum info by internal user ID (`User.id`).
 */
export async function getForumUserByInternalId(
  userId: string,
  db?: PrismaClient
): Promise<{ forumUserId: number | null; forumUsername: string | null } | null> {
  const database = db ?? (await import("~/server/db")).db;
  return await database.user.findUnique({
    where: { id: userId },
    select: { forumUserId: true, forumUsername: true },
  });
}
