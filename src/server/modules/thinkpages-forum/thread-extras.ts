/**
 * What the thread page adds to its posts: each author's role pill (Staff, Officer, Thread starter) and the
 * Participants panel. A persona post never reveals the player behind it, so it gets no role from the player's
 * standing and participants count it under the persona, never under the player.
 */
import type { PrismaClient } from "@prisma/client";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { hiddenFilter } from "./reads";

export type PostRole = "staff" | "officer" | "starter";

/** The thread's starter is a persona (`starterPersonaId`) or, when that is null, the player (`starterUserId`). */
export interface RoleContext {
  staffUserIds: ReadonlySet<string>;
  officerUserIds: ReadonlySet<string>;
  starterUserId: string | null;
  starterPersonaId: string | null;
}

interface PostAuthor {
  authorUserId: string | null;
  authorPersonaId: string | null;
}

/** One role per post, by priority staff > officer > starter. A persona post is a starter's post or has no role. */
export function roleOf(post: PostAuthor, ctx: RoleContext): PostRole | null {
  if (post.authorPersonaId !== null) {
    return post.authorPersonaId === ctx.starterPersonaId ? "starter" : null;
  }
  const id = post.authorUserId;
  if (id === null) return null;
  if (ctx.staffUserIds.has(id)) return "staff";
  if (ctx.officerUserIds.has(id)) return "officer";
  return ctx.starterPersonaId === null && id === ctx.starterUserId ? "starter" : null;
}

type RolesDb = Pick<PrismaClient, "user" | "realmOfficer">;

/**
 * Staff (the site-admin rule) among the page's player authors, and the officers of the thread's realm, in two
 * queries. `RealmOfficer.userId` is a Clerk id, so officers map back through `User.clerkUserId`. Persona authors
 * are never loaded: their player is not looked at.
 */
export async function roleContextOf(
  db: RolesDb,
  thread: PostAuthor,
  category: { scope: string; realmId: string | null },
  posts: readonly PostAuthor[]
): Promise<RoleContext> {
  const ids = [
    ...new Set(
      posts.flatMap((p) => (p.authorPersonaId === null && p.authorUserId ? [p.authorUserId] : []))
    ),
  ];
  const ctx: RoleContext = {
    staffUserIds: new Set(),
    officerUserIds: new Set(),
    starterUserId: thread.authorUserId,
    starterPersonaId: thread.authorPersonaId,
  };
  if (ids.length === 0) return ctx;
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, clerkUserId: true, role: { select: { name: true, level: true } } },
  });
  const officers =
    category.scope === "realm" && category.realmId
      ? await db.realmOfficer.findMany({
          where: { realmId: category.realmId, userId: { in: users.map((u) => u.clerkUserId) } },
          select: { userId: true },
        })
      : [];
  const officerClerkIds = new Set(officers.map((o) => o.userId));
  return {
    ...ctx,
    staffUserIds: new Set(users.filter((u) => isSiteAdmin(u)).map((u) => u.id)),
    officerUserIds: new Set(
      users.filter((u) => officerClerkIds.has(u.clerkUserId)).map((u) => u.id)
    ),
  };
}

export interface ThreadParticipant extends PostAuthor {
  importedAuthorName: string | null;
  posts: number;
}

/**
 * The thread's most active authors by visible post count (hidden posts only for the category's moderators). A
 * persona's posts are counted under the persona (`authorUserId: null`), so the player stays unnamed.
 */
export async function threadParticipants(
  db: Pick<PrismaClient, "forumPost">,
  viewer: ForumViewer,
  category: { id: string; scope: string; realmId: string | null; visibility: string },
  threadId: string,
  limit = 6
): Promise<ThreadParticipant[]> {
  const groups = await db.forumPost.groupBy({
    by: ["authorUserId", "authorPersonaId", "importedAuthorName"],
    where: { threadId, ...hiddenFilter(viewer, category) },
    _count: { _all: true },
  });
  const merged = new Map<string, ThreadParticipant>();
  for (const g of groups) {
    const author = g.authorPersonaId !== null ? null : g.authorUserId;
    const key = g.authorPersonaId
      ? `persona:${g.authorPersonaId}`
      : author
        ? `user:${author}`
        : `imported:${g.importedAuthorName ?? ""}`;
    const row = merged.get(key) ?? {
      authorUserId: author,
      authorPersonaId: g.authorPersonaId,
      importedAuthorName: g.importedAuthorName,
      posts: 0,
    };
    merged.set(key, { ...row, posts: row.posts + g._count._all });
  }
  return [...merged.values()].sort((a, b) => b.posts - a.posts).slice(0, limit);
}
