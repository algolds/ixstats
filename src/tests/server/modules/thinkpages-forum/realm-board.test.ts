/** @jest-environment node */
import { boardPostRealm, getBoard } from "~/server/modules/thinkpages-forum/board";
import {
  admin,
  boardPost,
  boardStore,
  member,
  officer,
  seed,
  visitor,
} from "~/tests/helpers/forum-board-fake";
import { boardAccessFor } from "~/server/modules/thinkpages-forum/board-access";
import { loadForumRealm, type ForumRealm } from "~/server/modules/thinkpages-forum";
import { ban, banned, claimsOfficer, founder } from "~/tests/helpers/forum-board-fake";
import { realmBoardPreview } from "~/server/modules/thinkpages-forum/board-preview";
import { seedRealmCategories } from "~/server/modules/thinkpages-forum/realm-seed";
import {
  forumActivityOf,
  importedAuthorByName,
  loadCategory,
} from "~/server/modules/thinkpages-forum";
import {
  latestPublicThreads,
  publicThreadWhere,
} from "~/server/modules/thinkpages-forum/public-threads";
import { summarizeCategories } from "~/server/modules/thinkpages-forum/reads";
import { admin as siteAdmin } from "~/tests/helpers/forum-mod-fixtures";
import { locatePostFor } from "~/server/api/routers/thinkpagesForum/permalink";
import { getThreadPosts, replyToThread } from "~/server/modules/thinkpages-forum";
import { BOARD_THREAD, seed as boardSeed } from "~/tests/helpers/forum-board-fake";

const messages = [
  boardPost("p1", 1),
  boardPost("p2", 2, { authorUserId: "u_visitor" }),
  boardPost("p3", 3, { replyToPostId: "p1", authorUserId: "u_officer" }),
  boardPost("p4", 4, { authorUserId: null, importedAuthorName: "OldHand" }),
  boardPost("p5", 5, { hidden: true }),
  boardPost("p6", 6, {
    authorPersonaId: "pa_news",
    plainText: "News flash",
    contentHtml: "<p>News flash</p>",
  }),
];

const storeWith = (posts = messages, threads: object[] = []) => {
  const base = seed();
  return boardStore(seed({ posts, threads: [...(base.threads ?? []), ...threads] as never }));
};
const board = (
  who: object | null,
  opts: { before?: string; limit?: number } = {},
  slug = "eurth",
  store = storeWith()
) => getBoard(store.db as never, who as never, slug, opts);
describe("getBoard", () => {
  it("refuses a cursor that is not a message of this board", async () => {
    await expect(board(member, { before: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("hides hidden messages from members and anonymous readers", async () => {
    for (const who of [member, null, visitor]) {
      const out = await board(who);
      expect(out.messages.map((m) => m.id)).not.toContain("p5");
      expect(out.messages.every((m) => !("hidden" in m))).toBe(true);
    }
  });
  it("gives each message persona-safe author data", async () => {
    const out = await board(member);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.p1!.author).toEqual({
      name: "member",
      handle: "member",
      avatarUrl: null,
      flagUrl: "https://flags.example/u_member.png",
      persona: false,
      personaType: null,
    });
    expect(byId.p4!.author).toMatchObject({ name: "OldHand", persona: false, flagUrl: null });
    // A persona's message names the persona only: no player id, flag, avatar of the player, role or visitor label.
    expect(byId.p6).toMatchObject({
      authorUserId: null,
      authorPersonaId: "pa_news",
      author: {
        name: "Eurth Daily",
        handle: "eurthdaily",
        avatarUrl: "https://img.example/daily.png",
        flagUrl: null,
        persona: true,
        personaType: "media",
      },
      role: null,
      isVisitor: false,
      visitorRealm: null,
    });
    expect(JSON.stringify(byId.p6)).not.toContain("u_member");
  });

  it("tells moderators what they may do to each author's message, and readers nothing", async () => {
    const posts = [
      ...messages,
      boardPost("p7", 7, { authorUserId: "u_admin" }),
      boardPost("p8", 8, { authorUserId: "u_officer" }),
    ];
    const asOfficer = await board(officer, {}, "eurth", storeWith(posts));
    const byId = Object.fromEntries(asOfficer.messages.map((m) => [m.id, m]));
    expect(byId.p1).toMatchObject({ moderable: true, sanctionable: true });
    // A persona's message is its player's: the moderator may warn that player.
    expect(byId.p6).toMatchObject({ moderable: true, sanctionable: true });
    // Imported content has nobody to warn or ban; a site admin's content is site admins' only; your own is not sanctioned.
    expect(byId.p4).toMatchObject({ moderable: true, sanctionable: false });
    expect(byId.p7).toMatchObject({ moderable: false, sanctionable: false });
    expect(byId.p8).toMatchObject({ sanctionable: false });
    const asAdmin = await board(admin, {}, "eurth", storeWith(posts));
    expect(asAdmin.messages.find((m) => m.id === "p7")).toMatchObject({ sanctionable: false });
    expect(asAdmin.messages.find((m) => m.id === "p1")).toMatchObject({ moderable: true });
    for (const who of [member, visitor, null]) {
      const out = await board(who, {}, "eurth", storeWith(posts));
      expect(out.messages.every((m) => !("moderable" in m) && !("sanctionable" in m))).toBe(true);
    }
  });
  it("summarizes the message a reply answers, not leaking hidden or persona players", async () => {
    const store = storeWith([
      boardPost("a", 1, { plainText: "x".repeat(300) }),
      boardPost("b", 2, { replyToPostId: "a" }),
      boardPost("h", 3, { hidden: true, plainText: "secret" }),
      boardPost("c", 4, { replyToPostId: "h" }),
      boardPost("d", 5, { authorPersonaId: "pa_news", plainText: "by persona" }),
      boardPost("e", 6, { replyToPostId: "d" }),
    ]);
    const out = await board(member, {}, "eurth", store);
    const byId = Object.fromEntries(out.messages.map((m) => [m.id, m]));
    expect(byId.b!.replyTo).toEqual({
      postId: "a",
      authorName: "member",
      excerpt: `${"x".repeat(139)}…`,
    });
    expect(byId.c!.replyTo).toBeNull();
    expect(byId.e!.replyTo).toEqual({
      postId: "d",
      authorName: "Eurth Daily",
      excerpt: "by persona",
    });
    const asMod = await board(officer, {}, "eurth", store);
    expect(asMod.messages.find((m) => m.id === "c")!.replyTo).toMatchObject({
      postId: "h",
      excerpt: "secret",
    });
  });
  it("does not name a continued thread in a category the viewer cannot see", async () => {
    const store = storeWith(
      [boardPost("c1", 1, { continuedThreadId: "t_staff" })],
      [
        {
          id: "t_staff",
          categoryId: "cat_staff",
          title: "Secret plans",
          postCount: 9,
          hidden: false,
        },
      ]
    );
    store.state.categories.push({
      id: "cat_staff",
      key: "staff",
      scope: "site",
      realmId: null,
      visibility: "staff",
      postRole: "any",
      icAllowed: false,
    });
    const asMember = await board(member, {}, "eurth", store);
    expect(JSON.stringify(asMember.messages)).not.toContain("Secret plans");
    const asAdmin = await board(admin, {}, "eurth", store);
    expect(asAdmin.messages[0]!.continued).toMatchObject({ title: "Secret plans", replies: 8 });
  });

  it("reads as not found for an unknown realm and for a draft realm to a member", async () => {
    await expect(board(member, {}, "nowhere")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(board(member, {}, "draft")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(board(admin, {}, "draft")).resolves.toMatchObject({ realm: { slug: "draft" } });
  });
});

describe("boardPostRealm", () => {
  it("is null for a post in a realm hidden from the viewer", async () => {
    const draft = boardStore(
      seed({ posts: [boardPost("d1", 1, { threadId: "t_board_r_draft" })] })
    );
    expect(await boardPostRealm(draft.db as never, member as never, "d1")).toBeNull();
    expect(await boardPostRealm(draft.db as never, admin as never, "d1")).toEqual({
      realmSlug: "draft",
    });
  });
});

describe("who reads, posts and moderates the board", () => {
  async function accessFor(
    who: object | null,
    slug = "eurth",
    store = boardStore(),
    category?: { id: string }
  ) {
    const realm = (await loadForumRealm(store.db as never, { slug })) as ForumRealm;
    return boardAccessFor(store.db as never, who as never, realm, undefined, category);
  }

  describe("boardAccessFor", () => {
    it("refuses a banned member (realm ban), who can still read", async () => {
      const store = boardStore();
      store.state.bans.push(ban({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
      expect(await accessFor(banned, "eurth", store)).toMatchObject({
        canRead: true,
        canPost: false,
        reason: "banned",
      });
    });

    it("refuses a member banned from the board category, not one banned from another category", async () => {
      const store = boardStore();
      store.state.bans.push(
        ban({ userId: "u_banned", scope: "category", scopeId: "cat_r_eurth_board" }),
        ban({ id: "b2", userId: "u_member", scope: "category", scopeId: "cat_r_eurth_hub" })
      );
      const boardCategory = { id: "cat_r_eurth_board" };
      expect(await accessFor(banned, "eurth", store, boardCategory)).toMatchObject({
        canPost: false,
        reason: "banned",
      });
      expect(await accessFor(member, "eurth", store, boardCategory)).toMatchObject({
        canPost: true,
      });
    });
    it("treats the founder, a board officer and a site admin as moderators who can post", async () => {
      for (const who of [founder, officer, admin]) {
        expect(await accessFor(who)).toMatchObject({
          canPost: true,
          isModerator: true,
          isMember: true,
        });
      }
    });
    it("does not make a claims-only officer a moderator", async () => {
      expect(await accessFor(claimsOfficer)).toMatchObject({ isModerator: false, isVisitor: true });
    });

    it("makes an archived realm read-only for everyone but site admins", async () => {
      expect(await accessFor(member, "old")).toMatchObject({
        canRead: true,
        canPost: false,
        reason: "archived",
      });
      expect(await accessFor(visitor, "old")).toMatchObject({ canPost: false, reason: "archived" });
      expect(await accessFor(admin, "old")).toMatchObject({ canPost: true });
    });

    it("hides a draft realm from everyone but its staff", async () => {
      expect(await accessFor(member, "draft")).toMatchObject({ canRead: false, canPost: false });
      expect(await accessFor(admin, "draft")).toMatchObject({ canRead: true });
    });
  });
});

describe("the board preview", () => {
  const longText = `${"alpha ".repeat(40)}omega`;
  const posts = [
    boardPost("p1", 1),
    boardPost("p2", 2, {
      authorUserId: "u_visitor",
      plainText: "From Aurora",
      contentHtml: "<p>From Aurora</p>",
    }),
    boardPost("p4", 4, {
      authorUserId: "u_member",
      authorPersonaId: "pa_news",
      plainText: "News flash [ixaction=a1] tonight",
      contentHtml: "<p>News flash</p>",
    }),
    boardPost("p5", 5, {
      continuedThreadId: "t_long",
      plainText: "Continued in a thread",
      contentHtml: "<p>Continued in a thread</p>",
    }),
    boardPost("p6", 6, { plainText: longText, contentHtml: `<p>${longText}</p>` }),
    // Newer than every visible message: a query that forgot `hidden: false` would put it first.
    boardPost("p8", 8, { hidden: true, plainText: "Hidden one", contentHtml: "<p>Hidden one</p>" }),
    boardPost("p7", 7, {
      plainText: "",
      contentHtml: '<p><img src="https://img.example/a.png"></p>',
    }),
  ];
  const store = (extra: Parameters<typeof boardStore>[1] = {}) =>
    boardStore(seed({ posts }), extra);
  describe("realmBoardPreview", () => {
    it("shows a persona's message by the persona only, never its player", async () => {
      const out = await realmBoardPreview(store().db as never, member as never, "eurth");
      const persona = out!.messages.find((m) => m.id === "p4")!;
      expect(persona.author).toEqual({
        name: "Eurth Daily",
        avatarUrl: "https://img.example/daily.png",
        flagUrl: null,
        persona: true,
        personaType: "media",
      });
      expect(Object.keys(persona).sort()).toEqual(["author", "createdAt", "excerpt", "href", "id"]);
      // The player also wrote p6 and p7 as themselves: only the persona's own message is held to the rule.
      const text = JSON.stringify(persona);
      expect(text).not.toContain("u_member");
      expect(text).not.toContain("flags.example");
      expect(text).not.toContain("eurthdaily");
      for (const message of out!.messages) {
        expect(Object.keys(message).sort()).toEqual([
          "author",
          "createdAt",
          "excerpt",
          "href",
          "id",
        ]);
      }
    });

    it("keeps a persona masked for a site admin too, and hides hidden messages from them", async () => {
      // The admin owns the persona's player account: even its owner is shown the persona only.
      const siteAdmin = { ...member, role: admin.role };
      const out = await realmBoardPreview(store().db as never, siteAdmin as never, "eurth");
      expect(out!.messages.map((m) => m.id)).toEqual(["p7", "p6", "p4"]);
      const persona = out!.messages.find((m) => m.id === "p4")!;
      expect(persona.author).toEqual({
        name: "Eurth Daily",
        avatarUrl: "https://img.example/daily.png",
        flagUrl: null,
        persona: true,
        personaType: "media",
      });
      expect(JSON.stringify(persona)).not.toContain("u_member");
    });
  });
});

describe("seeding the board", () => {
  type CategoryRow = Record<string, unknown>;
  type ManyArgs<T> = { data: T[]; skipDuplicates: boolean };
  /** An in-memory forum that honours the (scope, realmId, key) and sourceRef unique indexes like skipDuplicates. */
  function fakeForum() {
    const categories: CategoryRow[] = [];
    const threads: Array<Record<string, unknown>> = [];
    const forumCategory = {
      createMany: jest.fn(async (args: ManyArgs<CategoryRow>) => {
        let count = 0;
        for (const row of args.data) {
          const taken = categories.some(
            (c) => c.scope === row.scope && c.realmId === row.realmId && c.key === row.key
          );
          if (taken) continue;
          categories.push({ id: `cat_${row.key}`, ...row });
          count += 1;
        }
        return { count };
      }),
      findFirst: jest.fn(
        async (args: { where: CategoryRow }) =>
          categories.find((c) => c.realmId === args.where.realmId && c.key === args.where.key) ??
          null
      ),
    };
    const forumThread = {
      createMany: jest.fn(async (args: ManyArgs<Record<string, unknown>>) => {
        let count = 0;
        for (const row of args.data) {
          if (threads.some((t) => t.sourceRef === row.sourceRef)) continue;
          threads.push(row);
          count += 1;
        }
        return { count };
      }),
    };
    return { categories, threads, db: { forumCategory, forumThread } };
  }
  describe("seedRealmCategories", () => {
    it("is idempotent: a second run creates nothing and leaves one board thread", async () => {
      const { db, categories, threads } = fakeForum();
      await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
      const again = await seedRealmCategories(db as never, { id: "r1", name: "Eurth" });
      expect(again).toEqual({ created: 0 });
      expect(categories).toHaveLength(4);
      expect(threads).toHaveLength(1);
    });
  });
});

/**
 * The realm board (a hidden category with one thread whose posts are the live message board) must never show in a
 * forum list, count, stat, Trending, the activity feed, the passport or the realm directory: one spec per read.
 */
describe("the board stays out of the generic forum", () => {
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
        siteAdmin as never,
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
        loadCategory(db as never, siteAdmin as never, { key: "board", realm: "eurth" })
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
          replyToThread(s.db as never, member as never, {
            threadId: BOARD_THREAD,
            html: "<p>hi</p>",
          })
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(s.state.posts).toHaveLength(2);
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
        expect(await locatePostFor(s.db as never, "founder", "hid")).toEqual({
          realmSlug: "eurth",
        });
      });
    });
  });
});
