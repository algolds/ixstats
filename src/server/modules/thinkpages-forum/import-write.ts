/**
 * The XenForo importer's writes (phase 4): archive categories, then one transaction per thread (the thread when new,
 * its posts in chunks with `skipDuplicates`, the action-link remap, the recount under the thread lock), then the
 * author relink and the applied node map. Idempotent: a rerun plans only what is missing, and a thread interrupted
 * mid-write rolled back whole, so it is written again in full. No activity feed, notification or mod-log rows.
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
import { storeNodeMap, type ImportDb } from "./import-db";
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
 * Imported rows with no author whose XenForo user is now linked (`User.forumUserId`, earliest account first as at
 * import) take that user. Only rows with a XenForo user id are touched; guests never match.
 */
export async function relinkImportedAuthors(
  db: Pick<ImportDb, "user" | "forumThread" | "forumPost">
): Promise<{ threads: number; posts: number }> {
  const users = await db.user.findMany({
    where: { forumUserId: { not: null } },
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
  return relinked;
}

export interface ApplyTotals {
  categoriesCreated: number;
  threadsCreated: number;
  threadsResumed: number;
  postsCreated: number;
  postsPresent: number;
  linksRemapped: number;
  relinked: { threads: number; posts: number };
}

/** --apply: categories, every planned thread, the relink pass, the applied node map. */
export async function applyImport(
  db: ImportDb,
  plan: Pick<ImportPlan, "categories" | "threads">,
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
    relinked: { threads: 0, posts: 0 },
  };
  for (const [index, planned] of plan.threads.entries()) {
    const write = await writeThread(db, planned, categoryIdOf(planned.categoryRef, ids));
    if (write.threadCreated) totals.threadsCreated += 1;
    else totals.threadsResumed += 1;
    totals.postsCreated += write.postsCreated;
    totals.postsPresent += write.postsPresent;
    totals.linksRemapped += write.linksRemapped;
    if ((index + 1) % PROGRESS_EVERY === 0)
      log(`  ${index + 1}/${plan.threads.length} threads written`);
  }
  totals.relinked = await relinkImportedAuthors(db);
  await storeNodeMap(db, opts.nodeMap);
  return totals;
}
