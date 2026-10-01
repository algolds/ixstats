/**
 * staged-uploads.ts — who still needs a staged file, and the lock that keeps that answer true (plan 411).
 *
 * A staged file (upload-staging.ts) is named by its content hash, so one file can serve several uploads: two names
 * given the same bytes, a new version waiting behind an older one that has not been mirrored yet. It may be deleted
 * only when no asset is still served from it and no unfinished `upload` job (a dead one included: it can be requeued)
 * names its hash. Both the mirror job that finished with it and an upload that failed after staging it ask here.
 *
 * "Needed?" and "delete" are two steps, and an upload of the same bytes can record its asset and job between them:
 * the file would be gone under a job that is about to need it. So both sides work under a transaction-scoped advisory
 * lock per hash (`withStagedFileLock`): an upload records its rows and makes sure the file is there, the mirror job
 * decides and deletes, never both at once. The second one to arrive sees the first one's committed rows.
 */

import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { MediaAssetService } from "../core/media-asset-service";
import { MIRROR_SOURCE } from "./mirror-outbox";
import { listStaged, releaseStaged, removeStaleTemporaries } from "./upload-staging";

type Tx = Prisma.TransactionClient;

/**
 * The first int of the staged-file locks, in the two-int form `pg_advisory_xact_lock(namespace, key)`: a different key space from
 * the single-int locks (`withJobLock`'s `hashtext(key)`), so a staged file's lock can never be one of those, and distinct from the
 * other namespaces (cards/serial-number.ts: 7331). Arbitrary; it identifies these locks in pg_locks.
 */
export const STAGED_FILE_LOCK_NAMESPACE = 41101;
const STAGED_FILE_TRANSACTION_TIMEOUT_MS = 30_000;

/** Run `work` in a transaction that holds the advisory lock of the staged file `sha1` until it ends. */
export function withStagedFileLock<T>(sha1: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      // $executeRaw, not $queryRaw: the function returns `void`, which Prisma cannot read back as a row
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STAGED_FILE_LOCK_NAMESPACE}::int, hashtext(${sha1}))`;
      return work(tx);
    },
    // the work writes a file of up to 10 MB (and may wait for the lock): the default 5 s would cut a slow disk off mid-write
    { timeout: STAGED_FILE_TRANSACTION_TIMEOUT_MS }
  );
}

/** Whether an asset waits to be mirrored with the content `sha1`, or an unfinished upload job (other than `exceptJobId`) names it. */
export async function isStagedFileNeeded(
  tx: Tx,
  sha1: string,
  exceptJobId?: string
): Promise<boolean> {
  if (await MediaAssetService.isStillStaged(sha1, tx)) return true;
  const waiting = await tx.wikiMirrorJob.count({
    where: {
      source: MIRROR_SOURCE,
      kind: "upload",
      state: { notIn: ["done", "discarded"] },
      payload: { path: ["sha1"], equals: sha1 },
      ...(exceptJobId === undefined ? {} : { id: { not: exceptJobId } }),
    },
  });
  return waiting > 0;
}

/**
 * Delete the staged copy of `sha1` unless something still needs it (the caller holds the lock: `tx` is from
 * `withStagedFileLock`); resolves to whether it was deleted.
 */
export async function releaseStagedFileUnlessNeeded(
  tx: Tx,
  sha1: string,
  exceptJobId?: string
): Promise<boolean> {
  if (await isStagedFileNeeded(tx, sha1, exceptJobId)) return false;
  await releaseStaged(sha1);
  return true;
}

/** A staged file nothing needs is an orphan once it is this old (a crash between staging and the commit leaves one). */
export const STAGED_ORPHAN_AGE_MS = 24 * 60 * 60_000;

/**
 * Delete the staged files older than a day that no asset serves and no unfinished upload job names, and the temporary
 * files of writes that never finished; resolves to how many staged files went. Each file is judged under its own
 * lock (`withStagedFileLock`), so an upload that records its rows and writes the file at this moment is waited for, and
 * its rows are seen.
 */
export async function sweepStagedOrphans(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - STAGED_ORPHAN_AGE_MS);
  await removeStaleTemporaries(before);
  let released = 0;
  for (const { sha1, modifiedAt } of await listStaged()) {
    if (modifiedAt >= before) continue;
    if (await withStagedFileLock(sha1, (tx) => releaseStagedFileUnlessNeeded(tx, sha1))) released++;
  }
  return released;
}

export const STAGED_SWEEP_INTERVAL_MS = 60 * 60_000;
export const STAGED_SWEEP_KEY = "wikiMirror.stagedSweepAt";

/**
 * `sweepStagedOrphans`, at most once an hour (the time of the last one is kept in `SystemConfig`, as mirror-alerts.ts does for
 * its warning); resolves to how many files went, or null when it was not due. The time is stored before the sweep, so one that
 * fails waits for the next hour as well.
 */
export async function sweepStagedOrphansIfDue(now = new Date()): Promise<number | null> {
  const row = await db.systemConfig.findUnique({
    where: { key: STAGED_SWEEP_KEY },
    select: { value: true },
  });
  const last = row ? new Date(row.value).getTime() : Number.NaN;
  if (now.getTime() - last < STAGED_SWEEP_INTERVAL_MS) return null;
  await db.systemConfig.upsert({
    where: { key: STAGED_SWEEP_KEY },
    create: { key: STAGED_SWEEP_KEY, value: now.toISOString() },
    update: { value: now.toISOString() },
  });
  return sweepStagedOrphans(now);
}
