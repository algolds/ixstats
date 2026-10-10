/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum", () => {
  const actual = jest.requireActual("~/server/modules/thinkpages-forum");
  return {
    ...actual,
    // Spies over the real posting access, so the router's single entry (T0-2) is observable.
    postingAccessFor: jest.fn(actual.postingAccessFor),
    canPostInCategory: jest.fn(actual.canPostInCategory),
    createThread: jest.fn(async () => ({
      threadId: "t_new",
      postId: "p_new",
      formatting: "done",
    })),
    renderPostWikitext: jest.fn(),
    replyToThread: jest.fn(async () => {
      throw new actual.ForumError("CONFLICT", "This thread is closed to replies.");
    }),
    fileReport: jest.fn(async () => ({ reportId: "rep_1" })),
    fileAppeal: jest.fn(async () => ({ appealId: "ap_1" })),
    myStanding: jest.fn(async () => ({ activePoints: 3, warnings: [], bans: [], appeals: [] })),
  };
});

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { REALM_CATEGORIES, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  canPostInCategory,
  createThread,
  fileAppeal,
  fileReport,
  myStanding,
  postingAccessFor,
  renderPostWikitext,
  replyToThread,
} from "~/server/modules/thinkpages-forum";
import { POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { banNotice } from "~/lib/thinkpages-forum/moderation-policy";
import { banRow, forumBanFake, type BanRow } from "~/tests/helpers/forum-ban-fake";

const caller = (user: object | null, db: object = {}) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: "clerk_1" } : null,
      user: user as never,
      db,
    }) as never
  );

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: "c1",
  email: "x@y.z",
  role: { name: "user", level: 100 },
};
const admin = { ...member, id: "u_admin", role: { name: "admin", level: 10 } };

const categories = SITE_CATEGORIES.map((c, i) => ({
  id: `cat_${c.key}`,
  scope: "site",
  realmId: null,
  style: "ooc",
  ...c,
  order: i,
}));
const general = categories.find((c) => c.key === "general")!;
const staff = categories.find((c) => c.key === "staff")!;

const when = new Date("2026-10-01");
const rawUser = {
  id: "u1",
  handle: "heku",
  wikiUsername: "Heku",
  discordUsername: "heku#1",
  email: "secret@example.com",
  clerkUserId: "clerk_1",
};
const rawPersona = {
  id: "pa1",
  displayName: "Caphiria News",
  username: "caphnews",
  clerkUserId: "clerk_1",
  isActive: true,
};

function forumDb(thread: object = {}, bans: BanRow[] = []) {
  return {
    forumBan: forumBanFake(bans),
    forumCategory: {
      findMany: jest.fn(async () => categories),
      findFirst: jest.fn(
        async ({ where }: { where: { key: string } }) =>
          categories.find((c) => c.key === where.key) ?? null
      ),
    },
    forumThread: {
      groupBy: jest.fn(async () => []),
      findMany: jest.fn(async () => [
        {
          id: "t1",
          title: "Hello",
          authorUserId: "u1",
          authorPersonaId: "pa1",
          pinned: false,
          locked: false,
          postCount: 2,
          lastPostAt: when,
        },
      ]),
      count: jest.fn(async () => 1),
      findUnique: jest.fn(async () => ({
        id: "t1",
        title: "Hello",
        categoryId: general.id,
        authorUserId: "u1",
        authorPersonaId: null,
        hidden: false,
        locked: false,
        archived: false,
        category: general,
        ...thread,
      })),
    },
    forumPost: {
      findMany: jest.fn(async (_args?: { select?: Record<string, boolean> }) => [
        {
          id: "p1",
          authorUserId: "u1",
          authorPersonaId: "pa1",
          contentHtml: "<p>hi</p>",
          editedAt: null,
          createdAt: when,
        },
        {
          id: "p2",
          authorUserId: "u2",
          authorPersonaId: null,
          contentHtml: "<p>yo</p>",
          editedAt: null,
          createdAt: when,
        },
      ]),
      count: jest.fn(async () => 2),
      groupBy: jest.fn(async () => []),
    },
    user: {
      findMany: jest.fn(async () => [
        rawUser,
        { ...rawUser, id: "u2", handle: null, wikiUsername: null, discordUsername: "disc#2" },
      ]),
    },
    thinkpagesAccount: { findMany: jest.fn(async () => [rawPersona]) },
    // moderatorContext's lookups: nobody founds a realm, holds an office or moderates a category here.
    realm: { findMany: jest.fn(async () => []) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
  };
}

const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const hub = {
  id: "rcat_hub",
  scope: "realm",
  realmId: "r_eurth",
  visibility: "public",
  postRole: "any",
  ...REALM_CATEGORIES[0]!,
};
const NO_NATION = "Only owners of a nation in Eurth can post here.";

/** forumDb plus a realm (Eurth) with its Hub, and the realm posting lookups; `owned` are the caller's nations. */
function realmForumDb(owned: Array<{ id: string; realmId: string; currentTotalGdp: number }> = []) {
  const base = forumDb({ categoryId: hub.id, category: hub });
  base.forumCategory.findFirst.mockImplementation((async ({
    where,
  }: {
    where: { scope: string };
  }) => (where.scope === "realm" ? hub : null)) as never);
  base.forumCategory.findMany.mockResolvedValue([hub] as never);
  return {
    ...base,
    realm: {
      findUnique: jest.fn(async () => EURTH),
      // moderatorContext asks for the realms the viewer founded; listForumRealms for all of them.
      findMany: jest.fn(async ({ where }: { where?: { ownerId?: string } } = {}) =>
        [EURTH].filter((r) => where?.ownerId === undefined || r.ownerId === where.ownerId)
      ),
    },
    country: {
      findMany: jest.fn(async ({ where }: { where: { realmId?: string } }) =>
        owned.filter((c) => !where.realmId || c.realmId === where.realmId)
      ),
    },
    realmOfficer: { findMany: jest.fn(async () => []) },
  };
}
const inEurth = [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 10 }];
const founder = { ...member, id: "u_f", clerkUserId: "founder" };
const noMod = { siteAdmin: false, realmIds: [], categoryIds: [] };

const ALLOWED_USER_FIELDS = ["name", "handle", "avatarUrl", "flagUrl"];
const ALLOWED_PERSONA_FIELDS = ["displayName", "username", "avatarUrl"];

describe("thinkpagesForum router", () => {
  it("lets an anonymous visitor read the public categories only", async () => {
    const out = await caller(null, forumDb()).categories();
    expect(out.map((c) => c.key)).toContain("general");
    expect(out.map((c) => c.key)).not.toContain("staff");
  });

  describe("board reads", () => {
    it("gives each home board its style, post count and latest post with the author's name", async () => {
      const db = forumDb();
      db.forumThread.groupBy.mockImplementation((async ({ by }: { by: string[] }) =>
        by.length === 2
          ? [
              {
                categoryId: general.id,
                archived: false,
                _count: { _all: 2 },
                _max: { lastPostAt: when },
              },
            ]
          : [{ categoryId: general.id, _sum: { postCount: 9 } }]) as never);
      db.forumThread.findMany.mockResolvedValue([
        { id: "t1", title: "Hello", categoryId: general.id, lastPostAt: when },
      ] as never);
      db.forumPost.findMany.mockResolvedValue([
        {
          threadId: "t1",
          authorUserId: "u1",
          authorPersonaId: null,
          importedAuthorName: null,
          createdAt: when,
        },
      ] as never);
      const out = await caller(null, db).categories();
      const row = out.find((c) => c.key === "general")!;
      expect(row).toMatchObject({ id: general.id, style: "ooc", threadCount: 2, postCount: 9 });
      expect(row.latest).toMatchObject({
        threadId: "t1",
        threadTitle: "Hello",
        author: { name: "heku", handle: "heku" },
      });
      expect(out.find((c) => c.key === "rules")!.latest).toBeNull();
    });

    it("sorts a board by the requested order and returns its style", async () => {
      const db = forumDb();
      const out = await caller(null, db).category({ key: "general", sort: "replies" });
      expect(out.category.style).toBe("ooc");
      expect(db.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ pinned: "desc" }, { postCount: "desc" }, { id: "desc" }],
        })
      );
      await expect(
        caller(null, db).category({ key: "general", sort: "oldest" as never })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("answers a board's top posters, and NOT_FOUND for a board the viewer cannot see", async () => {
      const db = {
        ...forumDb(),
        forumPost: {
          groupBy: jest.fn(async () => [{ authorUserId: "u1", _count: { authorUserId: 4 } }]),
        },
      };
      const out = await caller(null, db).boardTopPosters({ key: "general" });
      expect(out.posters).toEqual([{ authorUserId: "u1", postCount: 4 }]);
      expect(out.authors.users.u1).toMatchObject({ name: "heku" });
      await expect(caller(member, db).boardTopPosters({ key: "staff" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  it("refuses to start a thread without signing in", async () => {
    // authMiddleware throws an UnauthorizedError; a direct caller sees its code as the cause.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      caller(null, forumDb()).createThread({
        categoryKey: "general",
        title: "Hello there",
        html: "<p>x</p>",
      })
    ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    warn.mockRestore();
    expect(createThread).not.toHaveBeenCalled();
  });

  it("starts a thread as the signed-in user", async () => {
    await expect(
      caller(member, forumDb()).createThread({
        categoryKey: "general",
        title: "Hello there",
        html: "<p>x</p>",
      })
    ).resolves.toEqual({ threadId: "t_new", postId: "p_new", formatting: "done" });
    expect(createThread).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: "u1",
        clerkUserId: "clerk_1",
        countryId: "c1",
        role: { name: "user", level: 100 },
        mod: noMod,
      },
      expect.objectContaining({ categoryKey: "general", title: "Hello there" })
    );
  });

  describe("the post body and previewPost", () => {
    const NEW = { categoryKey: "general", title: "Hello there" };

    it("takes exactly one of html and wikitext", async () => {
      jest.mocked(createThread).mockClear();
      const c = caller(member, forumDb());
      await expect(c.createThread({ ...NEW })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        c.createThread({ ...NEW, html: "<p>x</p>", wikitext: "x" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(c.reply({ threadId: "t1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        c.reply({ threadId: "t1", html: "<p>x</p>", wikitext: "x" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(c.editPost({ postId: "p1", editedAt: null })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(
        c.editPost({ postId: "p1", editedAt: null, wikitext: "x".repeat(50_001) })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(createThread).not.toHaveBeenCalled();
    });

    it("passes wikitext to the module and returns its formatting", async () => {
      jest.mocked(replyToThread).mockClear();
      await expect(
        caller(member, forumDb()).createThread({ ...NEW, wikitext: "== x ==" })
      ).resolves.toEqual({ threadId: "t_new", postId: "p_new", formatting: "done" });
      expect(createThread).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ wikitext: "== x ==" })
      );
      expect(replyToThread).not.toHaveBeenCalled();
    });

    it("previews wikitext for a signed-in user under the thread id, or 'preview'", async () => {
      jest.mocked(renderPostWikitext).mockResolvedValue({
        contentHtml: "<p>x</p>",
        plainText: "x",
        rendererVersion: "forum-1:v",
        renderedAt: null,
        templates: [],
      });
      const c = caller(member, forumDb());
      await expect(c.previewPost({ wikitext: "x" })).resolves.toEqual({
        html: "<p>x</p>",
        pending: true,
      });
      expect(renderPostWikitext).toHaveBeenLastCalledWith("x", "preview", "u1");
      await c.previewPost({ wikitext: "x", threadId: "t9" });
      expect(renderPostWikitext).toHaveBeenLastCalledWith("x", "t9", "u1");
    });

    it("refuses a preview to an anonymous visitor and maps a refused render", async () => {
      jest.mocked(renderPostWikitext).mockClear();
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      await expect(caller(null, forumDb()).previewPost({ wikitext: "x" })).rejects.toMatchObject({
        cause: { code: "UNAUTHORIZED" },
      });
      warn.mockRestore();
      expect(renderPostWikitext).not.toHaveBeenCalled();
      const { ForumError } = jest.requireActual("~/server/modules/thinkpages-forum");
      jest
        .mocked(renderPostWikitext)
        .mockRejectedValueOnce(new ForumError("BAD_REQUEST", "Signatures are not used."));
      await expect(
        caller(member, forumDb()).previewPost({ wikitext: "~~~~" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("a post's wikitext on the thread read", () => {
    function wikitextDb(thread: object = {}) {
      const db = forumDb(thread);
      db.forumPost.findMany.mockResolvedValue([
        {
          id: "p1",
          authorUserId: "u1",
          authorPersonaId: null,
          importedAuthorName: null,
          contentHtml: "<p>mine</p>",
          contentWikitext: "mine ''wiki''",
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
        {
          id: "p2",
          authorUserId: "u2",
          authorPersonaId: null,
          importedAuthorName: null,
          contentHtml: "<p>theirs</p>",
          contentWikitext: "theirs ''wiki''",
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
        {
          id: "p3",
          authorUserId: "u1",
          authorPersonaId: null,
          importedAuthorName: null,
          contentHtml: "<p>html only</p>",
          contentWikitext: null,
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
      ] as never);
      return db;
    }

    it("asks for it and returns it for the viewer's own editable posts only", async () => {
      const db = wikitextDb();
      const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
      expect(db.forumPost.findMany.mock.calls[0]?.[0]?.select).toMatchObject({
        contentWikitext: true,
      });
      expect(out.posts.map((p) => p.contentWikitext ?? null)).toEqual([
        "mine ''wiki''",
        null,
        null,
      ]);
      expect(JSON.stringify(out)).not.toContain("theirs ''wiki''");
    });

    it("sends it to nobody where the viewer may not edit: a locked thread, an anonymous reader, a moderator's view of others", async () => {
      const locked = await caller(member, wikitextDb({ locked: true })).thread({
        threadId: "t1",
        page: 1,
      });
      expect(JSON.stringify(locked)).not.toContain("''wiki''");
      const anon = await caller(null, wikitextDb()).thread({ threadId: "t1", page: 1 });
      expect(JSON.stringify(anon)).not.toContain("''wiki''");
      const asAdmin = await caller(admin, wikitextDb()).thread({ threadId: "t1", page: 1 });
      expect(JSON.stringify(asAdmin)).not.toContain("''wiki''");
    });
  });

  it("keeps the code of a ForumError", async () => {
    await expect(
      caller(member, forumDb()).reply({ threadId: "t1", html: "<p>x</p>" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("maps the render limit to TOO_MANY_REQUESTS", async () => {
    const { ForumError } = jest.requireActual("~/server/modules/thinkpages-forum");
    jest
      .mocked(createThread)
      .mockRejectedValueOnce(new ForumError("TOO_MANY_REQUESTS", "Slow down."));
    await expect(
      caller(member, forumDb()).createThread({
        categoryKey: "general",
        title: "Hello there",
        html: "<p>x</p>",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("maps an unseen category to NOT_FOUND", async () => {
    await expect(
      caller(member, forumDb()).category({ key: "staff", page: 1 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns display-safe authors and canStart on a category", async () => {
    const db = forumDb();
    const out = await caller(member, db).category({ key: "general", page: 1 });
    expect(out.canStart).toBe(true);
    // The listed thread is a persona thread: the player behind it gets no entry (flag, avatar or name).
    expect(out.authors.users).toEqual({});
    expect(Object.keys(out.authors.personas.pa1!).sort()).toEqual(
      [...ALLOWED_PERSONA_FIELDS].sort()
    );
    expect(JSON.stringify(out)).not.toContain("secret@example.com");
    expect(JSON.stringify(out)).not.toContain("clerk_1");
  });

  it("denies canStart to an anonymous visitor and to a member in a staff-post category", async () => {
    expect((await caller(null, forumDb()).category({ key: "general", page: 1 })).canStart).toBe(
      false
    );
    const announcements = categories.find(
      (c) => c.postRole === "staff" && c.visibility === "public"
    );
    if (announcements) {
      const out = await caller(member, forumDb()).category({ key: announcements.key, page: 1 });
      expect(out.canStart).toBe(false);
    }
    expect((await caller(admin, forumDb()).category({ key: staff.key, page: 1 })).canStart).toBe(
      true
    );
  });

  it("marks own posts and allows replies on an open thread", async () => {
    const out = await caller(member, forumDb()).thread({ threadId: "t1", page: 1 });
    expect(out.posts.map((p) => p.isOwn)).toEqual([true, false]);
    expect(out.canReply).toBe(true);
    expect(Object.keys(out.authors.users.u2!).sort()).toEqual([...ALLOWED_USER_FIELDS].sort());
    expect(out.authors.users.u2!.name).toBe("Member");
    expect(JSON.stringify(out)).not.toContain("secret@example.com");
    expect(JSON.stringify(out)).not.toContain("disc#2");
  });

  describe("thread page authors, numbers, roles and participants", () => {
    const post = (id: string, authorUserId: string | null, authorPersonaId: string | null) => ({
      id,
      authorUserId,
      authorPersonaId,
      importedAuthorName: null,
      contentHtml: `<p>${id}</p>`,
      editedAt: null,
      createdAt: when,
    });
    /** Thread by u1 (no persona); posts: u1 as persona pa1, u2 as themselves (an admin), u1 as themselves. */
    function pageDb(thread: object = {}) {
      const db = forumDb(thread);
      db.forumPost.findMany.mockResolvedValue([
        post("p1", "u1", "pa1"),
        post("p2", "u2", null),
        post("p3", "u1", null),
      ] as never);
      db.forumPost.groupBy.mockResolvedValue([
        {
          authorUserId: "u1",
          authorPersonaId: "pa1",
          importedAuthorName: null,
          _count: { _all: 4 },
        },
        {
          authorUserId: "u2",
          authorPersonaId: null,
          importedAuthorName: null,
          _count: { _all: 2 },
        },
      ] as never);
      db.user.findMany.mockImplementation((async ({ where }: { where: { id: { in: string[] } } }) =>
        [
          {
            ...rawUser,
            clerkUserId: "clerk_1",
            country: { name: "Caphiria", flag: "/f/caph.png" },
            role: null,
          },
          {
            ...rawUser,
            id: "u2",
            clerkUserId: "clerk_2",
            handle: "boss",
            country: null,
            role: { name: "admin", level: 10 },
          },
        ].filter((u) => where.id.in.includes(u.id))) as never);
      db.thinkpagesAccount.findMany.mockImplementation((async ({
        where,
      }: {
        where: { id?: unknown };
      }) =>
        where.id
          ? [{ ...rawPersona, profileImageUrl: "/p/news.png" }]
          : [{ clerkUserId: "clerk_1", profileImageUrl: "/p/heku.png" }]) as never);
      return db;
    }

    it("numbers posts by page and gives each its role: persona posts none, staff over starter", async () => {
      const out = await caller(member, pageDb()).thread({ threadId: "t1", page: 2 });
      expect(out.posts.map((p) => p.number)).toEqual([
        POSTS_PER_PAGE + 1,
        POSTS_PER_PAGE + 2,
        POSTS_PER_PAGE + 3,
      ]);
      expect(out.posts.map((p) => p.role)).toEqual([null, "staff", "starter"]);
      expect(out.style).toBe("ooc");
    });

    it("sends a persona post its persona's avatar and no player flag, avatar or name", async () => {
      const out = await caller(member, pageDb()).thread({ threadId: "t1", page: 1 });
      expect(out.authors.personas.pa1).toMatchObject({ avatarUrl: "/p/news.png" });
      expect(out.authors.personas.pa1).not.toHaveProperty("flagUrl");
      expect(out.authors.users.u2).toMatchObject({ name: "boss", flagUrl: null });
      // u1 appears as a player on p3 only, so their data is present once, for that post.
      expect(out.authors.users.u1).toMatchObject({
        flagUrl: "/f/caph.png",
        avatarUrl: "/p/heku.png",
      });
    });

    it("keeps a player whose only posts are persona posts out of the author maps", async () => {
      const db = pageDb({ authorUserId: "u9", authorPersonaId: "pa1" });
      db.forumPost.findMany.mockResolvedValue([post("p1", "u1", "pa1")] as never);
      db.forumPost.groupBy.mockResolvedValue([
        {
          authorUserId: "u1",
          authorPersonaId: "pa1",
          importedAuthorName: null,
          _count: { _all: 1 },
        },
      ] as never);
      const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
      expect(out.authors.users).toEqual({});
      expect(out.posts[0]!.role).toBe("starter");
      expect(JSON.stringify(out.participants)).not.toContain('"u1"');
    });

    it("sends a member no player id on persona posts or a persona thread, yet keeps byViewer for the author", async () => {
      const db = pageDb({ authorUserId: "u1", authorPersonaId: "pa1" });
      const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
      expect(out.posts.map((p) => p.authorUserId)).toEqual([null, "u2", "u1"]);
      expect(out.posts.map((p) => p.byViewer)).toEqual([true, false, true]);
      expect(out.thread.authorUserId).toBeNull();
      expect(out.viewerIsAuthor).toBe(true);
    });

    it("keeps the player ids on persona posts and the persona thread for the category's moderator", async () => {
      const db = pageDb({ authorUserId: "u1", authorPersonaId: "pa1" });
      const out = await caller(admin, db).thread({ threadId: "t1", page: 1 });
      expect(out.posts.map((p) => p.authorUserId)).toEqual(["u1", "u2", "u1"]);
      expect(out.thread.authorUserId).toBe("u1");
    });

    it("sends a member no player id on a persona thread in the category list, a moderator the id", async () => {
      const asMember = await caller(member, forumDb()).category({ key: "general", page: 1 });
      expect(asMember.threads[0]).toMatchObject({ authorPersonaId: "pa1", authorUserId: null });
      const asAdmin = await caller(admin, forumDb()).category({ key: "general", page: 1 });
      expect(asAdmin.threads[0]).toMatchObject({ authorPersonaId: "pa1", authorUserId: "u1" });
    });

    it("returns participants grouped by persona with their author data", async () => {
      const out = await caller(member, pageDb()).thread({ threadId: "t1", page: 1 });
      expect(out.participants).toEqual([
        { authorUserId: null, authorPersonaId: "pa1", importedAuthorName: null, posts: 4 },
        { authorUserId: "u2", authorPersonaId: null, importedAuthorName: null, posts: 2 },
      ]);
      expect(out.participantCount).toBe(2);
      expect(out.authors.personas.pa1).toBeDefined();
    });
  });

  it("offers an admin no reply and no Edit on a hidden thread, or on their own hidden post", async () => {
    const own = { authorUserId: "u_admin", authorPersonaId: null, editedAt: null, createdAt: when };
    const posts = [
      { ...own, id: "p1", contentHtml: "<p>mine</p>", hidden: false },
      { ...own, id: "p2", contentHtml: "<p>hidden</p>", hidden: true },
    ];
    const hiddenThread = forumDb({ hidden: true });
    hiddenThread.forumPost.findMany.mockResolvedValue(posts as never);
    const out = await caller(admin, hiddenThread).thread({ threadId: "t1", page: 1 });
    expect(out.canReply).toBe(false);
    expect(out.posts.map((p) => p.isOwn)).toEqual([false, false]);

    const openThread = forumDb();
    openThread.forumPost.findMany.mockResolvedValue(posts as never);
    const visible = await caller(admin, openThread).thread({ threadId: "t1", page: 1 });
    expect(visible.canReply).toBe(true);
    expect(visible.posts.map((p) => p.isOwn)).toEqual([true, false]);
    // A site admin moderates the category, so the Hidden badge reaches them (T0-19).
    expect(visible.posts.map((p) => p.hidden)).toEqual([false, true]);
    expect(visible).toMatchObject({ canModerate: true });
  });

  it("strips hidden and gives no moderator tools to a member (T0-19)", async () => {
    const db = forumDb();
    db.forumPost.findMany.mockResolvedValue([
      {
        id: "p1",
        authorUserId: "u1",
        authorPersonaId: null,
        contentHtml: "<p>a</p>",
        editedAt: null,
        createdAt: when,
        hidden: false,
      },
    ] as never);
    const out = await caller(member, db).thread({ threadId: "t1", page: 1 });
    expect(out.canModerate).toBe(false);
    expect(out.posts.every((p) => !("hidden" in p))).toBe(true);
    expect("moderatorTools" in out).toBe(false);
  });

  it("asks for posting access once per thread, never through canPostInCategory (T0-2)", async () => {
    jest.mocked(postingAccessFor).mockClear();
    await caller(member, forumDb()).thread({ threadId: "t1", page: 1 });
    expect(postingAccessFor).toHaveBeenCalledTimes(1);
    expect(canPostInCategory).not.toHaveBeenCalled();
  });

  it("loads a realm category's realm once per category or thread read, and never returns it whole (N1)", async () => {
    const db = realmForumDb(inEurth);
    const category = await caller(member, db).category({ key: "hub", realm: "eurth", page: 1 });
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    db.realm.findUnique.mockClear();
    const thread = await caller(member, db).thread({ threadId: "t1", page: 1 });
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    for (const out of [category, thread]) {
      expect(out).not.toHaveProperty("forumRealm");
      expect(JSON.stringify(out)).not.toContain('"ownerId"');
    }
    expect(thread.canReply).toBe(true);
  });

  it("offers a site-banned member no thread start, no reply and no Edit on their own sitewide post", async () => {
    const ban = banRow({ userId: "u1", reason: "Abuse" });
    const category = await caller(member, forumDb({}, [ban])).category({ key: "general", page: 1 });
    expect(category).toMatchObject({
      canStart: false,
      notice: banNotice({ scope: "site", expiresAt: null, reason: "Abuse" }),
    });
    const thread = await caller(member, forumDb({}, [ban])).thread({ threadId: "t1", page: 1 });
    expect(thread).toMatchObject({
      canReply: false,
      banned: true,
      notice: banNotice({ scope: "site", expiresAt: null, reason: "Abuse" }),
    });
    expect(category.banned).toBe(true);
    expect(thread.posts.map((p) => p.isOwn)).toEqual([false, false]);
    const lifted = banRow({ userId: "u1", liftedAt: new Date() });
    const free = await caller(member, forumDb({}, [lifted])).thread({ threadId: "t1", page: 1 });
    expect(free.posts.map((p) => p.isOwn)).toEqual([true, false]);
    expect(free).toMatchObject({ banned: false, notice: null, canReply: true });
  });

  it("marks the viewer's posts and thread as theirs even where they may not edit them", async () => {
    const locked = await caller(member, forumDb({ locked: true })).thread({
      threadId: "t1",
      page: 1,
    });
    expect(locked.posts.map((p) => [p.byViewer, p.isOwn])).toEqual([
      [true, false],
      [false, false],
    ]);
    expect(locked.viewerIsAuthor).toBe(true);
    const other = await caller(member, forumDb({ authorUserId: "u2" })).thread({
      threadId: "t1",
      page: 1,
    });
    expect(other.viewerIsAuthor).toBe(false);
  });

  it("gives an anonymous reader no Edit and no reply", async () => {
    const out = await caller(null, forumDb()).thread({ threadId: "t1", page: 1 });
    expect(out.posts.every((p) => p.isOwn === false && p.byViewer === false)).toBe(true);
    expect(out.viewerIsAuthor).toBe(false);
    expect(out.canReply).toBe(false);
  });

  it("closes replies on a locked or archived thread", async () => {
    expect(
      (await caller(member, forumDb({ locked: true })).thread({ threadId: "t1", page: 1 })).canReply
    ).toBe(false);
    expect(
      (await caller(member, forumDb({ archived: true })).thread({ threadId: "t1", page: 1 }))
        .canReply
    ).toBe(false);
  });

  it("lists only the caller's active personas", async () => {
    const db = forumDb();
    const out = await caller(member, db).myPersonas();
    expect(out).toEqual([rawPersona]);
    expect(db.thinkpagesAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: "clerk_1", isActive: true },
        select: { id: true, displayName: true, username: true },
      })
    );
  });

  it("resolves a post permalink to its thread and page", async () => {
    const db = {
      forumPost: {
        findUnique: jest.fn(async () => ({
          id: "p1",
          threadId: "t1",
          createdAt: when,
          hidden: false,
          thread: { hidden: false, category: { visibility: "public" } },
        })),
        count: jest.fn(async () => 21),
      },
    };
    await expect(caller(null, db).resolvePost({ postId: "p1" })).resolves.toEqual({
      threadId: "t1",
      page: 2,
    });
  });

  it("enforces the input limits", async () => {
    const c = caller(member, forumDb());
    await expect(c.category({ key: "Bad Key", page: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(c.category({ key: "general", page: 1001 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(c.thread({ threadId: "x".repeat(65), page: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      c.createThread({ categoryKey: "general", title: "ab", html: "<p>x</p>" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      c.createThread({ categoryKey: "general", title: "Fine title", html: "x".repeat(50_001) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      c.editPost({ postId: "p1", editedAt: null, html: "x".repeat(50_001) })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  describe("reports, standing and appeals", () => {
    const quiet = () => jest.spyOn(console, "warn").mockImplementation(() => {});
    beforeEach(() => {
      jest.mocked(fileReport).mockClear();
      jest.mocked(fileAppeal).mockClear();
    });

    it("refuses a report, the standing and an appeal without signing in", async () => {
      const warn = quiet();
      const anon = caller(null, forumDb());
      await expect(
        anon.report({ targetType: "post", targetId: "p1", reason: "Spam here" })
      ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
      await expect(anon.myStanding()).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
      await expect(
        anon.appeal({ subjectType: "ban", subjectId: "b1", body: "Please reconsider this." })
      ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
      warn.mockRestore();
      expect(fileReport).not.toHaveBeenCalled();
      expect(fileAppeal).not.toHaveBeenCalled();
    });

    it("files a report as the signed-in member and returns only its id", async () => {
      const out = await caller(member, forumDb()).report({
        targetType: "post",
        targetId: "p2",
        reason: "  Spam here  ",
      });
      expect(out).toEqual({ reportId: "rep_1" });
      expect(fileReport).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "u1", mod: noMod }),
        { targetType: "post", targetId: "p2", reason: "Spam here" }
      );
    });

    it("returns the module's standing for the caller", async () => {
      await expect(caller(member, forumDb()).myStanding()).resolves.toEqual({
        activePoints: 3,
        warnings: [],
        bans: [],
        appeals: [],
      });
      expect(myStanding).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "u1" })
      );
    });

    it("spends no moderator-context queries on the standing or an appeal (M16)", async () => {
      const db = forumDb();
      await caller(member, db).myStanding();
      await caller(member, db).appeal({
        subjectType: "ban",
        subjectId: "b1",
        body: "Please reconsider this.",
      });
      expect(db.forumCategoryModerator.findMany).not.toHaveBeenCalled();
      expect(jest.mocked(myStanding).mock.calls.at(-1)![1]).not.toHaveProperty("mod");
      expect(jest.mocked(fileAppeal).mock.calls.at(-1)![1]).not.toHaveProperty("mod");
    });

    it("files an appeal as the signed-in member", async () => {
      await caller(member, forumDb()).appeal({
        subjectType: "warning",
        subjectId: "w1",
        body: "I was quoting someone else.",
      });
      expect(fileAppeal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "u1" }),
        { subjectType: "warning", subjectId: "w1", body: "I was quoting someone else." }
      );
    });

    it("bounds the report and appeal inputs", async () => {
      const c = caller(member, forumDb());
      for (const bad of [
        { targetType: "user", targetId: "p1", reason: "Spam here" },
        { targetType: "post", targetId: "x".repeat(65), reason: "Spam here" },
        { targetType: "post", targetId: "p1", reason: "  a " },
        { targetType: "post", targetId: "p1", reason: "x".repeat(1001) },
      ]) {
        await expect(c.report(bad as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      for (const bad of [
        { subjectType: "report", subjectId: "w1", body: "Long enough body." },
        { subjectType: "warning", subjectId: "w1", body: "too short" },
        { subjectType: "warning", subjectId: "w1", body: "x".repeat(4001) },
      ]) {
        await expect(c.appeal(bad as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      expect(fileReport).not.toHaveBeenCalled();
      expect(fileAppeal).not.toHaveBeenCalled();
    });
  });

  describe("realm sections", () => {
    it("lists IxWorld for an anonymous visitor, with IxWorld as the default", async () => {
      const db = { realm: { findMany: jest.fn(async () => []) } };
      await expect(caller(null, db).realms()).resolves.toEqual({
        defaultSlug: "ixworld",
        realms: [{ id: "default", slug: "ixworld", name: "IxWorld" }],
      });
    });

    it("defaults the switcher to the realm of the caller's primary nation", async () => {
      const db = realmForumDb([
        { id: "c_small", realmId: "r_alba", currentTotalGdp: 1 },
        { id: "c_big", realmId: "r_eurth", currentTotalGdp: 99 },
      ]);
      // c1 (User.countryId) is not one of their nations, so the highest-GDP nation's realm wins.
      expect((await caller(member, db).realms()).defaultSlug).toBe("eurth");
      expect(db.country.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerUserId: "u1" } })
      );
      const linked = realmForumDb([
        { id: "c1", realmId: "default", currentTotalGdp: 1 },
        { id: "c_big", realmId: "r_eurth", currentTotalGdp: 99 },
      ]);
      expect((await caller(member, linked).realms()).defaultSlug).toBe("ixworld");
    });

    it("reports no sidebar flags to an anonymous visitor, without a query", async () => {
      const db = realmForumDb(inEurth);
      await expect(caller(null, db).navFlags()).resolves.toEqual({
        realmMember: false,
        forumModerator: false,
      });
      expect(db.country.findMany).not.toHaveBeenCalled();
    });

    it("flags a member of a realm, and a member with no nation or no moderator role as neither", async () => {
      await expect(caller(member, realmForumDb(inEurth)).navFlags()).resolves.toEqual({
        realmMember: true,
        forumModerator: false,
      });
      await expect(caller(member, realmForumDb()).navFlags()).resolves.toEqual({
        realmMember: false,
        forumModerator: false,
      });
    });

    it("flags site staff and any realm or category moderator as forum moderators", async () => {
      await expect(caller(admin, realmForumDb()).navFlags()).resolves.toMatchObject({
        forumModerator: true,
      });
      // The realm's founder moderates it (the fake's EURTH is owned by "founder").
      await expect(caller(founder, realmForumDb()).navFlags()).resolves.toMatchObject({
        forumModerator: true,
      });
      const categoryMod = {
        ...realmForumDb(),
        forumCategoryModerator: {
          findMany: jest.fn(async (): Promise<Array<{ categoryId: string }>> => [
            { categoryId: "cat_general" },
          ]),
        },
      };
      await expect(caller(member, categoryMod).navFlags()).resolves.toMatchObject({
        forumModerator: true,
      });
    });

    it("returns a realm section with canPost and notice, never the raw posting access", async () => {
      const out = await caller(member, realmForumDb()).realmSection({ realm: "eurth" });
      expect(out).toMatchObject({
        realm: { slug: "eurth", name: "Eurth" },
        canPost: false,
        notice: NO_NATION,
      });
      expect(out.categories.map((c) => c.key)).toEqual(["hub"]);
      expect(Object.keys(out).sort()).toEqual([
        "banned",
        "canPost",
        "categories",
        "needsNation",
        "notice",
        "realm",
      ]);
      // U6: the claim-a-nation offer is the server's flag, not a match on the notice text.
      expect(out.needsNation).toBe(true);
      expect(JSON.stringify(out)).not.toContain("ownedCountryIds");
      expect(JSON.stringify(out)).not.toContain("restriction");
      const owner = await caller(member, realmForumDb(inEurth)).realmSection({ realm: "eurth" });
      expect(owner).toMatchObject({ canPost: true, notice: null, needsNation: false });
      const guest = await caller(null, realmForumDb()).realmSection({ realm: "eurth" });
      expect(guest).toMatchObject({ canPost: false, needsNation: false });
    });

    it("maps an unknown realm section to NOT_FOUND", async () => {
      const db = realmForumDb();
      db.realm.findUnique.mockResolvedValue(null as never);
      await expect(caller(member, db).realmSection({ realm: "nowhere" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("reads a realm category through its locator, with canStart and the notice", async () => {
      const db = realmForumDb();
      const out = await caller(member, db).category({ key: "hub", page: 1, realm: "eurth" });
      expect(db.forumCategory.findFirst).toHaveBeenCalledWith({
        where: { scope: "realm", realmId: "r_eurth", key: "hub" },
      });
      expect(out).toMatchObject({ canStart: false, notice: NO_NATION });
      expect(out.category.realm).toEqual({ slug: "eurth", name: "Eurth" });
      const owner = await caller(member, realmForumDb(inEurth)).category({
        key: "hub",
        page: 1,
        realm: "eurth",
      });
      expect(owner).toMatchObject({ canStart: true, notice: null });
    });

    it("gives a sitewide category no notice", async () => {
      const out = await caller(member, forumDb()).category({ key: "general", page: 1 });
      expect(out).toMatchObject({ canStart: true, notice: null });
    });

    it("offers reply and Edit in a realm thread only to those who may post there", async () => {
      const outsider = await caller(member, realmForumDb()).thread({ threadId: "t1", page: 1 });
      expect(outsider.canReply).toBe(false);
      expect(outsider.posts.map((p) => p.isOwn)).toEqual([false, false]);
      const owner = await caller(member, realmForumDb(inEurth)).thread({ threadId: "t1", page: 1 });
      expect(owner.canReply).toBe(true);
      expect(owner.posts.map((p) => p.isOwn)).toEqual([true, false]);
    });

    it("forwards the realm when starting a thread, and bounds it", async () => {
      await caller(member, forumDb()).createThread({
        categoryKey: "hub",
        realm: "eurth",
        title: "Hello there",
        html: "<p>x</p>",
      });
      expect(createThread).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ categoryKey: "hub", realm: "eurth" })
      );
      const c = caller(member, realmForumDb());
      await expect(
        c.createThread({ categoryKey: "hub", realm: "x".repeat(101), title: "Hi there", html: "x" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(c.category({ key: "hub", page: 1, realm: "" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(c.realmSection({ realm: "x".repeat(101) })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
    it("carries the viewer's moderator context, matched by Clerk id (T0-10)", async () => {
      const db = realmForumDb();
      await caller(founder, db).createThread({
        categoryKey: "hub",
        realm: "eurth",
        title: "Hello there",
        html: "<p>x</p>",
      });
      expect(createThread).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: "u_f", mod: { ...noMod, realmIds: ["r_eurth"] } }),
        expect.anything()
      );
      expect(db.realm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: "founder" } })
      );
    });

    it("gives a realm moderator the Hidden badge and the Move destinations, a member neither", async () => {
      const characterThreads = {
        ...hub,
        id: "rcat_ct",
        ...REALM_CATEGORIES[1]!,
      };
      const db = realmForumDb();
      db.forumCategory.findMany.mockResolvedValue([characterThreads] as never);
      db.forumPost.findMany.mockResolvedValue([
        {
          id: "p1",
          authorUserId: "u1",
          authorPersonaId: null,
          contentHtml: "<p>a</p>",
          editedAt: null,
          createdAt: when,
          hidden: false,
        },
        {
          id: "p2",
          authorUserId: "u2",
          authorPersonaId: null,
          contentHtml: "<p>b</p>",
          editedAt: null,
          createdAt: when,
          hidden: true,
        },
      ] as never);
      const out = await caller(founder, db).thread({ threadId: "t1", page: 1 });
      expect(out).toMatchObject({
        canModerate: true,
        moderatorTools: {
          categories: [
            {
              key: "character-threads",
              name: "Character Threads",
              realm: { slug: "eurth", name: "Eurth" },
            },
          ],
        },
      });
      expect(out.posts.map((p) => p.hidden)).toEqual([false, true]);
      expect(db.forumCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            scope: "realm",
            realmId: "r_eurth",
            visibility: "public",
            id: { not: "rcat_hub" },
            style: { not: "board" },
          },
        })
      );

      const plain = await caller(member, realmForumDb(inEurth)).thread({ threadId: "t1", page: 1 });
      expect(plain.canModerate).toBe(false);
      expect("moderatorTools" in plain).toBe(false);
      expect(plain.posts.every((p) => !("hidden" in p))).toBe(true);
    });

    it("tells a realm moderator what they may do to each post and the thread; a member nothing (I-1, M-8)", async () => {
      const db = realmForumDb(inEurth);
      const by = (id: string, authorUserId: string) => ({
        id,
        authorUserId,
        authorPersonaId: null,
        contentHtml: "<p>x</p>",
        editedAt: null,
        createdAt: when,
        hidden: false,
      });
      db.forumThread.findUnique.mockResolvedValue({
        ...(await db.forumThread.findUnique()),
        authorUserId: "u_admin",
      } as never);
      db.forumPost.findMany.mockResolvedValue([
        by("p_member", "u1"),
        by("p_admin", "u_admin"),
        by("p_officer", "u_o"),
        by("p_own", "u_f"),
      ] as never);
      const role = (name: string, level: number) => ({ name, level });
      db.user.findMany.mockResolvedValue([
        { ...rawUser, role: role("user", 100) },
        { ...rawUser, id: "u_admin", clerkUserId: "clerk_admin", role: role("admin", 10) },
        { ...rawUser, id: "u_o", clerkUserId: "clerk_officer", role: role("user", 100) },
        { ...rawUser, id: "u_f", clerkUserId: "founder", role: role("user", 100) },
      ] as never);
      db.realmOfficer.findMany.mockResolvedValue([
        { realmId: "r_eurth", userId: "clerk_officer" },
      ] as never);
      const out = await caller(founder, db).thread({ threadId: "t1", page: 1 });
      expect(out.moderable).toBe(false);
      expect(
        out.posts.map(({ id, moderable, sanctionable }) => ({ id, moderable, sanctionable }))
      ).toEqual([
        { id: "p_member", moderable: true, sanctionable: true },
        { id: "p_admin", moderable: false, sanctionable: false },
        { id: "p_officer", moderable: true, sanctionable: false },
        { id: "p_own", moderable: true, sanctionable: false },
      ]);
      expect(JSON.stringify(out)).not.toContain("clerk_admin");

      const plain = await caller(member, realmForumDb(inEurth)).thread({ threadId: "t1", page: 1 });
      expect("moderable" in plain).toBe(false);
      expect(plain.posts.some((p) => "moderable" in p || "sanctionable" in p)).toBe(false);
    });

    it("marks hidden threads in a category for its moderators only (M-4)", async () => {
      const listed = (db: ReturnType<typeof realmForumDb>) => {
        db.forumThread.findMany.mockResolvedValue([
          {
            id: "t1",
            title: "Hello",
            authorUserId: "u1",
            authorPersonaId: null,
            pinned: false,
            locked: false,
            hidden: true,
            postCount: 1,
            lastPostAt: when,
          },
        ] as never);
        return db;
      };
      const forMod = await caller(founder, listed(realmForumDb())).category({
        key: "hub",
        page: 1,
        realm: "eurth",
      });
      expect(forMod.threads.map((t) => t.hidden)).toEqual([true]);
      const db = listed(realmForumDb(inEurth));
      const forMember = await caller(member, db).category({ key: "hub", page: 1, realm: "eurth" });
      expect(forMember.threads.every((t) => !("hidden" in t))).toBe(true);
      expect(db.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.objectContaining({ hidden: true }) })
      );
    });

    it("flags a realm-banned member on the section, the category and the thread", async () => {
      const ban = banRow({ userId: "u1", scope: "realm", scopeId: "r_eurth", reason: "Spam" });
      const db = () => ({ ...realmForumDb(inEurth), forumBan: forumBanFake([ban]) });
      const section = await caller(member, db()).realmSection({ realm: "eurth" });
      expect(section).toMatchObject({ canPost: false, banned: true });
      const category = await caller(member, db()).category({ key: "hub", page: 1, realm: "eurth" });
      expect(category).toMatchObject({ canStart: false, banned: true, canModerate: false });
      const thread = await caller(member, db()).thread({ threadId: "t1", page: 1 });
      expect(thread).toMatchObject({ canReply: false, banned: true });
      expect(thread.notice).toBe(section.notice);
      const free = await caller(member, realmForumDb(inEurth)).realmSection({ realm: "eurth" });
      expect(free.banned).toBe(false);
    });
  });
});
