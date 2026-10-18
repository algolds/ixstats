/** @jest-environment node */
import type { Snapshot } from "~/lib/thinkpages-forum/import/snapshot";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { ImportLockLostError } from "~/server/modules/thinkpages-forum/import-db";
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

/** The snapshot with some posts' message_state changed (a later export). */
function withStates(base: Snapshot, states: Record<number, string>): Snapshot {
  const postsByThread = new Map(
    [...base.postsByThread].map(([id, posts]) => [
      id,
      posts.map((p) => ({ ...p, message_state: states[p.post_id] ?? p.message_state })),
    ])
  );
  return { ...base, postsByThread };
}

/** The snapshot with some posts' messages replaced. */
function withMessages(base: Snapshot, messages: Record<number, string>): Snapshot {
  const postsByThread = new Map(
    [...base.postsByThread].map(([id, posts]) => [
      id,
      posts.map((p) => ({ ...p, message: messages[p.post_id] ?? p.message })),
    ])
  );
  return { ...base, postsByThread };
}

/** The snapshot with some threads' discussion_state changed. */
function withThreadStates(base: Snapshot, states: Record<number, string>): Snapshot {
  const threads = base.threads.map((t) => ({
    ...t,
    discussion_state: states[t.thread_id] ?? t.discussion_state,
  }));
  return { ...base, threads };
}

/** Thread 101's write fails once (its recount), so the first run lists it as failed and the rerun writes it. */
function failingThread101(rows: Partial<ImportTables>) {
  let armed = true;
  const store = importStore(rows, {
    failWhen: (table, method, args) => {
      if (!armed || table !== "threads" || method !== "update") return false;
      const row = store.tables().threads.find((t) => t.id === args.where?.id);
      if (row?.xenforoThreadId !== 101) return false;
      armed = false;
      return true;
    },
  });
  return store;
}

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
    expect(store.tables().configs).toEqual([]); // the run writes no SystemConfig row
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
      bridgeLinks: { remapped: 0, twins: 0 },
      quoteIds: { remapped: 0, dropped: 0 },
      forumLinks: { mapped: 0, unwrapped: 0 },
      stashedThreads: { moved: 0, twins: 0, deleted: 0 },
      notificationLinks: { mapped: 0, unresolved: 0 },
      relinked: { threads: 0, posts: 0 },
      rehidden: { threads: 0, posts: 0, assets: 0 },
      failedThreads: [],
    });
    expect(second.plan.rehide).toEqual({ threads: [], attachmentIds: [] });
    expect(imported(store.tables())).toEqual(before);
  });

  it("records a failing thread, rolls back only that thread and still runs the passes after it (M19)", async () => {
    const store = importStore(seed(), {
      failWhen: (table, method, args) => {
        if (table !== "threads" || method !== "update") return false;
        return store.tables().threads.find((t) => t.id === args.where?.id)?.xenforoThreadId === 101;
      },
    });
    const { totals } = await runImport(store.db as never, snapshot);
    expect(totals.failedThreads).toEqual([
      { xenforoThreadId: 101, error: "injected failure: threads.update" },
    ]);
    expect(totals).toMatchObject({ threadsCreated: 2, linksRemapped: 1 });
    expect(
      store
        .tables()
        .threads.map((t) => t.xenforoThreadId)
        .sort()
    ).toEqual([100, 103]);
    expect(store.tables().posts.some((p) => p.xenforoPostId === 1010)).toBe(false);
    expect(store.tables().configs).toEqual([]); // the run writes no SystemConfig row
  });

  it("points quotes at the native post, and drops the id of a quoted post that was not imported", async () => {
    const store = importStore(seed());
    const quoting = withMessages(snapshot, {
      1011: '[QUOTE="Admin, post: 1000, member: 7"]hi[/QUOTE][QUOTE="Spam, post: 1002, member: 0"]x[/QUOTE]',
    });
    const { totals } = await runImport(store.db as never, quoting);
    const native = store.tables().posts.find((p) => p.xenforoPostId === 1000)!;
    const html = store.tables().posts.find((p) => p.xenforoPostId === 1011)!.contentHtml as string;
    expect(html).toContain(`<blockquote class="forum-quote" data-post="${native.id}">`);
    expect(html).not.toMatch(/data-post="\d/);
    expect(html.match(/<blockquote class="forum-quote">/g)).toHaveLength(1);
    expect(totals.quoteIds).toEqual({ remapped: 1, dropped: 1 });
  });

  it("points post 1001's old forum link at the native thread 100, once", async () => {
    const store = importStore(seed());
    const first = await runImport(store.db as never, snapshot);
    const thread100 = store.tables().threads.find((t) => t.xenforoThreadId === 100)!;
    const row = store.tables().posts.find((p) => p.xenforoPostId === 1001)!;
    expect(row.contentHtml).toContain(`href="/thinkpages/t/${thread100.id}"`);
    expect(row.contentHtml).not.toContain("forum.ixwiki.com");
    expect(stripHtml(row.contentHtml as string)).toBe(row.plainText);
    expect(first.totals.forumLinks).toEqual({ mapped: 1, unwrapped: 0 });
    const second = await runImport(store.db as never, snapshot);
    expect(second.totals.forumLinks).toEqual({ mapped: 0, unwrapped: 0 });
  });

  it("moves bridge-era stash items and notification links to the native threads, once", async () => {
    const store = importStore({
      ...seed(),
      stashItems: [
        {
          id: "i-100",
          stashId: "s-1",
          pageTitle: "forum:thread:100",
          pageSlug: "/forum/thread/100",
          contentType: "forum_thread",
          contentId: 100,
        },
        { id: "i-103", stashId: "s-1", pageTitle: "forum:thread:103", contentType: "forum_thread" },
        { id: "i-555", stashId: "s-1", pageTitle: "forum:thread:555", contentType: "forum_thread" },
      ],
      notifications: [
        { id: "n-post", href: "/projects/ixstates/forum/thread/100#post-1000" },
        // Post 1001 was moderated on XenForo, so it is imported hidden: its link falls back to the thread.
        { id: "n-hidden-post", href: "/forum/thread/100#post-1001" },
        { id: "n-staff", href: "/forum/thread/103" },
      ],
    });
    const first = await runImport(store.db as never, snapshot);
    const thread = (xf: number) => store.tables().threads.find((t) => t.xenforoThreadId === xf)!;
    const post1000 = store.tables().posts.find((p) => p.xenforoPostId === 1000)!;
    expect(
      store.tables().stashItems.map((i) => [i.id, i.pageTitle, i.pageSlug, i.contentId])
    ).toEqual([
      ["i-100", `thinkpages:thread:${thread(100).id}`, `/thinkpages/t/${thread(100).id}`, null],
      ["i-103", `thinkpages:thread:${thread(103).id}`, `/thinkpages/t/${thread(103).id}`, null],
    ]);
    expect(store.tables().notifications.map((n) => [n.id, n.href])).toEqual([
      ["n-post", `/projects/ixstates/thinkpages/post/${post1000.id}`],
      ["n-hidden-post", `/thinkpages/t/${thread(100).id}`],
      ["n-staff", "/thinkpages"],
    ]);
    expect(first.totals.stashedThreads).toEqual({ moved: 2, twins: 0, deleted: 1 });
    expect(first.totals.notificationLinks).toEqual({ mapped: 2, unresolved: 1 });
    const second = await runImport(store.db as never, snapshot);
    expect(second.totals.stashedThreads).toEqual({ moved: 0, twins: 0, deleted: 0 });
    expect(second.totals.notificationLinks).toEqual({ mapped: 0, unresolved: 0 });
  });

  it("keeps an unmapped quote id while a thread failed, and maps it on the rerun", async () => {
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
    const quoting = withMessages(snapshot, {
      1031: '[QUOTE="Writer, post: 1010, member: 9"]end[/QUOTE]',
    });
    const html = () =>
      store.tables().posts.find((p) => p.xenforoPostId === 1031)!.contentHtml as string;
    const first = await runImport(store.db as never, quoting);
    expect(first.totals.quoteIds).toEqual({ remapped: 0, dropped: 0 });
    expect(html()).toContain('data-post="1010"');
    // The rerun plans no new post for thread 103: its quote is mapped by the pass over the stored rows.
    const rerun = await runImport(store.db as never, quoting);
    const native = store.tables().posts.find((p) => p.xenforoPostId === 1010)!;
    expect(rerun.totals.quoteIds).toEqual({ remapped: 1, dropped: 0 });
    expect(html()).toContain(`data-post="${native.id}"`);
  });

  it("keeps old forum links, stashed threads and notification links while a thread failed, and maps them on the rerun", async () => {
    const store = failingThread101({
      ...seed(),
      stashItems: [
        {
          id: "i-101",
          stashId: "s-1",
          pageTitle: "forum:thread:101",
          contentType: "forum_thread",
          contentId: 101,
        },
      ],
      notifications: [{ id: "n-101", href: "/forum/thread/101" }],
    });
    // Thread 101 is visible in this export, so once written its native thread is public.
    const linking = withThreadStates(
      withMessages(snapshot, { 1031: "[url=https://forum.ixwiki.com/threads/x.101/]x[/url]" }),
      { 101: "visible" }
    );
    const html = () =>
      store.tables().posts.find((p) => p.xenforoPostId === 1031)!.contentHtml as string;

    const first = await runImport(store.db as never, linking);
    expect(first.totals.failedThreads.map((f) => f.xenforoThreadId)).toEqual([101]);
    expect(html()).toContain('href="https://forum.ixwiki.com/threads/x.101/"');
    // Post 1001's link to thread 100 maps; 1031's link to the failed thread is kept, not unwrapped.
    expect(first.totals.forumLinks).toEqual({ mapped: 1, unwrapped: 0 });
    expect(first.totals.stashedThreads).toEqual({ moved: 0, twins: 0, deleted: 0 });
    expect(first.totals.notificationLinks).toEqual({ mapped: 0, unresolved: 0 });
    expect(store.tables().stashItems.map((i) => i.pageTitle)).toEqual(["forum:thread:101"]);
    expect(store.tables().notifications.map((n) => n.href)).toEqual(["/forum/thread/101"]);

    const rerun = await runImport(store.db as never, linking);
    const thread101 = store.tables().threads.find((t) => t.xenforoThreadId === 101)!;
    expect(rerun.totals.failedThreads).toEqual([]);
    expect(html()).toContain(`href="/thinkpages/t/${thread101.id}"`);
    expect(rerun.totals.forumLinks).toEqual({ mapped: 1, unwrapped: 0 });
    expect(rerun.totals.stashedThreads).toEqual({ moved: 1, twins: 0, deleted: 0 });
    expect(rerun.totals.notificationLinks).toEqual({ mapped: 1, unresolved: 0 });
    expect(store.tables().stashItems.map((i) => i.pageTitle)).toEqual([
      `thinkpages:thread:${thread101.id}`,
    ]);
    expect(store.tables().notifications.map((n) => n.href)).toEqual([
      `/thinkpages/t/${thread101.id}`,
    ]);
  });

  it("keeps what nothing maps while the snapshot covers only some forums, and drops it on a run over every forum", async () => {
    const store = importStore({
      ...seed(),
      stashItems: [
        {
          id: "i-999",
          stashId: "s-1",
          pageTitle: "forum:thread:999",
          contentType: "forum_thread",
          contentId: 999,
        },
      ],
      notifications: [{ id: "n-999", href: "/forum/thread/999" }],
    });
    const whole = withMessages(snapshot, {
      1031: '[url=https://forum.ixwiki.com/threads/x.999/]gone[/url] [QUOTE="Ann, post: 9999, member: 0"]q[/QUOTE]',
    });
    const filtered: Snapshot = { ...whole, meta: { ...whole.meta, nodeFilter: [12, 13] } };
    const html = () =>
      store.tables().posts.find((p) => p.xenforoPostId === 1031)!.contentHtml as string;

    const first = await runImport(store.db as never, filtered);
    expect(first.totals).toMatchObject({
      failedThreads: [],
      quoteIds: { remapped: 0, dropped: 0 },
      // Post 1001's link to thread 100 maps; nothing is unwrapped, dropped or deleted.
      forumLinks: { mapped: 1, unwrapped: 0 },
      stashedThreads: { moved: 0, twins: 0, deleted: 0 },
      notificationLinks: { mapped: 0, unresolved: 0 },
    });
    expect(html()).toContain('href="https://forum.ixwiki.com/threads/x.999/"');
    expect(html()).toContain('data-post="9999"');
    expect(store.tables().stashItems.map((i) => i.id)).toEqual(["i-999"]);
    expect(store.tables().notifications.map((n) => n.href)).toEqual(["/forum/thread/999"]);

    const again = await runImport(store.db as never, whole);
    expect(again.totals).toMatchObject({
      quoteIds: { remapped: 0, dropped: 1 },
      forumLinks: { mapped: 0, unwrapped: 1 },
      stashedThreads: { moved: 0, twins: 0, deleted: 1 },
      notificationLinks: { mapped: 0, unresolved: 1 },
    });
    expect(html()).not.toContain("forum.ixwiki.com");
    expect(html()).not.toContain("data-post=");
    expect(store.tables().stashItems).toEqual([]);
    expect(store.tables().notifications.map((n) => n.href)).toEqual(["/thinkpages"]);
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
    const first = await runImport(store.db as never, snapshot);
    expect(first.totals.failedThreads.map((f) => f.xenforoThreadId)).toEqual([101]);
    expect(store.tables().threads.map((t) => t.xenforoThreadId)).toEqual([100, 103]);
    const rerun = await runImport(store.db as never, snapshot);
    expect(rerun.totals).toMatchObject({ threadsCreated: 1, postsCreated: 2, failedThreads: [] });
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

  it("re-hides imported content XenForo has since moderated or deleted, and restricts its assets (I7)", async () => {
    const store = importStore({
      ...seed(),
      assets: [
        { id: "a-55", source: "forum", sourceRef: "55", visibility: "public" },
        { id: "a-56", source: "forum", sourceRef: "56", visibility: "restricted" },
      ],
    });
    await runImport(store.db as never, snapshot);
    // The delta export: thread 100's first post deleted, thread 101's visible reply now moderated.
    const delta = withStates(snapshot, { 1000: "deleted", 1011: "moderated" });
    const rerun = await runImport(store.db as never, delta);
    expect(rerun.plan.report.rehidden).toEqual({ threads: 1, posts: 1, attachments: 1 });
    expect(rerun.totals.rehidden).toEqual({ threads: 1, posts: 1, assets: 1 });
    expect(imported(store.tables()).threads).toEqual([
      "100@xf-12 hidden=true count=1",
      "101@xf-12 hidden=true count=1",
      "103@xf-13 hidden=true count=2",
    ]);
    const tables = store.tables();
    expect(tables.posts.find((p) => p.xenforoPostId === 1000)).toMatchObject({ hidden: false });
    expect(tables.posts.find((p) => p.xenforoPostId === 1011)).toMatchObject({ hidden: true });
    expect(tables.assets.map((a) => `${a.id}:${a.visibility}`)).toEqual([
      "a-55:restricted",
      "a-56:restricted",
    ]);
    // Never un-hides: the original states back in the snapshot change nothing, and nothing is planned again.
    const again = await runImport(store.db as never, snapshot);
    expect(again.plan.rehide.threads).toEqual([]);
    expect(store.tables().threads.find((t) => t.xenforoThreadId === 100)?.hidden).toBe(true);
    expect(store.tables().posts.find((p) => p.xenforoPostId === 1011)?.hidden).toBe(true);
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

  it("remaps links the bridge made on imported posts after an earlier run, in pages, and only those", async () => {
    const store = importStore(seed());
    await runImport(store.db as never, snapshot);
    const native1031 = store.tables().posts.find((p) => p.xenforoPostId === 1031)!.id;
    const native1000 = store.tables().posts.find((p) => p.xenforoPostId === 1000)!.id;
    const link = (id: string, postRef: string, activityId: string) => ({
      id,
      postSource: "xenforo",
      postRef,
      activityId,
      countryId: "c",
      storylineId: null,
      chainOrder: null,
      createdAt: new Date(0),
    });
    // 501 links on a post that was never imported, so the pass needs two pages.
    for (let i = 0; i < 501; i += 1)
      store.tables().links.push(link(`l-a${String(i).padStart(3, "0")}`, "4242", `x${i}`));
    store
      .tables()
      .links.push(
        link("l-z1", "1031", "act5"),
        link("l-z2", "1000", "act1"),
        link("l-z3", "not-a-number", "act6")
      );
    const rerun = await runImport(store.db as never, snapshot);
    expect(rerun.totals.bridgeLinks).toEqual({ remapped: 1, twins: 1 });
    const byId = (id: string) => store.tables().links.find((l) => l.id === id);
    expect(byId("l-z1")).toMatchObject({ postSource: "native", postRef: native1031 });
    expect(byId("l-1")).toMatchObject({ postSource: "native", postRef: native1000 });
    expect(byId("l-z2")).toMatchObject({ postSource: "xenforo", postRef: "1000" });
    expect(byId("l-z3")).toMatchObject({ postSource: "xenforo" });
    expect(store.tables().links.filter((l) => l.postRef === "4242")).toHaveLength(501);
    const again = await runImport(store.db as never, snapshot);
    expect(again.totals.bridgeLinks).toEqual({ remapped: 0, twins: 1 });
  });

  it("stops before writing a thread when the import lock is lost", async () => {
    const store = importStore(seed());
    store.db.$queryRaw.mockResolvedValueOnce([{ locked: false }]);
    await expect(runImport(store.db as never, snapshot)).rejects.toThrow(ImportLockLostError);
    expect(store.tables().threads).toHaveLength(0);
  });
});
