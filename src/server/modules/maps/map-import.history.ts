/**
 * A realm's applied map imports and their rollback. Only the realm's latest import that is still in place can be
 * rolled back (rolling back an older one would undo the newer import's work too): its snapshot restores the
 * features it changed, deletes the ones it created and puts back the linked countries' outline and land area.
 */
import type { PrismaClient } from "@prisma/client";
import {
  restoreMapSnapshot,
  unpackSnapshot,
  type RestoreResult,
} from "~/lib/maps/realm-map-snapshot";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { refreshRealmMap } from "./map-import.apply";
import { loadImportRealm, MapImportError } from "./map-import.realm";

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

export async function rollbackMapImport(
  db: PrismaClient,
  actor: RealmActor,
  importId: string
): Promise<RestoreResult & { adjacencyPairs: number | null }> {
  const record = await db.mapImport.findUnique({ where: { id: importId } });
  if (!record) throw new MapImportError("NOT_FOUND", "Import not found");
  await loadImportRealm(db, actor, record.realmId);
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

  // Claim the rollback first, so two clicks never restore twice.
  const claimed = await db.mapImport.updateMany({
    where: { id: importId, rolledBackAt: null },
    data: { rolledBackAt: new Date(), rolledBackBy: actor.clerkUserId },
  });
  if (claimed.count === 0)
    throw new MapImportError("CONFLICT", "This import was already rolled back");
  try {
    const restored = await restoreMapSnapshot(db, unpackSnapshot(record.snapshot));
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
