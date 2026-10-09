/**
 * Forum bans (phase 3). A ban stops posting, never reading, in its scope: the whole forum (site, admin-only), a
 * realm's section, or one category. Manual bans run any number of days or are permanent; automatic ones come from
 * warning points (mod-auto-bans.ts). Site admins are never banned (M5). Each issue and lift takes the member's
 * lock (`lockMember`) and writes its mod log row in the same transaction. No archived-realm check (T0-6).
 */
import type { PrismaClient } from "@prisma/client";
import {
  banExpiry,
  banNotice,
  strongestBan,
  type BanScope,
} from "~/lib/thinkpages-forum/moderation-policy";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isSiteAdmin } from "~/server/modules/realms";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import { logModAction, modNote, modReason, type ModLogDetail } from "./mod-log";
import {
  assertSanctionable,
  assertScope,
  banScopeOf,
  canActInScope,
  listingScope,
  lockMember,
  pageWindow,
  scopeColumns,
  scopedRowsWhere,
  scopeFromColumns,
  type ModScope,
} from "./mod-scope";

export type BansDb = Pick<
  PrismaClient,
  | "forumBan"
  | "forumCategory"
  | "user"
  | "realm"
  | "realmOfficer"
  | "forumCategoryModerator"
  | "forumModLog"
  | "$transaction"
  | "$executeRaw"
>;

export interface ActiveBan {
  id: string;
  scope: BanScope;
  scopeId: string | null;
  reason: string;
  expiresAt: Date | null;
  auto: boolean;
}

/** A place to post: a category, or a whole realm section (`id: null`). */
export interface BanPlace {
  id: string | null;
  scope: string;
  realmId: string | null;
}

export interface BanInput {
  userId: string;
  scope: ModScope;
  reason: string;
  /** null = permanent */
  days: number | null;
}

export const BANS_PER_PAGE = 25;
const MAX_BAN_DAYS = 3650;

const ACTIVE_BAN_SELECT = {
  id: true,
  scope: true,
  scopeId: true,
  reason: true,
  expiresAt: true,
  auto: true,
} as const;

const liveAt = (now: Date) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

function placeScopes(place: BanPlace): Array<{ scope: BanScope; scopeId?: string }> {
  const scopes: Array<{ scope: BanScope; scopeId?: string }> = [{ scope: "site" }];
  if (place.scope === "realm" && place.realmId !== null)
    scopes.push({ scope: "realm", scopeId: place.realmId });
  if (place.id !== null) scopes.push({ scope: "category", scopeId: place.id });
  return scopes;
}

/** Bans in force on the user for a place: site, the place's realm, and the category itself (`id: null` = a whole realm section). */
export async function activeBansFor(
  db: Pick<BansDb, "forumBan">,
  userId: string,
  category: BanPlace,
  now: Date = new Date()
): Promise<ActiveBan[]> {
  const rows = await db.forumBan.findMany({
    where: { userId, liftedAt: null, AND: [liveAt(now), { OR: placeScopes(category) }] },
    select: ACTIVE_BAN_SELECT,
  });
  return rows.map((row) => ({ ...row, scope: banScopeOf(row.scope) }));
}

/** The strongest active ban or null; site admins are never banned (M5) and cost no query. */
export async function postingBan(
  db: Pick<BansDb, "forumBan">,
  viewer: ForumViewer,
  category: BanPlace
): Promise<ActiveBan | null> {
  if (viewer === null || isSiteAdmin(viewer)) return null;
  return strongestBan(await activeBansFor(db, viewer.id, category));
}

/** Throws FORBIDDEN with banNotice(ban). Used by sitewide editPost (Task 3, T0-17) and fileReport (Task 4). */
export async function assertNotBanned(
  db: Pick<BansDb, "forumBan">,
  actor: NonNullable<ForumViewer>,
  category: BanPlace
): Promise<void> {
  const ban = await postingBan(db, actor, category);
  if (ban) throw new ForumError("FORBIDDEN", banNotice(ban));
}

/** The realm of a category (null sitewide), or undefined when the category is gone. */
async function categoryRealmOf(
  db: Pick<BansDb, "forumCategory">,
  categoryId: string
): Promise<string | null | undefined> {
  const category = await db.forumCategory.findUnique({
    where: { id: categoryId },
    select: { realmId: true },
  });
  return category ? category.realmId : undefined;
}

/**
 * Refuses unless the actor may act at the ban's scope (category bans: by the category or its realm). A ban whose
 * category is gone is left to site admins.
 */
export async function assertBanScope(
  db: Pick<BansDb, "forumCategory">,
  actor: ForumViewer,
  ban: { scope: string; scopeId: string | null }
): Promise<NonNullable<ForumViewer>> {
  const scope = scopeFromColumns(ban.scope, ban.scopeId);
  const realmId = scope.kind === "category" ? await categoryRealmOf(db, scope.categoryId) : null;
  assertScope(actor, scope, realmId ?? null);
  return actor;
}

/** IxWorld exists with or without a realm row (D8). */
async function realmExists(db: Pick<BansDb, "realm">, realmId: string): Promise<boolean> {
  if (realmId === DEFAULT_REALM_ID) return true;
  return (await db.realm.findUnique({ where: { id: realmId }, select: { id: true } })) !== null;
}

/** Checks the actor may act at the scope and that the place exists; returns the actor and a category's realm. */
async function resolveBanScope(
  db: BansDb,
  actor: ForumViewer,
  scope: ModScope
): Promise<{ issuer: NonNullable<ForumViewer>; realmId: string | null }> {
  const realmId = scope.kind === "category" ? await categoryRealmOf(db, scope.categoryId) : null;
  if (realmId === undefined) throw new ForumError("NOT_FOUND", "Category not found.");
  assertScope(actor, scope, realmId);
  if (scope.kind === "realm" && !(await realmExists(db, scope.realmId))) {
    throw new ForumError("NOT_FOUND", "Realm not found.");
  }
  return { issuer: actor, realmId };
}

function banDays(days: number | null): number | null {
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > MAX_BAN_DAYS)) {
    throw new ForumError("BAD_REQUEST", `A ban lasts 1 to ${MAX_BAN_DAYS} days, or is permanent.`);
  }
  return days;
}

export async function issueBan(
  db: BansDb,
  actor: ForumViewer,
  input: BanInput
): Promise<{ banId: string }> {
  const reason = modReason(input.reason);
  const days = banDays(input.days);
  const { issuer, realmId } = await resolveBanScope(db, actor, input.scope);
  await assertSanctionable(db, input.userId, "banned", (target) =>
    canActInScope(target, input.scope, realmId)
  );
  const now = new Date();
  return db.$transaction(async (tx) => {
    await lockMember(tx, input.userId);
    const ban = await tx.forumBan.create({
      data: {
        userId: input.userId,
        ...scopeColumns(input.scope),
        reason,
        expiresAt: banExpiry(days, now),
        auto: false,
        issuedBy: issuer.id,
      },
    });
    await logModAction(tx, {
      actorId: issuer.id,
      action: "ban.issue",
      targetType: "user",
      targetId: input.userId,
      scope: input.scope,
      detail: { banId: ban.id, days, reason },
    });
    return { banId: ban.id };
  });
}

/**
 * reviewAppeal and the automatic-ban recompute call this with their own transaction client and their `now`. The ban
 * must still be live at `now` when the member's lock is held (CONFLICT otherwise), so concurrent lifts log once.
 */
export async function liftBanTx(
  tx: Pick<BansDb, "forumBan" | "forumModLog" | "$executeRaw">,
  actor: NonNullable<ForumViewer>,
  ban: { id: string; userId: string; scope: string; scopeId: string | null },
  detail: ModLogDetail,
  now: Date
): Promise<void> {
  await lockMember(tx, ban.userId);
  const { count } = await tx.forumBan.updateMany({
    where: { id: ban.id, liftedAt: null, ...liveAt(now) },
    data: { liftedAt: now, liftedBy: actor.id },
  });
  if (count === 0) throw new ForumError("CONFLICT", "This ban is no longer active.");
  await logModAction(tx, {
    actorId: actor.id,
    action: "ban.lift",
    targetType: "user",
    targetId: ban.userId,
    scope: scopeFromColumns(ban.scope, ban.scopeId),
    detail: { ...detail, banId: ban.id },
  });
}

export async function liftBan(
  db: BansDb,
  actor: ForumViewer,
  input: { banId: string; note?: string }
): Promise<void> {
  const ban = await db.forumBan.findUnique({
    where: { id: input.banId },
    select: { id: true, userId: true, scope: true, scopeId: true },
  });
  if (!ban) throw new ForumError("NOT_FOUND", "Ban not found.");
  const lifter = await assertBanScope(db, actor, ban);
  const note = modNote(input.note);
  await db.$transaction((tx) => liftBanTx(tx, lifter, ban, { note }, new Date()));
}

/** Bans in the viewer's scope, newest first: live ones (`active`), or lifted and expired ones. */
export async function listBans(
  db: Pick<BansDb, "forumBan" | "forumCategory">,
  viewer: ForumViewer,
  filter: { active: boolean; realmId?: string | null; userId?: string },
  page: number
) {
  const now = new Date();
  const state = filter.active
    ? { liftedAt: null, ...liveAt(now) }
    : { OR: [{ liftedAt: { not: null } }, { expiresAt: { lte: now } }] };
  const where = {
    AND: [
      state,
      scopedRowsWhere(await listingScope(db, viewer, filter.realmId)),
      filter.userId ? { userId: filter.userId } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.forumBan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageWindow(page, BANS_PER_PAGE),
      select: {
        ...ACTIVE_BAN_SELECT,
        userId: true,
        issuedBy: true,
        liftedAt: true,
        liftedBy: true,
        createdAt: true,
      },
    }),
    db.forumBan.count({ where }),
  ]);
  return { rows: rows.map((row) => ({ ...row, scope: banScopeOf(row.scope) })), total };
}
