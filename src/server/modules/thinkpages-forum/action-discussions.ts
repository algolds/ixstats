/**
 * "Discussed in": the forum posts that link an action, for the viewer who is asking (spec section 4). A link is only
 * a row; whether the viewer may see its post is the forum's own rule, applied here to every post: a post hidden to
 * members, one in a hidden thread, one in a staff category or in a Reports thread that is not the viewer's, and any
 * post (or board message) in a realm hidden from the viewer are dropped before they are counted or listed. A
 * moderator sees hidden posts, marked.
 *
 * Only a public activity has discussions (an abandoned directive turns private, and with it its backlinks go quiet),
 * and a persona's post is never listed or counted, for any viewer: a persona post that links a nation's action would
 * otherwise make "this persona is that nation's player" readable from the country side. An author is shown by name only.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import { postHref } from "~/lib/thinkpages-forum/links";
import { canSeeThread, type ForumViewer } from "./access";
import { canModerateCategory } from "./mod-scope";
import { authorsOf, visibleRealmOf, type AuthorsDb } from "./reads";
import type { ForumRealm } from "./realm-access";

export type DiscussionsDb = Pick<PrismaClient, "postActionLink" | "forumPost" | "realm"> &
  AuthorsDb;

export interface DiscussionItem {
  postId: string;
  href: string;
  /** The thread's title; "<Realm> board" for a board message. */
  title: string;
  kind: "thread" | "board";
  categoryName: string | null;
  realmName: string | null;
  author: { name: string };
  createdAt: Date;
  /** Present for moderators only: the post or its thread is hidden from members. */
  hidden?: true;
}

export interface DiscussionPage {
  items: DiscussionItem[];
  /** Opaque: pass it back to continue after the last link this page used, even if that link is gone. Null at the end. */
  nextCursor: string | null;
}

export interface DiscussionCount {
  count: number;
  /** The newest one or two visible post ids: enough to link a lone post straight to it. */
  postIds: string[];
}

const PAGE_SIZE = 20;
/** Links read per call; hidden ones do not take page slots, so one call may scan past 20. */
const SCAN = 100;
// ponytail: one bound for the whole counts call. It reads at most this many links, newest first, across ALL requested
// ids, then drops the ones this viewer cannot see. So one busy action (a country may link its own action any number of
// times) or many persona and hidden links can use the budget up and push the other cards, or the older links of the
// same card, to a count of 0 or too low. A 50-card page of ordinary traffic stays far below it. Upgrade path: a bounded
// scan per id (one take per activity), so a busy action can only shortchange itself.
const COUNT_SCAN = 1000;
const LONE_IDS = 2;

/** The cursor names the last link used by its time and id, so it still works after that link row is deleted. */
const encodeCursor = (link: { createdAt: Date; id: string }): string =>
  `${link.createdAt.getTime()}.${link.id}`;

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const dot = cursor.indexOf(".");
  const digits = cursor.slice(0, dot);
  const time = Number(digits);
  const id = cursor.slice(dot + 1);
  if (dot < 1 || !/^\d+$/.test(digits) || id === "" || !Number.isSafeInteger(time)) return null;
  const createdAt = new Date(time);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

/** The links after the cursor in (createdAt desc, id desc) order. */
const afterCursor = (at: { createdAt: Date; id: string }) => ({
  OR: [{ createdAt: { lt: at.createdAt } }, { createdAt: at.createdAt, id: { lt: at.id } }],
});

/** Only a public activity has backlinks (R3): a private one is a draft or a withdrawn directive. */
const PUBLIC_ACTIVITY = { visibility: "public" } as const;

const POST_SELECT = {
  id: true,
  hidden: true,
  createdAt: true,
  authorUserId: true,
  authorPersonaId: true,
  importedAuthorName: true,
  thread: {
    select: {
      id: true,
      title: true,
      hidden: true,
      authorUserId: true,
      category: {
        select: {
          id: true,
          key: true,
          name: true,
          style: true,
          visibility: true,
          scope: true,
          realmId: true,
        },
      },
    },
  },
} as const satisfies Prisma.ForumPostSelect;

type PostRow = Prisma.ForumPostGetPayload<{ select: typeof POST_SELECT }>;

interface Seen {
  row: PostRow;
  realm: ForumRealm | null;
  moderated: boolean;
}

/**
 * The linked posts the viewer may see, by post id. It applies, for each post, the same checks the forum applies when
 * it opens one, so a backlink can never point at a post the forum would not show:
 * - `resolvePostLocation` (post-location.ts), the thread post permalink: `canSeeThread` (which covers staff
 *   categories, a Reports thread that is not the viewer's, and a hidden thread), a hidden post needs a moderator of
 *   its category, and the category's realm must be visible to the viewer.
 * - `loadVisibleThread` (reads.ts), the thread page: the same `canSeeThread` and realm checks on the thread itself.
 * - `loadReadablePost` (reaction-target.ts): the same three checks for a thread post and for a realm board message,
 *   which `boardPostRealm` (board.ts) resolves for the board permalink by the hidden-post and realm rules alone.
 * Moderators keep hidden posts (the caller marks them). A persona's post is dropped for everyone (see the file head).
 */
async function visiblePosts(
  db: DiscussionsDb,
  viewer: ForumViewer,
  refs: readonly string[]
): Promise<Map<string, Seen>> {
  const seen = new Map<string, Seen>();
  if (refs.length === 0) return seen;
  const rows = await db.forumPost.findMany({
    where: { id: { in: [...new Set(refs)] } },
    select: POST_SELECT,
  });
  const readable = rows.filter((row) => {
    if (row.authorPersonaId) return false;
    const { category } = row.thread;
    if (!canSeeThread(viewer, row.thread, category)) return false;
    return !row.hidden || canModerateCategory(viewer, category);
  });
  const places = new Map(
    readable.map(({ thread: { category } }) => [
      `${category.scope}:${category.realmId ?? ""}`,
      category,
    ])
  );
  const realms = new Map(
    await Promise.all(
      [...places].map(
        async ([place, category]) => [place, await visibleRealmOf(db, viewer, category)] as const
      )
    )
  );
  for (const row of readable) {
    const { category } = row.thread;
    const realm = realms.get(`${category.scope}:${category.realmId ?? ""}`);
    if (realm === undefined) continue;
    seen.set(row.id, { row, realm, moderated: canModerateCategory(viewer, category) });
  }
  return seen;
}

type AuthorMaps = Awaited<ReturnType<typeof authorsOf>>;

function authorOf(row: PostRow, maps: AuthorMaps): { name: string } {
  const user = row.authorUserId ? maps.users.get(row.authorUserId) : undefined;
  return { name: user?.name ?? row.importedAuthorName ?? "Member" };
}

function itemOf({ row, realm, moderated }: Seen, maps: AuthorMaps): DiscussionItem {
  const { category, title } = row.thread;
  const onBoard = isBoardCategory(category);
  return {
    postId: row.id,
    href: postHref(row.id),
    title: onBoard ? `${realm?.name ?? "Realm"} board` : title,
    kind: onBoard ? "board" : "thread",
    categoryName: onBoard ? null : category.name,
    realmName: realm?.name ?? null,
    author: authorOf(row, maps),
    createdAt: row.createdAt,
    ...(moderated && (row.hidden || row.thread.hidden) ? { hidden: true as const } : {}),
  };
}

/** One page of the posts linking `activityId`, newest link first. Nothing for an activity that is not public. */
export async function discussionsOf(
  db: DiscussionsDb,
  viewer: ForumViewer,
  input: { activityId: string; cursor?: string }
): Promise<DiscussionPage> {
  // A cursor that does not parse reads as the end of the list.
  const at = input.cursor ? decodeCursor(input.cursor) : undefined;
  if (at === null) return { items: [], nextCursor: null };
  const links = await db.postActionLink.findMany({
    where: {
      activityId: input.activityId,
      postSource: "native",
      activity: PUBLIC_ACTIVITY,
      ...(at ? afterCursor(at) : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: SCAN + 1,
    select: { id: true, createdAt: true, postRef: true },
  });
  const scanned = links.slice(0, SCAN);
  const seen = await visiblePosts(
    db,
    viewer,
    scanned.map((l) => l.postRef)
  );
  const visible = scanned.filter((l) => seen.has(l.postRef));
  const shown = visible.slice(0, PAGE_SIZE);
  const rows = shown.map((l) => seen.get(l.postRef)!);
  const maps = await authorsOf(
    db,
    rows.map((s) => s.row.authorUserId),
    []
  );
  const items = rows.map((s) => itemOf(s, maps));
  let nextCursor: string | null = null;
  if (visible.length > PAGE_SIZE) nextCursor = encodeCursor(shown[PAGE_SIZE - 1]!);
  else if (links.length > SCAN) nextCursor = encodeCursor(scanned[SCAN - 1]!);
  return { items, nextCursor };
}

/**
 * The discussion count of each action, as `discussionsOf` would list them for this viewer: two queries (links, posts)
 * plus one realm read per distinct realm among the posts, however many ids. Every requested id is in the result; one
 * that is not public counts 0. Bounded by `COUNT_SCAN` (see the note there).
 */
export async function discussionCountsOf(
  db: DiscussionsDb,
  viewer: ForumViewer,
  activityIds: readonly string[]
): Promise<Record<string, DiscussionCount>> {
  const ids = [...new Set(activityIds)];
  const counts = new Map<string, DiscussionCount>(ids.map((id) => [id, { count: 0, postIds: [] }]));
  if (ids.length === 0) return Object.fromEntries(counts);
  const links = await db.postActionLink.findMany({
    where: { activityId: { in: ids }, postSource: "native", activity: PUBLIC_ACTIVITY },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: COUNT_SCAN,
    select: { activityId: true, postRef: true },
  });
  const seen = await visiblePosts(
    db,
    viewer,
    links.map((l) => l.postRef)
  );
  for (const l of links) {
    const entry = counts.get(l.activityId);
    if (!entry || !seen.has(l.postRef)) continue;
    entry.count += 1;
    if (entry.postIds.length < LONE_IDS) entry.postIds.push(l.postRef);
  }
  return Object.fromEntries(counts);
}
