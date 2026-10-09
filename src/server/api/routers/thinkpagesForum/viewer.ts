/**
 * Shared by the forum routers (`thinkpagesForum`, `thinkpagesForumMod`): the signed-in user mapped to the module's
 * viewer with its moderator context (M10), ForumError mapped 1:1 to TRPCError, author display data as plain
 * objects (Maps do not serialize), and the shared input bounds. No raw user row leaves through here.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requireWikiUserId, requireWikiUserIds, type WikiAuthContext } from "~/lib/wiki-os/auth";
import { MAX_PAGE } from "~/lib/thinkpages-forum/paging";
import {
  authorsOf,
  ForumError,
  moderatorContext,
  type AuthorsDb,
  type ForumActor,
  type ForumUserAuthor,
  type ForumViewer,
  type ModeratorContext,
  type ScopeDb,
  type StashOwner,
} from "~/server/modules/thinkpages-forum";

/** Input bounds both routers share: ids, pages, category keys (the phase 1 regex) and realm slugs. */
export const id = z.string().min(1).max(64);
export const page = z.number().int().min(1).max(MAX_PAGE).default(1);
export const categoryKey = z.string().regex(/^[a-z0-9-]{2,40}$/);
/** A realm slug, bounded as in realms/region.ts. */
export const realm = z.string().min(1).max(100);

export function mapError(error: Error): never {
  if (error instanceof ForumError)
    throw new TRPCError({ code: error.code, message: error.message });
  throw error;
}

export interface ViewerSource {
  id: string;
  clerkUserId: string;
  countryId?: string | null;
  role?: { name: string; level: number } | null;
}

/** The signed-in user as a member, without what they moderate: for calls that never read it (M16). */
export function memberOf(user: ViewerSource): ForumActor {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    countryId: user.countryId ?? null,
    role: user.role ? { name: user.role.name, level: user.role.level } : null,
  };
}

/** The signed-in user with what they moderate; site admins cost no moderator query. */
export async function actorOf(
  db: ScopeDb,
  user: ViewerSource
): Promise<ForumActor & { mod: ModeratorContext }> {
  const actor = memberOf(user);
  return { ...actor, mod: await moderatorContext(db, actor) };
}

/** `actorOf` for reads open to anonymous visitors (null). `activeRealmId` stays the `realms` procedure's (T0-1). */
export async function viewerOf(
  db: ScopeDb,
  user: ViewerSource | null | undefined
): Promise<ForumViewer> {
  return user ? actorOf(db, user) : null;
}

/**
 * Display data for the authors of posts and threads, keyed by user id and persona id. A null author (imported
 * content, phase 4) gets no entry; the row's `importedAuthorName` names it.
 */
export async function authorMaps(
  db: AuthorsDb,
  rows: ReadonlyArray<{ authorUserId: string | null; authorPersonaId: string | null }>
) {
  const { users, personas } = await authorsOf(
    db,
    rows.map((r) => r.authorUserId),
    rows.map((r) => r.authorPersonaId)
  );
  return { users: Object.fromEntries(users), personas: Object.fromEntries(personas) };
}

/** Display data for the members a moderator list shows (null ids skipped), keyed by user id. */
export async function memberMaps(
  db: AuthorsDb,
  ids: ReadonlyArray<string | null | undefined>
): Promise<{ users: Record<string, ForumUserAuthor> }> {
  const { users } = await authorsOf(db, ids, []);
  return { users: Object.fromEntries(users) };
}

/** Whose stashes the caller owns: new rows go under their user id, reads match every id the stash system knows. */
export function stashOwnerOf(ctx: WikiAuthContext): StashOwner {
  return { primaryId: requireWikiUserId(ctx), ids: requireWikiUserIds(ctx) };
}
