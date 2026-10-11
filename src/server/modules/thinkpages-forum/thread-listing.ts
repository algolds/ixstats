/**
 * The New posts and Watched lists (spec section 3). Both read candidate threads with the member's own read mark joined
 * in the one query (`reads`, filtered to the member), keep what the member may read (the thread rule, the realm's
 * visibility) and what is unread, and page the result. The realm board never appears: it is left out of the query and
 * dropped again here. A persona thread is named by the persona only, never the player.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isBoardCategory,
  notBoardCategory,
  visibleForumVisibilities,
} from "~/lib/thinkpages-forum/categories";
import { UNPUBLISHED_REALM_STATUSES } from "~/lib/realms/realm-ids";
import { THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { isUnread } from "~/lib/thinkpages-forum/unread";
import { DEFAULT_REALM_ID, isSiteAdmin } from "~/server/modules/realms";
import { canSeeThread, type ForumViewer } from "./access";
import {
  advertGate,
  advertRealmHiddenFrom,
  advertRowOf,
  ADVERT_REALM_SELECT,
  type AdvertRow,
} from "./advert-access";
import { canSeeRealm, loadForumRealms, type ForumRealm } from "./realm-access";
import type { ReadsDb } from "./reads";
import { threadLastPosters, type ThreadLastPoster } from "./thread-extras";
import { readerFloor, type UnreadDb } from "./unread";

export type ListingDb = ReadsDb & UnreadDb & Pick<PrismaClient, "forumThreadWatch">;

/**
 * Candidate rows read for New posts, newest first (the thirty-day window bounds it; this is the backstop).
 * ponytail: the Reports and unpublished-realm rules are in the query, but "already read" compares two columns of
 * different tables and is filtered here, so a member who has read more than this many newer threads of the window
 * sees the oldest unread ones missing until they read or mark some. Past that, move the compare into SQL.
 */
const NEW_POSTS_MAX = 1000;
/** Watches read for the Watched page and the sidebar count. */
const WATCHED_MAX = 500;

export interface ListedThread {
  id: string;
  title: string;
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
  xenforoThreadId: number | null;
  pinned: boolean;
  locked: boolean;
  hidden: false;
  postCount: number;
  lastPostAt: Date;
  unread: boolean;
  board: { key: string; name: string; realm: { slug: string; name: string } | null };
  lastPoster: ThreadLastPoster | null;
  /** The realm this thread advertises (Find a Realm), else null. */
  advert: AdvertRow | null;
}

export interface ThreadListing {
  threads: ListedThread[];
  total: number;
}

const candidateSelect = (userId: string) =>
  ({
    id: true,
    title: true,
    authorUserId: true,
    authorPersonaId: true,
    importedAuthorName: true,
    xenforoThreadId: true,
    pinned: true,
    locked: true,
    hidden: true,
    postCount: true,
    lastPostAt: true,
    category: {
      select: {
        id: true,
        key: true,
        name: true,
        style: true,
        scope: true,
        realmId: true,
        visibility: true,
      },
    },
    advertRealm: { select: ADVERT_REALM_SELECT },
    reads: { where: { userId }, select: { readAt: true } },
  }) as const satisfies Prisma.ForumThreadSelect;

type Candidate = Prisma.ForumThreadGetPayload<{ select: ReturnType<typeof candidateSelect> }>;
interface Placed {
  row: Candidate;
  realm: ForumRealm | null;
}

/** Hidden last posts never show in a list, whoever asks: the listing reads as a member. */
const LISTING_VIEW = { id: "", scope: "site", realmId: null, visibility: "public" } as const;

const unreadOf = (row: Candidate, floor: Date): boolean =>
  isUnread(row.lastPostAt, row.reads[0]?.readAt, floor);

/**
 * What the member may read: not the board, not hidden, the thread rule, and a realm that is visible to them. The
 * distinct realms of the rows that pass are loaded in one read, then each row is placed synchronously.
 */
async function readable(
  db: ReadsDb,
  viewer: NonNullable<ForumViewer>,
  rows: readonly Candidate[]
): Promise<Placed[]> {
  const passing = rows.filter(
    (row) =>
      !isBoardCategory(row.category) &&
      !row.hidden &&
      canSeeThread(viewer, row, row.category) &&
      !advertRealmHiddenFrom(viewer, row.advertRealm)
  );
  const realmIds = new Set<string>();
  for (const { category } of passing) {
    if (category.scope === "realm" && category.realmId) realmIds.add(category.realmId);
  }
  const realms = await loadForumRealms(db, [...realmIds]);
  const placed: Placed[] = [];
  for (const row of passing) {
    const { category } = row;
    if (category.scope !== "realm") {
      placed.push({ row, realm: null });
      continue;
    }
    const realm = category.realmId ? realms.get(category.realmId) : undefined;
    if (realm && canSeeRealm(viewer, realm)) placed.push({ row, realm });
  }
  return placed;
}

async function shape(
  db: ReadsDb,
  placed: readonly Placed[],
  unread: ReadonlySet<string>
): Promise<ListedThread[]> {
  const posters = await threadLastPosters(
    db,
    null,
    LISTING_VIEW,
    placed.map(({ row }) => row.id)
  );
  return placed.map(({ row, realm }) => ({
    id: row.id,
    title: row.title,
    authorUserId: row.authorPersonaId ? null : row.authorUserId,
    authorPersonaId: row.authorPersonaId,
    importedAuthorName: row.authorPersonaId ? null : row.importedAuthorName,
    xenforoThreadId: row.xenforoThreadId,
    pinned: row.pinned,
    locked: row.locked,
    hidden: false,
    postCount: row.postCount,
    lastPostAt: row.lastPostAt,
    unread: unread.has(row.id),
    board: {
      key: row.category.key,
      name: row.category.name,
      realm: realm ? { slug: realm.slug, name: realm.name } : null,
    },
    lastPoster: posters.get(row.id) ?? null,
    advert: advertRowOf(row.advertRealm),
  }));
}

const pageOf = <T>(items: readonly T[], page: number): T[] =>
  items.slice((Math.max(1, page) - 1) * THREADS_PER_PAGE, Math.max(1, page) * THREADS_PER_PAGE);

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

/** Unread threads of the window across every board the member can see, newest first. */
export async function listNewPosts(
  db: ListingDb,
  viewer: NonNullable<ForumViewer>,
  page: number
): Promise<ThreadListing> {
  const [floor, rules] = await Promise.all([readerFloor(db, viewer.id), readableRules(db, viewer)]);
  const rows = await db.forumThread.findMany({
    where: {
      hidden: false,
      lastPostAt: { gt: floor },
      ...advertGate(viewer),
      ...(rules.threadOr.length ? { OR: rules.threadOr } : {}),
      category: {
        ...notBoardCategory(),
        visibility: {
          in: [...visibleForumVisibilities({ signedIn: true, siteAdmin: isSiteAdmin(viewer) })],
        },
        ...(rules.categoryAnd.length ? { AND: rules.categoryAnd } : {}),
      },
    },
    orderBy: { lastPostAt: "desc" },
    take: NEW_POSTS_MAX,
    select: candidateSelect(viewer.id),
  });
  const placed = await readable(
    db,
    viewer,
    rows.filter((row) => unreadOf(row, floor))
  );
  const shown = pageOf(placed, page);
  return {
    threads: await shape(db, shown, new Set(shown.map(({ row }) => row.id))),
    total: placed.length,
  };
}

/** The member's watched threads that are not the realm board; `since` keeps only those with a post after it. */
async function watchedRows(
  db: ListingDb,
  viewer: NonNullable<ForumViewer>,
  since: Date | null
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
        ...(since ? { lastPostAt: { gt: since } } : {}),
      },
    },
    // Most recently active first, so the cap drops the quietest watches and the list agrees with the badge.
    orderBy: { thread: { lastPostAt: "desc" } },
    take: WATCHED_MAX,
    select: { thread: { select: candidateSelect(viewer.id) } },
  });
  return watches.map(({ thread }) => thread);
}

/** Watched threads, unread first and then by last post. */
export async function listWatched(
  db: ListingDb,
  viewer: NonNullable<ForumViewer>,
  page: number
): Promise<ThreadListing> {
  const floor = await readerFloor(db, viewer.id);
  const placed = await readable(db, viewer, await watchedRows(db, viewer, null));
  const unread = new Set(placed.filter(({ row }) => unreadOf(row, floor)).map(({ row }) => row.id));
  const ordered = [...placed].sort(
    (a, b) =>
      Number(unread.has(b.row.id)) - Number(unread.has(a.row.id)) ||
      b.row.lastPostAt.getTime() - a.row.lastPostAt.getTime()
  );
  const shown = pageOf(ordered, page);
  return { threads: await shape(db, shown, unread), total: ordered.length };
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
