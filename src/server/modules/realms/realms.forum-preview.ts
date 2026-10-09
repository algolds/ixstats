/**
 * The realm overview's "Latest on the forum" (phase 2, D4): the newest threads of the realm's Hub. It reads the
 * forum tables itself rather than importing the forum module, which imports this module's barrel.
 */
import type { PrismaClient } from "@prisma/client";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { isSiteAdmin, type RealmActor } from "./realms.access";

/** How many threads the overview lists. */
const FORUM_PREVIEW_SIZE = 5;

export type ForumPreviewDb = Pick<PrismaClient, "forumCategory" | "forumThread">;

/**
 * A realm's latest visible Hub threads. A Hub the viewer cannot see (not public, and they are no site admin)
 * and a realm without a Hub both read as empty. The caller has checked the viewer can see the realm.
 */
export async function forumPreview(db: ForumPreviewDb, realmId: string, viewer: RealmActor | null) {
  const category = await db.forumCategory.findFirst({
    where: {
      scope: "realm",
      realmId,
      key: REALM_HUB_KEY,
      ...(viewer && isSiteAdmin(viewer) ? {} : { visibility: "public" }),
    },
    select: { id: true },
  });
  if (!category) return { threads: [] };
  const threads = await db.forumThread.findMany({
    where: { categoryId: category.id, hidden: false },
    orderBy: { lastPostAt: "desc" },
    take: FORUM_PREVIEW_SIZE,
    select: { id: true, title: true, postCount: true, lastPostAt: true },
  });
  return {
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      replies: Math.max(0, t.postCount - 1),
      lastPostAt: t.lastPostAt,
    })),
  };
}
