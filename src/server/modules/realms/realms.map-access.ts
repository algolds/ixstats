/**
 * Who edits a realm's map (borders, region links, labels, map settings): site admins, the founder and officers
 * holding the `map` power, in their own realm only. IxWorld stays with site admins.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { canEditRealmMap, canModerateRealm, isSiteAdmin, type RealmActor } from "./realms.access";

export interface RealmMapAccess {
  /** May edit the map (`canEditRealmMap`), and the realm is not archived (archived realms are read-only). */
  canEdit: boolean;
  /** Founder powers (the founder or a site admin): needed to overwrite nations' stated land area. */
  isFounder: boolean;
  /** Why editing is refused, when it is. */
  reason: string | null;
}

/** What `actor` may do on the map of realm `realmId` (an id, as `viewerRealmId` resolves it). */
export async function realmMapAccess(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor | null,
  realmId: string
): Promise<RealmMapAccess> {
  if (!actor) return { canEdit: false, isFounder: false, reason: "Sign in to edit the map" };
  if (isSiteAdmin(actor)) return { canEdit: true, isFounder: true, reason: null };
  if (realmId === DEFAULT_REALM_ID) {
    return { canEdit: false, isFounder: false, reason: "Only site staff edit IxWorld's map" };
  }
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      officers: { select: { userId: true, powers: true } },
    },
  });
  if (!realm) return { canEdit: false, isFounder: false, reason: "Realm not found" };
  const isFounder = canModerateRealm(actor, realm);
  if (!canEditRealmMap(actor, realm, realm.officers)) {
    return {
      canEdit: false,
      isFounder,
      reason: "Only the realm's founder and officers with the Map power edit its map",
    };
  }
  if (realm.status === "archived") {
    return {
      canEdit: false,
      isFounder,
      reason: "This realm is archived and its map can't be changed",
    };
  }
  return { canEdit: true, isFounder, reason: null };
}
