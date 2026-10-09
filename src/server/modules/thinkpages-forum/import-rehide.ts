/**
 * The XenForo importer's delta re-hide (phase 4, I7): imported threads and replies XenForo has since moderated or
 * deleted (planned by `src/lib/thinkpages-forum/import/rehide.ts`) get `hidden: true`, one transaction per thread
 * under the thread lock with a recount; never un-hidden, never deleted. Then the media assets of their attachments
 * turn restricted. A thread that fails is recorded like a failed write (M19) and the run goes on.
 */
import type { RehidePlan, RehideThread } from "~/lib/thinkpages-forum/import/rehide";
import type { ImportDb } from "./import-db";
import type { ThreadFailure } from "./import-write";
import { lockThread, recountThread } from "./thread-counts";

const ASSET_CHUNK = 1000;
/** Two updates and a recount under the thread lock. */
const REHIDE_TIMEOUT_MS = 30_000;

export interface RehideTotals {
  threads: number;
  posts: number;
  /** Media assets turned restricted. */
  assets: number;
}

/** One thread: the thread row and its replies hidden, counts recomputed; rows already hidden are not counted. */
function rehideThread(
  db: Pick<ImportDb, "$transaction">,
  entry: RehideThread
): Promise<{ threads: number; posts: number }> {
  return db.$transaction(
    async (tx) => {
      await lockThread(tx, entry.threadId);
      const threads = entry.thread
        ? (
            await tx.forumThread.updateMany({
              where: { id: entry.threadId, hidden: false },
              data: { hidden: true },
            })
          ).count
        : 0;
      const posts = entry.posts.length
        ? (
            await tx.forumPost.updateMany({
              where: {
                threadId: entry.threadId,
                xenforoPostId: { in: entry.posts },
                hidden: false,
              },
              data: { hidden: true },
            })
          ).count
        : 0;
      await recountThread(tx, entry.threadId);
      return { threads, posts };
    },
    { timeout: REHIDE_TIMEOUT_MS }
  );
}

/** The "forum" media assets of these attachments become restricted (public ones only, so a rerun counts none). */
async function restrictAssets(
  db: Pick<ImportDb, "uploadedAsset">,
  attachmentIds: readonly number[]
): Promise<number> {
  const refs = [...new Set(attachmentIds)].map(String);
  let restricted = 0;
  for (let i = 0; i < refs.length; i += ASSET_CHUNK) {
    const { count } = await db.uploadedAsset.updateMany({
      where: {
        source: "forum",
        sourceRef: { in: refs.slice(i, i + ASSET_CHUNK) },
        visibility: "public",
      },
      data: { visibility: "restricted" },
    });
    restricted += count;
  }
  return restricted;
}

export async function rehideImported(
  db: Pick<ImportDb, "$transaction" | "uploadedAsset">,
  plan: RehidePlan,
  opts: { failures: ThreadFailure[]; log?: (line: string) => void }
): Promise<RehideTotals> {
  const totals: RehideTotals = { threads: 0, posts: 0, assets: 0 };
  for (const entry of plan.threads) {
    try {
      const done = await rehideThread(db, entry);
      totals.threads += done.threads;
      totals.posts += done.posts;
    } catch (error) {
      const failure = {
        xenforoThreadId: entry.xenforoThreadId,
        error: error instanceof Error ? error.message : String(error),
      };
      opts.failures.push(failure);
      opts.log?.(`  thread ${failure.xenforoThreadId} could not be re-hidden: ${failure.error}`);
    }
  }
  totals.assets = await restrictAssets(db, plan.attachmentIds);
  return totals;
}
