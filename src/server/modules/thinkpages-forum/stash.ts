/**
 * Stashing a native forum thread (phase 4, owner decision): a Stash item with title `thinkpages:thread:<threadId>`,
 * path `/thinkpages/t/<threadId>`, content type `forum_thread`, no `contentId` (the column is an Int, ids here are
 * strings) and the thread's title as the note. Ownership follows the stash system's rules (a given stash must be the
 * caller's, matched across their linked user ids; the default stash is created on demand). Only a thread the caller
 * may read can be stashed: anything else is NOT_FOUND, so a staff or Reports thread's existence never leaks. Removing
 * a stashed thread needs no visibility: it only deletes the caller's own rows. Listing does (I5): a stashed thread is
 * shown with its current title, and one the caller can no longer read (hidden, staff-only, gone) is left out, so the
 * note written at stash time never shows a title after the thread was hidden. Legacy `forum:thread:` items belong to
 * the XenForo bridge and are never touched here.
 */
import type { PrismaClient } from "@prisma/client";
import { NATIVE_THREAD_PREFIX } from "~/lib/wiki-os/stash-content-type";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { getOrCreateDefaultStash } from "~/server/shared/default-stash";
import { canSeeThread, type ForumViewer } from "./access";
import { ForumError } from "./errors";
import { forumActorOf, type ForumUserSource } from "./forum-viewer";
import type { ScopeDb } from "./mod-scope";
import { loadVisibleThread, visibleRealmOf, type ReadsDb } from "./reads";

export type StashDb = ReadsDb & Pick<PrismaClient, "stash" | "stashItem">;

/** The caller's stash identity: the id new rows are written under, and every linked id their stashes may carry. */
export interface StashOwner {
  primaryId: string;
  ids: readonly string[];
}

const CONTENT_TYPE = "forum_thread";

const titleOf = (threadId: string): string => `${NATIVE_THREAD_PREFIX}${threadId}`;
const stashNotFound = (): ForumError => new ForumError("NOT_FOUND", "Stash not found.");

/** A stash of the caller's, else NOT_FOUND. */
async function ownedStash(
  db: Pick<StashDb, "stash">,
  owner: StashOwner,
  stashId: string
): Promise<string> {
  const owned = await db.stash.findFirst({
    where: { id: stashId, userId: { in: [...owner.ids] } },
    select: { id: true },
  });
  if (!owned) throw stashNotFound();
  return owned.id;
}

/** The given stash, else the caller's default one (created on demand; a racing first stash is reused, I6). */
async function targetStash(
  db: Pick<StashDb, "stash">,
  owner: StashOwner,
  stashId?: string
): Promise<string> {
  if (stashId) return ownedStash(db, owner, stashId);
  return (await getOrCreateDefaultStash(db, [...owner.ids], owner.primaryId)).id;
}

export async function stashThread(
  db: StashDb,
  viewer: ForumViewer,
  owner: StashOwner,
  input: { threadId: string; stashId?: string }
): Promise<{ success: true; stashId: string }> {
  const { thread } = await loadVisibleThread(db, viewer, input.threadId);
  const stashId = await targetStash(db, owner, input.stashId);
  const pageTitle = titleOf(thread.id);
  await db.stashItem.upsert({
    where: { stashId_contentType_pageTitle: { stashId, contentType: CONTENT_TYPE, pageTitle } },
    create: {
      stashId,
      pageTitle,
      pageSlug: threadHref(thread.id),
      contentType: CONTENT_TYPE,
      contentId: null,
      note: thread.title,
    },
    update: { updatedAt: new Date(), note: thread.title },
  });
  return { success: true, stashId };
}

export async function unstashThread(
  db: Pick<StashDb, "stash" | "stashItem">,
  owner: StashOwner,
  input: { threadId: string; stashId?: string }
): Promise<{ success: true }> {
  const stashIds = input.stashId
    ? [await ownedStash(db, owner, input.stashId)]
    : (
        await db.stash.findMany({ where: { userId: { in: [...owner.ids] } }, select: { id: true } })
      ).map((s) => s.id);
  await db.stashItem.deleteMany({
    where: {
      stashId: { in: stashIds },
      pageTitle: titleOf(input.threadId),
      contentType: CONTENT_TYPE,
    },
  });
  return { success: true };
}

/** The caller's stashes holding the thread. */
export async function isThreadStashed(
  db: Pick<StashDb, "stash" | "stashItem">,
  owner: StashOwner,
  input: { threadId: string }
): Promise<{ stashed: boolean; stashes: { id: string; name: string; color: string | null }[] }> {
  const stashes = await db.stash.findMany({
    where: { userId: { in: [...owner.ids] } },
    select: { id: true, name: true, color: true },
  });
  const items = await db.stashItem.findMany({
    where: {
      stashId: { in: stashes.map((s) => s.id) },
      pageTitle: titleOf(input.threadId),
      contentType: CONTENT_TYPE,
    },
    select: { stashId: true },
  });
  const holding = new Set(items.map((i) => i.stashId));
  const held = stashes
    .filter((s) => holding.has(s.id))
    .map(({ id, name, color }) => ({ id, name, color }));
  return { stashed: held.length > 0, stashes: held };
}

/**
 * I5: the current titles of the threads the viewer may read, by id; a hidden, unreadable or gone thread has none.
 * One thread query, and one realm read per realm.
 */
export async function readableThreadTitles(
  db: ReadsDb,
  viewer: ForumViewer,
  threadIds: readonly string[]
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  if (threadIds.length === 0) return titles;
  const rows = await db.forumThread.findMany({
    where: { id: { in: [...threadIds] } },
    select: { id: true, title: true, authorUserId: true, hidden: true, category: true },
  });
  const realmVisible = new Map<string | null, boolean>();
  for (const row of rows) {
    if (!canSeeThread(viewer, row, row.category)) continue;
    const realmId = row.category.realmId;
    if (!realmVisible.has(realmId)) {
      realmVisible.set(realmId, (await visibleRealmOf(db, viewer, row.category)) !== undefined);
    }
    if (realmVisible.get(realmId)) titles.set(row.id, row.title);
  }
  return titles;
}

/**
 * I5 for the general stash listing (/stashes): its native forum thread items carry the thread's current title as
 * their note, and those the user can no longer read are left out; every other item passes unchanged. The user's
 * forum viewer (with what they moderate) is built only when the page holds such an item.
 */
export async function withReadableThreads<T extends { pageTitle: string; note: string | null }>(
  db: ReadsDb & ScopeDb,
  user: ForumUserSource,
  items: readonly T[]
): Promise<T[]> {
  const threadIdOf = (item: T) =>
    item.pageTitle.startsWith(NATIVE_THREAD_PREFIX)
      ? item.pageTitle.slice(NATIVE_THREAD_PREFIX.length)
      : null;
  const threadIds = items.flatMap((item) => threadIdOf(item) ?? []);
  if (threadIds.length === 0) return [...items];
  const titles = await readableThreadTitles(db, await forumActorOf(db, user), threadIds);
  return items.flatMap((item) => {
    const threadId = threadIdOf(item);
    if (threadId === null) return [item];
    const title = titles.get(threadId);
    return title === undefined ? [] : [{ ...item, note: title }];
  });
}

/** The caller's native stashed threads they may still read, newest first, with each thread's current title (I5). */
export async function listStashedThreads(
  db: StashDb,
  viewer: ForumViewer,
  owner: StashOwner,
  limit: number
): Promise<{ id: string; threadId: string; title: string; href: string; savedAt: Date }[]> {
  const stashes = await db.stash.findMany({
    where: { userId: { in: [...owner.ids] } },
    select: { id: true },
  });
  const items = await db.stashItem.findMany({
    where: {
      stashId: { in: stashes.map((s) => s.id) },
      contentType: CONTENT_TYPE,
      pageTitle: { startsWith: NATIVE_THREAD_PREFIX },
    },
    orderBy: { savedAt: "desc" },
    take: limit,
    select: { id: true, pageTitle: true, savedAt: true },
  });
  const threadIdOf = (pageTitle: string) => pageTitle.slice(NATIVE_THREAD_PREFIX.length);
  const titles = await readableThreadTitles(
    db,
    viewer,
    items.map((item) => threadIdOf(item.pageTitle))
  );
  return items.flatMap((item) => {
    const threadId = threadIdOf(item.pageTitle);
    const title = titles.get(threadId);
    if (title === undefined) return [];
    return [{ id: item.id, threadId, title, href: threadHref(threadId), savedAt: item.savedAt }];
  });
}
