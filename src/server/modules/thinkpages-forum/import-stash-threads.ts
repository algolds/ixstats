/**
 * The import's stash pass: a stash item the retired XenForo bridge wrote (`forum:thread:<xenforoThreadId>`, the id
 * also in `contentId`) becomes the native item stashThread writes (`thinkpages:thread:<id>`, `/thinkpages/t/<id>`,
 * content type `forum_thread`, no `contentId`), once every thread is written. The thread is found by its XenForo id
 * whatever its visibility: the stash listing's own filter (I5, `withReadableThreads`) decides what its owner may read.
 * When that stash already holds the native thread (StashItem is unique on stash, content type and title), the
 * bridge-era item is deleted instead. One whose thread was never imported is deleted on a clean run and kept while
 * threads failed, for the rerun. Keyset-paged and idempotent (a moved item is no longer a bridge-era one).
 */
import { xenforoId } from "~/lib/thinkpages-forum/import/forum-links";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { LEGACY_THREAD_PREFIX, NATIVE_THREAD_PREFIX } from "~/lib/wiki-os/stash-content-type";
import type { ImportDb } from "./import-db";

const PAGE = 500;
const CONTENT_TYPE = "forum_thread";

export type StashThreadsDb = Pick<ImportDb, "forumThread" | "stashItem">;

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

/** Moves the item to its native thread; false when its stash already holds that thread (the item is a twin). */
async function moveItem(db: StashThreadsDb, item: LegacyItem, threadId: string): Promise<boolean> {
  const pageTitle = `${NATIVE_THREAD_PREFIX}${threadId}`;
  const twin = await db.stashItem.findFirst({
    where: { stashId: item.stashId, contentType: CONTENT_TYPE, pageTitle },
    select: { id: true },
  });
  if (twin) return false;
  await db.stashItem.update({
    where: { id: item.id },
    data: { pageTitle, pageSlug: threadHref(threadId), contentType: CONTENT_TYPE, contentId: null },
  });
  return true;
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
      if (threadId === undefined) unresolved.push(item.id);
      else if (await moveItem(db, item, threadId)) out.moved += 1;
      else twins.push(item.id);
    }
    const gone = opts.dropUnresolved ? [...twins, ...unresolved] : twins;
    if (gone.length) await db.stashItem.deleteMany({ where: { id: { in: gone } } });
    out.twins += twins.length;
    if (opts.dropUnresolved) out.deleted += unresolved.length;
  }
}
