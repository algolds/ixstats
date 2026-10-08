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
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
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
        { ...rawUser, id: "u2", handle: null, wikiUsername: null, discordUsername: null },
      ]),
    },
    thinkpagesAccount: { findMany: jest.fn(async () => [rawPersona]) },
  };
}

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
});
