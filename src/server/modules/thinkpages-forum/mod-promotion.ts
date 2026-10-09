/**
 * M9 (owner ruling): no moderator powers for a member with a live forum ban where those powers apply or sitewide,
 * so a sanctioned member is never put over their own sanction history. Active warnings alone do not block. A
 * category moderator: the category, its realm's section, or the site. A realm's `board` power (an officer's, or a
 * new founder's): the realm's section, any of its categories, or the site. The realms router supplies the board
 * check to the realms module, which cannot import this one.
 */
import type { PrismaClient } from "@prisma/client";
import { ForumError } from "./errors";
import { activeBansFor, liveAt, type BanPlace } from "./mod-bans";

export type PromotionDb = Pick<PrismaClient, "forumBan" | "forumCategory" | "user">;

const refused = () =>
  new ForumError(
    "BAD_REQUEST",
    "They have an active forum ban here or sitewide. Lift it before giving them moderator powers."
  );

/** Refuses a category moderator role to a member (User.id) banned in the category, its realm or sitewide. */
export async function assertCategoryRoleGrantable(
  db: Pick<PromotionDb, "forumBan">,
  userId: string,
  category: BanPlace
): Promise<void> {
  if ((await activeBansFor(db, userId, category)).length > 0) throw refused();
}

/** Refuses a realm's `board` power to a player (by Clerk id, as realm officers are kept) banned there or sitewide. */
export async function assertBoardGrantable(
  db: PromotionDb,
  realmId: string,
  clerkUserId: string
): Promise<void> {
  const user = await db.user.findUnique({ where: { clerkUserId }, select: { id: true } });
  if (!user) return;
  const categories = await db.forumCategory.findMany({
    where: { scope: "realm", realmId },
    select: { id: true },
  });
  const ban = await db.forumBan.findFirst({
    where: {
      userId: user.id,
      liftedAt: null,
      AND: [
        liveAt(new Date()),
        {
          OR: [
            { scope: "site" },
            { scope: "realm", scopeId: realmId },
            { scope: "category", scopeId: { in: categories.map((c) => c.id) } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  if (ban) throw refused();
}
