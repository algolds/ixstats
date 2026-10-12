/**
 * A realm's applied map imports and their rollback. Only the realm's latest import that is still in place can be
 * rolled back (rolling back an older one would undo the newer import's work too): its snapshot restores the
 * features it changed, deletes the ones it created and puts back the linked countries' outline and land area. A
 * world import's snapshot also removes the nation slots it created and puts back the ones it retired, and the
 * realm's previous generation record and relief layer, unless a player has since claimed one of the new slots (then
 * nothing is rolled back). A rollback takes the realm's job lease, as an import does.
 */
import type { PrismaClient } from "@prisma/client";
import {
  heldSlots,
  restoreMapSnapshot,
  unpackSnapshot,
  type RestoreResult,
} from "~/lib/maps/realm-map-snapshot";
import { withJobLock } from "~/lib/system/job-lock";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { refreshRealmMap } from "./map-import.apply";
import {
  loadImportRealm,
  MAP_IMPORT_LOCK_MS,
  mapImportLockName,
  MapImportError,
} from "./map-import.realm";

export async function listMapImports(
  db: PrismaClient,
  actor: RealmActor,
  realmId: string,
  take = 20
) {
  await loadImportRealm(db, actor, realmId);
  const rows = await db.mapImport.findMany({
    where: { realmId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      jobId: true,
      layerTypes: true,
      mode: true,
      createdBy: true,
      summary: true,
      snapshotBytes: true,
      rollbackAvailable: true,
      rolledBackAt: true,
      rolledBackBy: true,
      createdAt: true,
    },
  });
  const latestInPlace = rows.find((r) => !r.rolledBackAt)?.id ?? null;
  return rows.map((row) => ({
    ...row,
    canRollBack: row.id === latestInPlace && row.rollbackAvailable,
  }));
}

type RollbackResult = RestoreResult & { adjacencyPairs: number | null };

/** Roll an import back under its realm's job lease, so it never overlaps a running import of the realm. */
export async function rollbackMapImport(
  db: PrismaClient,
  actor: RealmActor,
  importId: string
): Promise<RollbackResult> {
  const found = await db.mapImport.findUnique({
    where: { id: importId },
    select: { realmId: true },
  });
  if (!found) throw new MapImportError("NOT_FOUND", "Import not found");
  await loadImportRealm(db, actor, found.realmId);
  const outcome = await withJobLock(
    db,
    mapImportLockName(found.realmId),
    () => rollBack(db, actor, importId),
    { timeoutMs: MAP_IMPORT_LOCK_MS }
  );
  if (!outcome.ran) {
    throw new MapImportError(
      "CONFLICT",
      "Another import of this realm is running. Try again when it has finished"
    );
  }
  return outcome.result;
}

async function rollBack(
  db: PrismaClient,
  actor: RealmActor,
  importId: string
): Promise<RollbackResult> {
  const record = await db.mapImport.findUnique({ where: { id: importId } });
  if (!record) throw new MapImportError("NOT_FOUND", "Import not found");
  if (record.rolledBackAt)
    throw new MapImportError("CONFLICT", "This import was already rolled back");
  if (!record.rollbackAvailable || !record.snapshot) {
    throw new MapImportError(
      "BAD_REQUEST",
      "This import kept no snapshot (it was too large), so it cannot be rolled back"
    );
  }
  const newer = await db.mapImport.count({
    where: { realmId: record.realmId, createdAt: { gt: record.createdAt }, rolledBackAt: null },
  });
  if (newer > 0)
    throw new MapImportError("CONFLICT", "Roll back the newer import of this realm first");

  const snapshot = unpackSnapshot(record.snapshot);
  const held = await heldSlots(db, snapshot.slots?.created ?? []);
  if (held.size > 0) {
    throw new MapImportError(
      "CONFLICT",
      `${held.size} of the nations this import created have been claimed, so it can't be rolled back`
    );
  }

  // Claim the rollback first, so two clicks never restore twice.
  const claimed = await db.mapImport.updateMany({
    where: { id: importId, rolledBackAt: null },
    data: { rolledBackAt: new Date(), rolledBackBy: actor.clerkUserId },
  });
  if (claimed.count === 0)
    throw new MapImportError("CONFLICT", "This import was already rolled back");
  try {
    const restored = await restoreMapSnapshot(db, snapshot);
    const adjacencyPairs = await refreshRealmMap(db, record.realmId);
    return { ...restored, adjacencyPairs };
  } catch (error) {
    await db.mapImport.update({
      where: { id: importId },
      data: { rolledBackAt: null, rolledBackBy: null },
    });
    throw error;
  }
}
