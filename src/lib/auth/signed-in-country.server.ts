import "server-only";

import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { db } from "~/server/db";

/**
 * The signed-in user's linked country id, read on the server (same `User.countryId` lookup by
 * Clerk id that `users.getProfile` does) so a page can start country-scoped queries on the first
 * client render instead of waiting for getProfile. It is only a hint: getProfile stays the source
 * of truth once it loads. Returns "" for guests, unlinked users, or any lookup failure.
 */
export async function getSignedInCountryId(): Promise<string> {
  try {
    const { userId } = await auth();
    if (!userId) return "";
    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      select: { countryId: true },
    });
    return user?.countryId ?? "";
  } catch (error) {
    unstable_rethrow(error);
    return "";
  }
}
