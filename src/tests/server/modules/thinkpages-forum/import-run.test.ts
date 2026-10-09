/** @jest-environment node */
import type { Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import { importStore, type ImportTables } from "~/tests/helpers/forum-import-fake";
import { readSmallSnapshot, runImport, SITE_ROWS } from "~/tests/helpers/forum-import-run";

let snapshot: Snapshot;
beforeAll(async () => {
  snapshot = await readSmallSnapshot();
});

const seed = (): Partial<ImportTables> => ({
  users: [{ id: "u-admin", forumUserId: 7, createdAt: new Date("2025-01-01") }],
  categories: SITE_ROWS,
  links: [
    { id: "l-1", postSource: "xenforo", postRef: "1000", activityId: "act1", countryId: "c" },
  ],
  configs: [],
});

/** The imported rows by XenForo id, without generated ids, for comparing two runs. */
function imported(tables: ImportTables) {
  const keyOf = new Map(tables.categories.map((c) => [c.id, c.key]));
  const xfOf = new Map(tables.threads.map((t) => [t.id, t.xenforoThreadId]));
  return {
    categories: tables.categories.map((c) => `${c.key}:${c.visibility}`).sort(),
    threads: tables.threads
      .map(
        (t) =>
          `${t.xenforoThreadId}@${keyOf.get(t.categoryId as string)} hidden=${t.hidden} count=${t.postCount}`
      )
      .sort(),
    posts: tables.posts
      .map(
        (p) =>
          `${p.xenforoPostId}@${xfOf.get(p.threadId as string)} hidden=${p.hidden} author=${p.authorUserId}`
      )
      .sort(),
    links: tables.links.map((l) => `${l.postSource}:${l.postRef === "1000" ? "1000" : "native"}`),
  };
}

describe("the XenForo import applied to the small snapshot", () => {
  it("writes the plan: archive categories, threads, posts, counts, link remap, node map", async () => {
    const store = importStore(seed());
    const { totals } = await runImport(store.db as never, snapshot);
    expect(totals).toMatchObject({
      categoriesCreated: 2,
      threadsCreated: 3,
      threadsResumed: 0,
      postsCreated: 6,
      postsPresent: 0,
      linksRemapped: 1,
    });
    expect(imported(store.tables())).toMatchObject({
      threads: [
        "100@xf-12 hidden=false count=1",
        "101@xf-12 hidden=true count=2",
        "103@xf-13 hidden=true count=2",
      ],
      links: ["native:native"],
    });
    expect(store.tables().categories.find((c) => c.key === "xf-13")?.visibility).toBe("staff");
    const remapped = store.tables().links[0]!;
    expect(store.tables().posts.find((p) => p.id === remapped.postRef)?.xenforoPostId).toBe(1000);
    expect(store.tables().configs.map((c) => c.key)).toEqual(["forum_import_node_map"]);
    expect(store.db.forumThread.create).toHaveBeenCalledTimes(3);
  });

  it("creates nothing the second time", async () => {
    const store = importStore(seed());
    await runImport(store.db as never, snapshot);
    const before = imported(store.tables());
    const second = await runImport(store.db as never, snapshot);
    expect(second.plan.threads).toEqual([]);
    expect(second.totals).toEqual({
      categoriesCreated: 0,
      threadsCreated: 0,
      threadsResumed: 0,
      postsCreated: 0,
      postsPresent: 0,
      linksRemapped: 0,
      relinked: { threads: 0, posts: 0 },
    });
    expect(imported(store.tables())).toEqual(before);
  });

  it("finishes a thread interrupted mid-write on the rerun, ending as one clean run would", async () => {
    const clean = importStore(seed());
    await runImport(clean.db as never, snapshot);

    // Thread 101's recount fails after its posts were inserted: the transaction rolls the thread back whole.
    let armed = true;
    const store = importStore(seed(), {
      failWhen: (table, method, args) => {
        if (!armed || table !== "threads" || method !== "update") return false;
        const row = store.tables().threads.find((t) => t.id === args.where?.id);
        if (row?.xenforoThreadId !== 101) return false;
        armed = false;
        return true;
      },
    });
    await expect(runImport(store.db as never, snapshot)).rejects.toThrow(/injected/);
    expect(store.tables().threads.map((t) => t.xenforoThreadId)).toEqual([100]);
    const rerun = await runImport(store.db as never, snapshot);
    expect(rerun.totals).toMatchObject({ threadsCreated: 2, postsCreated: 4 });
    expect(imported(store.tables())).toEqual(imported(clean.tables()));
  });

  it("resumes a thread holding only part of its posts and recounts it", async () => {
    const store = importStore(seed());
    await runImport(store.db as never, snapshot);
    const tables = store.tables();
    const thread = tables.threads.find((t) => t.xenforoThreadId === 103)!;
    tables.posts = tables.posts.filter((p) => p.xenforoPostId !== 1031);
    thread.postCount = 99;
    const rerun = await runImport(store.db as never, snapshot);
    expect(rerun.totals).toMatchObject({ threadsCreated: 0, threadsResumed: 1, postsCreated: 1 });
    expect(store.tables().threads.find((t) => t.xenforoThreadId === 103)?.postCount).toBe(2);
  });

  it("relinks authors linked after the first run", async () => {
    const store = importStore(seed());
    await runImport(store.db as never, snapshot);
    store
      .tables()
      .users.push({ id: "u-member", forumUserId: 8, createdAt: new Date("2025-02-01") });
    const rerun = await runImport(store.db as never, snapshot);
    expect(rerun.totals.relinked).toEqual({ threads: 0, posts: 2 });
    const byMember = store.tables().posts.filter((p) => p.xenforoUserId === 8);
    expect(byMember.map((p) => p.authorUserId)).toEqual(["u-member", "u-member"]);
  });
});
