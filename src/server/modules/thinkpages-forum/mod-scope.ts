/**
 * Moderation scope (phase 3). Site admins moderate everywhere; a realm's founder and its officers with the `board`
 * power moderate the realm's categories; category moderators their category (M10, M19). Site-scope actions (site
 * bans, sitewide warnings) are site admins' only. Nobody warns or bans a site admin or a moderator of the place (M5).
 * The checks here are pure over `ForumViewer.mod`; `moderatorContext` computes it.
 */
import type { PrismaClient } from "@prisma/client";
import { BAN_SCOPES, type BanScope } from "~/lib/thinkpages-forum/moderation-policy";
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms";
import type { ForumViewer, ModeratorContext } from "./access";
import { ForumError } from "./errors";

export type ModScope =
  { kind: "site" } | { kind: "realm"; realmId: string } | { kind: "category"; categoryId: string };
export type ScopeDb = Pick<PrismaClient, "realm" | "realmOfficer" | "forumCategoryModerator">;
export type CategoryScopeDb = Pick<PrismaClient, "forumCategory">;
export type SanctionDb = ScopeDb & Pick<PrismaClient, "user">;
export type LockDb = Pick<PrismaClient, "$executeRaw">;

/** The realm officer power that makes an officer a moderator of the realm's forum (M10). */
export const MODERATOR_POWER = "board";

/** A member as `isSiteAdmin` needs them (id, Clerk id, role). */
export type Member = RealmActor & { countryId: null };
export const MEMBER_SELECT = {
  id: true,
  clerkUserId: true,
  role: { select: { name: true, level: true } },
} as const;

export interface ScopedCategory {
  id: string;
  scope: string;
  realmId: string | null;
}

/**
 * Site admin flag, realms the actor founded or serves as an officer with `board`, categories they moderate (M10).
 * T0-10: founder and officer rows match by Clerk id, category moderators by User.id. Site admins moderate
 * everything, so their lists stay empty and cost no query.
 */
export async function moderatorContext(db: ScopeDb, actor: RealmActor): Promise<ModeratorContext> {
  if (isSiteAdmin(actor)) return { siteAdmin: true, realmIds: [], categoryIds: [] };
  const [founded, officers, categories] = await Promise.all([
    db.realm.findMany({ where: { ownerId: actor.clerkUserId }, select: { id: true } }),
    db.realmOfficer.findMany({
      where: { userId: actor.clerkUserId, powers: { has: MODERATOR_POWER } },
      select: { realmId: true },
    }),
    db.forumCategoryModerator.findMany({
      where: { userId: actor.id },
      select: { categoryId: true },
    }),
  ]);
  return {
    siteAdmin: false,
    realmIds: [...new Set([...founded.map((r) => r.id), ...officers.map((o) => o.realmId)])],
    categoryIds: categories.map((c) => c.categoryId),
  };
}

/** Moderates anything at all. */
export function isModerator(viewer: ForumViewer): boolean {
  if (viewer === null) return false;
  if (isSiteAdmin(viewer)) return true;
  return (viewer.mod?.realmIds.length ?? 0) > 0 || (viewer.mod?.categoryIds.length ?? 0) > 0;
}

/** Site admin, or the category's realm is in mod.realmIds, or its id is in mod.categoryIds. */
export function canModerateCategory(viewer: ForumViewer, category: ScopedCategory): boolean {
  if (viewer === null) return false;
  if (isSiteAdmin(viewer)) return true;
  const mod = viewer.mod;
  if (!mod) return false;
  if (
    category.scope === "realm" &&
    category.realmId !== null &&
    mod.realmIds.includes(category.realmId)
  )
    return true;
  return mod.categoryIds.includes(category.id);
}

/**
 * Site → site admins only (site bans are admin-only); realm → site admins or the realm's moderators; category →
 * site admins, the moderators of `categoryRealmId` (the category's realm, resolved by the caller; pass null for a
 * sitewide category and for site and realm scopes) or of the category.
 */
export function canActInScope(
  viewer: ForumViewer,
  scope: ModScope,
  categoryRealmId: string | null
): boolean {
  if (viewer === null) return false;
  if (isSiteAdmin(viewer)) return true;
  if (scope.kind === "site") return false;
  if (scope.kind === "realm") return viewer.mod?.realmIds.includes(scope.realmId) ?? false;
  return canModerateCategory(viewer, {
    id: scope.categoryId,
    scope: categoryRealmId === null ? "site" : "realm",
    realmId: categoryRealmId,
  });
}

export function assertModeratesCategory(
  viewer: ForumViewer,
  category: ScopedCategory
): asserts viewer is NonNullable<ForumViewer> {
  if (!canModerateCategory(viewer, category))
    throw new ForumError("FORBIDDEN", "You don't moderate this category.");
}

export function assertScope(
  viewer: ForumViewer,
  scope: ModScope,
  categoryRealmId: string | null
): asserts viewer is NonNullable<ForumViewer> {
  if (!canActInScope(viewer, scope, categoryRealmId))
    throw new ForumError("FORBIDDEN", "You can't act at this scope.");
}

/** Moderator-only reads (queue, log, bans, warnings). */
export function assertModerator(viewer: ForumViewer): asserts viewer is NonNullable<ForumViewer> {
  if (!isModerator(viewer)) throw new ForumError("FORBIDDEN", "Only moderators can see this.");
}

/** Category ids the viewer moderates (all for site admins → null meaning "no filter"). */
export async function scopeCategoryIds(
  db: CategoryScopeDb,
  viewer: ForumViewer
): Promise<string[] | null> {
  if (viewer === null) return [];
  if (isSiteAdmin(viewer)) return null;
  const realmIds = viewer.mod?.realmIds ?? [];
  const own = viewer.mod?.categoryIds ?? [];
  if (realmIds.length === 0) return [...own];
  const realmCategories = await db.forumCategory.findMany({
    where: { scope: "realm", realmId: { in: [...realmIds] } },
    select: { id: true },
  });
  return [...new Set([...realmCategories.map((c) => c.id), ...own])];
}

/** The ModScope of a category: realm categories → { kind: "realm", realmId }, site → { kind: "category", categoryId }. */
export function scopeOfCategory(category: ScopedCategory): ModScope {
  return category.scope === "realm" && category.realmId !== null
    ? { kind: "realm", realmId: category.realmId }
    : { kind: "category", categoryId: category.id };
}

/** The `scope`/`scopeId` columns shared by ForumBan and ForumModLog. */
export function scopeColumns(scope: ModScope): { scope: BanScope; scopeId: string | null } {
  if (scope.kind === "realm") return { scope: "realm", scopeId: scope.realmId };
  if (scope.kind === "category") return { scope: "category", scopeId: scope.categoryId };
  return { scope: "site", scopeId: null };
}

/** A stored scope back as a ModScope; anything malformed reads as site, which only site admins act on. */
export function scopeFromColumns(scope: string, scopeId: string | null): ModScope {
  if (scopeId !== null && scope === "realm") return { kind: "realm", realmId: scopeId };
  if (scopeId !== null && scope === "category") return { kind: "category", categoryId: scopeId };
  return { kind: "site" };
}

export function banScopeOf(scope: string): BanScope {
  return BAN_SCOPES.find((s) => s === scope) ?? "site";
}

/**
 * Serializes moderation of one member for the rest of the transaction (Postgres advisory transaction lock; re-taking
 * it in the same transaction is free). Every warning, revoke, ban and lift takes it first, so points recounts and
 * automatic bans see each other's committed rows (READ COMMITTED), and status checks cannot pass twice.
 */
export async function lockMember(tx: LockDb, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`forum-member:${userId}`}))`;
}

/** A member as a RealmActor (id, Clerk id, role), enough for `isSiteAdmin`; null when the user row is gone. */
async function memberOf(db: Pick<PrismaClient, "user">, userId: string): Promise<Member | null> {
  const row = await db.user.findUnique({ where: { id: userId }, select: MEMBER_SELECT });
  return row && { ...row, countryId: null };
}

/** Content a site admin wrote is moderated by site admins only; an author whose user row is gone is not an admin. */
export function mayModerateAuthor(actor: ForumViewer, author: Member | null): boolean {
  if (actor === null) return false;
  return isSiteAdmin(actor) || author === null || !isSiteAdmin(author);
}

/**
 * Content a site admin wrote is moderated by site admins only (hide, edit, move, lock, pin, archive, resolving its
 * reports). Site admin actors cost no query.
 */
export async function assertCanModerateAuthor(
  db: Pick<PrismaClient, "user">,
  actor: NonNullable<ForumViewer>,
  authorUserId: string
): Promise<void> {
  if (isSiteAdmin(actor)) return;
  if (!mayModerateAuthor(actor, await memberOf(db, authorUserId))) {
    throw new ForumError("FORBIDDEN", "Only site admins moderate a site admin's posts.");
  }
}

/**
 * M5 as a verdict, null when the member may be sanctioned: they must exist, must not be a site admin, and must not
 * moderate the place (`moderates`, asked of the member with their own moderator context).
 */
export function sanctionRefusal(
  target: (Member & { mod: ModeratorContext }) | null,
  verb: "banned" | "warned",
  moderates: (target: NonNullable<ForumViewer>) => boolean
): ForumError | null {
  if (!target) return new ForumError("NOT_FOUND", "Member not found.");
  if (isSiteAdmin(target)) return new ForumError("BAD_REQUEST", `Site admins can't be ${verb}.`);
  if (moderates(target)) return new ForumError("BAD_REQUEST", "Remove their moderator role first.");
  return null;
}

/** M5 (`sanctionRefusal`) for one member, whose moderator context is looked up here (none for site admins). */
export async function assertSanctionable(
  db: SanctionDb,
  userId: string,
  verb: "banned" | "warned",
  moderates: (target: NonNullable<ForumViewer>) => boolean
): Promise<void> {
  const member = await memberOf(db, userId);
  const target = member && { ...member, mod: await moderatorContext(db, member) };
  const refusal = sanctionRefusal(target, verb, moderates);
  if (refusal) throw refusal;
}

/** Which rows a moderator listing shows: null for no filter (site admins), else these realms and categories. */
export type ListingScope = { realmIds: string[]; categoryIds: string[] } | null;

/** The viewer's listing scope, optionally narrowed to one realm (its own rows and its categories' rows). */
export async function listingScope(
  db: CategoryScopeDb,
  viewer: ForumViewer,
  realmId: string | null | undefined
): Promise<ListingScope> {
  assertModerator(viewer);
  const admin = isSiteAdmin(viewer);
  if (admin && !realmId) return null;
  const scoped = await scopeCategoryIds(db, viewer);
  if (!realmId) return { realmIds: [...(viewer.mod?.realmIds ?? [])], categoryIds: scoped ?? [] };
  const realmCategories = await db.forumCategory.findMany({
    where: { scope: "realm", realmId },
    select: { id: true },
  });
  const ids = realmCategories.map((c) => c.id);
  return {
    realmIds: admin || viewer.mod?.realmIds.includes(realmId) ? [realmId] : [],
    categoryIds: scoped === null ? ids : ids.filter((id) => scoped.includes(id)),
  };
}

/** A where fragment over `scope`/`scopeId` columns (ForumBan, ForumModLog) for a listing scope. */
export function scopedRowsWhere(listing: ListingScope): {
  OR?: Array<{ scope: BanScope; scopeId: { in: string[] } }>;
} {
  if (listing === null) return {};
  return {
    OR: [
      { scope: "realm", scopeId: { in: listing.realmIds } },
      { scope: "category", scopeId: { in: listing.categoryIds } },
    ],
  };
}

/** skip/take for a 1-based page; anything not a finite number reads as page 1. */
export function pageWindow(page: number, perPage: number): { skip: number; take: number } {
  const current = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  return { skip: (current - 1) * perPage, take: perPage };
}
