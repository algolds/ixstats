import type { Prisma } from "@prisma/client";

/** How a board orders its threads (`?sort=`); pinned threads always come first. */
export const THREAD_SORTS = ["latest", "newest", "replies"] as const;
export type ThreadSort = (typeof THREAD_SORTS)[number];

/** Reads `?sort=` from a route's search params: one of the known sorts, else the default (latest). */
export function sortParam(value: string | string[] | undefined): ThreadSort {
  const first = Array.isArray(value) ? value[0] : value;
  return THREAD_SORTS.find((sort) => sort === first) ?? "latest";
}

/** `basePath` ordered by `sort`; the default sort needs no parameter. Page links add `&page=` to it. */
export function sortHref(basePath: string, sort: ThreadSort): string {
  return sort === "latest" ? basePath : `${basePath}?sort=${sort}`;
}

const SECOND_KEY: Record<ThreadSort, Prisma.ForumThreadOrderByWithRelationInput> = {
  latest: { lastPostAt: "desc" },
  newest: { createdAt: "desc" },
  replies: { postCount: "desc" },
};

export function threadOrderBy(sort: ThreadSort): Prisma.ForumThreadOrderByWithRelationInput[] {
  return [{ pinned: "desc" }, SECOND_KEY[sort], { id: "desc" }];
}
