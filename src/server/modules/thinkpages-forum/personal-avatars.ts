import type { PrismaClient } from "@prisma/client";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";

/**
 * The Passport avatar of each member: the image of their personal ThinkPages persona, keyed by Clerk user id. One
 * query; members without a personal persona (or image) are absent or null.
 */
export async function personalAvatars(
  db: Pick<PrismaClient, "thinkpagesAccount">,
  clerkUserIds: readonly string[]
): Promise<Map<string, string | null>> {
  if (clerkUserIds.length === 0) return new Map();
  const accounts = await db.thinkpagesAccount.findMany({
    where: {
      clerkUserId: { in: [...clerkUserIds] },
      accountType: PERSONAL_ACCOUNT_TYPE,
      isActive: true,
    },
    select: { clerkUserId: true, profileImageUrl: true },
  });
  return new Map(accounts.map((a) => [a.clerkUserId, a.profileImageUrl]));
}
