/**
 * Who wrote an imported XenForo thread or post (phase 4, Q3). A XenForo user id resolves to an IxStats user only
 * through `User.forumUserId` (the database map), never by name. Everyone else keeps their XenForo name with no
 * account; guests (`user_id: 0`) have no XenForo id either.
 */

export interface LinkedForumUser {
  id: string;
  forumUserId: number;
  createdAt: Date;
}

export interface ForumAuthorMap {
  /** XenForo user id → IxStats user id. */
  byForumId: Map<number, string>;
  /** Forum ids linked to more than one user, the chosen one first. */
  duplicates: Array<{ forumUserId: number; userIds: string[] }>;
}

export interface ImportedAuthor {
  authorUserId: string | null;
  importedAuthorName: string;
  xenforoUserId: number | null;
}

const earliestFirst = (a: LinkedForumUser, b: LinkedForumUser): number =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** A forum id linked to several users resolves to the earliest `createdAt`, then the smallest id, and is reported. */
export function resolveAuthors(users: readonly LinkedForumUser[]): ForumAuthorMap {
  const linked = new Map<number, LinkedForumUser[]>();
  for (const user of [...users].sort(earliestFirst)) {
    linked.set(user.forumUserId, [...(linked.get(user.forumUserId) ?? []), user]);
  }
  const byForumId = new Map<number, string>();
  const duplicates: ForumAuthorMap["duplicates"] = [];
  for (const [forumUserId, list] of linked) {
    byForumId.set(forumUserId, list[0]!.id);
    if (list.length > 1) duplicates.push({ forumUserId, userIds: list.map((u) => u.id) });
  }
  return { byForumId, duplicates };
}

const GUEST_USER_ID = 0;

export function authorOf(
  byForumId: ReadonlyMap<number, string>,
  xfUserId: number,
  username: string
): ImportedAuthor {
  const name = username.trim();
  if (xfUserId === GUEST_USER_ID) {
    return { authorUserId: null, importedAuthorName: name || "Guest", xenforoUserId: null };
  }
  return {
    authorUserId: byForumId.get(xfUserId) ?? null,
    importedAuthorName: name || "Member",
    xenforoUserId: xfUserId,
  };
}
