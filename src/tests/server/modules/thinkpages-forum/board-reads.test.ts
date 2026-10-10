/** @jest-environment node */
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { threadOrderBy } from "~/lib/thinkpages-forum/thread-sort";
import {
  boardTopPosters,
  forumStatistics,
  latestPerCategory,
  postCountsPerCategory,
  trendingThreads,
} from "~/server/modules/thinkpages-forum/board-reads";
import { listBoards } from "~/server/modules/thinkpages-forum/board-list";

const admin = {
  id: "u_a",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};
const member = {
  id: "u_m",
  clerkUserId: "member",
  countryId: "c1",
  role: { name: "user", level: 100 },
};
const moderator = {
  ...member,
  id: "u_mod",
  mod: { siteAdmin: false, realmIds: [], categoryIds: ["cat_general"] },
};

const categories = SITE_CATEGORIES.map((c, i) => ({
  id: `cat_${c.key}`,
  scope: "site",
  realmId: null,
  style: "ooc",
  ...c,
  order: i,
}));
const byKey = (key: string) => categories.find((c) => c.key === key)!;
const general = byKey("general");
const staff = byKey("staff");
const reports = byKey("reports");

const T1 = new Date("2026-10-08T10:00:00Z");
const T2 = new Date("2026-10-09T08:00:00Z");

interface Args {
  where: { OR?: Array<Record<string, unknown>> } & Record<string, unknown>;
  [key: string]: unknown;
}
const argsOf = (fn: jest.Mock, call = 0) => fn.mock.calls[call]![0] as Args;

function latestDb() {
  return {
    forumThread: {
      findMany: jest.fn(async (_args: object) => [
        { id: "t_g", title: "General chat", categoryId: general.id, lastPostAt: T2 },
        { id: "t_r", title: "Find me", categoryId: byKey("find-a-realm").id, lastPostAt: T1 },
      ]),
    },
    forumPost: {
      findMany: jest.fn(async (_args: object) => [
        {
          threadId: "t_g",
          authorUserId: "u_x",
          authorPersonaId: "pa_1",
          importedAuthorName: null,
          createdAt: T2,
        },
        {
          threadId: "t_r",
          authorUserId: null,
          authorPersonaId: null,
          importedAuthorName: "OldName",
          createdAt: T1,
        },
      ]),
    },
  };
}

describe("latestPerCategory", () => {
  it("returns the newest thread of each board with its last post's author ids", async () => {
    const db = latestDb();
    const out = await latestPerCategory(db as never, null, categories);
    expect(out.get(general.id)).toEqual({
      threadId: "t_g",
      threadTitle: "General chat",
      authorUserId: "u_x",
      authorPersonaId: "pa_1",
      importedAuthorName: null,
      at: T2,
    });
    expect(out.get(byKey("find-a-realm").id)).toMatchObject({
      authorUserId: null,
      importedAuthorName: "OldName",
    });
  });

  it("makes exactly two queries however many categories there are", async () => {
    const db = latestDb();
    await latestPerCategory(db as never, member, categories);
    expect(db.forumThread.findMany).toHaveBeenCalledTimes(1);
    expect(db.forumPost.findMany).toHaveBeenCalledTimes(1);
    const threadArgs = argsOf(db.forumThread.findMany);
    expect(threadArgs).toMatchObject({ orderBy: { lastPostAt: "desc" }, distinct: ["categoryId"] });
    expect(argsOf(db.forumPost.findMany)).toMatchObject({
      orderBy: { createdAt: "desc" },
      distinct: ["threadId"],
    });
  });

  it("ignores archived threads", async () => {
    const db = latestDb();
    await latestPerCategory(db as never, null, [general]);
    expect(argsOf(db.forumThread.findMany).where).toMatchObject({ archived: false });
  });

  it("ignores hidden threads for members and keeps them for admins and the category's moderators", async () => {
    const forMember = latestDb();
    await latestPerCategory(forMember as never, member, [general]);
    expect(argsOf(forMember.forumThread.findMany).where.OR).toEqual([
      { categoryId: general.id, hidden: false },
    ]);
    const forAdmin = latestDb();
    await latestPerCategory(forAdmin as never, admin, [general]);
    expect(argsOf(forAdmin.forumThread.findMany).where.OR).toEqual([{ categoryId: general.id }]);
    const forMod = latestDb();
    await latestPerCategory(forMod as never, moderator, [general]);
    expect(argsOf(forMod.forumThread.findMany).where.OR).toEqual([{ categoryId: general.id }]);
  });

  it("ignores hidden posts for members but not in a thread the viewer moderates", async () => {
    const forMember = latestDb();
    await latestPerCategory(forMember as never, member, categories);
    expect(argsOf(forMember.forumPost.findMany).where).toEqual({
      threadId: { in: ["t_g", "t_r"] },
      hidden: false,
    });
    const forMod = latestDb();
    await latestPerCategory(forMod as never, moderator, categories);
    expect(argsOf(forMod.forumPost.findMany).where).toEqual({
      threadId: { in: ["t_g", "t_r"] },
      OR: [{ hidden: false }, { threadId: { in: ["t_g"] } }],
    });
  });

  it("shows a member only their own threads in Reports", async () => {
    const db = latestDb();
    await latestPerCategory(db as never, member, [reports]);
    expect(argsOf(db.forumThread.findMany).where.OR).toEqual([
      { categoryId: reports.id, hidden: false, authorUserId: member.id },
    ]);
  });

  it("asks nothing about categories the viewer cannot see", async () => {
    const db = latestDb();
    const out = await latestPerCategory(db as never, member, [staff]);
    expect(out.size).toBe(0);
    expect(db.forumThread.findMany).not.toHaveBeenCalled();
    expect(db.forumPost.findMany).not.toHaveBeenCalled();
  });

  it("falls back to the thread's own time when no post is visible", async () => {
    const db = latestDb();
    db.forumPost.findMany.mockResolvedValue([]);
    const out = await latestPerCategory(db as never, null, [general]);
    expect(out.get(general.id)).toMatchObject({ authorUserId: null, at: T2 });
  });
});

describe("postCountsPerCategory", () => {
  it("sums post counts per visible category in one grouped query, archived threads included", async () => {
    const groupBy = jest.fn(async (_args: object) => [
      { categoryId: general.id, _sum: { postCount: 42 } },
      { categoryId: byKey("rules").id, _sum: { postCount: null } },
    ]);
    const out = await postCountsPerCategory({ forumThread: { groupBy } } as never, member, [
      general,
      byKey("rules"),
      staff,
    ]);
    expect(out.get(general.id)).toBe(42);
    expect(out.get(byKey("rules").id)).toBe(0);
    expect(groupBy).toHaveBeenCalledTimes(1);
    const args = argsOf(groupBy);
    expect(args).toMatchObject({ by: ["categoryId"], _sum: { postCount: true } });
    expect(args.where.OR).toEqual([
      { categoryId: general.id, hidden: false },
      { categoryId: byKey("rules").id, hidden: false },
    ]);
    expect(args.where).not.toHaveProperty("archived");
  });
});

describe("forumStatistics", () => {
  const realmDb = { findMany: jest.fn(async () => []) };
  const statsDb = (threads: number, posts: number, members: string[]) => ({
    realm: realmDb,
    forumThread: { count: jest.fn(async (_args: object) => threads) },
    forumPost: {
      count: jest.fn(async (_args: object) => posts),
      groupBy: jest.fn(async (_args: object) => members.map((authorUserId) => ({ authorUserId }))),
    },
  });
  const MIN = 60_000;

  it("counts threads, posts and distinct member authors over public content, and caches for five minutes", async () => {
    const t0 = Date.UTC(2026, 9, 9, 12);
    const db = statsDb(10, 55, ["a", "b", "c"]);
    expect(await forumStatistics(db as never, t0)).toEqual({ threads: 10, posts: 55, members: 3 });
    const where = argsOf(db.forumThread.count).where;
    expect(where).toMatchObject({ hidden: false });
    expect(JSON.stringify(where)).toContain('"public"');
    expect(argsOf(db.forumPost.groupBy)).toMatchObject({ by: ["authorUserId"] });

    const later = statsDb(99, 99, []);
    expect(await forumStatistics(later as never, t0 + 4 * MIN)).toEqual({
      threads: 10,
      posts: 55,
      members: 3,
    });
    expect(later.forumThread.count).not.toHaveBeenCalled();
    expect(await forumStatistics(later as never, t0 + 6 * MIN)).toEqual({
      threads: 99,
      posts: 99,
      members: 0,
    });
  });
});

describe("trendingThreads", () => {
  const NOW = new Date("2026-10-09T12:00:00Z");
  const row = (id: string, category: object, authorUserId: string | null = "u_x") => ({
    id,
    title: `Thread ${id}`,
    authorUserId,
    hidden: false,
    category,
  });
  function trendingDb(threads: object[]) {
    return {
      realm: {
        findMany: jest.fn(async () => [
          { id: "r1", status: "active" },
          { id: "r_draft", status: "draft" },
        ]),
      },
      forumPost: {
        groupBy: jest.fn(async (_args: object) => [
          { threadId: "t_staff", _count: { threadId: 9 } },
          { threadId: "t_gen", _count: { threadId: 6 } },
          { threadId: "t_rep", _count: { threadId: 4 } },
        ]),
      },
      forumThread: { findMany: jest.fn(async (_args: object) => threads) },
    };
  }
  const threads = [
    row("t_gen", general),
    row("t_staff", staff),
    row("t_rep", reports, "someone_else"),
  ];

  it("ranks by posts in the last 24 hours and drops threads the member cannot see", async () => {
    const db = trendingDb(threads);
    const out = await trendingThreads(db as never, member, 5, NOW);
    expect(out).toEqual([
      { threadId: "t_gen", title: "Thread t_gen", categoryName: "General", repliesToday: 6 },
    ]);
    const args = argsOf(db.forumPost.groupBy);
    expect(args).toMatchObject({
      by: ["threadId"],
      orderBy: { _count: { threadId: "desc" } },
    });
    expect(args.where.createdAt).toEqual({ gte: new Date("2026-10-08T12:00:00Z") });
    expect(args.where.hidden).toBe(false);
  });

  it("keeps staff boards for admins and respects the limit", async () => {
    const db = trendingDb(threads);
    const out = await trendingThreads(db as never, admin, 2, NOW);
    expect(out.map((t) => t.threadId)).toEqual(["t_staff", "t_gen"]);
  });

  it("leaves out threads of categories in unpublished realms", async () => {
    const db = trendingDb(threads);
    await trendingThreads(db as never, member, 5, NOW);
    const category = (argsOf(db.forumPost.groupBy).where.thread as { category: object }).category;
    expect(category).toEqual({
      style: { not: "board" },
      OR: [{ scope: "site" }, { scope: "realm", realmId: { in: expect.arrayContaining(["r1"]) } }],
    });
    const realmIds = (category as { OR: Array<{ realmId?: { in: string[] } }> }).OR[1]!.realmId!.in;
    expect(realmIds).not.toContain("r_draft");
  });

  it("excludes archived and hidden threads in the grouped query", async () => {
    const db = trendingDb(threads);
    await trendingThreads(db as never, member, 5, NOW);
    expect(argsOf(db.forumPost.groupBy).where.thread).toMatchObject({
      hidden: false,
      archived: false,
    });
  });
});

describe("boardTopPosters", () => {
  const NOW = new Date("2026-10-17T12:00:00Z");
  const postsDb = () => ({
    forumPost: {
      groupBy: jest.fn(async (_args: object) => [
        { authorUserId: "u_1", _count: { authorUserId: 7 } },
        { authorUserId: "u_2", _count: { authorUserId: 3 } },
      ]),
    },
  });

  it("returns the top authors by posts this calendar month", async () => {
    const db = postsDb();
    const out = await boardTopPosters(db as never, member, general, 5, NOW);
    expect(out).toEqual([
      { authorUserId: "u_1", postCount: 7 },
      { authorUserId: "u_2", postCount: 3 },
    ]);
    const args = argsOf(db.forumPost.groupBy);
    expect(args).toMatchObject({ by: ["authorUserId"], take: 5 });
    expect(args.where).toMatchObject({
      createdAt: { gte: new Date("2026-10-01T00:00:00Z") },
      hidden: false,
      thread: { categoryId: general.id, hidden: false },
    });
  });

  it("does not count persona posts for the player behind the persona", async () => {
    const db = postsDb();
    await boardTopPosters(db as never, null, general, 5, NOW);
    expect(argsOf(db.forumPost.groupBy).where).toMatchObject({
      authorUserId: { not: null },
      authorPersonaId: null,
    });
  });

  it("applies the own-threads rule in Reports and nothing for a hidden board", async () => {
    const db = postsDb();
    await boardTopPosters(db as never, member, reports, 5, NOW);
    expect(argsOf(db.forumPost.groupBy).where).toMatchObject({
      thread: { categoryId: reports.id, authorUserId: member.id },
    });
    const none = await boardTopPosters(db as never, member, staff, 5, NOW);
    expect(none).toEqual([]);
    expect(db.forumPost.groupBy).toHaveBeenCalledTimes(1);
  });
});

describe("threadOrderBy", () => {
  it("orders latest by activity, newest by creation and replies by post count, pinned first", () => {
    expect(threadOrderBy("latest")).toEqual([
      { pinned: "desc" },
      { lastPostAt: "desc" },
      { id: "desc" },
    ]);
    expect(threadOrderBy("newest")).toEqual([
      { pinned: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(threadOrderBy("replies")).toEqual([
      { pinned: "desc" },
      { postCount: "desc" },
      { id: "desc" },
    ]);
  });
});

describe("listBoards", () => {
  it("joins counts, latest post (with its author's name) and style onto the visible site boards", async () => {
    const db = {
      forumCategory: { findMany: jest.fn(async (_args: object) => categories) },
      forumThread: {
        groupBy: jest.fn(async (args: { by: string[] }) =>
          args.by.length === 2
            ? [
                {
                  categoryId: general.id,
                  archived: false,
                  _count: { _all: 4 },
                  _max: { lastPostAt: T2 },
                },
              ]
            : [{ categoryId: general.id, _sum: { postCount: 20 } }]
        ),
        findMany: jest.fn(async (_args: object) => [
          { id: "t_g", title: "General chat", categoryId: general.id, lastPostAt: T2 },
        ]),
      },
      forumPost: {
        findMany: jest.fn(async (_args: object) => [
          {
            threadId: "t_g",
            authorUserId: "u_x",
            authorPersonaId: null,
            importedAuthorName: null,
            createdAt: T2,
          },
        ]),
      },
      user: {
        findMany: jest.fn(async (_args: object) => [
          { id: "u_x", handle: "heku", wikiUsername: null, country: null },
        ]),
      },
      thinkpagesAccount: { findMany: jest.fn(async (_args: object) => []) },
    };
    const rows = await listBoards(db as never, null);
    expect(rows.map((r) => r.key)).not.toContain("staff");
    const row = rows.find((r) => r.key === "general")!;
    expect(row).toMatchObject({
      id: general.id,
      style: "ooc",
      visibility: "public",
      threadCount: 4,
      postCount: 20,
    });
    expect(row.latest).toEqual({
      threadId: "t_g",
      threadTitle: "General chat",
      authorUserId: "u_x",
      authorPersonaId: null,
      importedAuthorName: null,
      at: T2,
      author: { name: "heku", handle: "heku" },
    });
    expect(rows.find((r) => r.key === "rules")!.latest).toBeNull();
    expect(rows.find((r) => r.key === "rules")!.postCount).toBe(0);
  });

  it("hides the player's user id behind a persona's latest post and names the persona", async () => {
    const db = {
      forumCategory: { findMany: jest.fn(async (_args: object) => [general]) },
      forumThread: {
        groupBy: jest.fn(async () => []),
        findMany: jest.fn(async (_args: object) => [
          { id: "t_g", title: "General chat", categoryId: general.id, lastPostAt: T2 },
        ]),
      },
      forumPost: {
        findMany: jest.fn(async (_args: object) => [
          {
            threadId: "t_g",
            authorUserId: "u_x",
            authorPersonaId: "pa_1",
            importedAuthorName: null,
            createdAt: T2,
          },
        ]),
      },
      user: {
        findMany: jest.fn(async (_args: object) => [
          { id: "u_x", handle: "heku", wikiUsername: null, country: null },
        ]),
      },
      thinkpagesAccount: {
        findMany: jest.fn(async (_args: object) => [
          { id: "pa_1", displayName: "Caphiria News", username: "caphnews" },
        ]),
      },
    };
    const [row] = await listBoards(db as never, null);
    expect(row!.latest).toMatchObject({
      authorUserId: null,
      authorPersonaId: "pa_1",
      author: { name: "Caphiria News", handle: "caphnews" },
    });
    expect(JSON.stringify(row)).not.toContain("u_x");
  });
});
