/**
 * Pruning the stored world bundles. Each "Use this world" check stores a 2 to 8 MB gzip in the map import folder
 * (map-import.storage.ts) and nothing else removes it; on a box that once filled its disk that adds up. A bundle goes
 * once it was last stored more than 14 days ago, unless it is the bundle of its realm's latest applied world import
 * (a world is rolled back to the previous one's record, and "Rebuild relief" reads the bundle of the latest world
 * import that wrote the elevation), and the work is started by a new upload, at most once an hour across processes.
 * Other uploads (images, drawings, GeoJSON) are not touched, and neither is anything that is not a regular file named
 * by an upload id in the folder. Server only.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  claimUploadPrune,
  listWorldBundleUploads,
  removeMapUploadStoredBefore,
} from "./map-import.storage";
import { summarySource } from "./world-import.check";

export const WORLD_UPLOAD_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;

type PruneDb = Pick<PrismaClient, "mapImport" | "mapImportJob">;

interface AppliedImport {
  realmId: string;
  jobId: string | null;
  layerTypes: string[];
  summary: Prisma.JsonValue;
}

/** Per realm, the jobs of its latest world import and of its latest import with elevation, when that was a world. */
function keptJobs(imports: readonly AppliedImport[]): string[] {
  const latestWorld = new Map<string, string>();
  const latestElevation = new Map<string, AppliedImport>();
  for (const record of imports) {
    if (
      record.jobId &&
      summarySource(record.summary) === "world" &&
      !latestWorld.has(record.realmId)
    ) {
      latestWorld.set(record.realmId, record.jobId);
    }
    if (record.layerTypes.includes("altitudes") && !latestElevation.has(record.realmId)) {
      latestElevation.set(record.realmId, record);
    }
  }
  const shaded = [...latestElevation.values()]
    .filter((record) => summarySource(record.summary) === "world")
    .flatMap((record) => (record.jobId ? [record.jobId] : []));
  return [...latestWorld.values(), ...shaded];
}

/** The upload ids the realms' latest applied world imports read. */
async function keptUploads(db: PruneDb): Promise<Set<string>> {
  const imports = await db.mapImport.findMany({
    where: { rolledBackAt: null },
    orderBy: { createdAt: "desc" },
    select: { realmId: true, jobId: true, layerTypes: true, summary: true },
    // Past the guarded client's 1000-row cap: a realm whose latest world import is older than the newest 1000 imports
    take: 50_000,
  });
  const jobs = await db.mapImportJob.findMany({
    where: { id: { in: keptJobs(imports) } },
    select: { uploadId: true },
  });
  return new Set(jobs.flatMap((job) => (job.uploadId ? [job.uploadId] : [])));
}

/** Remove the world bundles last stored more than 14 days before `now`, except the kept ones; the ids removed. */
export async function pruneWorldUploads(db: PruneDb, now = Date.now()): Promise<string[]> {
  const cutoff = now - WORLD_UPLOAD_MAX_AGE_MS;
  const stale = (await listWorldBundleUploads()).filter((upload) => upload.storedAt < cutoff);
  if (stale.length === 0) return [];
  const kept = await keptUploads(db);
  const removed: string[] = [];
  for (const { uploadId } of stale) {
    if (!kept.has(uploadId) && (await removeMapUploadStoredBefore(uploadId, cutoff))) {
      removed.push(uploadId);
    }
  }
  return removed;
}

/**
 * `pruneWorldUploads`, unless one ran within the hour (in any process: the time is kept in the folder). The ids
 * removed, or null when it was not due. For a new upload to start; the caller does not wait for it.
 */
export async function pruneWorldUploadsIfDue(
  db: PruneDb,
  now = Date.now()
): Promise<string[] | null> {
  if (!(await claimUploadPrune(now, PRUNE_EVERY_MS))) return null;
  return pruneWorldUploads(db, now);
}
