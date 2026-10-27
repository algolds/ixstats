/**
 * Who may generate a realm's world, and when. The founder or an officer with the Map power (`canEditRealmMap`, the
 * same people who import a map), in a realm that is not archived, never Ixnay (its map is hand drawn, and a site
 * admin passes `canEditRealmMap` there), and only while no claim is pending or approved: a claim holds the realm's
 * nations still. The apply checks the claims again inside its transaction (world-import.slots.ts). The one way into
 * Ixnay is a site admin's layer choice (physical layers only, see `assertWorldImportAllowed`).
 */
import type { PrismaClient } from "@prisma/client";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { isSiteAdmin, type RealmActor } from "~/server/modules/realms/realms.access";
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
 *
 * `layers` is the admin layer choice: only physical layers are written, so no claim can lock it and Ixnay is allowed,
 * but only for a site admin (a founder or officer sending it is FORBIDDEN). An archived realm is refused as ever.
 */
export async function assertWorldImportAllowed(
  db: Pick<PrismaClient, "realm" | "realmClaim">,
  actor: RealmActor,
  realmId: string,
  options: {
    claims?: boolean;
    layers?: readonly PhysicalLayer[] | null;
    /** Ixnay is allowed to a site admin (work that leaves its borders and nations alone: its relief) */
    ixnay?: boolean;
  } = {}
): Promise<ImportRealm> {
  const choosing = !!options.layers;
  if (choosing && !isSiteAdmin(actor)) {
    throw new MapImportError("FORBIDDEN", "Only site admins can choose the layers to write");
  }
  const realm = await loadImportRealm(db, actor, realmId);
  if (realm.id === DEFAULT_REALM_ID && !choosing && !(options.ixnay && isSiteAdmin(actor))) {
    throw new MapImportError(
      "BAD_REQUEST",
      "Ixnay's map is hand drawn and is never generated; only chosen physical layers can be written"
    );
  }
  if (options.claims !== false && !choosing) await assertNoLockingClaims(db, realm.id);
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
