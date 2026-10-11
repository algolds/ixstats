/**
 * The newest messages of a realm's board for surfaces outside the board (sub-project 7): Home's "Your realm" panel
 * and the realm overview's board block. A preview, not a board page: the newest three visible messages reduced to a
 * persona-safe author (`previewAuthorOf`, the one place that rule lives), an excerpt, a time and a link. Read-only:
 * unlike `getBoard` it never seeds a board. Hidden messages and the placeholders of continued messages are left out
 * for every viewer, moderators included (`PREVIEWED_BOARD_MESSAGES`, which the sidebar's "new" count shares).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { realmBoardHref } from "~/lib/thinkpages-forum/links";
import { postSummary } from "~/lib/thinkpages-forum/post-summary";
import {
  PANEL_EXCERPT_MAX,
  PANEL_MESSAGES,
  previewExcerpt,
  type BoardPreviewMessage,
} from "~/lib/thinkpages-forum/preview";
import type { ForumViewer } from "./access";
import { authorsOf, previewAuthorOf, type AuthorsDb } from "./authors";
import { boardThreadOf, PREVIEWED_BOARD_MESSAGES } from "./board-thread";
import { canSeeRealm, loadForumRealm, type ForumRealm } from "./realm-access";
import { myRealmOf } from "./realm-reads";

export type BoardPreviewDb = AuthorsDb &
  Pick<PrismaClient, "forumThread" | "forumPost" | "realm" | "country">;

export interface BoardPreview {
  realm: { slug: string; name: string; emblemUrl: string | null; thumbnail: string | null };
  messages: BoardPreviewMessage[];
}

const PREVIEW_SELECT = {
  id: true,
  authorUserId: true,
  authorPersonaId: true,
  importedAuthorName: true,
  plainText: true,
  contentHtml: true,
  createdAt: true,
} as const satisfies Prisma.ForumPostSelect;

/** The realm's newest board messages; the caller has checked the viewer may see the realm. */
async function previewOf(db: BoardPreviewDb, realm: ForumRealm): Promise<BoardPreview> {
  const [board, images] = await Promise.all([
    boardThreadOf(db, realm.id),
    // IxWorld may have no row (synthesized): it has no images to show.
    db.realm.findUnique({ where: { id: realm.id }, select: { emblemUrl: true, thumbnail: true } }),
  ]);
  const head = {
    slug: realm.slug,
    name: realm.name,
    emblemUrl: images?.emblemUrl ?? null,
    thumbnail: images?.thumbnail ?? null,
  };
  if (!board) return { realm: head, messages: [] };
  const rows = await db.forumPost.findMany({
    where: { threadId: board.threadId, ...PREVIEWED_BOARD_MESSAGES },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PANEL_MESSAGES,
    select: PREVIEW_SELECT,
  });
  const maps = await authorsOf(
    db,
    rows.map((row) => row.authorUserId),
    rows.map((row) => row.authorPersonaId)
  );
  return {
    realm: head,
    messages: rows.map((row) => ({
      id: row.id,
      author: previewAuthorOf(row, maps, "Member"),
      excerpt: previewExcerpt(postSummary(row), PANEL_EXCERPT_MAX),
      createdAt: row.createdAt,
      href: realmBoardHref(realm.slug, row.id),
    })),
  };
}

/** The board of the realm of the viewer's current country ("Your realm"); null without a realm, or when it is hidden. */
export async function realmPanel(
  db: BoardPreviewDb,
  viewer: NonNullable<ForumViewer>
): Promise<BoardPreview | null> {
  const realm = await myRealmOf(db, viewer);
  return realm ? previewOf(db, realm) : null;
}

/** A realm's board preview for anyone who may see the realm (a signed-out visitor included); null for an unknown or hidden one. */
export async function realmBoardPreview(
  db: BoardPreviewDb,
  viewer: ForumViewer,
  slug: string
): Promise<BoardPreview | null> {
  const realm = await loadForumRealm(db, { slug });
  if (!realm || !canSeeRealm(viewer, realm)) return null;
  return previewOf(db, realm);
}
