import { isSystemOwner } from "~/lib/auth";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { REALM_POWERS, type RealmPower } from "~/lib/realms/realm-region";

// ponytail: mirrors adminMiddleware's rule (owner/admin/staff or level ≤ 20); share it if a third caller appears.
const SITE_ADMIN_ROLES: readonly string[] = ["owner", "admin", "staff"];

export interface RealmActor {
  id: string;
  clerkUserId: string;
  role?: { name?: string | null; level?: number | null } | null;
}

export function isSiteAdmin(actor: RealmActor): boolean {
  if (isSystemOwner(actor.clerkUserId)) return true;
  return SITE_ADMIN_ROLES.includes(actor.role?.name ?? "") || (actor.role?.level ?? 999) <= 20;
}

/**
 * The realm's founder powers (appointing officers, and every officer power including claims review): site admins
 * or the realm's founder (`Realm.ownerId` is a Clerk id). Officers granted `claims` review claims too; see
 * `hasRealmPower`.
 */
export function canModerateRealm(actor: RealmActor, realm: { ownerId: string }): boolean {
  return isSiteAdmin(actor) || realm.ownerId === actor.clerkUserId;
}

export interface RealmOfficerGrant {
  userId: string;
  powers: readonly string[];
}

/**
 * The officer powers `actor` holds in the realm: all of them for the founder and site admins, else the ones the
 * founder granted them (`RealmOfficer.powers`, unknown entries ignored).
 */
export function realmPowers(
  actor: RealmActor | null,
  realm: { ownerId: string },
  officers: readonly RealmOfficerGrant[]
): RealmPower[] {
  if (!actor) return [];
  if (canModerateRealm(actor, realm)) return [...REALM_POWERS];
  const grant = officers.find((o) => o.userId === actor.clerkUserId);
  return REALM_POWERS.filter((power) => grant?.powers.includes(power));
}

/** Whether `actor` holds `power` in the realm (founder, site admin, or an officer granted it). */
export function hasRealmPower(
  actor: RealmActor | null,
  realm: { ownerId: string },
  officers: readonly RealmOfficerGrant[],
  power: RealmPower
): boolean {
  return realmPowers(actor, realm, officers).includes(power);
}

/**
 * `Realm.status` (draft, generating, active, archived): only an active realm takes new nations and claims.
 * IxWorld predates realms and is always open, with or without a realm row.
 */
export function isRealmOpen(realmId: string, status: string | null | undefined): boolean {
  return realmId === DEFAULT_REALM_ID || status === "active";
}

/** Draft and generating realms are unpublished (moderators only); an archived realm stays readable, closed to claims. */
export function isRealmPublished(realmId: string, status: string | null | undefined): boolean {
  return isRealmOpen(realmId, status) || status === "archived";
}

/**
 * AT-6: whether a realm is hidden from `viewer`. Draft and generating realms are visible only to their staff
 * (the founder and site admins); public, unlisted and archived realms are readable by anyone with the link.
 * Listing is a separate rule (`DIRECTORY_REALM_WHERE`): only public, active realms (and IxWorld) are listed.
 */
export function isRealmHiddenFrom(
  viewer: RealmActor | null | undefined,
  realm: { status?: string | null; ownerId?: string | null }
): boolean {
  const unpublished = realm.status === "draft" || realm.status === "generating";
  return unpublished && !(viewer && canModerateRealm(viewer, { ownerId: realm.ownerId ?? "" }));
}

/**
 * Whether `actor` may edit the realm's map (borders, region links, labels, map settings): a site admin, the
 * founder, or an officer granted `map`. IxWorld (`DEFAULT_REALM_ID`) has no founder: only site admins edit it,
 * whatever its realm row says.
 */
export function canEditRealmMap(
  actor: RealmActor | null,
  realm: { id: string; ownerId: string },
  officers: readonly RealmOfficerGrant[]
): boolean {
  if (!actor) return false;
  if (isSiteAdmin(actor)) return true;
  if (realm.id === DEFAULT_REALM_ID) return false;
  return hasRealmPower(actor, realm, officers, "map");
}

/** Whether `actor` may import a map into the realm: the same people who edit it (`canEditRealmMap`). */
export function canImportRealmMap(
  actor: RealmActor | null,
  realm: { id: string; ownerId: string },
  officers: readonly RealmOfficerGrant[]
): boolean {
  return canEditRealmMap(actor, realm, officers);
}
