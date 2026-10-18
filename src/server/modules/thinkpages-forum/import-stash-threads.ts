/**
 * The import's stash pass: a stash item the retired XenForo bridge wrote (`forum:thread:<xenforoThreadId>`, the id
 * also in `contentId`) becomes the native item stashThread writes (`thinkpages:thread:<id>`, `/thinkpages/t/<id>`,
 * content type `forum_thread`, no `contentId`), once every thread is written. The thread is found by its XenForo id
 * whatever its visibility: the stash listing's own filter (I5, `withReadableThreads`) decides what its owner may read.
 * When that stash already holds the native thread (StashItem is unique on stash, content type and title), the
 * bridge-era item is deleted instead, also when its owner stashes the native thread between that check and the move.
 * One whose thread was never imported is deleted on a clean run and kept while threads failed (or the snapshot left
 * forums out), for the rerun. An item removed or changed between its read and the move is left alone. Keyset-paged
 * and idempotent (a moved item is no longer a bridge-era one).
 */
import { isUniqueViolation } from "~/lib/prisma-error";
import { xenforoId } from "~/lib/thinkpages-forum/import/forum-links";
import { threadHref } from "~/lib/thinkpages-forum/links";
import {
  FORUM_THREAD_CONTENT_TYPE,
  LEGACY_THREAD_PREFIX,
  nativeThreadTitle,
} from "~/lib/wiki-os/stash-content-type";
import type { ImportDb } from "./import-db";

const PAGE = 500;

type StashThreadsDb = Pick<ImportDb, "forumThread" | "stashItem">;

export interface StashThreadRemap {
  /** Bridge-era items moved to their native thread. */
  moved: number;
  /** Bridge-era items deleted because their stash already held the native thread. */
  twins: number;
  /** Bridge-era items deleted because their thread was never imported. */
  deleted: number;
}

interface LegacyItem {
  id: string;
  stashId: string;
  pageTitle: string;
  contentId: number | null;
}

const xenforoThreadOf = (item: LegacyItem): number | null =>
  item.contentId ?? xenforoId(item.pageTitle.slice(LEGACY_THREAD_PREFIX.length));

/** The native thread ids of the page's XenForo thread ids, whatever the threads' visibility. */
async function nativeThreads(
  db: StashThreadsDb,
  items: readonly LegacyItem[]
): Promise<Map<number, string>> {
  const wanted = [...new Set(items.flatMap((item) => xenforoThreadOf(item) ?? []))];
  const rows = await db.forumThread.findMany({
    where: { xenforoThreadId: { in: wanted } },
    select: { id: true, xenforoThreadId: true },
  });
  return new Map(
    rows.flatMap((r) => (r.xenforoThreadId === null ? [] : [[r.xenforoThreadId, r.id]]))
  );
}

/**
 * Moves the item to its native thread: "twin" when its stash already holds that thread (or gains it before the move
 * is written), "changed" when the item was removed or retitled since it was read (nothing is written).
 */
async function moveItem(
  db: StashThreadsDb,
  item: LegacyItem,
  threadId: string
): Promise<"moved" | "twin" | "changed"> {
  const pageTitle = nativeThreadTitle(threadId);
  const contentType = FORUM_THREAD_CONTENT_TYPE;
  const twin = await db.stashItem.findFirst({
    where: { stashId: item.stashId, contentType, pageTitle },
    select: { id: true },
  });
  if (twin) return "twin";
  try {
    const { count } = await db.stashItem.updateMany({
      where: { id: item.id, pageTitle: item.pageTitle },
      data: { pageTitle, pageSlug: threadHref(threadId), contentType, contentId: null },
    });
    return count ? "moved" : "changed";
  } catch (error) {
    if (isUniqueViolation(error)) return "twin";
    throw error;
  }
}

export async function remapStashedThreads(
  db: StashThreadsDb,
  opts: { dropUnresolved: boolean }
): Promise<StashThreadRemap> {
  const out: StashThreadRemap = { moved: 0, twins: 0, deleted: 0 };
  let after = "";
  for (;;) {
    const items = await db.stashItem.findMany({
      where: { pageTitle: { startsWith: LEGACY_THREAD_PREFIX }, id: { gt: after } },
      orderBy: { id: "asc" },
      take: PAGE,
      select: { id: true, stashId: true, pageTitle: true, contentId: true },
    });
    if (!items.length) return out;
    after = items[items.length - 1]!.id;
    const nativeOf = await nativeThreads(db, items);
    const twins: string[] = [];
    const unresolved: string[] = [];
    for (const item of items) {
      const xf = xenforoThreadOf(item);
      const threadId = xf === null ? undefined : nativeOf.get(xf);
      const move = threadId === undefined ? null : await moveItem(db, item, threadId);
      if (move === null) unresolved.push(item.id);
      else if (move === "moved") out.moved += 1;
      else if (move === "twin") twins.push(item.id);
    }
    const gone = opts.dropUnresolved ? [...twins, ...unresolved] : twins;
    if (gone.length) await db.stashItem.deleteMany({ where: { id: { in: gone } } });
    out.twins += twins.length;
    if (opts.dropUnresolved) out.deleted += unresolved.length;
  }
}
