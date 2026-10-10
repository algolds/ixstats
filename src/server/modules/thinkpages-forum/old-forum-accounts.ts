/**
 * Staff link an old XenForo account to an IxStats account (phase 4b: self-service forum linking is retired). The
 * link sets `User.forumUserId` / `forumUsername` and attributes the imported threads and posts of that XenForo
 * user at once (`relinkImportedAuthors`, scoped), so no import rerun is needed; unlinking hands the attributed
 * imported rows back to the old name. Native content (no `xenforoUserId`) is never touched.
 */
import type { PrismaClient } from "@prisma/client";
import { ForumError } from "./errors";
import { relinkImportedAuthors } from "./import-write";

export type OldForumAccountsDb = Pick<PrismaClient, "user" | "forumThread" | "forumPost">;

export interface OldForumLink {
  userId: string;
  xenforoUserId: number;
  /** The old forum name; when omitted, the name the imported content carries. */
  username?: string | null;
}

/** The name imported content carries for a XenForo user, if any was imported. */
async function importedNameOf(db: OldForumAccountsDb, xenforoUserId: number): Promise<string | null> {
  const where = { xenforoUserId, importedAuthorName: { not: null } };
  const post = await db.forumPost.findFirst({ where, select: { importedAuthorName: true } });
  if (post?.importedAuthorName) return post.importedAuthorName;
  const thread = await db.forumThread.findFirst({ where, select: { importedAuthorName: true } });
  return thread?.importedAuthorName ?? null;
}

export async function linkOldForumAccount(
  db: OldForumAccountsDb,
  link: OldForumLink
): Promise<{ username: string; relinked: { threads: number; posts: number } }> {
  const holder = await db.user.findFirst({
    where: { forumUserId: link.xenforoUserId, id: { not: link.userId } },
    select: { id: true },
  });
  if (holder) {
    throw new ForumError("CONFLICT", "Another account is already linked to this old forum account");
  }
  const username = link.username?.trim() || (await importedNameOf(db, link.xenforoUserId));
  if (!username) {
    throw new ForumError(
      "BAD_REQUEST",
      "No imported post carries this old forum id yet: type the old forum name"
    );
  }
  await db.user.update({
    where: { id: link.userId },
    data: { forumUserId: link.xenforoUserId, forumUsername: username, lastForumSync: new Date() },
  });
  return { username, relinked: await relinkImportedAuthors(db, link.xenforoUserId) };
}

export async function unlinkOldForumAccount(
  db: OldForumAccountsDb,
  userId: string
): Promise<{ released: { threads: number; posts: number } }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { forumUserId: true } });
  if (!user) throw new ForumError("NOT_FOUND", "User not found");
  const released = { threads: 0, posts: 0 };
  if (user.forumUserId !== null) {
    const where = { authorUserId: userId, xenforoUserId: user.forumUserId };
    const data = { authorUserId: null };
    released.threads = (await db.forumThread.updateMany({ where, data })).count;
    released.posts = (await db.forumPost.updateMany({ where, data })).count;
  }
  await db.user.update({
    where: { id: userId },
    data: { forumUserId: null, forumUsername: null, lastForumSync: null },
  });
  return { released };
}
