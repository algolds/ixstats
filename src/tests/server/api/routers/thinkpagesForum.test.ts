/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/thinkpages-forum", () => ({
  ...jest.requireActual("~/server/modules/thinkpages-forum"),
  createThread: jest.fn(async () => ({ threadId: "t_new", postId: "p_new" })),
  replyToThread: jest.fn(async () => {
    const { ForumError } = jest.requireActual("~/server/modules/thinkpages-forum");
    throw new ForumError("CONFLICT", "This thread is closed to replies.");
  }),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { REALM_CATEGORIES, SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import { createThread } from "~/server/modules/thinkpages-forum";

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

function forumDb(thread: object = {}) {
  return {
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
      findMany: jest.fn(async () => [
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
    },
    user: {
      findMany: jest.fn(async () => [
        rawUser,
        { ...rawUser, id: "u2", handle: null, wikiUsername: null, discordUsername: "disc#2" },
      ]),
    },
    thinkpagesAccount: { findMany: jest.fn(async () => [rawPersona]) },
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
      findMany: jest.fn(async () => [EURTH]),
    },
    country: {
      findMany: jest.fn(async ({ where }: { where: { realmId?: string } }) =>
        owned.filter((c) => !where.realmId || c.realmId === where.realmId)
      ),
    },
    realmOfficer: { findMany: jest.fn(async () => []) },
    realmBoardBan: { findMany: jest.fn(async () => []) },
    realmClaim: { findMany: jest.fn(async () => []) },
  };
}
const inEurth = [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 10 }];

const ALLOWED_USER_FIELDS = ["name", "handle"];
const ALLOWED_PERSONA_FIELDS = ["displayName", "username"];

describe("thinkpagesForum router", () => {
  it("lets an anonymous visitor read the public categories only", async () => {
    const out = await caller(null, forumDb()).categories();
    expect(out.map((c) => c.key)).toContain("general");
    expect(out.map((c) => c.key)).not.toContain("staff");
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
      caller(member).createThread({
        categoryKey: "general",
        title: "Hello there",
        html: "<p>x</p>",
      })
    ).resolves.toEqual({ threadId: "t_new", postId: "p_new" });
    expect(createThread).toHaveBeenCalledWith(
      expect.anything(),
      { id: "u1", clerkUserId: "clerk_1", countryId: "c1", role: { name: "user", level: 100 } },
      expect.objectContaining({ categoryKey: "general", title: "Hello there" })
    );
  });

  it("keeps the code of a ForumError", async () => {
    await expect(caller(member).reply({ threadId: "t1", html: "<p>x</p>" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
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
    expect(Object.keys(out.authors.users.u1!).sort()).toEqual([...ALLOWED_USER_FIELDS].sort());
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
    expect(visible.posts.every((p) => !("hidden" in p))).toBe(true);
  });

  it("gives an anonymous reader no Edit and no reply", async () => {
    const out = await caller(null, forumDb()).thread({ threadId: "t1", page: 1 });
    expect(out.posts.every((p) => p.isOwn === false)).toBe(true);
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
    await expect(c.editPost({ postId: "p1", html: "x".repeat(50_001) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
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

    it("returns a realm section with canPost and notice, never the raw posting access", async () => {
      const out = await caller(member, realmForumDb()).realmSection({ realm: "eurth" });
      expect(out).toMatchObject({
        realm: { slug: "eurth", name: "Eurth" },
        canPost: false,
        notice: NO_NATION,
      });
      expect(out.categories.map((c) => c.key)).toEqual(["hub"]);
      expect(Object.keys(out).sort()).toEqual(["canPost", "categories", "notice", "realm"]);
      expect(JSON.stringify(out)).not.toContain("ownedCountryIds");
      expect(JSON.stringify(out)).not.toContain("restriction");
      const owner = await caller(member, realmForumDb(inEurth)).realmSection({ realm: "eurth" });
      expect(owner).toMatchObject({ canPost: true, notice: null });
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
      await caller(member).createThread({
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
  });
});
