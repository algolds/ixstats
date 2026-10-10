import type { PrismaClient } from "@prisma/client";
import {
  BOARD_STYLE,
  REALM_BOARD_KEY,
  REALM_CATEGORIES,
} from "~/lib/thinkpages-forum/categories";
import { boardThreadSourceRef } from "./board-thread";

export type SeedDb = Pick<PrismaClient, "forumCategory" | "forumThread">;

/**
 * Give a realm its three forum categories, its hidden board category (order 0, personas allowed) and the board's
 * one thread, "<Realm> board". Idempotent: the (scope, realmId, key) index and the board thread's `sourceRef` are
 * unique, so a rerun, or a race between two, creates nothing twice and heals a missing board thread.
 * `created` counts the categories made.
 */
export async function seedRealmCategories(
  db: SeedDb,
  realm: { id: string; name: string }
): Promise<{ created: number }> {
  const { count } = await db.forumCategory.createMany({
    data: [
      {
        scope: "realm",
        realmId: realm.id,
        key: REALM_BOARD_KEY,
        name: "Board",
        description: "The realm's live message board.",
        order: 0,
        visibility: "public",
        postRole: "any",
        icAllowed: true,
        style: BOARD_STYLE,
      },
      ...REALM_CATEGORIES.map((c) => ({
        scope: "realm",
        realmId: realm.id,
        key: c.key,
        name: c.name,
        description: c.description,
        order: c.order,
        visibility: "public",
        postRole: "any",
        icAllowed: c.icAllowed,
        // IC categories render as WikiOS articles (spec section 1); the hub is compact OOC.
        style: c.icAllowed ? "ic" : "ooc",
      })),
    ],
    skipDuplicates: true,
  });
  const board = await db.forumCategory.findFirst({
    where: { scope: "realm", realmId: realm.id, key: REALM_BOARD_KEY },
    select: { id: true },
  });
  if (board) {
    await db.forumThread.createMany({
      data: [
        {
          categoryId: board.id,
          title: `${realm.name} board`,
          authorUserId: null,
          pinned: false,
          sourceRef: boardThreadSourceRef(realm.id),
        },
      ],
      skipDuplicates: true,
    });
  }
  return { created: count };
}
