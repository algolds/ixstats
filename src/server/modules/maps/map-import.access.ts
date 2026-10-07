/**
 * Who may import (and roll back) a realm's map: site admins and the realm's founder. `officers` is accepted so a
 * realm officer power for maps can be granted here without changing the callers.
 */
import {
  canModerateRealm,
  type RealmActor,
  type RealmOfficerGrant,
} from "~/server/modules/realms/realms.access";

export function canImportRealmMap(
  actor: RealmActor | null | undefined,
  realm: { ownerId: string },
  _officers: readonly RealmOfficerGrant[] = []
): boolean {
  return !!actor && canModerateRealm(actor, realm);
}
