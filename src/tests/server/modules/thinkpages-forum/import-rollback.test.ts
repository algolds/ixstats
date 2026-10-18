/** @jest-environment node */
import path from "node:path";
import type { Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import { ImportLockLostError } from "~/server/modules/thinkpages-forum/import-db";
import {
  nativeRepliesOnImported,
  previewRollback,
  rollbackImport,
  type RollbackFs,
} from "~/server/modules/thinkpages-forum/import-rollback";
import { importStore, type ImportTables } from "~/tests/helpers/forum-import-fake";
import { readSmallSnapshot, runImport, SITE_ROWS } from "~/tests/helpers/forum-import-run";

const UPLOADS = "/srv/uploads";
const HASH = "0123456789ab";

let snapshot: Snapshot;
beforeAll(async () => {
  snapshot = await readSmallSnapshot();
});

const seed = (): Partial<ImportTables> => ({
  users: [{ id: "u-admin", forumUserId: 7, createdAt: new Date("2025-01-01") }],
  categories: SITE_ROWS,
  threads: [
    { id: "t-native", categoryId: "c-general", title: "Native", createdAt: new Date("2025-03-01") },
  ],
  posts: [{ id: "p-native", threadId: "t-native", contentHtml: "<p>[ixaction=act9]</p>" }],
  links: [
    { id: "l-xf", postSource: "xenforo", postRef: "1000", activityId: "act1", countryId: "c" },
    {
      id: "l-native",
      postSource: "native",
      postRef: "p-native",
      activityId: "act9",
      countryId: "c",
    },
  ],
  assets: [
    { id: "a-55", source: "forum", sourceRef: "55", url: "/images/uploads/forum/55.png" },
    { id: "a-56", source: "forum", sourceRef: "56", url: "/images/uploads/forum/56.pdf" },
    { id: "a-999", source: "forum", sourceRef: "999", url: "/images/uploads/forum/999.png" },
    { id: "a-upload", source: "upload", sourceRef: "55", url: "/images/uploads/x.png" },
  ],
});

function fakeFs(names: string[]): RollbackFs & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    readdir: async (dir) => (dir === path.join(UPLOADS, "forum") ? names : []),
    unlink: async (file) => {
      removed.push(path.basename(file));
    },
  };
}

/** A stash item as stashThread writes it (or the import moves it to): the native thread's title and path. */
const stashed = (id: string, stashId: string, threadId: string) => ({
  id,
  stashId,
  pageTitle: `thinkpages:thread:${threadId}`,
  pageSlug: `/thinkpages/t/${threadId}`,
  contentType: "forum_thread",
  contentId: null,
  note: "A thread",
  createdAt: new Date(0),
});

const importedThread = (tables: ImportTables, xenforoThreadId: number) =>
  tables.threads.find((t) => t.xenforoThreadId === xenforoThreadId)!;

/** Each stash item's id, title and contentId. */
const stashRows = (tables: ImportTables) =>
  tables.stashItems.map((i) => [i.id, i.pageTitle, i.contentId]);

/**
 * An imported store with a native reply (and its link) on imported thread 100, and stash items on imported threads
 * 100 and 103 and on the native thread.
 */
async function importedStore() {
  const store = importStore(seed());
  await runImport(store.db as never, snapshot);
  const tables = store.tables();
  const thread = importedThread(tables, 100);
  tables.posts.push({
    id: "p-reply",
    threadId: thread.id,
    xenforoPostId: null,
    xenforoUserId: null,
    contentHtml: "",
  });
  tables.links.push({
    id: "l-reply",
    postSource: "native",
    postRef: "p-reply",
    activityId: "act7",
    countryId: "c",
  });
  tables.stashItems.push(
    stashed("i-100", "s-1", thread.id),
    stashed("i-103", "s-2", importedThread(tables, 103).id),
    stashed("i-native", "s-1", "t-native")
  );
  return store;
}

describe("rollbackImport", () => {
  const FILES = [
    `55-${HASH}-map.png`,
    `55-${HASH}-map.png.thumb.webp`,
    `56-${HASH}-rules.pdf`,
    `999-${HASH}-other.png`,
    "notes.txt",
    `55-map.png`,
    `.55-${HASH}-map.png.partial`,
  ];

  it("previews exactly what it deletes, deleting nothing (I2)", async () => {
    const store = await importedStore();
    const before = JSON.stringify(store.tables());
    const fs = fakeFs(FILES);
    const preview = await previewRollback(store.db as never, { uploadsDir: UPLOADS, fs });
    expect(preview).toEqual({
      threads: 3,
      posts: 7,
      nativeReplies: 1,
      links: 2,
      stashItems: 2,
      categories: ["xf-12", "xf-13"],
      assets: 3,
      files: 4,
    });
    expect(JSON.stringify(store.tables())).toEqual(before);
    expect(fs.removed).toEqual([]);
    const totals = await rollbackImport(store.db as never, { uploadsDir: UPLOADS, fs });
    expect(totals).toMatchObject({
      threads: preview.threads,
      posts: preview.posts,
      nativeReplies: preview.nativeReplies,
      stashItems: preview.stashItems,
      categories: preview.categories.length,
      assets: preview.assets,
      files: preview.files,
    });
    expect(totals.linksRestored + totals.linksDeleted).toBe(preview.links);
  });

  it("removes exactly the imported rows, every forum asset and copied file (M18), and leaves native content alone", async () => {
    const store = await importedStore();
    expect(await nativeRepliesOnImported(store.db as never)).toBe(1);
    const fs = fakeFs(FILES);
    const totals = await rollbackImport(store.db as never, { uploadsDir: UPLOADS, fs });
    expect(totals).toEqual({
      threads: 3,
      posts: 7,
      nativeReplies: 1,
      linksRestored: 1,
      linksDeleted: 1,
      stashItems: 2,
      categories: 2,
      assets: 3,
      files: 4,
    });
    const after = store.tables();
    expect(after.threads.map((t) => t.id)).toEqual(["t-native"]);
    expect(after.posts.map((p) => p.id)).toEqual(["p-native"]);
    expect(after.links.map((l) => `${l.id} ${l.postSource}:${l.postRef}`)).toEqual([
      "l-xf xenforo:1000",
      "l-native native:p-native",
    ]);
    expect(after.categories.map((c) => c.key)).toEqual(SITE_ROWS.map((c) => c.key));
    expect(stashRows(after)).toEqual([
      ["i-100", "forum:thread:100", 100],
      ["i-103", "forum:thread:103", 103],
      ["i-native", "thinkpages:thread:t-native", null],
    ]);
    // An earlier snapshot's asset and file (999) go too: the scope is the source and the name, not this snapshot.
    expect(after.assets.map((a) => a.id)).toEqual(["a-upload"]);
    expect(fs.removed).toEqual([
      `55-${HASH}-map.png`,
      `55-${HASH}-map.png.thumb.webp`,
      `56-${HASH}-rules.pdf`,
      `999-${HASH}-other.png`,
    ]);
  });

  it("keeps an archive category that holds a native thread, and is a no-op the second time", async () => {
    const store = await importedStore();
    const xf12 = store.tables().categories.find((c) => c.key === "xf-12")!;
    store.tables().threads.push({ id: "t-staff", categoryId: xf12.id, xenforoThreadId: null });
    const opts = { uploadsDir: UPLOADS, fs: fakeFs([]) };
    expect((await rollbackImport(store.db as never, opts)).categories).toBe(1);
    expect(store.tables().categories.some((c) => c.key === "xf-12")).toBe(true);
    const again = await rollbackImport(store.db as never, opts);
    expect(again).toMatchObject({ threads: 0, posts: 0, stashItems: 0, categories: 0 });
  });

  it("returns stash items on imported threads to their bridge-era form, so a re-apply moves them back", async () => {
    const store = await importedStore();
    await rollbackImport(store.db as never, { uploadsDir: UPLOADS, fs: fakeFs([]) });

    const reapplied = await runImport(store.db as never, snapshot);

    expect(reapplied.totals.stashedThreads).toEqual({ moved: 2, twins: 0, deleted: 0 });
    const tables = store.tables();
    expect(stashRows(tables)).toEqual([
      ["i-100", `thinkpages:thread:${importedThread(tables, 100).id}`, null],
      ["i-103", `thinkpages:thread:${importedThread(tables, 103).id}`, null],
      ["i-native", "thinkpages:thread:t-native", null],
    ]);
  });

  it("deletes a stash item instead of returning it when its stash holds the bridge-era item again", async () => {
    const store = await importedStore();
    store.tables().stashItems.push({
      ...stashed("i-again", "s-1", "x"),
      pageTitle: "forum:thread:100",
      contentId: 100,
    });

    const totals = await rollbackImport(store.db as never, {
      uploadsDir: UPLOADS,
      fs: fakeFs([]),
    });

    expect(totals.stashItems).toBe(2);
    expect(stashRows(store.tables())).toEqual([
      ["i-103", "forum:thread:103", 103],
      ["i-native", "thinkpages:thread:t-native", null],
      ["i-again", "forum:thread:100", 100],
    ]);
  });

  it("deletes a remapped link instead of restoring it when the bridge has re-created the XenForo row", async () => {
    const store = await importedStore();
    store.tables().links.push({
      id: "l-twin",
      postSource: "xenforo",
      postRef: "1000",
      activityId: "act1",
      countryId: "c",
    });
    const totals = await rollbackImport(store.db as never, {
      uploadsDir: UPLOADS,
      fs: fakeFs([]),
    });
    expect(totals).toMatchObject({ linksRestored: 0, linksDeleted: 2 });
    expect(store.tables().links.map((l) => l.id)).toEqual(["l-native", "l-twin"]);
  });

  it("deletes nothing when the import lock is lost", async () => {
    const store = await importedStore();
    const before = JSON.stringify(store.tables());
    store.db.$queryRaw.mockResolvedValueOnce([{ locked: false }]);
    await expect(
      rollbackImport(store.db as never, {
        uploadsDir: UPLOADS,
        fs: fakeFs([]),
      })
    ).rejects.toThrow(ImportLockLostError);
    expect(JSON.stringify(store.tables())).toEqual(before);
  });
});
