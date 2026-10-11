/**
 * The Home feed's forum items as post previews (sub-project 7): for each public thread `latestPublicThreads`
 * lists, the post the item refers to (a thread nobody answered: its first visible post; otherwise its newest visible
 * post), its persona-safe author, the board and realm it sits in, and the post's reaction total. Reads only the
 * listed threads, so the realm board (which `publicThreadWhere` leaves out) can never be previewed, and only visible
 * posts. The listing is `latestPublicThreads`' query, which Trending reads too.
 *
 * Queries for N listed threads: the listing with its authors and the published realms (the one realm read), one
 * `findMany` for the unanswered threads' first posts (one per thread, even if a post count is stale), one for the
 * answered threads' newest posts, and one authors read for the post authors. A per-thread `findFirst` happens only for
 * an answered thread whose newest post is hidden.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { categoryHref, postHref } from "~/lib/thinkpages-forum/links";
import {
  FEED_EXCERPT_MAX,
  previewExcerpt,
  type ForumFeedPreview,
} from "~/lib/thinkpages-forum/preview";
import { readReactionCounts, reactionTotal } from "~/lib/thinkpages-forum/reactions";
import { authorsOf, previewAuthorOf, type AuthorMaps } from "./authors";
import { IXWORLD_REALM } from "./realm-access";
import {
  authorRef,
  latestPublicThreads,
  type PlacedThread,
  type PublicForumThread,
  type PublishedRealm,
  type PublicThreadsDb,
} from "./public-threads";

export type ThreadPreviewDb = PublicThreadsDb;
type ForumFeedPreviewRealm = NonNullable<ForumFeedPreview["realm"]>;
export type PreviewedThread = PublicForumThread & {
  preview: ForumFeedPreview;
  /** When the previewed post was written; null when no post is visible. Never the thread's `lastPostAt` on an older post. */
  postedAt: Date | null;
};

const POST_SELECT = {
  id: true,
  threadId: true,
  authorUserId: true,
  authorPersonaId: true,
  importedAuthorName: true,
  plainText: true,
  reactionCounts: true,
  createdAt: true,
} as const satisfies Prisma.ForumPostSelect;
type PostRow = Prisma.ForumPostGetPayload<{ select: typeof POST_SELECT }>;

/** The first row of each thread, the rows being ordered best first. */
function firstPerThread(rows: readonly PostRow[]): Map<string, PostRow> {
  const out = new Map<string, PostRow>();
  for (const row of rows) if (!out.has(row.threadId)) out.set(row.threadId, row);
  return out;
}

/** The visible posts a preview is drawn from, by thread id. */
async function previewPosts(
  db: Pick<PrismaClient, "forumPost">,
  threads: readonly PlacedThread[]
): Promise<Map<string, PostRow>> {
  const unanswered = threads.filter((t) => t.replyCount === 0);
  const answered = threads.filter((t) => t.replyCount > 0);
  const [firsts, lasts] = await Promise.all([
    unanswered.length
      ? db.forumPost.findMany({
          where: { threadId: { in: unanswered.map((t) => t.id) }, hidden: false },
          // One post per thread however stale `postCount` is: the first visible one.
          distinct: ["threadId"],
          orderBy: [{ threadId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: POST_SELECT,
        })
      : [],
    answered.length
      ? db.forumPost.findMany({
          // A thread's `lastPostAt` is its newest post's time: that post, unless it is hidden.
          where: {
            hidden: false,
            OR: answered.map((t) => ({ threadId: t.id, createdAt: t.lastPostAt })),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: POST_SELECT,
        })
      : [],
  ]);
  const posts = firstPerThread(firsts);
  const newest = firstPerThread(lasts);
  // ponytail: one findFirst per answered thread whose newest post is hidden (or whose lastPostAt has drifted): at
  // most the listing's 20 threads, and none in the common case.
  const stale = answered.filter((t) => !newest.has(t.id));
  const fallbacks = await Promise.all(
    stale.map((t) =>
      db.forumPost.findFirst({
        where: { threadId: t.id, hidden: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: POST_SELECT,
      })
    )
  );
  for (const post of [...newest.values(), ...fallbacks]) if (post) posts.set(post.threadId, post);
  return posts;
}

/** The realms a preview names, by id; IxWorld goes by its `ixworld` slug and may have no row of its own. */
function realmsById(published: readonly PublishedRealm[]): Map<string, ForumFeedPreviewRealm> {
  const out = new Map<string, ForumFeedPreviewRealm>();
  for (const { id, slug, name, emblemUrl, thumbnail } of published) {
    // IxWorld always goes by its `ixworld` slug, even when its row carries the legacy slug "default".
    out.set(id, {
      slug: id === DEFAULT_REALM_ID ? IXWORLD_REALM.slug : slug,
      name,
      emblemUrl,
      thumbnail,
    });
  }
  if (!out.has(DEFAULT_REALM_ID)) {
    out.set(DEFAULT_REALM_ID, {
      slug: IXWORLD_REALM.slug,
      name: IXWORLD_REALM.name,
      emblemUrl: null,
      thumbnail: null,
    });
  }
  return out;
}

/** A preview says "started a thread" for an unanswered thread's first post by the thread's own author; any other post is a reply. */
function startsThread(thread: PlacedThread, post: PostRow | undefined): boolean {
  return thread.replyCount === 0 && (!post || authorRef(post) === thread.starter);
}

function previewOf(
  thread: PlacedThread,
  post: PostRow | undefined,
  authors: AuthorMaps,
  realms: Map<string, ForumFeedPreviewRealm>
): ForumFeedPreview {
  const { placement } = thread;
  const realm =
    placement.scope === "realm" && placement.realmId
      ? (realms.get(placement.realmId) ?? null)
      : null;
  // A realm category whose realm cannot be resolved links the thread instead of a wrong sitewide board.
  const board =
    placement.scope !== "realm" || realm
      ? { name: placement.name, href: categoryHref({ key: placement.key, realm }) }
      : { name: thread.categoryName, href: thread.href };
  return {
    threadId: thread.id,
    title: thread.title,
    threadHref: thread.href,
    postHref: post ? postHref(post.id) : thread.href,
    kind: startsThread(thread, post) ? "thread" : "reply",
    excerpt: post ? previewExcerpt(post.plainText, FEED_EXCERPT_MAX) : "",
    author: post
      ? previewAuthorOf(post, authors, thread.author)
      : { name: thread.author, avatarUrl: null, flagUrl: null, persona: thread.persona },
    board,
    realm,
    style: placement.style === "ic" ? "ic" : "ooc",
    replyCount: thread.replyCount,
    reactionTotal: post ? reactionTotal(readReactionCounts(post.reactionCounts)) : 0,
  };
}

/** The listed `threads` (with the realms the listing read) with the preview of the post each refers to. */
export async function withThreadPreviews(
  db: ThreadPreviewDb,
  threads: readonly PlacedThread[],
  published: readonly PublishedRealm[]
): Promise<PreviewedThread[]> {
  if (threads.length === 0) return [];
  const posts = await previewPosts(db, threads);
  const shown = [...posts.values()];
  // A persona's post never looks up its player.
  const authors = await authorsOf(
    db,
    shown.map((p) => (p.authorPersonaId ? null : p.authorUserId)),
    shown.map((p) => p.authorPersonaId)
  );
  const realms = realmsById(published);
  return threads.map(({ placement, persona, starter, ...thread }) => {
    const post = posts.get(thread.id);
    return {
      ...thread,
      preview: previewOf({ ...thread, placement, persona, starter }, post, authors, realms),
      postedAt: post?.createdAt ?? null,
    };
  });
}

/** The newest public threads by last activity, each with its preview. */
export async function latestPublicThreadPreviews(
  db: ThreadPreviewDb,
  limit: number
): Promise<PreviewedThread[]> {
  const { threads, realms } = await latestPublicThreads(db, limit);
  return withThreadPreviews(db, threads, realms);
}
