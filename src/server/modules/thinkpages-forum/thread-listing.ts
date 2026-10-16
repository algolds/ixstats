/**
 * The count behind the sidebar's Watched badge: the member's watched threads with posts they have not read. The watch
 * rows are read with the member's own read mark joined in the one query, filtered to what the member may read (the
 * thread rule, the realm's visibility). The realm board never counts: it is left out of the query.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { notBoardCategory } from "~/lib/thinkpages-forum/categories";
import { UNPUBLISHED_REALM_STATUSES } from "~/lib/realms/realm-ids";
import { isUnread } from "~/lib/thinkpages-forum/unread";
import { DEFAULT_REALM_ID, isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { advertGate } from "./advert-access";
import type { ReadsDb } from "./reads";
import { candidateSelect, readable, type Candidate } from "./thread-candidates";
import type { UnreadDb } from "./unread";

export type ListingDb = ReadsDb & UnreadDb & Pick<PrismaClient, "forumThreadWatch">;

/** Watches read for the sidebar count. */
const WATCHED_MAX = 500;

const unreadOf = (row: Candidate, floor: Date): boolean =>
  isUnread(row.lastPostAt, row.reads[0]?.readAt, floor);

/** Query fragments for what the member may read, so the row caps are spent on readable threads only. */
interface ReadableRules {
  /** The Reports rule: other members' reports stay out unless the member moderates the place. */
  threadOr: Prisma.ForumThreadWhereInput[];
  /** Realms the member cannot see (draft or generating, unless theirs) stay out. */
  categoryAnd: Prisma.ForumCategoryWhereInput[];
}

async function readableRules(
  db: ListingDb,
  viewer: NonNullable<ForumViewer>
): Promise<ReadableRules> {
  if (isSiteAdmin(viewer)) return { threadOr: [], categoryAnd: [] };
  const { mod } = viewer;
  const unpublished = await db.realm.findMany({
    where: {
      status: { in: [...UNPUBLISHED_REALM_STATUSES] },
      id: { not: DEFAULT_REALM_ID },
      ownerId: { not: viewer.clerkUserId },
    },
    select: { id: true },
  });
  return {
    threadOr: [
      { category: { visibility: { not: "reporter_staff" } } },
      { authorUserId: viewer.id },
      ...(mod?.categoryIds.length ? [{ categoryId: { in: [...mod.categoryIds] } }] : []),
      ...(mod?.realmIds.length
        ? [{ category: { scope: "realm", realmId: { in: [...mod.realmIds] } } }]
        : []),
    ],
    categoryAnd: unpublished.length
      ? [{ NOT: { scope: "realm", realmId: { in: unpublished.map(({ id }) => id) } } }]
      : [],
  };
}

/** The member's watched threads that are not the realm board and have a post after `since`. */
async function watchedRows(
  db: ListingDb,
  viewer: NonNullable<ForumViewer>,
  since: Date
): Promise<Candidate[]> {
  const rules = await readableRules(db, viewer);
  const watches = await db.forumThreadWatch.findMany({
    where: {
      userId: viewer.id,
      thread: {
        hidden: false,
        ...advertGate(viewer),
        ...(rules.threadOr.length ? { OR: rules.threadOr } : {}),
        category: {
          ...notBoardCategory(),
          ...(rules.categoryAnd.length ? { AND: rules.categoryAnd } : {}),
        },
        lastPostAt: { gt: since },
      },
    },
    // Most recently active first, so the cap drops the quietest watches.
    orderBy: { thread: { lastPostAt: "desc" } },
    take: WATCHED_MAX,
    select: { thread: { select: candidateSelect(viewer.id) } },
  });
  return watches.map(({ thread }) => thread);
}

/** How many watched threads have posts the member has not read (the sidebar's Watched badge). */
export async function unreadWatchedCount(
  db: ListingDb,
  viewer: NonNullable<ForumViewer>,
  floor: Date
): Promise<number> {
  const rows = await watchedRows(db, viewer, floor);
  return (
    await readable(
      db,
      viewer,
      rows.filter((row) => unreadOf(row, floor))
    )
  ).length;
}
