/**
 * staged-uploads.ts — who still needs a staged file (plan 411).
 *
 * A staged file (upload-staging.ts) is named by its content hash, so one file can serve several uploads: two names
 * given the same bytes, a new version waiting behind an older one that has not been mirrored yet. It may be deleted
 * only when no asset is still served from it and no unfinished `upload` job (a dead one included: it can be requeued)
 * names its hash. Both the mirror job that finished with it and an upload that failed after staging it ask here.
 */

import { db } from "~/server/db";
import { MediaAssetService } from "../core/media-asset-service";
import { MIRROR_SOURCE, uploadPayloadSchema } from "./mirror-outbox";
import { releaseStaged } from "./upload-staging";

/** Whether an asset waits to be mirrored with the content `sha1`, or an unfinished upload job (other than `exceptJobId`) names it. */
export async function isStagedFileNeeded(sha1: string, exceptJobId?: string): Promise<boolean> {
  if (await MediaAssetService.isStillStaged(sha1)) return true;
  const waiting = await db.wikiMirrorJob.findMany({
    where: {
      source: MIRROR_SOURCE,
      kind: "upload",
      state: { notIn: ["done", "discarded"] },
      ...(exceptJobId === undefined ? {} : { id: { not: exceptJobId } }),
    },
    select: { payload: true },
  });
  return waiting.some((other) => uploadPayloadSchema.safeParse(other.payload).data?.sha1 === sha1);
}

/** Delete the staged copy of `sha1` unless something still needs it; resolves to whether it was deleted. */
export async function releaseStagedFileUnlessNeeded(
  sha1: string,
  exceptJobId?: string
): Promise<boolean> {
  if (await isStagedFileNeeded(sha1, exceptJobId)) return false;
  await releaseStaged(sha1);
  return true;
}
