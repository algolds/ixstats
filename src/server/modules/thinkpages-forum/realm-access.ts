/**
 * Realm sections (phase 2). Reading follows realm visibility: a draft or generating realm is hidden from everyone
 * but its founder and site admins (AT-6). Posting (D5, D13) takes a nation in the realm, or realm moderation (the
 * founder, officers with the `board` power, site admins); a board mute or ban, which binds the player who held the
 * nation, blocks it for everyone but moderators; an archived realm is read-only except to site admins.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, IXWORLD_SLUG } from "~/lib/realms/realm-ids";
import { STAFF_FOUNDER_ID } from "~/lib/realms/realm-region";
import { noNationNotice } from "~/lib/thinkpages-forum/notices";
import {
  hasRealmPower,
  isRealmHiddenFrom,
  isRealmOpen,
  isSiteAdmin,
} from "~/server/modules/realms";
import { boardRestrictionMessage, userBoardRestriction } from "~/server/shared/realm-board";
import { canPostIn, type ForumViewer } from "./access";

export interface ForumRealm {
  id: string;
  slug: string;
  name: string;
  status: string | null;
  ownerId: string;
}

export type RealmDb = Pick<PrismaClient, "realm">;
export type RealmAccessDb = Pick<
  PrismaClient,
  "country" | "realmOfficer" | "realmBoardBan" | "realmClaim"
>;

/** IxWorld when it has no realm row (D8): always active, and its founder is staff, so nobody is its founder. */
export const IXWORLD_REALM: ForumRealm = {
  id: DEFAULT_REALM_ID,
  slug: IXWORLD_SLUG,
  name: "IxWorld",
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

/** IxWorld always goes by its `ixworld` slug, even when its row carries the legacy slug "default". */
export function canonicalRealm(row: ForumRealm): ForumRealm {
  return row.id === DEFAULT_REALM_ID ? { ...row, slug: IXWORLD_SLUG } : row;
}

const namesIxWorld = (ref: { slug: string } | { id: string }): boolean =>
  "slug" in ref
    ? ref.slug === IXWORLD_SLUG || ref.slug === DEFAULT_REALM_ID
    : ref.id === DEFAULT_REALM_ID;

/**
 * A realm by slug or id. IxWorld's slugs (`ixworld`, legacy `default`) and id resolve even without a realm row
 * (synthesized, D8); with one, it is named from the row.
 */
export async function loadForumRealm(
  db: RealmDb,
  ref: { slug: string } | { id: string }
): Promise<ForumRealm | null> {
  const where = "slug" in ref ? { slug: ref.slug } : { id: ref.id };
  const row = await db.realm.findUnique({ where, select: REALM_SELECT });
  if (row) return canonicalRealm(row);
  if (!namesIxWorld(ref)) return null;
  const ixworld =
    "slug" in ref
      ? await db.realm.findUnique({ where: { id: DEFAULT_REALM_ID }, select: REALM_SELECT })
      : null;
  return ixworld ? canonicalRealm(ixworld) : IXWORLD_REALM;
}

export function canSeeRealm(viewer: ForumViewer, realm: ForumRealm): boolean {
  return !isRealmHiddenFrom(viewer, realm);
}

export interface RealmPostingAccess {
  ownedCountryIds: string[];
  /** Site admins, the founder, and officers granted `board`. */
  isModerator: boolean;
  /** The mute or ban binding the viewer; never looked up (null) for moderators. */
  restriction: { kind: "mute" | "ban"; until: Date | null; reason: string | null } | null;
  canPost: boolean;
  /** Why the viewer cannot post, for the UI; null when they can. */
  notice: string | null;
}

const ARCHIVED_NOTICE = "This realm is archived: its forum can be read but no longer changes.";

/** IxWorld is never archived, whatever its row says. */
const isArchived = (realm: ForumRealm): boolean =>
  realm.status === "archived" && !isRealmOpen(realm.id, realm.status);

function refused(
  base: Pick<RealmPostingAccess, "ownedCountryIds" | "isModerator">,
  notice: string,
  restriction: RealmPostingAccess["restriction"] = null
): RealmPostingAccess {
  return { ...base, restriction, canPost: false, notice };
}

/** Who may post in a realm's section (D5, D13). The caller has checked the viewer can see the realm. */
export async function realmPostingAccess(
  db: RealmAccessDb,
  viewer: ForumViewer,
  realm: ForumRealm
): Promise<RealmPostingAccess> {
  if (!viewer) {
    return refused(
      { ownedCountryIds: [], isModerator: false },
      `Sign in and claim a nation in ${realm.name} to post here.`
    );
  }
  const [owned, officers] = await Promise.all([
    db.country.findMany({
      where: { realmId: realm.id, ownerUserId: viewer.id },
      select: { id: true },
    }),
    db.realmOfficer.findMany({
      where: { realmId: realm.id, userId: viewer.clerkUserId },
      select: { userId: true, powers: true },
    }),
  ]);
  const ownedCountryIds = owned.map((c) => c.id);
  const admin = isSiteAdmin(viewer);
  const base = {
    ownedCountryIds,
    isModerator: admin || hasRealmPower(viewer, realm, officers, "board"),
  };
  const granted: RealmPostingAccess = { ...base, restriction: null, canPost: true, notice: null };
  if (admin) return granted;
  if (isArchived(realm)) return refused(base, ARCHIVED_NOTICE);
  if (base.isModerator) return granted;

  const restriction = await userBoardRestriction(db, realm.id, viewer.id, ownedCountryIds);
  const restrictedBy = boardRestrictionMessage(restriction);
  if (restrictedBy) return refused(base, restrictedBy, restriction);
  if (ownedCountryIds.length === 0) {
    return refused(base, noNationNotice(realm.name));
  }
  return granted;
}

export interface PostableCategory {
  scope: string;
  realmId: string | null;
  visibility: string;
  postRole: string;
}

export interface PostingAccess {
  canPost: boolean;
  /** Why the viewer cannot post, for the UI and refusals; null for sitewide categories and when they can. */
  notice: string | null;
}

/**
 * Whether the viewer may post in `category`, and why not: sitewide categories follow `canPostIn` (no notice);
 * realm categories also need `realmPostingAccess`. `realm` is the category's realm (null for site scope).
 */
export async function postingAccessFor(
  db: RealmAccessDb,
  viewer: ForumViewer,
  category: PostableCategory,
  realm: ForumRealm | null
): Promise<PostingAccess> {
  if (category.scope !== "realm") return { canPost: canPostIn(viewer, category), notice: null };
  if (!realm || !canSeeRealm(viewer, realm)) return { canPost: false, notice: null };
  const access = await realmPostingAccess(db, viewer, realm);
  return { canPost: access.canPost && canPostIn(viewer, category), notice: access.notice };
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

/** The posting rule for any category: site scope → canPostIn; realm scope → realmPostingAccess(...).canPost && canPostIn. */
export async function canPostInCategory(
  db: RealmAccessDb & RealmDb,
  viewer: ForumViewer,
  category: PostableCategory
): Promise<boolean> {
  return (await categoryPostingAccess(db, viewer, category)).canPost;
}
