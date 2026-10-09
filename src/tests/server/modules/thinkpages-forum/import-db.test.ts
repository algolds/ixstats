/** @jest-environment node */
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { resolveNodeTargets } from "~/lib/thinkpages-forum/import/node-map";
import type { PlannedPost, PlannedThread } from "~/lib/thinkpages-forum/import/plan";
import type { XfNode } from "~/lib/thinkpages-forum/import/xenforo-types";
import { parseNodeLandings } from "~/lib/thinkpages-forum/legacy-forum";
import {
  appliedNodeMap,
  assertImportLock,
  loadImportDbState,
  mappedRealmSlugs,
  missingTargets,
  restrictedImportedPosts,
  storeNodeMap,
  takeImportLock,
} from "~/server/modules/thinkpages-forum/import-db";
import {
  ensureArchiveCategories,
  POST_CHUNK,
  relinkImportedAuthors,
  writeThread,
} from "~/server/modules/thinkpages-forum/import-write";
import { FORUM_IMPORT_NODE_MAP_KEY } from "~/server/modules/thinkpages-forum/legacy-redirect";
import { importStore } from "~/tests/helpers/forum-import-fake";

const SITE = SITE_CATEGORIES.map((c) => ({
  id: `c-${c.key}`,
  key: c.key,
  scope: "site",
  realmId: null,
  visibility: c.visibility,
}));
const day = (n: number) => new Date(Date.UTC(2025, 0, n));

function post(xenforoPostId: number, extra: Partial<PlannedPost> = {}): PlannedPost {
  return {
    xenforoPostId,
    xenforoUserId: 7,
    authorUserId: null,
    importedAuthorName: "Admin",
    contentHtml: `<p>post ${xenforoPostId}</p>`,
    plainText: `post ${xenforoPostId}`,
    hidden: false,
    createdAt: new Date(day(1).getTime() + xenforoPostId),
    editedAt: null,
    ...extra,
  };
}

function planned(posts: PlannedPost[], extra: Partial<PlannedThread> = {}): PlannedThread {
  return {
    xenforoThreadId: 100,
    existingId: null,
    categoryRef: { kind: "existing", id: "c-general" },
    title: "Welcome",
    authorUserId: null,
    importedAuthorName: "Admin",
    xenforoUserId: 7,
    pinned: false,
    locked: false,
    hidden: false,
    createdAt: day(1),
    lastPostAt: day(1),
    posts,
    skippedPosts: { deleted: 0, alreadyImported: 0 },
    ...extra,
  };
}

describe("loadImportDbState", () => {
  it("reads linked users, site categories with visibility, mapped realms and what is already imported", async () => {
    const { db } = importStore({
      users: [
        { id: "u-1", forumUserId: 7, createdAt: day(1) },
        { id: "u-2", forumUserId: null, createdAt: day(2) },
      ],
      realms: [{ id: "realm-urcea", slug: "urcea", name: "Urcea", status: "active", ownerId: "o" }],
      categories: [
        ...SITE,
        { id: "rc-hub", scope: "realm", realmId: "default", key: "hub" },
        { id: "rc-urcea", scope: "realm", realmId: "realm-urcea", key: "current-events" },
        { id: "rc-other", scope: "realm", realmId: "realm-other", key: "hub" },
      ],
      threads: [
        { id: "t-1", categoryId: "c-general", xenforoThreadId: 100 },
        { id: "t-native", categoryId: "c-general", xenforoThreadId: null },
      ],
      posts: [
        { id: "p-1", threadId: "t-1", xenforoPostId: 1000 },
        { id: "p-native", threadId: "t-1", xenforoPostId: null },
      ],
    });
    const state = await loadImportDbState(db as never, ["ixworld", "urcea", "nowhere"]);
    expect(state.users).toEqual([{ id: "u-1", forumUserId: 7, createdAt: day(1) }]);
    expect(state.siteCategories).toHaveLength(7);
    expect(state.siteCategories.find((c) => c.key === "staff")?.visibility).toBe("staff");
    expect([...state.realmIds]).toEqual([
      ["ixworld", "default"],
      ["urcea", "realm-urcea"],
    ]);
    expect(state.realmCategories.map((c) => c.id).sort()).toEqual(["rc-hub", "rc-urcea"]);
    expect([...state.existingThreads]).toEqual([[100, "t-1"]]);
    expect([...state.existingPosts]).toEqual([1000]);
    expect(missingTargets(state, ["ixworld", "urcea", "nowhere"])).toEqual([
      'The node map names realm "nowhere", which does not exist.',
    ]);
  });

  it("names every missing phase 1 seed", async () => {
    const { db } = importStore({ categories: SITE.filter((c) => c.key !== "general") });
    const state = await loadImportDbState(db as never, []);
    expect(missingTargets(state, [])).toEqual([
      'Sitewide category "general" is missing: apply the phase 1 forum migration.',
    ]);
  });

  it("collects the realm slugs a node map names, once each", () => {
    expect(
      mappedRealmSlugs({
        nodes: {
          "1": { scope: "realm", realm: "urcea", key: "hub" },
          "2": { scope: "realm", realm: "urcea", key: "current-events" },
          "3": { scope: "site", key: "general" },
          "4": { archive: true },
        },
      })
    ).toEqual(["urcea"]);
    expect(mappedRealmSlugs(null)).toEqual([]);
  });
});

describe("restrictedImportedPosts", () => {
  it("lists imported posts that are hidden, in a hidden thread or in a non-public category", async () => {
    const { db } = importStore({
      categories: [...SITE, { id: "c-xf-13", key: "xf-13", visibility: "staff" }],
      threads: [
        { id: "t-open", categoryId: "c-general", xenforoThreadId: 1 },
        { id: "t-hidden", categoryId: "c-general", xenforoThreadId: 2, hidden: true },
        { id: "t-staff", categoryId: "c-xf-13", xenforoThreadId: 3 },
      ],
      posts: [
        { id: "a", threadId: "t-open", xenforoPostId: 10 },
        { id: "b", threadId: "t-open", xenforoPostId: 11, hidden: true },
        { id: "c", threadId: "t-hidden", xenforoPostId: 12 },
        { id: "d", threadId: "t-staff", xenforoPostId: 13 },
        { id: "e", threadId: "t-hidden", xenforoPostId: null },
      ],
    });
    expect([...(await restrictedImportedPosts(db as never))].sort()).toEqual([11, 12, 13]);
  });
});

describe("takeImportLock", () => {
  it("is true when the advisory lock is free and false while another run holds it", async () => {
    expect(await takeImportLock(importStore({}).db as never)).toBe(true);
    expect(await takeImportLock(importStore({}, { lockHeld: true }).db as never)).toBe(false);
  });

  it("assertImportLock passes while the run holds the lock and stops it once another run does", async () => {
    const { db } = importStore({});
    await expect(assertImportLock(db as never)).resolves.toBeUndefined();
    db.$queryRaw.mockResolvedValueOnce([{ locked: false }]);
    await expect(assertImportLock(db as never)).rejects.toThrow(
      "The import lock was lost; stopping."
    );
  });
});

describe("the applied node map", () => {
  const node = (node_id: number, title: string): XfNode => ({
    node_id,
    title,
    description: "",
    node_type_id: "Forum",
    parent_node_id: 0,
    display_order: node_id,
  });

  it("stores each node's resolved target, which the /forum/<nodeId> redirect reads back", async () => {
    const resolved = resolveNodeTargets(
      [node(12, "General Discussion"), node(13, "Lore"), node(14, "Urcean news")],
      { nodes: { "14": { scope: "realm", realm: "urcea", key: "current-events" } } }
    );
    const { db, tables } = importStore({ configs: [] });
    await storeNodeMap(db as never, appliedNodeMap(resolved));
    await storeNodeMap(db as never, appliedNodeMap(resolved));
    const rows = tables().configs.filter((c) => c.key === FORUM_IMPORT_NODE_MAP_KEY);
    expect(rows).toHaveLength(1);
    const landings = parseNodeLandings(String(rows[0]!.value));
    expect(landings.get(12)).toEqual({ scope: "site", key: "general" });
    expect(landings.get(13)).toBeUndefined();
    expect(landings.get(14)).toEqual({ scope: "realm", realm: "urcea", key: "current-events" });
  });

  it("merges into the stored map: this run's nodes win, earlier nodes stay", async () => {
    const earlier = {
      nodes: {
        "5": { scope: "site", key: "announcements" },
        "12": { scope: "site", key: "side-games" },
      },
    };
    const { db, tables } = importStore({
      configs: [{ id: "cfg", key: FORUM_IMPORT_NODE_MAP_KEY, value: JSON.stringify(earlier) }],
    });
    await storeNodeMap(db as never, {
      nodes: { "12": { scope: "site", key: "general" }, "13": { archive: true } },
    });
    expect(JSON.parse(String(tables().configs[0]!.value))).toEqual({
      nodes: {
        "5": { scope: "site", key: "announcements" },
        "12": { scope: "site", key: "general" },
        "13": { archive: true },
      },
    });
  });

  it("replaces a stored row it cannot read", async () => {
    const { db, tables } = importStore({
      configs: [{ id: "cfg", key: FORUM_IMPORT_NODE_MAP_KEY, value: "{not json" }],
    });
    await storeNodeMap(db as never, { nodes: { "13": { archive: true } } });
    expect(JSON.parse(String(tables().configs[0]!.value))).toEqual({
      nodes: { "13": { archive: true } },
    });
  });
});

describe("ensureArchiveCategories", () => {
  const archive = (key: string) => ({
    key,
    name: `Archive: ${key}`,
    description: null,
    order: 1000,
    visibility: "public" as const,
    postRole: "staff" as const,
    icAllowed: false as const,
  });

  it("creates absent archive categories once and reuses existing ones", async () => {
    const { db, tables } = importStore({
      categories: [...SITE, { id: "c-xf-12", key: "xf-12" }],
    });
    const first = await ensureArchiveCategories(db as never, [archive("xf-12"), archive("xf-13")]);
    expect(first.created).toBe(1);
    expect(first.ids.get("xf-12")).toBe("c-xf-12");
    const again = await ensureArchiveCategories(db as never, [archive("xf-12"), archive("xf-13")]);
    expect(again.created).toBe(0);
    expect(again.ids.get("xf-13")).toBe(first.ids.get("xf-13"));
    expect(tables().categories.filter((c) => c.key === "xf-13")).toHaveLength(1);
  });

  it("re-reads the winner when a concurrent insert takes the key", async () => {
    const { db } = importStore({ categories: SITE });
    db.forumCategory.findFirst.mockResolvedValueOnce(null);
    await db.forumCategory.create({ data: { key: "xf-13", scope: "site", realmId: null } });
    const { ids, created } = await ensureArchiveCategories(db as never, [archive("xf-13")]);
    expect(created).toBe(0);
    expect(ids.get("xf-13")).toMatch(/^categories_/);
  });
});

describe("writeThread", () => {
  it("creates the thread and its posts in one transaction, in chunks of 500, and counts visible posts", async () => {
    const posts = Array.from({ length: POST_CHUNK * 2 + 1 }, (_, i) =>
      post(5000 + i, { hidden: i === POST_CHUNK * 2 })
    );
    const { db, tables } = importStore({ categories: SITE });
    const result = await writeThread(db as never, planned(posts), "c-general");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(
      db.forumPost.createMany.mock.calls.map(([args]) => (args.data as never[]).length)
    ).toEqual([500, 500, 1]);
    expect(db.forumPost.createMany.mock.calls.every(([args]) => args.skipDuplicates === true)).toBe(
      true
    );
    expect(result).toEqual({
      threadCreated: true,
      postsCreated: 1001,
      postsPresent: 0,
      linksRemapped: 0,
    });
    const [thread] = tables().threads;
    expect(thread).toMatchObject({
      xenforoThreadId: 100,
      categoryId: "c-general",
      postCount: 1000,
    });
    expect(thread!.lastPostAt).toEqual(posts[POST_CHUNK * 2 - 1]!.createdAt);
    expect(db.$executeRaw).toHaveBeenCalled();
  });

  it("writes into the existing thread without creating one, and skips posts already there", async () => {
    const { db, tables } = importStore({
      categories: SITE,
      threads: [
        {
          id: "t-1",
          categoryId: "c-general",
          xenforoThreadId: 100,
          postCount: 9,
          lastPostAt: day(9),
        },
      ],
      posts: [{ id: "p-1", threadId: "t-1", xenforoPostId: 1000, createdAt: day(1) }],
    });
    const result = await writeThread(
      db as never,
      planned([post(1000), post(1001)], { existingId: "t-1" }),
      "c-general"
    );
    expect(db.forumThread.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ threadCreated: false, postsCreated: 1, postsPresent: 1 });
    expect(tables().posts.filter((p) => p.threadId === "t-1")).toHaveLength(2);
    expect(tables().threads[0]).toMatchObject({ postCount: 2, lastPostAt: post(1001).createdAt });
  });

  it("remaps the XenForo action links of the posts that carry tokens, to the new native post", async () => {
    const { db, tables } = importStore({
      categories: SITE,
      links: [
        { id: "l-1", postSource: "xenforo", postRef: "1000", activityId: "act1", countryId: "c" },
        {
          id: "l-other",
          postSource: "xenforo",
          postRef: "4242",
          activityId: "act2",
          countryId: "c",
        },
      ],
    });
    const result = await writeThread(
      db as never,
      planned([post(1000, { contentHtml: "<p>see [ixaction=act1]</p>" }), post(1001)]),
      "c-general"
    );
    expect(result.linksRemapped).toBe(1);
    expect(db.postActionLink.updateMany).toHaveBeenCalledTimes(1);
    const native = tables().posts.find((p) => p.xenforoPostId === 1000)!;
    expect(tables().links.find((l) => l.id === "l-1")).toMatchObject({
      postSource: "native",
      postRef: native.id,
    });
    expect(tables().links.find((l) => l.id === "l-other")).toMatchObject({ postSource: "xenforo" });
  });

  it("rolls the whole thread back when a write fails", async () => {
    const { db, tables } = importStore(
      { categories: SITE },
      { failWhen: (table, method) => table === "threads" && method === "update" }
    );
    await expect(writeThread(db as never, planned([post(1000)]), "c-general")).rejects.toThrow(
      /injected/
    );
    expect(tables().threads).toHaveLength(0);
    expect(tables().posts).toHaveLength(0);
  });
});

describe("relinkImportedAuthors", () => {
  it("gives authorless imported rows their now-linked user (earliest account), and nothing else", async () => {
    const { db, tables } = importStore({
      users: [
        { id: "u-late", forumUserId: 8, createdAt: day(5) },
        { id: "u-early", forumUserId: 8, createdAt: day(1) },
        { id: "u-none", forumUserId: null, createdAt: day(1) },
      ],
      threads: [
        { id: "t-1", categoryId: "c", xenforoUserId: 8, authorUserId: null },
        { id: "t-2", categoryId: "c", xenforoUserId: 8, authorUserId: "u-other" },
      ],
      posts: [
        { id: "p-1", threadId: "t-1", xenforoUserId: 8, authorUserId: null },
        { id: "p-2", threadId: "t-1", xenforoUserId: 99, authorUserId: null },
        { id: "p-3", threadId: "t-1", xenforoUserId: null, authorUserId: null },
        { id: "p-4", threadId: "t-1", xenforoUserId: 8, authorUserId: "u-other" },
      ],
    });
    expect(await relinkImportedAuthors(db as never)).toEqual({ threads: 1, posts: 1 });
    const author = (rows: Array<{ id?: unknown; authorUserId?: unknown }>, id: string) =>
      rows.find((r) => r.id === id)?.authorUserId;
    expect(author(tables().threads, "t-1")).toBe("u-early");
    expect(author(tables().threads, "t-2")).toBe("u-other");
    expect(author(tables().posts, "p-1")).toBe("u-early");
    expect(author(tables().posts, "p-2")).toBeNull();
    expect(author(tables().posts, "p-3")).toBeNull();
    expect(author(tables().posts, "p-4")).toBe("u-other");
    expect(await relinkImportedAuthors(db as never)).toEqual({ threads: 0, posts: 0 });
  });
});
