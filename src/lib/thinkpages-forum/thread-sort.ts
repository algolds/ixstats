import type { Prisma } from "@prisma/client";

/** How a board orders its threads (`?sort=`); pinned threads always come first. */
export const THREAD_SORTS = ["latest", "newest", "replies"] as const;
export type ThreadSort = (typeof THREAD_SORTS)[number];

const SECOND_KEY: Record<ThreadSort, Prisma.ForumThreadOrderByWithRelationInput> = {
  latest: { lastPostAt: "desc" },
  newest: { createdAt: "desc" },
  replies: { postCount: "desc" },
};

export function threadOrderBy(sort: ThreadSort): Prisma.ForumThreadOrderByWithRelationInput[] {
  return [{ pinned: "desc" }, SECOND_KEY[sort], { id: "desc" }];
}
