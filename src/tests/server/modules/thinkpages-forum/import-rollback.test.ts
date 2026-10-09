/** @jest-environment node */
import path from "node:path";
import type { Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import {
  nativeRepliesOnImported,
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
  configs: [{ id: "cfg-other", key: "legacy_forum_redirect", value: "on" }],
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

/** An imported store with a native reply (and its link) on imported thread 100. */
async function importedStore() {
  const store = importStore(seed());
  await runImport(store.db as never, snapshot);
  const tables = store.tables();
  const thread = tables.threads.find((t) => t.xenforoThreadId === 100)!;
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
  return store;
}

describe("rollbackImport", () => {
  it("removes exactly the imported rows, files and assets, and leaves native content alone", async () => {
    const store = await importedStore();
    expect(await nativeRepliesOnImported(store.db as never)).toBe(1);
    const fs = fakeFs([
      `55-${HASH}-map.png`,
      `55-${HASH}-map.png.thumb.webp`,
      `56-${HASH}-rules.pdf`,
      `999-${HASH}-other.png`,
      "notes.txt",
      `55-map.png`,
    ]);
    const totals = await rollbackImport(store.db as never, {
      attachmentIds: new Set(snapshot.attachments.keys()),
      uploadsDir: UPLOADS,
      fs,
    });
    expect(totals).toEqual({
      threads: 3,
      posts: 7,
      nativeReplies: 1,
      linksRestored: 1,
      linksDeleted: 1,
      categories: 2,
      nodeMap: 1,
      assets: 2,
      files: 3,
    });
    const after = store.tables();
    expect(after.threads.map((t) => t.id)).toEqual(["t-native"]);
    expect(after.posts.map((p) => p.id)).toEqual(["p-native"]);
    expect(after.links.map((l) => `${l.id} ${l.postSource}:${l.postRef}`)).toEqual([
      "l-xf xenforo:1000",
      "l-native native:p-native",
    ]);
    expect(after.categories.map((c) => c.key)).toEqual(SITE_ROWS.map((c) => c.key));
    expect(after.configs.map((c) => c.id)).toEqual(["cfg-other"]);
    expect(after.assets.map((a) => a.id)).toEqual(["a-999", "a-upload"]);
    expect(fs.removed).toEqual([
      `55-${HASH}-map.png`,
      `55-${HASH}-map.png.thumb.webp`,
      `56-${HASH}-rules.pdf`,
    ]);
  });

  it("keeps an archive category that holds a native thread, and is a no-op the second time", async () => {
    const store = await importedStore();
    const xf12 = store.tables().categories.find((c) => c.key === "xf-12")!;
    store.tables().threads.push({ id: "t-staff", categoryId: xf12.id, xenforoThreadId: null });
    const opts = { attachmentIds: new Set<number>(), uploadsDir: UPLOADS, fs: fakeFs([]) };
    expect((await rollbackImport(store.db as never, opts)).categories).toBe(1);
    expect(store.tables().categories.some((c) => c.key === "xf-12")).toBe(true);
    const again = await rollbackImport(store.db as never, opts);
    expect(again).toMatchObject({ threads: 0, posts: 0, categories: 0, nodeMap: 0 });
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
      attachmentIds: new Set<number>(),
      uploadsDir: UPLOADS,
      fs: fakeFs([]),
    });
    expect(totals).toMatchObject({ linksRestored: 0, linksDeleted: 2 });
    expect(store.tables().links.map((l) => l.id)).toEqual(["l-native", "l-twin"]);
  });
});
