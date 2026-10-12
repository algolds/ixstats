/**
 * Who may generate a realm's world, and when. The founder or an officer with the Map power (`canEditRealmMap`, the
 * same people who import a map), in a realm that is not archived, never Ixnay (its map is hand drawn, and a site
 * admin passes `canEditRealmMap` there), and only while no claim is pending or approved: a claim holds the realm's
 * nations still. The apply checks the claims again inside its transaction (world-import.slots.ts).
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { loadImportRealm, MapImportError, type ImportRealm } from "./map-import.realm";

/** The claim states that lock a realm's world. */
const LOCKING_CLAIM_STATUSES = ["pending", "approved"];

async function lockingClaimCount(
  db: Pick<PrismaClient, "realmClaim">,
  realmId: string
): Promise<number> {
  return db.realmClaim.count({ where: { realmId, status: { in: LOCKING_CLAIM_STATUSES } } });
}

export async function assertNoLockingClaims(
  db: Pick<PrismaClient, "realmClaim">,
  realmId: string
): Promise<void> {
  const claims = await lockingClaimCount(db, realmId);
  if (claims > 0) {
    throw new MapImportError(
      "CONFLICT",
      `The world is locked: ${claims} ${claims === 1 ? "claim is" : "claims are"} pending or approved in this realm. Nothing was changed`
    );
  }
}

/**
 * The realm, when `actor` may generate its world now: they edit its map, it is not archived or Ixnay, and no claim
 * locks it. Throws a MapImportError (FORBIDDEN, NOT_FOUND, BAD_REQUEST or CONFLICT) otherwise. `claims: false` skips
 * the lock, for work that leaves the realm's nations alone (rebuilding its relief).
 */
export async function assertWorldImportAllowed(
  db: Pick<PrismaClient, "realm" | "realmClaim">,
  actor: RealmActor,
  realmId: string,
  options: { claims?: boolean } = {}
): Promise<ImportRealm> {
  const realm = await loadImportRealm(db, actor, realmId);
  if (realm.id === DEFAULT_REALM_ID) {
    throw new MapImportError("BAD_REQUEST", "Ixnay's map is hand drawn and is never generated");
  }
  if (options.claims !== false) await assertNoLockingClaims(db, realm.id);
  return realm;
}

/** The user who queued a job, as the guards need them; the job has only their Clerk id. */
export async function jobActor(
  db: Pick<PrismaClient, "user">,
  clerkUserId: string
): Promise<RealmActor> {
  const user = await db.user.findUnique({ where: { clerkUserId }, include: { role: true } });
  if (!user) {
    throw new MapImportError("FORBIDDEN", "The person who started this import no longer exists");
  }
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    role: user.role && { name: user.role.name, level: user.role.level },
  };
}
