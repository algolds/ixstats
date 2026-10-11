/**
 * Forum reads. They return ids only; the router adds display names through `authorsOf` (one query per kind per
 * page). Hidden threads and posts are shown only to moderators of their category (M9; category counts stay
 * admin-only), a Reports (`reporter_staff`) thread only to its author and the category's moderators (M8), and a
 * category the viewer cannot see reads as NOT_FOUND so its existence does not leak. A realm category is looked up
 * by (scope, realmId, key), never by key alone, and a realm hidden from the viewer (draft, generating) hides its
 * categories, threads and posts.
 */
import type { ForumCategory, Prisma, PrismaClient } from "@prisma/client";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { isSiteAdmin } from "~/server/modules/realms";
import { canSeeCategory, canSeeThread, type ForumViewer } from "./access";
import { advertGate, advertRealmHiddenFrom, ADVERT_REALM_SELECT } from "./advert-access";
import { ForumError } from "./errors";
import { canModerateCategory } from "./mod-scope";
import { canSeeRealm, loadForumRealm, type ForumRealm, type RealmDb } from "./realm-access";
import { POSTS_PER_PAGE, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { threadOrderBy, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";

export { POSTS_PER_PAGE, THREADS_PER_PAGE };
export {
  authorsOf,
  type AuthorsDb,
  type ForumPersonaAuthor,
  type ForumUserAuthor,
} from "./authors";

export type ReadsDb = Pick<PrismaClient, "forumCategory" | "forumThread" | "forumPost" | "realm">;

const SITE_SCOPE = { scope: "site", realmId: null } as const;

interface PlacedCategory {
  id: string;
  scope: string;
  realmId: string | null;
  visibility: string;
}

const isAdmin = (viewer: ForumViewer): boolean => viewer !== null && isSiteAdmin(viewer);
/** Hidden threads and posts stay in for the category's moderators (M9). */
export const hiddenFilter = (viewer: ForumViewer, category: PlacedCategory): { hidden?: false } =>
  canModerateCategory(viewer, category) ? {} : { hidden: false };
/** M8: in a Reports category a member who does not moderate it sees only their own threads. */
const onlyOwnThreads = (viewer: ForumViewer, category: PlacedCategory): boolean =>
  category.visibility === "reporter_staff" && !canModerateCategory(viewer, category);
// Anonymous never sees a Reports category (canSeeCategory); an empty author id would match no thread regardless.
const ownAuthor = (viewer: ForumViewer) => ({ authorUserId: viewer?.id ?? "" });
export const ownThreadsWhere = (
  viewer: ForumViewer,
  category: PlacedCategory
): { authorUserId?: string } => (onlyOwnThreads(viewer, category) ? ownAuthor(viewer) : {});
const pageOf = (page: number): number =>
  Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;

/** Where a category sits: `realm` is a realm slug; absent or null means the sitewide section. */
export interface CategoryLocator {
  key: string;
  realm?: string | null;
}

const notFound = (what: string): ForumError => new ForumError("NOT_FOUND", `${what} not found.`);

/** The realm of a category the viewer may see: null for site scope, undefined when its realm is hidden or gone. */
export async function visibleRealmOf(
  db: RealmDb,
  viewer: ForumViewer,
  category: { scope: string; realmId: string | null }
): Promise<ForumRealm | null | undefined> {
  if (category.scope !== "realm") return null;
  const realm = category.realmId ? await loadForumRealm(db, { id: category.realmId }) : null;
  return realm && canSeeRealm(viewer, realm) ? realm : undefined;
}

/** The fields every read result carries about its category's place: scope, realm id, and the realm's slug and name. */
const placeOf = (
  category: { scope: string; realmId: string | null },
  realm: ForumRealm | null
) => ({
  scope: category.scope,
  realmId: category.realmId,
  realm: realm ? { slug: realm.slug, name: realm.name } : null,
});

/** The category (and its realm, for realm scope) the viewer may see, else NOT_FOUND. Shared by reads and writes. */
export async function loadCategory(
  db: Pick<ReadsDb, "forumCategory"> & RealmDb,
  viewer: ForumViewer,
  where: CategoryLocator
): Promise<{ category: ForumCategory; realm: ForumRealm | null }> {
  const realm = where.realm ? await loadForumRealm(db, { slug: where.realm }) : null;
  if (where.realm && (!realm || !canSeeRealm(viewer, realm))) throw notFound("Category");
  const scope = realm ? { scope: "realm", realmId: realm.id } : SITE_SCOPE;
  const category = await db.forumCategory.findFirst({ where: { ...scope, key: where.key } });
  // The realm board is no category page: its one thread is reached through the board reads and writes only.
  if (!category || isBoardCategory(category) || !canSeeCategory(viewer, category)) {
    throw notFound("Category");
  }
  return { category, realm };
}

/**
 * Thread counts and last activity for the categories the viewer may see, in one grouped query. Archived threads
 * (the Realm Board archive) count as threads but are not the latest activity (U12).
 */
export async function summarizeCategories(
  db: Pick<ReadsDb, "forumThread">,
  viewer: ForumViewer,
  categories: readonly ForumCategory[]
) {
  const visible = categories.filter((c) => canSeeCategory(viewer, c) && !isBoardCategory(c));
  const ids = (list: readonly ForumCategory[]) => list.map((c) => c.id);
  const own = visible.filter((c) => onlyOwnThreads(viewer, c));
  const all = visible.filter((c) => !onlyOwnThreads(viewer, c));
  const stats = await db.forumThread.groupBy({
    by: ["categoryId", "archived"],
    where: {
      ...(isAdmin(viewer) ? {} : { hidden: false }),
      ...advertGate(viewer),
      OR: [
        { categoryId: { in: ids(all) } },
        ...(own.length > 0 ? [{ categoryId: { in: ids(own) }, ...ownAuthor(viewer) }] : []),
      ],
    },
    _count: { _all: true },
    _max: { lastPostAt: true },
  });
  const byCategory = new Map<string, { threadCount: number; lastPostAt: Date | null }>();
  for (const row of stats) {
    const sum = byCategory.get(row.categoryId) ?? { threadCount: 0, lastPostAt: null };
    byCategory.set(row.categoryId, {
      threadCount: sum.threadCount + row._count._all,
      lastPostAt: row.archived ? sum.lastPostAt : (row._max.lastPostAt ?? null),
    });
  }
  return visible.map((c) => ({
    key: c.key,
    name: c.name,
    description: c.description,
    icAllowed: c.icAllowed,
    postRole: c.postRole,
    threadCount: byCategory.get(c.id)?.threadCount ?? 0,
    lastPostAt: byCategory.get(c.id)?.lastPostAt ?? null,
  }));
}

export async function getCategoryThreads(
  db: Pick<ReadsDb, "forumCategory" | "forumThread" | "realm">,
  viewer: ForumViewer,
  where: CategoryLocator,
  page: number,
  sort: ThreadSort = "latest"
) {
  const { category, realm } = await loadCategory(db, viewer, where);
  const threadWhere = {
    categoryId: category.id,
    ...hiddenFilter(viewer, category),
    ...ownThreadsWhere(viewer, category),
    ...advertGate(viewer),
  };
  const [threads, total] = await Promise.all([
    db.forumThread.findMany({
      where: threadWhere,
      orderBy: threadOrderBy(sort),
      skip: (pageOf(page) - 1) * THREADS_PER_PAGE,
      take: THREADS_PER_PAGE,
      select: {
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
        advertRealm: { select: ADVERT_REALM_SELECT },
      },
    }),
    db.forumThread.count({ where: threadWhere }),
  ]);
  return {
    category: {
      id: category.id,
      key: category.key,
      name: category.name,
      description: category.description,
      icAllowed: category.icAllowed,
      postRole: category.postRole,
      visibility: category.visibility,
      style: category.style,
      ...placeOf(category, realm),
    },
    threads,
    total,
    canModerate: canModerateCategory(viewer, category),
    /** For the caller's posting access (N1: no second realm read); never sent to a client whole. */
    forumRealm: realm,
  };
}

/**
 * The thread fields a thread read returns: an explicit list, so the XenForo author id (`xenforoUserId`) and the
 * archive provenance (`sourceRef`) never reach a client.
 */
const THREAD_FIELDS = {
  id: true,
  categoryId: true,
  title: true,
  authorUserId: true,
  authorPersonaId: true,
  importedAuthorName: true,
  xenforoThreadId: true,
  pinned: true,
  locked: true,
  hidden: true,
  archived: true,
  postCount: true,
  lastPostAt: true,
  createdAt: true,
} as const satisfies Prisma.ForumThreadSelect;

/**
 * The thread the viewer may read (the canSeeThread rule, and its realm visible), else NOT_FOUND: a thread they cannot
 * see reads as one that does not exist. Shared by the thread read and by stashing.
 */
export async function loadVisibleThread(db: ReadsDb, viewer: ForumViewer, threadId: string) {
  const row = await db.forumThread.findUnique({
    where: { id: threadId },
    select: { ...THREAD_FIELDS, category: true, advertRealm: { select: ADVERT_REALM_SELECT } },
  });
  // The realm board's thread is no thread page: its messages are read through board.ts.
  if (!row || isBoardCategory(row.category) || !canSeeThread(viewer, row, row.category))
    throw notFound("Thread");
  const realm = await visibleRealmOf(db, viewer, row.category);
  // An advert of a realm the viewer cannot see does not exist for them.
  if (realm === undefined || advertRealmHiddenFrom(viewer, row.advertRealm))
    throw notFound("Thread");
  const { category, advertRealm, ...thread } = row;
  return { thread, category, realm, advertRealm };
}

export async function getThreadPosts(
  db: ReadsDb,
  viewer: ForumViewer,
  threadId: string,
  page: number
) {
  const { thread, category, realm, advertRealm } = await loadVisibleThread(db, viewer, threadId);
  const where = { threadId, ...hiddenFilter(viewer, category) };
  const [posts, total] = await Promise.all([
    db.forumPost.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (pageOf(page) - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
      select: {
        id: true,
        authorUserId: true,
        authorPersonaId: true,
        importedAuthorName: true,
        contentHtml: true,
        contentWikitext: true, // Never sent whole: the router keeps it only for posts the viewer may edit.
        editedAt: true,
        createdAt: true,
        hidden: true,
        reactionCounts: true,
      },
    }),
    db.forumPost.count({ where }),
  ]);
  return {
    thread,
    category: {
      id: category.id,
      key: category.key,
      name: category.name,
      icAllowed: category.icAllowed,
      visibility: category.visibility,
      postRole: category.postRole,
      style: category.style,
      ...placeOf(category, realm),
    },
    posts,
    total,
    canModerate: canModerateCategory(viewer, category),
    /** For the caller's posting access (N1: no second realm read); never sent to a client whole. */
    forumRealm: realm,
    /** The realm this thread advertises (a Find a Realm advert), else null; never sent whole (it carries the founder). */
    advertRealm,
  };
}
