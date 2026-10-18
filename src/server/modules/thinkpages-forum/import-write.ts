/**
 * The XenForo importer's writes (phase 4): archive categories, then one transaction per thread (the thread when new,
 * its posts in chunks with `skipDuplicates`, the action-link remap, the recount under the thread lock), then the
 * author relink. Idempotent: a rerun plans only what is missing, and a thread interrupted mid-write rolled back
 * whole, so it is written again in full. A thread that fails is recorded and the run goes on (M19): its transaction
 * rolled it back, and the bridge pass and the relink still run. Then the I7 re-hide (import-rehide.ts), the passes
 * over every imported post: quote ids (import-quote-ids.ts) and old forum links (import-forum-links.ts), and the
 * bridge-era rows moved to native threads: stash items (import-stash-threads.ts) and notification links
 * (import-notification-links.ts). It creates no activity feed, notification or mod-log rows.
 */
import type { Prisma } from "@prisma/client";
import { countActionTokens } from "~/lib/action-links";
import { resolveAuthors } from "~/lib/thinkpages-forum/import/authors";
import type { ArchiveCategory, NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import type {
  CategoryRef,
  ImportPlan,
  PlannedPost,
  PlannedThread,
} from "~/lib/thinkpages-forum/import/plan";
import { isUniqueViolation } from "./errors";
import { assertImportLock, type ImportDb } from "./import-db";
import { rewriteImportedForumLinks, type ForumLinkRewrite } from "./import-forum-links";
import {
  rewriteNotificationLinks,
  type NotificationLinkRewrite,
} from "./import-notification-links";
import { remapQuoteIds, type QuoteRemap } from "./import-quote-ids";
import { rehideImported, type RehideTotals } from "./import-rehide";
import { remapStashedThreads, type StashThreadRemap } from "./import-stash-threads";
import { lockThread, recountThread } from "./thread-counts";

/** Posts per `createMany`; lower it (one constant) if 500-row inserts are slow on the VPS. */
export const POST_CHUNK = 500;
export const TRANSACTION_TIMEOUT_MS = 120_000;
const PROGRESS_EVERY = 100;

type ImportTx = Pick<
  Prisma.TransactionClient,
  "forumThread" | "forumPost" | "postActionLink" | "$executeRaw"
>;

const siteKey = (key: string) => ({ scope: "site", realmId: null, key });

/**
 * Each planned archive category's id by key, creating the ones still absent. The site key is unique through a
 * partial index Prisma cannot target, so it is find-then-create, and a lost race re-reads the winner.
 */
export async function ensureArchiveCategories(
  db: Pick<ImportDb, "forumCategory">,
  categories: readonly ArchiveCategory[]
): Promise<{ ids: Map<string, string>; created: number }> {
  const ids = new Map<string, string>();
  let created = 0;
  for (const category of categories) {
    const found = await db.forumCategory.findFirst({
      where: siteKey(category.key),
      select: { id: true },
    });
    if (found) {
      ids.set(category.key, found.id);
      continue;
    }
    try {
      const row = await db.forumCategory.create({
        data: { ...category, scope: "site", realmId: null },
        select: { id: true },
      });
      ids.set(category.key, row.id);
      created += 1;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await db.forumCategory.findFirst({
        where: siteKey(category.key),
        select: { id: true },
      });
      if (!winner) throw error;
      ids.set(category.key, winner.id);
    }
  }
  return { ids, created };
}

function categoryIdOf(ref: CategoryRef, archiveIds: ReadonlyMap<string, string>): string {
  if (ref.kind === "existing") return ref.id;
  const id = archiveIds.get(ref.key);
  if (!id) throw new Error(`Archive category ${ref.key} was not created`);
  return id;
}

export interface ThreadWrite {
  threadCreated: boolean;
  postsCreated: number;
  /** Planned posts another run wrote first (skipped as duplicates). */
  postsPresent: number;
  linksRemapped: number;
}

async function threadIdFor(
  tx: ImportTx,
  planned: PlannedThread,
  categoryId: string
): Promise<string> {
  if (planned.existingId) return planned.existingId;
  const row = await tx.forumThread.create({
    data: {
      categoryId,
      xenforoThreadId: planned.xenforoThreadId,
      title: planned.title,
      authorUserId: planned.authorUserId,
      importedAuthorName: planned.importedAuthorName,
      xenforoUserId: planned.xenforoUserId,
      pinned: planned.pinned,
      locked: planned.locked,
      hidden: planned.hidden,
      createdAt: planned.createdAt,
      lastPostAt: planned.lastPostAt,
    },
    select: { id: true },
  });
  return row.id;
}

const postRow = (post: PlannedPost, threadId: string): Prisma.ForumPostCreateManyInput => ({
  ...post,
  threadId,
});

/** Q17: the posts' XenForo-sourced action links now point at the native post, in the thread's transaction. */
async function remapLinks(tx: ImportTx, posts: readonly PlannedPost[]): Promise<number> {
  const withTokens = posts
    .filter((p) => countActionTokens(p.contentHtml) > 0)
    .map((p) => p.xenforoPostId);
  if (!withTokens.length) return 0;
  const rows = await tx.forumPost.findMany({
    where: { xenforoPostId: { in: withTokens } },
    select: { id: true, xenforoPostId: true },
  });
  let remapped = 0;
  for (const row of rows) {
    if (row.xenforoPostId === null) continue;
    const { count } = await tx.postActionLink.updateMany({
      where: { postSource: "xenforo", postRef: String(row.xenforoPostId) },
      data: { postSource: "native", postRef: row.id },
    });
    remapped += count;
  }
  return remapped;
}

/** One thread in one transaction; the counts come from the database, so a resumed thread ends consistent. */
export function writeThread(
  db: Pick<ImportDb, "$transaction">,
  planned: PlannedThread,
  categoryId: string
): Promise<ThreadWrite> {
  return db.$transaction(
    async (tx) => {
      const threadId = await threadIdFor(tx, planned, categoryId);
      await lockThread(tx, threadId);
      let postsCreated = 0;
      for (let i = 0; i < planned.posts.length; i += POST_CHUNK) {
        const data = planned.posts.slice(i, i + POST_CHUNK).map((p) => postRow(p, threadId));
        postsCreated += (await tx.forumPost.createMany({ data, skipDuplicates: true })).count;
      }
      const linksRemapped = await remapLinks(tx, planned.posts);
      await recountThread(tx, threadId);
      return {
        threadCreated: planned.existingId === null,
        postsCreated,
        postsPresent: planned.posts.length - postsCreated,
        linksRemapped,
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

/**
 * M8: reports filed on rows that had no author take the author those rows have now, so a moderator's queue keeps
 * leaving out reports about their own content. Only reports still unattributed are touched.
 */
async function attributeReports(db: Pick<ImportDb, "$executeRaw">): Promise<void> {
  await db.$executeRaw`UPDATE "forum_reports" AS r SET "targetAuthorId" = t."authorUserId" FROM "forum_threads" AS t WHERE r."targetType" = 'thread' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL`;
  await db.$executeRaw`UPDATE "forum_reports" AS r SET "targetAuthorId" = t."authorUserId" FROM "forum_posts" AS t WHERE r."targetType" = 'post' AND r."targetId" = t."id" AND r."targetAuthorId" IS NULL AND t."authorUserId" IS NOT NULL`;
}

/**
 * Imported rows with no author whose XenForo user is now linked (`User.forumUserId`, earliest account first as at
 * import) take that user, and so do the reports on them (M8). Only rows with a XenForo user id are touched; guests
 * never match. `onlyXenforoUserId` limits the pass to one XenForo user (the admin link, phase 4b).
 */
export async function relinkImportedAuthors(
  db: Pick<ImportDb, "user" | "forumThread" | "forumPost" | "$executeRaw">,
  onlyXenforoUserId?: number
): Promise<{ threads: number; posts: number }> {
  const users = await db.user.findMany({
    where: { forumUserId: onlyXenforoUserId ?? { not: null } },
    select: { id: true, forumUserId: true, createdAt: true },
  });
  const { byForumId } = resolveAuthors(
    users.flatMap((u) => (u.forumUserId === null ? [] : [{ ...u, forumUserId: u.forumUserId }]))
  );
  const relinked = { threads: 0, posts: 0 };
  for (const [xenforoUserId, authorUserId] of byForumId) {
    const where = { authorUserId: null, xenforoUserId };
    relinked.threads += (await db.forumThread.updateMany({ where, data: { authorUserId } })).count;
    relinked.posts += (await db.forumPost.updateMany({ where, data: { authorUserId } })).count;
  }
  if (relinked.threads + relinked.posts > 0) await attributeReports(db);
  return relinked;
}

const LINK_CHUNK = 500;

type LinkDb = Pick<ImportDb, "postActionLink" | "forumPost">;
type BridgeLink = { id: string; postRef: string; activityId: string };

/** One chunk of the bridge pass: each link whose XenForo post is imported moves to the native post. */
async function remapLinkChunk(db: LinkDb, links: readonly BridgeLink[], out: BridgeRemap) {
  const refs = links.flatMap((l) => (/^\d+$/.test(l.postRef) ? [Number(l.postRef)] : []));
  const posts = await db.forumPost.findMany({
    where: { xenforoPostId: { in: refs } },
    select: { id: true, xenforoPostId: true },
  });
  const nativeOf = new Map(posts.map((p) => [String(p.xenforoPostId), p.id]));
  for (const link of links) {
    const postRef = nativeOf.get(link.postRef);
    if (!postRef) continue;
    const twin = await db.postActionLink.findFirst({
      where: { postSource: "native", postRef, activityId: link.activityId },
      select: { id: true },
    });
    if (twin) out.twins += 1;
    else {
      const { count } = await db.postActionLink.updateMany({
        where: { id: link.id, postSource: "xenforo" },
        data: { postSource: "native", postRef },
      });
      out.remapped += count;
    }
  }
}

export interface BridgeRemap {
  remapped: number;
  /** Links already present on the native post (left on the XenForo post). */
  twins: number;
}

/**
 * Every `("xenforo", xfPostId)` action link whose post is imported, from any run: the live bridge keeps linking
 * XenForo posts after an earlier import, and a rerun plans nothing for those posts. Keyset-paged, idempotent.
 */
export async function remapBridgeLinks(db: LinkDb): Promise<BridgeRemap> {
  const out: BridgeRemap = { remapped: 0, twins: 0 };
  let after = "";
  for (;;) {
    const links = await db.postActionLink.findMany({
      where: { postSource: "xenforo", id: { gt: after } },
      orderBy: { id: "asc" },
      take: LINK_CHUNK,
      select: { id: true, postRef: true, activityId: true },
    });
    if (!links.length) return out;
    after = links[links.length - 1]!.id;
    await remapLinkChunk(db, links, out);
  }
}

/** A thread whose write threw (its transaction rolled back); a rerun retries it. */
export interface ThreadFailure {
  xenforoThreadId: number;
  error: string;
}

export interface ApplyTotals {
  categoriesCreated: number;
  threadsCreated: number;
  threadsResumed: number;
  postsCreated: number;
  postsPresent: number;
  linksRemapped: number;
  bridgeLinks: BridgeRemap;
  /** Quote ids pointed at the native post, and dropped when their post is not imported. */
  quoteIds: QuoteRemap;
  /** Old forum links pointed at the native page, and unwrapped when nothing public is there. */
  forumLinks: ForumLinkRewrite;
  /** Bridge-era stash items moved to the native thread, or deleted (a twin, or never imported). */
  stashedThreads: StashThreadRemap;
  /** Bridge-era notification links pointed at the native page, or at the forum home when nothing public is there. */
  notificationLinks: NotificationLinkRewrite;
  relinked: { threads: number; posts: number };
  /** I7: imported rows hidden because XenForo has since moderated or deleted them. */
  rehidden: RehideTotals;
  failedThreads: ThreadFailure[];
}

function addWrite(totals: ApplyTotals, write: ThreadWrite): void {
  if (write.threadCreated) totals.threadsCreated += 1;
  else totals.threadsResumed += 1;
  totals.postsCreated += write.postsCreated;
  totals.postsPresent += write.postsPresent;
  totals.linksRemapped += write.linksRemapped;
}

/**
 * --apply: categories, every planned thread, the re-hide, the bridge link pass, the quote id pass, the forum link
 * pass (through the run's node map), the bridge-era stash item and notification link passes, the relink pass.
 * The import lock is asserted before the first thread and every 100 threads (ImportLockLostError stops the run);
 * any other error in a thread's write is recorded in `failedThreads` and the run continues (M19).
 */
export async function applyImport(
  db: ImportDb,
  plan: Pick<ImportPlan, "categories" | "threads" | "rehide">,
  opts: { nodeMap: NodeMapFile; log?: (line: string) => void }
): Promise<ApplyTotals> {
  const log = opts.log ?? (() => {});
  const { ids, created } = await ensureArchiveCategories(db, plan.categories);
  const totals: ApplyTotals = {
    categoriesCreated: created,
    threadsCreated: 0,
    threadsResumed: 0,
    postsCreated: 0,
    postsPresent: 0,
    linksRemapped: 0,
    bridgeLinks: { remapped: 0, twins: 0 },
    quoteIds: { remapped: 0, dropped: 0 },
    forumLinks: { mapped: 0, unwrapped: 0 },
    stashedThreads: { moved: 0, twins: 0, deleted: 0 },
    notificationLinks: { mapped: 0, unresolved: 0 },
    relinked: { threads: 0, posts: 0 },
    rehidden: { threads: 0, posts: 0, assets: 0 },
    failedThreads: [],
  };
  for (const [index, planned] of plan.threads.entries()) {
    if (index % PROGRESS_EVERY === 0) await assertImportLock(db);
    try {
      addWrite(totals, await writeThread(db, planned, categoryIdOf(planned.categoryRef, ids)));
    } catch (error) {
      const failure = {
        xenforoThreadId: planned.xenforoThreadId,
        error: error instanceof Error ? error.message : String(error),
      };
      totals.failedThreads.push(failure);
      log(`  thread ${failure.xenforoThreadId} failed and was rolled back: ${failure.error}`);
    }
    if ((index + 1) % PROGRESS_EVERY === 0)
      log(`  ${index + 1}/${plan.threads.length} threads written`);
  }
  await assertImportLock(db);
  totals.rehidden = await rehideImported(db, plan.rehide, { failures: totals.failedThreads, log });
  totals.bridgeLinks = await remapBridgeLinks(db);
  // A failed thread may hold a quoted, linked or stashed post: keep what nothing maps yet, so the rerun can map it.
  const complete = totals.failedThreads.length === 0;
  totals.quoteIds = await remapQuoteIds(db, { dropUnmapped: complete });
  const links = { nodeMap: opts.nodeMap, dropUnresolved: complete };
  totals.forumLinks = await rewriteImportedForumLinks(db, links);
  totals.stashedThreads = await remapStashedThreads(db, { dropUnresolved: complete });
  totals.notificationLinks = await rewriteNotificationLinks(db, links);
  totals.relinked = await relinkImportedAuthors(db);
  return totals;
}
