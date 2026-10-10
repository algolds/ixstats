/**
 * Realm board reads: the live message board on a realm's landing page. Its messages are the posts of the realm's one
 * board thread (board-thread.ts), read newest first with a post-id cursor. Hidden messages stay in for the board's
 * moderators, flagged, as in a thread (M9). Reached only through here: the generic thread paths refuse the board.
 */
import type { ForumCategory, PrismaClient } from "@prisma/client";
import { BOARD_MAX_PAGE_SIZE, BOARD_PAGE_SIZE } from "~/lib/thinkpages-forum/board";
import { isBoardCategory } from "~/lib/thinkpages-forum/categories";
import type { ForumViewer } from "./access";
import {
  boardAccessFor,
  boardSettingsOf,
  type BoardAccess,
  type BoardAccessDb,
} from "./board-access";
import {
  BOARD_POST_SELECT,
  shapeBoardMessages,
  type BoardMessage,
  type BoardMessageDb,
  type BoardPlace,
} from "./board-messages";
import { boardThreadOf } from "./board-thread";
import { ForumError } from "./errors";
import { canModerateCategory } from "./mod-scope";
import { canSeeRealm, loadForumRealm } from "./realm-access";
import { seedRealmCategories } from "./realm-seed";
import { hiddenFilter, visibleRealmOf } from "./reads";

export type BoardReadsDb = BoardMessageDb &
  BoardAccessDb &
  Pick<PrismaClient, "forumCategory" | "forumThread" | "forumPost">;

export interface BoardResult {
  realm: {
    id: string;
    slug: string;
    name: string;
    emblemUrl: string | null;
    memberCount: number;
    settings: { visitorsAllowed: boolean; slowModeSeconds: number };
  };
  messages: BoardMessage[];
  hasMore: boolean;
  access: BoardAccess;
}

/**
 * The realm's board for a viewer who may see the realm, else NOT_FOUND. A realm without its board (created outside
 * `adminCreateRealm`) is seeded on first read, as its section is.
 */
export async function loadBoard(
  db: BoardReadsDb,
  viewer: ForumViewer,
  ref: { slug: string } | { id: string }
): Promise<BoardPlace & { category: ForumCategory }> {
  const realm = await loadForumRealm(db, ref);
  if (!realm || !canSeeRealm(viewer, realm)) throw new ForumError("NOT_FOUND", "Realm not found.");
  let board = await boardThreadOf(db, realm.id);
  if (!board) {
    await seedRealmCategories(db, realm);
    board = await boardThreadOf(db, realm.id);
  }
  const category = board
    ? await db.forumCategory.findUnique({ where: { id: board.categoryId } })
    : null;
  if (!board || !category) throw new ForumError("NOT_FOUND", "Board not found.");
  return {
    realm,
    threadId: board.threadId,
    category,
    canModerate: canModerateCategory(viewer, category),
  };
}

const clampLimit = (limit: number): number =>
  Number.isFinite(limit)
    ? Math.min(BOARD_MAX_PAGE_SIZE, Math.max(1, Math.floor(limit)))
    : BOARD_PAGE_SIZE;

/** The distinct players who own a nation in the realm. */
async function memberCountOf(db: Pick<PrismaClient, "country">, realmId: string): Promise<number> {
  const owners = await db.country.groupBy({
    by: ["ownerUserId"],
    where: { realmId, ownerUserId: { not: null } },
  });
  return owners.length;
}

/** The posts older than the cursor post, as a where fragment (newest first by time, then id). */
async function olderThan(db: Pick<PrismaClient, "forumPost">, threadId: string, cursorId: string) {
  const cursor = await db.forumPost.findUnique({
    where: { id: cursorId },
    select: { id: true, threadId: true, createdAt: true },
  });
  if (!cursor || cursor.threadId !== threadId)
    throw new ForumError("NOT_FOUND", "Message not found.");
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export async function getBoard(
  db: BoardReadsDb,
  viewer: ForumViewer,
  realmSlug: string,
  opts: { before?: string; limit?: number } = {}
): Promise<BoardResult> {
  const place = await loadBoard(db, viewer, { slug: realmSlug });
  const limit = clampLimit(opts.limit ?? BOARD_PAGE_SIZE);
  const settings = await boardSettingsOf(db, place.realm.id);
  const cursor = opts.before ? await olderThan(db, place.threadId, opts.before) : {};
  const [rows, memberCount, access] = await Promise.all([
    db.forumPost.findMany({
      where: { threadId: place.threadId, ...hiddenFilter(viewer, place.category), ...cursor },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: BOARD_POST_SELECT,
    }),
    memberCountOf(db, place.realm.id),
    boardAccessFor(db, viewer, place.realm, settings, place.category),
  ]);
  const { id, slug, name } = place.realm;
  return {
    realm: {
      id,
      slug,
      name,
      emblemUrl: settings.emblemUrl,
      memberCount,
      settings: {
        visitorsAllowed: settings.visitorsAllowed,
        slowModeSeconds: settings.slowModeSeconds,
      },
    },
    messages: await shapeBoardMessages(db, viewer, place, rows.slice(0, limit)),
    hasMore: rows.length > limit,
    access,
  };
}

/**
 * Which realm's board holds a post the viewer may see (for the `/thinkpages/post/<id>` permalink), else null: an
 * unknown post, one outside any board, a hidden one (moderators see it) or one in a realm hidden from the viewer.
 */
export async function boardPostRealm(
  db: Pick<PrismaClient, "forumPost" | "realm">,
  viewer: ForumViewer,
  postId: string
): Promise<{ realmSlug: string } | null> {
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    select: {
      hidden: true,
      thread: {
        select: {
          category: {
            select: {
              id: true,
              key: true,
              style: true,
              scope: true,
              realmId: true,
              visibility: true,
            },
          },
        },
      },
    },
  });
  const category = post?.thread.category;
  if (!post || !category || !isBoardCategory(category)) return null;
  if (post.hidden && !canModerateCategory(viewer, category)) return null;
  const realm = await visibleRealmOf(db, viewer, category);
  return realm ? { realmSlug: realm.slug } : null;
}
