import { isSystemOwner } from "~/lib/auth";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

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

/** Realm moderation (claims, removals, content): site admins or the realm's founder (`Realm.ownerId` is a Clerk id). */
export function canModerateRealm(actor: RealmActor, realm: { ownerId: string }): boolean {
  return isSiteAdmin(actor) || realm.ownerId === actor.clerkUserId;
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
