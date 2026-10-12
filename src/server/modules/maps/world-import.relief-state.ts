/**
 * Whether the relief step of a realm's latest world import failed and has not been rebuilt: what the World tab reads
 * to offer "Rebuild relief" after a reload. The apply job's result holds the outcome (`relief.status`, world-import.ts
 * `WorldApplyResult`); a rebuild that succeeds writes "built" back into it, so the answer survives a reload and
 * clears once the relief is there.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ReliefEntry } from "./realm-relief";

type StateDb = Pick<PrismaClient, "mapImportJob" | "mapImport">;

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

/**
 * The relief step of the realm's latest world import failed, and the import has not been rolled back (a rollback puts
 * the previous relief back). The realm's relief can be built again with `rebuildRealmRelief`.
 */
export async function worldReliefFailed(db: StateDb, realmId: string): Promise<boolean> {
  const job = await latestWorldApply(db, realmId);
  if (!job || reliefOf(job.result)?.status !== "failed") return false;
  const record = await db.mapImport.findFirst({
    where: { jobId: job.id },
    select: { rolledBackAt: true },
  });
  return !record?.rolledBackAt;
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
