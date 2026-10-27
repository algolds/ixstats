/**
 * What a moderator may do to each author's content (I-1, M-8), so the UI offers only what the server allows: hide or
 * edit it (`moderable`: mod-scope's `mayModerateAuthor`, site admins' content is site admins') and warn or ban its
 * author (`sanctionable`: mod-scope's `sanctionRefusal` with the warning rule, never the viewer themself). Author
 * facts load in one user query per page plus one batch of `moderatorContext`'s three lookups for all of them. A null
 * author (imported content without an IxStats account, phase 4) is never looked up: any moderator of the category
 * may hide or edit it, and there is nobody to warn or ban.
 */
import type { PrismaClient } from "@prisma/client";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer, ModeratorContext } from "./access";
import {
  canModerateCategory,
  MEMBER_SELECT,
  MODERATOR_POWER,
  mayModerateAuthor,
  sanctionRefusal,
  type Member,
  type ScopedCategory,
  type ScopeDb,
} from "./mod-scope";

export type AuthorModerationDb = ScopeDb & Pick<PrismaClient, "user">;

export interface AuthorModeration {
  /** The viewer may hide or edit the author's content here. */
  moderable: boolean;
  /** The viewer may warn or ban the author from here. */
  sanctionable: boolean;
}

/** One author's verdict for content in a category. */
export type AuthorModerationOf = (
  authorUserId: string | null,
  category: ScopedCategory
) => AuthorModeration;

const ADMIN_CONTEXT: ModeratorContext = { siteAdmin: true, realmIds: [], categoryIds: [] };

/** `moderatorContext` for many members at once: the same three lookups, each batched over all of them. */
async function contextsFor(
  db: ScopeDb,
  members: readonly Member[]
): Promise<(member: Member) => ModeratorContext> {
  const plain = members.filter((m) => !isSiteAdmin(m));
  if (plain.length === 0) return () => ADMIN_CONTEXT;
  const clerkIds = plain.map((m) => m.clerkUserId);
  const [founded, officers, categories] = await Promise.all([
    db.realm.findMany({
      where: { ownerId: { in: clerkIds } },
      select: { id: true, ownerId: true },
    }),
    db.realmOfficer.findMany({
      where: { userId: { in: clerkIds }, powers: { has: MODERATOR_POWER } },
      select: { realmId: true, userId: true },
    }),
    db.forumCategoryModerator.findMany({
      where: { userId: { in: plain.map((m) => m.id) } },
      select: { categoryId: true, userId: true },
    }),
  ]);
  return (m) =>
    isSiteAdmin(m)
      ? ADMIN_CONTEXT
      : {
          siteAdmin: false,
          realmIds: [
            ...new Set([
              ...founded.filter((r) => r.ownerId === m.clerkUserId).map((r) => r.id),
              ...officers.filter((o) => o.userId === m.clerkUserId).map((o) => o.realmId),
            ]),
          ],
          categoryIds: categories.filter((c) => c.userId === m.id).map((c) => c.categoryId),
        };
}

/** `contextsFor` keyed by member id. */
export async function moderatorContexts(
  db: ScopeDb,
  members: readonly Member[]
): Promise<Map<string, ModeratorContext>> {
  const contextOf = await contextsFor(db, members);
  return new Map(members.map((m) => [m.id, contextOf(m)]));
}

/** The page's authors with their moderator contexts; an author whose user row is gone, or null, is absent. */
async function moderatedAuthors(
  db: AuthorModerationDb,
  authorIds: ReadonlyArray<string | null>
): Promise<Map<string, Member & { mod: ModeratorContext }>> {
  const ids = [...new Set(authorIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const rows = await db.user.findMany({ where: { id: { in: ids } }, select: MEMBER_SELECT });
  const members: Member[] = rows.map((row) => ({ ...row, countryId: null }));
  const contextOf = await contextsFor(db, members);
  return new Map(members.map((m) => [m.id, { ...m, mod: contextOf(m) }]));
}

/**
 * The viewer's verdict on each of a page's authors, per category: nothing where the viewer does not moderate it.
 * The server checks stay authoritative; this only keeps the UI from offering what they refuse.
 */
export async function authorModeration(
  db: AuthorModerationDb,
  viewer: ForumViewer,
  authorIds: ReadonlyArray<string | null>
): Promise<AuthorModerationOf> {
  const authors = await moderatedAuthors(db, authorIds);
  return (authorUserId, category) => {
    if (!canModerateCategory(viewer, category)) return { moderable: false, sanctionable: false };
    if (authorUserId === null) return { moderable: true, sanctionable: false };
    const author = authors.get(authorUserId) ?? null;
    const warnable = (target: NonNullable<ForumViewer>) => canModerateCategory(target, category);
    return {
      moderable: mayModerateAuthor(viewer, author),
      sanctionable:
        authorUserId !== viewer?.id && sanctionRefusal(author, "warned", warnable) === null,
    };
  };
}
