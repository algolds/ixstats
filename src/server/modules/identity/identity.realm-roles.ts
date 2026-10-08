/**
 * The passport holder's role in each realm they hold a nation in: founder (`Realm.ownerId`), officer
 * (a `RealmOfficer` row), else member. Both columns hold Clerk ids.
 */
import { db } from "~/server/db";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { RealmRole } from "./identity.types";

interface RealmStanding {
  id: string;
  ownerId: string;
  officers: { id: string }[];
}

/** IxWorld has no founder, whatever its realm row says (see realms.access.ts). */
function roleIn(realm: RealmStanding, clerkUserId: string): RealmRole {
  if (realm.id !== DEFAULT_REALM_ID && realm.ownerId === clerkUserId) return "founder";
  return realm.officers.length > 0 ? "officer" : "member";
}

/** Realm id to role. Realms without a row are absent (read them as member). */
export async function loadRealmRoles(
  clerkUserId: string,
  realmIds: readonly string[]
): Promise<Map<string, RealmRole>> {
  const ids = [...new Set(realmIds)];
  if (ids.length === 0) return new Map();
  const realms = await db.realm.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      ownerId: true,
      officers: { where: { userId: clerkUserId }, select: { id: true } },
    },
  });
  return new Map(realms.map((realm) => [realm.id, roleIn(realm, clerkUserId)]));
}
