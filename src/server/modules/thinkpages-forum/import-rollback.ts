/**
 * Undoes the XenForo import (phase 4, `--rollback --yes`): every thread with a XenForo id (its posts cascade, native
 * replies posted on it included), the action links of those posts (a link the import moved from the XenForo post goes
 * back to it; a native reply's link is deleted, T0-7), the `xf-*` archive categories left without threads, the
 * applied node map, every "Forum" media asset and every copied file (with thumbnails) under `<uploadsDir>/forum`
 * named like the import names them (M18: whatever snapshot copied them). Reports, warnings and mod-log rows that name
 * deleted content stay (the report queue handles gone targets; the log is append-only). Threads go in chunks, one
 * transaction each, so an interrupted rollback is finished by a rerun. The import lock is asserted before every chunk
 * and before the remaining deletes (ImportLockLostError stops it).
 * `previewRollback` (I2, `--rollback` without `--yes`) counts the same rows and files and deletes nothing. The legacy
 * `/forum/*` redirects need no switching off first (phase 4b): an id that no longer resolves lands on the forum home.
 */
import { promises as nodeFs } from "fs";
import path from "path";
import { ARCHIVE_KEY_PREFIX } from "~/lib/thinkpages-forum/import/node-map";
import { assertImportLock, type ImportDb } from "./import-db";
import { TRANSACTION_TIMEOUT_MS } from "./import-write";
import { FORUM_IMPORT_NODE_MAP_KEY } from "./legacy-redirect";

const THREAD_CHUNK = 100;
const ID_CHUNK = 1000;
const FORUM_SOURCE = { source: "forum" } as const;
const IMPORTED_THREAD = { xenforoThreadId: { not: null } } as const;
/** `<attachment id>-<12 hex>-<stem>.<ext>`, optionally `.thumb.webp`: the import's names (attachments.ts). */
const COPIED_FILE = /^\d+-[0-9a-f]{12}-[A-Za-z0-9_-]+\.[a-z0-9]+(?:\.thumb\.webp)?$/;

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
        where: { id: { in: ids }, ...IMPORTED_THREAD },
      });
      totals.threads += count;
      totals.posts += posts.length;
    },
    { timeout: TRANSACTION_TIMEOUT_MS }
  );
}

async function rollbackCategories(db: ImportDb): Promise<number> {
  let deleted = 0;
  for (const { id } of await emptiedArchives(db)) {
    deleted += (await db.forumCategory.deleteMany({ where: { id } })).count;
  }
  return deleted;
}

/** The import's copied files (and their thumbnails) in `<uploadsDir>/forum`, by the exact COPIED_FILE pattern. */
async function copiedFiles(uploadsDir: string, fs: RollbackFs): Promise<string[]> {
  const dir = path.join(uploadsDir, "forum");
  return (await fs.readdir(dir))
    .filter((name) => COPIED_FILE.test(name))
    .map((name) => path.join(dir, name));
}

/** `xf-*` archive categories that hold no thread but imported ones: the rollback deletes these. */
async function emptiedArchives(db: Pick<ImportDb, "forumCategory" | "forumThread">) {
  const archives = await db.forumCategory.findMany({
    where: { scope: "site", realmId: null, key: { startsWith: ARCHIVE_KEY_PREFIX } },
    select: { id: true, key: true },
  });
  const out: Array<{ id: string; key: string }> = [];
  for (const archive of archives) {
    const kept = await db.forumThread.count({
      where: { categoryId: archive.id, xenforoThreadId: null },
    });
    if (kept === 0) out.push(archive);
  }
  return out;
}

/** Native replies on imported threads: they go with their threads. */
export function nativeRepliesOnImported(db: Pick<ImportDb, "forumPost">): Promise<number> {
  return db.forumPost.count({ where: { xenforoPostId: null, thread: IMPORTED_THREAD } });
}

export interface RollbackPreview {
  threads: number;
  posts: number;
  nativeReplies: number;
  /** Native action links on those posts: returned to their XenForo post, or deleted. */
  links: number;
  /** Keys of the `xf-*` archive categories left empty. */
  categories: string[];
  nodeMap: number;
  assets: number;
  files: number;
}

async function linksOnImported(
  db: Pick<ImportDb, "forumPost" | "postActionLink">
): Promise<number> {
  const posts = await db.forumPost.findMany({
    where: { thread: IMPORTED_THREAD },
    select: { id: true },
  });
  let links = 0;
  for (let i = 0; i < posts.length; i += ID_CHUNK) {
    const ids = posts.slice(i, i + ID_CHUNK).map((p) => p.id);
    links += await db.postActionLink.count({
      where: { postSource: "native", postRef: { in: ids } },
    });
  }
  return links;
}

/** I2: what `rollbackImport` would delete, counted; reads only. */
export async function previewRollback(
  db: ImportDb,
  opts: { uploadsDir: string; fs?: RollbackFs }
): Promise<RollbackPreview> {
  return {
    threads: await db.forumThread.count({ where: IMPORTED_THREAD }),
    posts: await db.forumPost.count({ where: { thread: IMPORTED_THREAD } }),
    nativeReplies: await nativeRepliesOnImported(db),
    links: await linksOnImported(db),
    categories: (await emptiedArchives(db)).map((c) => c.key),
    nodeMap: await db.systemConfig.count({ where: { key: FORUM_IMPORT_NODE_MAP_KEY } }),
    assets: await db.uploadedAsset.count({ where: FORUM_SOURCE }),
    files: (await copiedFiles(opts.uploadsDir, opts.fs ?? diskFs)).length,
  };
}

export async function rollbackImport(
  db: ImportDb,
  opts: { uploadsDir: string; fs?: RollbackFs }
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
  const threads = await db.forumThread.findMany({ where: IMPORTED_THREAD, select: { id: true } });
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
  totals.assets = (await db.uploadedAsset.deleteMany({ where: FORUM_SOURCE })).count;
  const fs = opts.fs ?? diskFs;
  for (const file of await copiedFiles(opts.uploadsDir, fs)) {
    await fs.unlink(file);
    totals.files += 1;
  }
  return totals;
}
