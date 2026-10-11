/** @jest-environment node */
/**
 * The realm board (a hidden category with one thread whose posts are the live message board) must never show in a
 * forum list, count, stat, Trending, the activity feed, the passport or the realm directory: one spec per read.
 */
import {
  forumActivityOf,
  importedAuthorByName,
  loadCategory,
  moderationContext,
  moveDestinations,
} from "~/server/modules/thinkpages-forum";
import { trendingThreads } from "~/server/modules/thinkpages-forum/board-reads";
import {
  latestPublicThreads,
  publicThreadWhere,
} from "~/server/modules/thinkpages-forum/public-threads";
import { latestPublicThreadPreviews } from "~/server/modules/thinkpages-forum/thread-preview";
import { summarizeCategories } from "~/server/modules/thinkpages-forum/reads";
import { listRealmDirectory } from "~/server/api/routers/realms/places";
import { admin, eurthMod, realmCat, seed } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";

const NOT_BOARD = { style: { not: "board" }, NOT: { scope: "realm", key: "board" } };

const boardCategory = {
  id: "cat_board",
  scope: "realm",
  realmId: "r_eurth",
  key: "board",
  name: "Board",
  description: null,
  order: 0,
  visibility: "public",
  postRole: "any",
  icAllowed: true,
  style: "board",
  createdAt: new Date("2026-10-14"),
};
const hubCategory = {
  ...boardCategory,
  id: "cat_hub",
  key: "hub",
  name: "Hub",
  order: 10,
  style: "ooc",
};

const noRealms = { findMany: jest.fn(async () => []) };
interface QueryArgs {
  where: { category?: object; thread?: { category: object } };
}
const argsOf = (fn: jest.Mock): QueryArgs => fn.mock.calls[0]![0] as QueryArgs;

describe("publicThreadWhere", () => {
  it("leaves board categories out of what anyone may read", async () => {
    const where = await publicThreadWhere({ realm: noRealms } as never);
    expect(where.category).toMatchObject(NOT_BOARD);
  });
});

describe("realm board exclusions", () => {
  it("summarizeCategories lists no board and counts none", async () => {
    const groupBy = jest.fn(async (_args: object) => []);
    const out = await summarizeCategories(
      { forumThread: { groupBy } } as never,
      admin as never,
      [boardCategory, hubCategory] as never
    );
    expect(out.map((c) => c.key)).toEqual(["hub"]);
    expect(JSON.stringify(argsOf(groupBy as never))).not.toContain("cat_board");
  });

  it("loadCategory refuses the board by key, so no category page lists or writes into it", async () => {
    const db = {
      realm: {
        findUnique: jest.fn(async () => ({
          id: "r_eurth",
          slug: "eurth",
          name: "Eurth",
          status: "active",
          ownerId: "x",
        })),
      },
      forumCategory: { findFirst: jest.fn(async () => boardCategory) },
    };
    await expect(
      loadCategory(db as never, admin as never, { key: "board", realm: "eurth" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("the activity feed and Trending feed read no board thread", async () => {
    const findMany = jest.fn(async (_args: object) => []);
    await latestPublicThreads({ forumThread: { findMany }, realm: noRealms } as never, 20);
    expect(argsOf(findMany as never).where.category).toMatchObject(NOT_BOARD);
  });

  it("feed previews list the public threads and read only their visible posts, never a board thread", async () => {
    const row = {
      id: "t1",
      title: "Hello",
      authorUserId: null,
      authorPersonaId: null,
      importedAuthorName: "Old",
      postCount: 1,
      createdAt: new Date("2026-10-14"),
      lastPostAt: new Date("2026-10-14"),
      category: { key: "general", name: "General", scope: "site", realmId: null, style: "ooc" },
    };
    const findMany = jest.fn(async (_args: object) => [row]);
    const postFindMany = jest.fn(async (_args: object) => []);
    const db = {
      forumThread: { findMany },
      forumPost: { findMany: postFindMany, findFirst: jest.fn(async (_args: object) => null) },
      realm: noRealms,
      user: { findMany: jest.fn(async () => []) },
      thinkpagesAccount: { findMany: jest.fn(async () => []) },
    };
    await latestPublicThreadPreviews(db as never, 20);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(argsOf(findMany as never).where.category).toMatchObject(NOT_BOARD);
    expect(argsOf(postFindMany as never).where).toEqual({
      threadId: { in: ["t1"] },
      hidden: false,
    });
  });

  it("forum statistics count no board thread, post or author", async () => {
    const count = jest.fn(async (_args: object) => 0);
    const groupBy = jest.fn(async (_args: object) => []);
    const db = { realm: noRealms, forumThread: { count }, forumPost: { count, groupBy } };
    // The statistics cache lives in the module: a private copy keeps this call's entry out of every other spec.
    let forumStatistics!: typeof import("~/server/modules/thinkpages-forum/board-reads").forumStatistics;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      forumStatistics = require("~/server/modules/thinkpages-forum/board-reads").forumStatistics;
    });
    await forumStatistics(db as never, Date.now());
    expect(count).toHaveBeenCalledTimes(2);
    for (const [args] of count.mock.calls as Array<[object]>) {
      expect(JSON.stringify(args)).toContain('"style":{"not":"board"}');
    }
    expect(JSON.stringify(argsOf(groupBy as never))).toContain('"style":{"not":"board"}');
  });

  it("Trending groups no post of a board thread", async () => {
    const groupBy = jest.fn(async (_args: object) => []);
    const db = { realm: noRealms, forumPost: { groupBy }, forumThread: { findMany: jest.fn() } };
    await trendingThreads(db as never, null, 5, new Date("2026-10-14T12:00:00Z"));
    const { thread } = argsOf(groupBy as never).where;
    expect(thread?.category).toMatchObject(NOT_BOARD);
  });

  it("the passport's footprint counts no board post or thread and a board post never confirms a name", async () => {
    const count = jest.fn(async (_args: object) => 0);
    const findFirst = jest.fn(async (_args: object) => null);
    const db = { realm: noRealms, forumPost: { count, findFirst }, forumThread: { count } };
    await forumActivityOf(db as never, "u1");
    expect(count).toHaveBeenCalledTimes(2);
    for (const [args] of count.mock.calls as Array<[object]>) {
      expect(JSON.stringify(args)).toContain('"style":{"not":"board"}');
    }
    await importedAuthorByName(db as never, "OldTimer");
    expect(JSON.stringify(argsOf(findFirst as never))).toContain('"style":{"not":"board"}');
  });

  const directoryRealm = (n: number) => ({
    id: `r${n}`,
    slug: `r${n}`,
    name: `R${n}`,
    description: null,
    thumbnail: null,
    bannerUrl: null,
    tags: [],
    foundedAt: null,
    createdAt: new Date(),
    settings: null,
    _count: { countries: 0 },
  });
  const directoryDb = (realmCount: number) => ({
    realm: {
      findMany: jest.fn(async () =>
        Array.from({ length: realmCount }, (_, i) => directoryRealm(i + 1))
      ),
    },
    country: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    realmPage: { findMany: jest.fn(async () => []) },
    forumCategory: { findMany: jest.fn(async (_args: object) => []) },
    forumPost: { groupBy: jest.fn(async () => []) },
    forumThread: {
      findMany: jest.fn(async (_args: object) => []),
      groupBy: jest.fn(async (_args: object) => []),
    },
    $queryRaw: jest.fn(
      async (_sql: TemplateStringsArray, ..._values: unknown[]): Promise<object[]> => []
    ),
  });
  const forumQueries = (db: ReturnType<typeof directoryDb>) =>
    [
      db.forumCategory.findMany,
      db.forumPost.groupBy,
      db.forumThread.findMany,
      db.forumThread.groupBy,
      db.$queryRaw,
    ]
      .map((fn) => fn.mock.calls.length)
      .reduce((a, b) => a + b, 0);

  it("the realm directory's forum activity counts no board message", async () => {
    const db = directoryDb(1);
    await listRealmDirectory(db as never, null);
    const section = argsOf(db.forumCategory.findMany as never).where as object;
    expect(section).toMatchObject({ scope: "realm", visibility: "public", ...NOT_BOARD });
  });

  it("the directory's board-week figure is separate: the forum count keeps excluding the board, the board is read in its own batch", async () => {
    const db = directoryDb(1);
    await listRealmDirectory(db as never, null);
    const forumSection = argsOf(db.forumCategory.findMany as never).where as Record<string, object>;
    expect(forumSection).toMatchObject(NOT_BOARD);
    expect(forumSection.OR).toBeUndefined();
    const boardCategory = (
      argsOf(db.forumThread.findMany as never).where as {
        category: Record<string, object | string>;
      }
    ).category;
    expect(boardCategory).toMatchObject({
      OR: [{ style: "board" }, { scope: "realm", key: "board" }],
    });
    expect(boardCategory.style).toBeUndefined();
  });

  it("the directory reads every realm's forum activity in a fixed number of queries", async () => {
    const few = directoryDb(2);
    const many = directoryDb(12);
    await listRealmDirectory(few as never, null);
    await listRealmDirectory(many as never, null);
    expect(forumQueries(many)).toBe(forumQueries(few));
  });

  it("the directory sums each realm's posts and picks its latest thread across its sections", async () => {
    const db = directoryDb(3);
    const early = new Date("2026-10-01T00:00:00Z");
    const late = new Date("2026-10-09T00:00:00Z");
    db.forumCategory.findMany.mockResolvedValue([
      { id: "c1", realmId: "r1" },
      { id: "c2", realmId: "r1" },
      { id: "c3", realmId: "r2" },
    ] as never);
    db.forumThread.groupBy.mockResolvedValue([
      { categoryId: "c1", _max: { lastPostAt: early } },
      { categoryId: "c2", _max: { lastPostAt: late } },
    ] as never);
    // One grouped row per section, not one per active thread.
    db.$queryRaw.mockResolvedValue([
      { categoryId: "c1", posts: 2 },
      { categoryId: "c2", posts: 3 },
      { categoryId: "c3", posts: 1 },
    ]);
    const out = await listRealmDirectory(db as never, null);
    expect(out.map((r) => r.board)).toEqual([
      { recentPosts: 5, lastPostAt: late },
      { recentPosts: 1, lastPostAt: null },
      { recentPosts: 0, lastPostAt: null },
    ]);
    // The count is grouped in the database, over the non-board sections only, hidden posts and threads left out.
    const [strings, ...values] = db.$queryRaw.mock.calls[0]!;
    const sql = strings.join("?");
    expect(sql).toMatch(/GROUP BY t\."categoryId"/i);
    expect(sql).toMatch(/t\.hidden = false/);
    expect(sql).toMatch(/p\.hidden = false/);
    expect(values[0]).toMatchObject({ values: ["c1", "c2", "c3"] });
  });

  it("a moderator is never offered the board as a place to move a thread", async () => {
    const state = seed();
    state.categories = [
      ...state.categories,
      { ...realmCat("r_eurth", "board"), id: "r_eurth_board", style: "board" },
    ];
    const store = forumStore(state);
    const from = state.categories.find((c) => c.id === "r_eurth_hub") as never;
    const keys = (await moveDestinations(store.db as never, eurthMod, from)).map((c) => c.key);
    expect(keys).toEqual(["character-threads", "current-events"]);
  });

  it("the moderation console does not list the board among a moderator's categories", async () => {
    const state = seed();
    state.categories = [
      ...state.categories,
      { ...realmCat("r_eurth", "board"), id: "r_eurth_board", style: "board" },
    ];
    const store = forumStore(state);
    const context = await moderationContext(store.db as never, eurthMod);
    expect(context.categories.map((c) => c.key)).not.toContain("board");
    const asAdmin = await moderationContext(store.db as never, admin as never);
    expect(asAdmin.categories.map((c) => c.key)).not.toContain("board");
  });
});
