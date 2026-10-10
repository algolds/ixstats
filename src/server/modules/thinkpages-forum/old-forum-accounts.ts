/**
 * Staff link an old XenForo account to an IxStats account (phase 4b: self-service forum linking is retired). The
 * link sets `User.forumUserId` / `forumUsername` and attributes the imported threads and posts of that XenForo
 * user at once (`relinkImportedAuthors`, scoped), so no import rerun is needed; re-linking to another id and
 * unlinking hand the previous id's attributed imported rows back to the old name. Native content (no `xenforoUserId`) is never touched.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { ForumError } from "./errors";
import { relinkImportedAuthors } from "./import-write";

export type OldForumAccountsDb = Pick<
  PrismaClient,
  "user" | "forumThread" | "forumPost" | "$transaction"
>;
type AccountsTx = Pick<Prisma.TransactionClient, "user" | "forumThread" | "forumPost">;

export interface OldForumLink {
  userId: string;
  xenforoUserId: number;
  /** The old forum name; when omitted, the name the imported content carries. */
  username?: string | null;
}

/** The name imported content carries for a XenForo user, if any was imported. */
async function importedNameOf(db: AccountsTx, xenforoUserId: number): Promise<string | null> {
  const where = { xenforoUserId, importedAuthorName: { not: null } };
  const post = await db.forumPost.findFirst({ where, select: { importedAuthorName: true } });
  if (post?.importedAuthorName) return post.importedAuthorName;
  const thread = await db.forumThread.findFirst({ where, select: { importedAuthorName: true } });
  return thread?.importedAuthorName ?? null;
}

/** Hands a XenForo user's imported rows attributed to `userId` back to the old name (`authorUserId` null). */
async function releaseImported(
  tx: AccountsTx,
  userId: string,
  xenforoUserId: number
): Promise<{ threads: number; posts: number }> {
  const where = { authorUserId: userId, xenforoUserId };
  const data = { authorUserId: null };
  return {
    threads: (await tx.forumThread.updateMany({ where, data })).count,
    posts: (await tx.forumPost.updateMany({ where, data })).count,
  };
}

const NONE = { threads: 0, posts: 0 };

export interface OldForumLinkResult {
  username: string;
  /** The XenForo id the user held before, when the link replaced a different one. */
  previousXenforoUserId: number | null;
  /** The previous id's rows handed back to the old name. */
  released: { threads: number; posts: number };
  relinked: { threads: number; posts: number };
}

/**
 * Links `userId` to an old XenForo account in one transaction. A different id the user held before is released
 * first (its imported rows go back to the old name), so a re-link never leaves the old account's posts attributed.
 */
export async function linkOldForumAccount(
  db: OldForumAccountsDb,
  link: OldForumLink
): Promise<OldForumLinkResult> {
  return db.$transaction(async (tx) => {
    const holder = await tx.user.findFirst({
      where: { forumUserId: link.xenforoUserId, id: { not: link.userId } },
      select: { id: true },
    });
    if (holder) {
      throw new ForumError(
        "CONFLICT",
        "Another account is already linked to this old forum account"
      );
    }
    const username = link.username?.trim() || (await importedNameOf(tx, link.xenforoUserId));
    if (!username) {
      throw new ForumError(
        "BAD_REQUEST",
        "No imported post carries this old forum id yet: type the old forum name"
      );
    }
    const current = await tx.user.findUnique({
      where: { id: link.userId },
      select: { forumUserId: true },
    });
    if (!current) throw new ForumError("NOT_FOUND", "User not found");
    const previous =
      current.forumUserId !== null && current.forumUserId !== link.xenforoUserId
        ? current.forumUserId
        : null;
    const released = previous === null ? NONE : await releaseImported(tx, link.userId, previous);
    await tx.user.update({
      where: { id: link.userId },
      data: { forumUserId: link.xenforoUserId, forumUsername: username, lastForumSync: new Date() },
    });
    const relinked = await relinkImportedAuthors(tx, link.xenforoUserId);
    return { username, previousXenforoUserId: previous, released, relinked };
  });
}

export async function unlinkOldForumAccount(
  db: OldForumAccountsDb,
  userId: string
): Promise<{ released: { threads: number; posts: number } }> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { forumUserId: true } });
    if (!user) throw new ForumError("NOT_FOUND", "User not found");
    const released =
      user.forumUserId === null ? NONE : await releaseImported(tx, userId, user.forumUserId);
    await tx.user.update({
      where: { id: userId },
      data: { forumUserId: null, forumUsername: null, lastForumSync: null },
    });
    return { released };
  });
}
