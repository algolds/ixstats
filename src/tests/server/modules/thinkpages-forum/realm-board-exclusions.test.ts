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
import { latestPublicThreads, publicThreadWhere } from "~/server/modules/thinkpages-forum/public-threads";
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
const hubCategory = { ...boardCategory, id: "cat_hub", key: "hub", name: "Hub", order: 10, style: "ooc" };

const noRealms = { findMany: jest.fn(async () => []) };
const argsOf = (fn: jest.Mock): { where: Record<string, unknown> } =>
  fn.mock.calls[0]![0] as { where: Record<string, unknown> };

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
      realm: { findUnique: jest.fn(async () => ({ id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "x" })) },
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
    for (const [args] of count.mock.calls as Array<[Record<string, unknown>]>) {
      expect(JSON.stringify(args)).toContain('"style":{"not":"board"}');
    }
    expect(JSON.stringify(argsOf(groupBy as never))).toContain('"style":{"not":"board"}');
  });

  it("Trending groups no post of a board thread", async () => {
    const groupBy = jest.fn(async (_args: object) => []);
    const db = { realm: noRealms, forumPost: { groupBy }, forumThread: { findMany: jest.fn() } };
    await trendingThreads(db as never, null, 5, new Date("2026-10-14T12:00:00Z"));
    const thread = argsOf(groupBy as never).where.thread as { category: object };
    expect(thread.category).toMatchObject(NOT_BOARD);
  });

  it("the passport's footprint counts no board post or thread and a board post never confirms a name", async () => {
    const count = jest.fn(async (_args: object) => 0);
    const findFirst = jest.fn(async (_args: object) => null);
    const db = { realm: noRealms, forumPost: { count, findFirst }, forumThread: { count } };
    await forumActivityOf(db as never, "u1");
    expect(count).toHaveBeenCalledTimes(2);
    for (const [args] of count.mock.calls as Array<[Record<string, unknown>]>) {
      expect(JSON.stringify(args)).toContain('"style":{"not":"board"}');
    }
    await importedAuthorByName(db as never, "OldTimer");
    expect(JSON.stringify(argsOf(findFirst as never))).toContain('"style":{"not":"board"}');
  });

  it("the realm directory's forum activity counts no board message", async () => {
    const postCount = jest.fn(async (_args: object) => 0);
    const threadFirst = jest.fn(async (_args: object) => null);
    const db = {
      realm: {
        findMany: jest.fn(async () => [
          { id: "r1", slug: "r1", name: "R1", description: null, thumbnail: null, bannerUrl: null, tags: [], foundedAt: null, createdAt: new Date(), settings: null, _count: { countries: 0 } },
        ]),
      },
      country: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
      realmPage: { findMany: jest.fn(async () => []) },
      forumPost: { count: postCount },
      forumThread: { findFirst: threadFirst },
    };
    await listRealmDirectory(db as never, null);
    const inSection = (argsOf(postCount as never).where as { thread: { category: object } }).thread;
    expect(inSection.category).toMatchObject(NOT_BOARD);
    expect((argsOf(threadFirst as never).where as { category: object }).category).toMatchObject(NOT_BOARD);
  });

  it("a moderator is never offered the board as a place to move a thread", async () => {
    const state = seed();
    state.categories = [...state.categories, { ...realmCat("r_eurth", "board"), id: "r_eurth_board", style: "board" }];
    const store = forumStore(state);
    const from = state.categories.find((c) => c.id === "r_eurth_hub") as never;
    const keys = (await moveDestinations(store.db as never, eurthMod, from)).map((c) => c.key);
    expect(keys).toEqual(["character-threads", "current-events"]);
  });

  it("the moderation console does not list the board among a moderator's categories", async () => {
    const state = seed();
    state.categories = [...state.categories, { ...realmCat("r_eurth", "board"), id: "r_eurth_board", style: "board" }];
    const store = forumStore(state);
    const context = await moderationContext(store.db as never, eurthMod);
    expect(context.categories.map((c) => c.key)).not.toContain("board");
    const asAdmin = await moderationContext(store.db as never, admin as never);
    expect(asAdmin.categories.map((c) => c.key)).not.toContain("board");
  });
});
