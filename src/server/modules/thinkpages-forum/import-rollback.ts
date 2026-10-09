/**
 * Undoes the XenForo import (phase 4, `--rollback --yes`): every thread with a XenForo id (its posts cascade, native
 * replies posted on it included, so the runner prints their count and needs `--yes`), the action links of those
 * posts (a link the import moved from the XenForo post goes back to it; a native reply's link is deleted, T0-7), the
 * `xf-*` archive categories left without threads, the applied node map, the "Forum" media assets of the snapshot's
 * attachments and their copied files with thumbnails. Reports, warnings and mod-log rows that name deleted content
 * stay (the report queue handles gone targets; the log is append-only). Threads go in chunks, one transaction each,
 * so an interrupted rollback is finished by a rerun. The import lock is asserted before every chunk and before the
 * remaining deletes (ImportLockLostError stops it).
 */
import { promises as nodeFs } from "fs";
import path from "path";
import { ARCHIVE_KEY_PREFIX } from "~/lib/thinkpages-forum/import/node-map";
import { assertImportLock, type ImportDb } from "./import-db";
import { TRANSACTION_TIMEOUT_MS } from "./import-write";
import { FORUM_IMPORT_NODE_MAP_KEY } from "./legacy-redirect";

const THREAD_CHUNK = 100;
/** `<attachment id>-<12 hex>-<stem>.<ext>`, optionally `.thumb.webp`: the import's names (attachments.ts). */
const COPIED_FILE = /^(\d+)-[0-9a-f]{12}-[A-Za-z0-9_-]+\.[a-z0-9]+(?:\.thumb\.webp)?$/;

export interface RollbackFs {
  /** File names in `dir`; empty when it does not exist. */
  readdir(dir: string): Promise<string[]>;
  unlink(file: string): Promise<void>;
}

const diskFs: RollbackFs = {
  readdir: (dir) => nodeFs.readdir(dir).catch(() => []),
  unlink: (file) => nodeFs.unlink(file),
};

export interface RollbackTotals {
  threads: number;
  posts: number;
  nativeReplies: number;
  linksRestored: number;
  linksDeleted: number;
  categories: number;
  nodeMap: number;
  assets: number;
  files: number;
}

type LinkTx = Pick<ImportDb, "postActionLink">;

/** A link on an imported post returns to its XenForo post, unless the bridge has made that row again meanwhile. */
async function restoreLink(
  tx: LinkTx,
  link: { id: string; activityId: string },
  xenforoPostId: number
): Promise<"restored" | "deleted"> {
  const postRef = String(xenforoPostId);
  const twin = await tx.postActionLink.findFirst({
    where: { postSource: "xenforo", postRef, activityId: link.activityId },
    select: { id: true },
  });
  if (twin) {
    await tx.postActionLink.deleteMany({ where: { id: link.id } });
    return "deleted";
  }
  await tx.postActionLink.updateMany({
    where: { id: link.id },
    data: { postSource: "xenforo", postRef },
  });
  return "restored";
}

/** A native reply's link is deleted with its post (T0-7); an imported post's link goes back to XenForo. */
async function undoLink(
  tx: LinkTx,
  link: { id: string; activityId: string },
  xenforoPostId: number | null
): Promise<"restored" | "deleted"> {
  if (xenforoPostId !== null) return restoreLink(tx, link, xenforoPostId);
  await tx.postActionLink.deleteMany({ where: { id: link.id } });
  return "deleted";
}

async function rollbackThreads(db: ImportDb, ids: string[], totals: RollbackTotals): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const posts = await tx.forumPost.findMany({
        where: { threadId: { in: ids } },
        select: { id: true, xenforoPostId: true },
      });
      const xenforoIdOf = new Map(posts.map((p) => [p.id, p.xenforoPostId]));
      const links = await tx.postActionLink.findMany({
        where: { postSource: "native", postRef: { in: posts.map((p) => p.id) } },
        select: { id: true, postRef: true, activityId: true },
      });
      for (const link of links) {
        const outcome = await undoLink(tx, link, xenforoIdOf.get(link.postRef) ?? null);
        totals[outcome === "restored" ? "linksRestored" : "linksDeleted"] += 1;
      }
      const { count } = await tx.forumThread.deleteMany({
        where: { id: { in: ids }, xenforoThreadId: { not: null } },
      });
      totals.threads += count;
      totals.posts += posts.length;
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

async function rollbackCategories(db: ImportDb): Promise<number> {
  const archives = await db.forumCategory.findMany({
    where: { scope: "site", realmId: null, key: { startsWith: ARCHIVE_KEY_PREFIX } },
    select: { id: true },
  });
  let deleted = 0;
  for (const { id } of archives) {
    if ((await db.forumThread.count({ where: { categoryId: id } })) > 0) continue;
    deleted += (await db.forumCategory.deleteMany({ where: { id } })).count;
  }
  return deleted;
}

async function removeFiles(
  dir: string,
  attachmentIds: ReadonlySet<number>,
  fs: RollbackFs
): Promise<number> {
  let removed = 0;
  for (const name of await fs.readdir(dir)) {
    const match = COPIED_FILE.exec(name);
    if (!match || !attachmentIds.has(Number(match[1]))) continue;
    await fs.unlink(path.join(dir, name));
    removed += 1;
  }
  return removed;
}

/** Native replies on imported threads: they go with their threads. */
export function nativeRepliesOnImported(db: Pick<ImportDb, "forumPost">): Promise<number> {
  return db.forumPost.count({
    where: { xenforoPostId: null, thread: { xenforoThreadId: { not: null } } },
  });
}

export async function rollbackImport(
  db: ImportDb,
  opts: { attachmentIds: ReadonlySet<number>; uploadsDir: string; fs?: RollbackFs }
): Promise<RollbackTotals> {
  const totals: RollbackTotals = {
    threads: 0,
    posts: 0,
    nativeReplies: await nativeRepliesOnImported(db),
    linksRestored: 0,
    linksDeleted: 0,
    categories: 0,
    nodeMap: 0,
    assets: 0,
    files: 0,
  };
  const threads = await db.forumThread.findMany({
    where: { xenforoThreadId: { not: null } },
    select: { id: true },
  });
  for (let i = 0; i < threads.length; i += THREAD_CHUNK) {
    await assertImportLock(db);
    await rollbackThreads(
      db,
      threads.slice(i, i + THREAD_CHUNK).map((t) => t.id),
      totals
    );
  }
  await assertImportLock(db);
  totals.categories = await rollbackCategories(db);
  totals.nodeMap = (
    await db.systemConfig.deleteMany({ where: { key: FORUM_IMPORT_NODE_MAP_KEY } })
  ).count;
  const refs = [...opts.attachmentIds].map(String);
  totals.assets = (
    await db.uploadedAsset.deleteMany({ where: { source: "forum", sourceRef: { in: refs } } })
  ).count;
  totals.files = await removeFiles(
    path.join(opts.uploadsDir, "forum"),
    opts.attachmentIds,
    opts.fs ?? diskFs
  );
  return totals;
}
