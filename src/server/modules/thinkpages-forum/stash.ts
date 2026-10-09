/**
 * Stashing a native forum thread (phase 4, owner decision): a Stash item with title `thinkpages:thread:<threadId>`,
 * path `/thinkpages/t/<threadId>`, content type `forum_thread`, no `contentId` (the column is an Int, ids here are
 * strings) and the thread's title as the note. Ownership follows the stash system's rules (a given stash must be the
 * caller's, matched across their linked user ids; the default stash is created on demand). Only a thread the caller
 * may read can be stashed: anything else is NOT_FOUND, so a staff or Reports thread's existence never leaks. Removing
 * a stashed thread needs no visibility: it only deletes the caller's own rows. Legacy `forum:thread:` items belong to
 * the XenForo bridge and are never touched here.
 */
import type { PrismaClient } from "@prisma/client";
import { NATIVE_THREAD_PREFIX } from "~/lib/wiki-os/stash-content-type";
import { threadHref } from "~/lib/thinkpages-forum/links";
import type { ForumViewer } from "./access";
import { ForumError } from "./errors";
import { loadVisibleThread, type ReadsDb } from "./reads";

export type StashDb = ReadsDb & Pick<PrismaClient, "stash" | "stashItem">;

/** The caller's stash identity: the id new rows are written under, and every linked id their stashes may carry. */
export interface StashOwner {
  primaryId: string;
  ids: readonly string[];
}

const CONTENT_TYPE = "forum_thread";
const DEFAULT_STASH_NAME = "My Stash";

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

/** The given stash, else the caller's default one (created on demand). */
async function targetStash(
  db: Pick<StashDb, "stash">,
  owner: StashOwner,
  stashId?: string
): Promise<string> {
  if (stashId) return ownedStash(db, owner, stashId);
  const existing = await db.stash.findFirst({
    where: { userId: { in: [...owner.ids] }, isDefault: true },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.stash.create({
    data: { userId: owner.primaryId, name: DEFAULT_STASH_NAME, isDefault: true },
    select: { id: true },
  });
  return created.id;
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

/** The caller's native stashed threads, newest first. */
export async function listStashedThreads(
  db: Pick<StashDb, "stash" | "stashItem">,
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
    select: { id: true, pageTitle: true, note: true, savedAt: true },
  });
  return items.map((item) => {
    const threadId = item.pageTitle.slice(NATIVE_THREAD_PREFIX.length);
    return {
      id: item.id,
      threadId,
      title: item.note ?? "Thread",
      href: threadHref(threadId),
      savedAt: item.savedAt,
    };
  });
}
