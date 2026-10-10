/**
 * Places named the way the moderation router receives them (realm slugs, category keys) resolved to ids, and a
 * ban's place named for a notice. A realm hidden from the viewer (draft, generating) reads as NOT_FOUND, as reads do.
 */
import type { PrismaClient } from "@prisma/client";
import { canSeeCategory, type ForumViewer } from "./access";
import { ForumError } from "./errors";
import type { ModScope } from "./mod-scope";
import { placeNames } from "./mod-standing";
import { canSeeRealm, loadForumRealm, type ForumRealm, type RealmDb } from "./realm-access";

export type PlacesDb = Pick<PrismaClient, "forumCategory"> & RealmDb;

export type BanLocator =
  | { kind: "site" }
  | { kind: "realm"; realm: string }
  | { kind: "category"; key: string; realm?: string | null };

async function visibleRealm(db: RealmDb, viewer: ForumViewer, slug: string): Promise<ForumRealm> {
  const realm = await loadForumRealm(db, { slug });
  if (!realm || !canSeeRealm(viewer, realm)) throw new ForumError("NOT_FOUND", "Realm not found.");
  return realm;
}

/** A ban's scope from its locator, with the realm's or category's name for the notice (null for the site). */
export async function locateBanScope(
  db: PlacesDb,
  viewer: ForumViewer,
  locator: BanLocator
): Promise<{ scope: ModScope; name: string | null }> {
  if (locator.kind === "site") return { scope: { kind: "site" }, name: null };
  if (locator.kind === "realm") {
    const realm = await visibleRealm(db, viewer, locator.realm);
    return { scope: { kind: "realm", realmId: realm.id }, name: realm.name };
  }
  const realm = locator.realm ? await visibleRealm(db, viewer, locator.realm) : null;
  // Not `loadCategory`: it refuses a realm's board category, and a ban placed in one (postingBan honours it) is valid.
  const category = await db.forumCategory.findFirst({
    where: realm
      ? { scope: "realm", realmId: realm.id, key: locator.key }
      : { scope: "site", realmId: null, key: locator.key },
  });
  if (!category || !canSeeCategory(viewer, category)) {
    throw new ForumError("NOT_FOUND", "Category not found.");
  }
  return { scope: { kind: "category", categoryId: category.id }, name: category.name };
}

/** A moderator listing's realm filter: null without one, else the realm's id. */
export async function listingRealmId(
  db: RealmDb,
  viewer: ForumViewer,
  slug: string | undefined
): Promise<string | null> {
  return slug === undefined ? null : (await visibleRealm(db, viewer, slug)).id;
}

/** The realm's or category's name for a ban's place; null for the site and for a place that is gone. */
export async function banPlaceName(
  db: PlacesDb,
  ban: { scope: string; scopeId: string | null }
): Promise<string | null> {
  if (ban.scope === "site" || ban.scopeId === null) return null;
  return (await placeNames(db, [ban])).get(`${ban.scope}:${ban.scopeId}`) ?? null;
}
