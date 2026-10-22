/** @jest-environment node */
/**
 * The realm board (a hidden category with one thread whose posts are the live message board) must never show in a
 * forum list, count, stat, Trending, the activity feed, the passport or the realm directory: one spec per read.
 */
import {
  forumActivityOf,
  importedAuthorByName,
  loadCategory,
  moveDestinations,
} from "~/server/modules/thinkpages-forum";
import {
  latestPublicThreads,
  publicThreadWhere,
} from "~/server/modules/thinkpages-forum/public-threads";
import { summarizeCategories } from "~/server/modules/thinkpages-forum/reads";
import { admin, eurthMod, realmCat, seed } from "~/tests/helpers/forum-mod-fixtures";
import { forumStore } from "~/tests/helpers/forum-store-fake";
import { locatePostFor } from "~/server/api/routers/thinkpagesForum/permalink";
import {
  editPost,
  getThreadPosts,
  replyToThread,
  stashThread,
} from "~/server/modules/thinkpages-forum";
import {
  BOARD_THREAD,
  boardPost,
  boardStore,
  founder,
  member,
  seed as boardSeed,
} from "~/tests/helpers/forum-board-fake";

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
});

describe("the board thread on the generic thread paths", () => {
  const store = () =>
    boardStore(boardSeed({ posts: [boardPost("p1", 1), boardPost("hid", 2, { hidden: true })] }));
  describe("the realm board thread on the generic thread paths", () => {
    it("is not readable as a thread", async () => {
      const s = store();
      for (const who of [member, founder, null]) {
        await expect(
          getThreadPosts(s.db as never, who as never, BOARD_THREAD, 1)
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
    });

    it("takes no replies through the thread reply", async () => {
      const s = store();
      await expect(
        replyToThread(s.db as never, member as never, { threadId: BOARD_THREAD, html: "<p>hi</p>" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(s.state.posts).toHaveLength(2);
    });

    it("takes no author edits through the post edit", async () => {
      const s = store();
      await expect(
        editPost(s.db as never, member as never, {
          postId: "p1",
          html: "<p>edited</p>",
          editedAt: null,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(s.state.posts[0]).toMatchObject({ plainText: "Message p1" });
    });

    it("cannot be stashed", async () => {
      const s = store();
      await expect(
        stashThread(
          s.db as never,
          member as never,
          { primaryId: "u_member", ids: ["u_member"] },
          { threadId: BOARD_THREAD }
        )
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
  describe("the post permalink", () => {
    it("resolves a board post to the realm landing, for the viewer who may see it", async () => {
      const s = store();
      expect(await locatePostFor(s.db as never, "clerk_u_member", "p1")).toEqual({
        realmSlug: "eurth",
      });
      expect(await locatePostFor(s.db as never, null, "p1")).toEqual({ realmSlug: "eurth" });
      expect(await locatePostFor(s.db as never, "clerk_u_member", "hid")).toBeNull();
      expect(await locatePostFor(s.db as never, "founder", "hid")).toEqual({ realmSlug: "eurth" });
    });
  });
});
