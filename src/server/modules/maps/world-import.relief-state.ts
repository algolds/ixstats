/**
 * Whether a realm's relief is missing: what the World tab reads to offer "Rebuild relief" after a reload. Either the
 * relief step of the realm's latest world import failed and has not been rebuilt (the apply job's result holds the
 * outcome, `relief.status`, world-import.ts `WorldApplyResult`; a rebuild that succeeds writes "built" back into it, so
 * the answer survives a reload and clears once the relief is there), or the relief version the realm's settings record
 * has no tiles on disk (pruned by later builds, or lost with a folder that was not shared).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { RELIEF_LAYER_ID } from "~/lib/maps/raster-tiles";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import type { ReliefEntry } from "./realm-relief";
import { rasterVersionDir, rasterVersionExists } from "./realm-rasters.storage";

type StateDb = Pick<PrismaClient, "mapImportJob" | "mapImport" | "realm">;

const asObject = (value: Prisma.JsonValue | null | undefined): Prisma.JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

/** The realm's latest finished world apply job (the dry run and the interrupted ones say nothing of the relief). */
async function latestWorldApply(db: StateDb, realmId: string) {
  const [job] = await db.mapImportJob.findMany({
    where: { realmId, kind: "world", dryRun: false, status: "succeeded" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, result: true },
  });
  return job ?? null;
}

const reliefOf = (result: Prisma.JsonValue | null | undefined) =>
  asObject(asObject(result)?.relief);

/** The relief step of the realm's latest world import failed, and the import has not been rolled back. */
async function reliefStepFailed(db: StateDb, realmId: string): Promise<boolean> {
  const job = await latestWorldApply(db, realmId);
  if (!job || reliefOf(job.result)?.status !== "failed") return false;
  const record = await db.mapImport.findFirst({
    where: { jobId: job.id },
    select: { rolledBackAt: true },
  });
  return !record?.rolledBackAt;
}

/** The realm's settings record a relief version whose tiles are not on disk: every relief tile would answer 404. */
async function reliefTilesGone(db: StateDb, realmId: string): Promise<boolean> {
  const realm = await db.realm.findUnique({ where: { id: realmId }, select: { settings: true } });
  const entry = parseRealmMapSettings(realm?.settings).rasterLayers?.find(
    (layer) => layer.id === RELIEF_LAYER_ID
  );
  if (!entry) return false;
  const dir = rasterVersionDir(realmId, entry.id, entry.version);
  return !dir || !(await rasterVersionExists(dir));
}

/**
 * The relief is missing: its step failed in the realm's latest world import (and the import has not been rolled back,
 * which puts the previous relief back), or the version the realm records has no tiles. The realm's relief can be built
 * again with `rebuildRealmRelief`.
 */
export async function worldReliefFailed(db: StateDb, realmId: string): Promise<boolean> {
  return (await reliefStepFailed(db, realmId)) || (await reliefTilesGone(db, realmId));
}

/** The relief of the realm's latest world import is there now: record it, so it is no longer offered for a rebuild. */
export async function markWorldReliefBuilt(
  db: StateDb,
  realmId: string,
  entry: Pick<ReliefEntry, "version" | "tiles">
): Promise<void> {
  const job = await latestWorldApply(db, realmId);
  if (!job || reliefOf(job.result)?.status !== "failed") return;
  const built = { status: "built", version: entry.version, tiles: entry.tiles, error: null };
  await db.mapImportJob.update({
    where: { id: job.id },
    data: { result: { ...asObject(job.result), relief: built } as Prisma.InputJsonObject },
  });
}
