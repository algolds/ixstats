/**
 * store.ts — the Prisma implementation of `ApiStore` (plan 410): read-only queries over the WikiOS
 * tables, shaped as the plain rows the api.php modules work with (`store-types.ts`).
 *
 * Nothing here writes: edits, moves, deletions and protections go through the existing services.
 */

import { db } from "~/server/db";
import type { ApiStore, SiteStatistics } from "./store-types";

const SOURCE = "ixwiki";
const ACTIVE_USER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Pages a bot can see: not deleted, and with text (a row without text is a stub). */
const LIVE_PAGE = { source: SOURCE, status: { not: "ARCHIVED" }, wikitext: { not: "" } } as const;

async function statistics(): Promise<SiteStatistics> {
  const since = new Date(Date.now() - ACTIVE_USER_WINDOW_MS);
  const [pages, articles, edits, images, users, active, admins] = await Promise.all([
    db.wikiArticle.count({ where: LIVE_PAGE }),
    db.wikiArticle.count({ where: { ...LIVE_PAGE, namespace: 0, redirectTargetSlug: null } }),
    db.wikiRevision.count({ where: { source: SOURCE } }),
    db.wikiArticle.count({ where: { ...LIVE_PAGE, namespace: 6 } }),
    db.wikiAccountLink.count({ where: { source: SOURCE, verifiedAt: { not: null } } }),
    db.wikiRevision.groupBy({ by: ["author"], where: { source: SOURCE, createdAt: { gte: since } } }),
    db.wikiUserGroup.count({ where: { group: "sysop" } }),
  ]);
  return { pages, articles, edits, images, users, activeUsers: active.length, admins };
}

async function userStats(internalUserId: string | null, wikiName: string) {
  const [editCount, user] = await Promise.all([
    db.wikiRevision.count({
      where: {
        source: SOURCE,
        OR: [...(internalUserId ? [{ authorId: internalUserId }] : []), { author: wikiName }],
      },
    }),
    internalUserId
      ? db.user.findUnique({ where: { id: internalUserId }, select: { createdAt: true } })
      : null,
  ]);
  return { editCount, registration: user?.createdAt ?? null };
}

export const prismaApiStore: ApiStore = { statistics, userStats };
