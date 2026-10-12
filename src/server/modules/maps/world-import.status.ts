/**
 * Whether a world can be applied to a realm, for a site admin: the shape the founder's World tab reads
 * (`realms.map.worldStatus`) but open to Ixnay, which that one refuses. A layer choice writes only physical layers,
 * so no claim locks it; an archived realm is closed to it as to any apply.
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID, realmSlugWhere } from "~/lib/realms/realm-ids";
import type { RealmWorldStatus } from "~/server/modules/realms/realms.world-slots";
import { MapImportError } from "./map-import.realm";
import { worldReliefFailed } from "./world-import.relief-state";

type StatusDb = Pick<PrismaClient, "realm" | "realmClaim" | "mapImportJob" | "mapImport">;

/**
 * The status of the realm (an id or a slug). `layers`: the apply is a layer choice (Ixnay always is). The counts are
 * always the realm's own; only the lock differs.
 */
export async function adminWorldStatus(
  db: StatusDb,
  realm: string,
  options: { layers?: boolean } = {}
): Promise<RealmWorldStatus & { reliefFailed: boolean }> {
  const select = { id: true, status: true } as const;
  const row =
    (await db.realm.findUnique({ where: { id: realm }, select })) ??
    (await db.realm.findFirst({ where: realmSlugWhere(realm), select }));
  if (!row) throw new MapImportError("NOT_FOUND", "Realm not found");
  const [pendingClaims, approvedClaims, reliefFailed] = await Promise.all([
    db.realmClaim.count({ where: { realmId: row.id, status: "pending" } }),
    db.realmClaim.count({ where: { realmId: row.id, status: "approved" } }),
    worldReliefFailed(db, row.id),
  ]);
  const choosing = options.layers === true || row.id === DEFAULT_REALM_ID;
  const lockReason: RealmWorldStatus["lockReason"] =
    row.status === "archived"
      ? "archived"
      : !choosing && pendingClaims + approvedClaims > 0
        ? "claims"
        : null;
  return {
    realmId: row.id,
    status: row.status,
    pendingClaims,
    approvedClaims,
    locked: lockReason !== null,
    lockReason,
    canReviewClaims: true,
    reliefFailed,
  };
}
