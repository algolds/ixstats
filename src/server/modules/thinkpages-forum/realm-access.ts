/**
 * Realm sections (phase 2). Reading follows realm visibility: a draft or generating realm is hidden from everyone
 * but its founder and site admins (AT-6). Posting (D5, D13) takes a nation in the realm, or realm moderation (the
 * founder, officers with the `board` power, site admins); an archived realm is read-only except to site admins.
 * Forum bans (phase 3, M5, M7) block posting everywhere they apply, for moderators too; only site admins are never
 * banned. Every write and every posting flag goes through `postingAccessFor`, so a ban binds them all (T0-9).
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, IXNAY_SLUG, isIxnaySlug } from "~/lib/realms/realm-ids";
import { STAFF_FOUNDER_ID } from "~/lib/realms/realm-region";
import { banNotice } from "~/lib/thinkpages-forum/moderation-policy";
import { noNationNotice } from "~/lib/thinkpages-forum/notices";
import {
  hasRealmPower,
  isRealmHiddenFrom,
  isRealmOpen,
  isSiteAdmin,
} from "~/server/modules/realms";
import { canPostIn, type ForumViewer } from "./access";
import { postingBan, type ActiveBan } from "./mod-bans";

export interface ForumRealm {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  ownerId: string;
}

export type RealmDb = Pick<PrismaClient, "realm">;
export type RealmAccessDb = Pick<PrismaClient, "country" | "realmOfficer" | "forumBan">;

/** Ixnay when it has no realm row (D8): always active, and its founder is staff, so nobody is its founder. */
export const IXNAY_REALM: ForumRealm = {
  id: DEFAULT_REALM_ID,
  slug: IXNAY_SLUG,
  name: "Ixnay",
  status: "active",
  ownerId: STAFF_FOUNDER_ID,
};

export const REALM_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  ownerId: true,
} as const;

/** Ixnay always goes by its `ixnay` slug, even when its row carries the former slug `ixworld` or the legacy "default". */
export function canonicalRealm<R extends ForumRealm>(row: R): R {
  return row.id === DEFAULT_REALM_ID ? { ...row, slug: IXNAY_SLUG } : row;
}

const namesIxnay = (ref: { slug: string } | { id: string }): boolean =>
  "slug" in ref
    ? isIxnaySlug(ref.slug)
    : ref.id === DEFAULT_REALM_ID;

type RealmRef = { slug: string } | { id: string };

/**
 * The lookup `loadForumRealm` and `loadForumRealmLook` share: the row, else Ixnay synthesized (D8). `find` reads
 * one realm row with whatever columns the caller selects.
 */
async function resolveRealm<R extends ForumRealm>(
  find: (where: RealmRef) => Promise<R | null>,
  ref: RealmRef,
  synthesized: R
): Promise<R | null> {
  const row = await find("slug" in ref ? { slug: ref.slug } : { id: ref.id });
  if (row) return canonicalRealm(row);
  if (!namesIxnay(ref)) return null;
  const ixnay = "slug" in ref ? await find({ id: DEFAULT_REALM_ID }) : null;
  return ixnay ? canonicalRealm(ixnay) : synthesized;
}

/**
 * A realm by slug or id. Ixnay's slugs (`ixnay`, the former `ixworld`, legacy `default`) and id resolve even without a realm row
 * (synthesized, D8); with one, it is named from the row.
 */
export function loadForumRealm(db: RealmDb, ref: RealmRef): Promise<ForumRealm | null> {
  return resolveRealm<ForumRealm>(
    (where) => db.realm.findUnique({ where, select: REALM_SELECT }),
    ref,
    IXNAY_REALM
  );
}

/** `loadForumRealm` for many ids in one read: the realms found by id (Ixnay synthesized when it has no row). */
export async function loadForumRealms(
  db: RealmDb,
  ids: readonly string[]
): Promise<Map<string, ForumRealm>> {
  const rows = ids.length
    ? await db.realm.findMany({ where: { id: { in: [...ids] } }, select: REALM_SELECT })
    : [];
  const found = new Map<string, ForumRealm>(rows.map((row) => [row.id, canonicalRealm(row)]));
  if (ids.includes(DEFAULT_REALM_ID) && !found.has(DEFAULT_REALM_ID)) {
    found.set(DEFAULT_REALM_ID, IXNAY_REALM);
  }
  return found;
}

/** A realm with the images that stand in for its icon (the emblem, else the thumbnail), as a preview draws it. */
export interface ForumRealmLook extends ForumRealm {
  emblemUrl: string | null;
  thumbnail: string | null;
}

/** `loadForumRealm` in one read that also brings the realm's images; Ixnay without a row has none. */
export function loadForumRealmLook(db: RealmDb, ref: RealmRef): Promise<ForumRealmLook | null> {
  return resolveRealm<ForumRealmLook>(
    (where) =>
      db.realm.findUnique({
        where,
        select: { ...REALM_SELECT, emblemUrl: true, thumbnail: true },
      }),
    ref,
    { ...IXNAY_REALM, emblemUrl: null, thumbnail: null }
  );
}

/** Unpublished realms are their moderators' only; Ixnay, always listed in the switcher, is never hidden (U7). */
export function canSeeRealm(viewer: ForumViewer, realm: ForumRealm): boolean {
  return realm.id === DEFAULT_REALM_ID || !isRealmHiddenFrom(viewer, realm);
}

export interface RealmPostingAccess {
  ownedCountryIds: string[];
  /** Site admins, the founder, and officers granted `board`. */
  isModerator: boolean;
  /** The strongest forum ban binding the viewer here; never looked up (null) for anonymous and site admins. */
  ban: ActiveBan | null;
  canPost: boolean;
  /** Why the viewer cannot post, for the UI; null when they can. */
  notice: string | null;
  /** Refused only for want of a nation here (signed in, not banned, realm open): the UI offers to claim one (U6). */
  needsNation: boolean;
}

const ARCHIVED_NOTICE = "This realm is archived: its forum can be read but no longer changes.";

/** Ixnay is never archived, whatever its row says. */
export const isArchived = (realm: ForumRealm): boolean =>
  realm.status === "archived" && !isRealmOpen(realm.id, realm.status);

function refused(
  base: Pick<RealmPostingAccess, "ownedCountryIds" | "isModerator">,
  notice: string,
  ban: ActiveBan | null = null
): RealmPostingAccess {
  return { ...base, ban, canPost: false, notice, needsNation: false };
}

/**
 * Who may post in a realm's section (D5, D13), in the order admin → archived → ban → moderator → nation (T0-3).
 * The ban covers the site, the realm and, when `category` is given, that category. The caller has checked the
 * viewer can see the realm.
 */
export async function realmPostingAccess(
  db: RealmAccessDb,
  viewer: ForumViewer,
  realm: ForumRealm,
  category?: { id: string }
): Promise<RealmPostingAccess> {
  if (!viewer) {
    return refused(
      { ownedCountryIds: [], isModerator: false },
      `Sign in and claim a nation in ${realm.name} to post here.`
    );
  }
  const [owned, officers, ban] = await Promise.all([
    db.country.findMany({
      where: { realmId: realm.id, ownerUserId: viewer.id },
      select: { id: true },
    }),
    db.realmOfficer.findMany({
      where: { realmId: realm.id, userId: viewer.clerkUserId },
      select: { userId: true, powers: true },
    }),
    // Null without a query for site admins (M5), and in an archived realm, which refuses first (M16).
    isArchived(realm)
      ? null
      : postingBan(db, viewer, { id: category?.id ?? null, scope: "realm", realmId: realm.id }),
  ]);
  const ownedCountryIds = owned.map((c) => c.id);
  const admin = isSiteAdmin(viewer);
  const base = {
    ownedCountryIds,
    isModerator: admin || hasRealmPower(viewer, realm, officers, "board"),
  };
  const granted: RealmPostingAccess = {
    ...base,
    ban: null,
    canPost: true,
    notice: null,
    needsNation: false,
  };
  if (admin) return granted;
  if (isArchived(realm)) return refused(base, ARCHIVED_NOTICE);
  // Moderators of the realm are bound by bans too (M5): a stale row must still hold.
  if (ban) return refused(base, banNotice(ban), ban);
  if (base.isModerator) return granted;
  if (ownedCountryIds.length === 0)
    return { ...refused(base, noNationNotice(realm.name)), needsNation: true };
  return granted;
}

export interface PostableCategory {
  id: string;
  scope: string;
  realmId: string | null;
  visibility: string;
  postRole: string;
}

export interface PostingAccess {
  canPost: boolean;
  /** Why the viewer cannot post, for the UI and refusals; null when they can, and sitewide unless banned. */
  notice: string | null;
  /** The strongest ban binding the viewer in this category (site, realm or the category itself). */
  ban: ActiveBan | null;
}

const NO_ACCESS: PostingAccess = { canPost: false, notice: null, ban: null };

/**
 * Whether the viewer may post in `category`, and why not: sitewide categories follow `canPostIn` and the viewer's
 * bans (site and the category; looked up even where `canPostIn` refuses, so a banned author's own posts are not
 * offered for editing); realm categories follow `realmPostingAccess` for the category, then `canPostIn`. `realm`
 * is the category's realm (null for site scope).
 */
export async function postingAccessFor(
  db: RealmAccessDb,
  viewer: ForumViewer,
  category: PostableCategory,
  realm: ForumRealm | null
): Promise<PostingAccess> {
  if (category.scope !== "realm") {
    const ban = await postingBan(db, viewer, category);
    if (ban) return { canPost: false, notice: banNotice(ban), ban };
    return { ...NO_ACCESS, canPost: canPostIn(viewer, category) };
  }
  if (!realm || !canSeeRealm(viewer, realm)) return NO_ACCESS;
  const access = await realmPostingAccess(db, viewer, realm, category);
  return {
    canPost: access.canPost && canPostIn(viewer, category),
    notice: access.notice,
    ban: access.ban,
  };
}

/** `postingAccessFor` when only the category is at hand: a realm category's realm is loaded by its id. */
export async function categoryPostingAccess(
  db: RealmAccessDb & RealmDb,
  viewer: ForumViewer,
  category: PostableCategory
): Promise<PostingAccess> {
  const realm =
    category.scope === "realm" && category.realmId
      ? await loadForumRealm(db, { id: category.realmId })
      : null;
  return postingAccessFor(db, viewer, category, realm);
}

/** The posting rule for any category, bans included: `categoryPostingAccess(...).canPost`. */
export async function canPostInCategory(
  db: RealmAccessDb & RealmDb,
  viewer: ForumViewer,
  category: PostableCategory
): Promise<boolean> {
  return (await categoryPostingAccess(db, viewer, category)).canPost;
}
