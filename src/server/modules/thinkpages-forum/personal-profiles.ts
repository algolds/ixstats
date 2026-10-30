import type { PrismaClient } from "@prisma/client";
import { PERSONAL_ACCOUNT_TYPE } from "~/server/shared/thinkpages-personal-account";

export interface PersonalProfile {
  avatarUrl: string | null;
  displayName: string;
}

/**
 * The Passport profile of each member: the name and image of their personal ThinkPages persona, keyed by Clerk user
 * id. One query; members without a personal persona are absent, and one without an image has a null avatarUrl.
 */
export async function personalProfiles(
  db: Pick<PrismaClient, "thinkpagesAccount">,
  clerkUserIds: readonly string[]
): Promise<Map<string, PersonalProfile>> {
  if (clerkUserIds.length === 0) return new Map();
  const accounts = await db.thinkpagesAccount.findMany({
    where: {
      clerkUserId: { in: [...clerkUserIds] },
      accountType: PERSONAL_ACCOUNT_TYPE,
      isActive: true,
    },
    select: { clerkUserId: true, profileImageUrl: true, displayName: true },
  });
  return new Map(
    accounts.map((a) => [
      a.clerkUserId,
      { avatarUrl: a.profileImageUrl, displayName: a.displayName },
    ])
  );
}
