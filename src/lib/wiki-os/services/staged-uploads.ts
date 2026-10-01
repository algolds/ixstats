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
import { releaseStaged } from "./upload-staging";

type Tx = Prisma.TransactionClient;

/** Run `work` in a transaction that holds the advisory lock of the staged file `sha1` until it ends. */
export function withStagedFileLock<T>(sha1: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`wiki-upload:${sha1}`}))`;
    return work(tx);
  });
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
