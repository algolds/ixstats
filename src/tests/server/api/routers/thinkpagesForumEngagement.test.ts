/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { unreadTargetFor } from "~/server/api/routers/thinkpagesForum/unread-target";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

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
  countryId: null,
  email: "x@y.z",
  role: { name: "user", level: 100 },
};
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const general = {
  id: "cat_general",
  scope: "site",
  realmId: null,
  key: "general",
  style: "ooc",
  visibility: "public",
  postRole: "any",
  icAllowed: false,
  name: "General",
  description: null,
};

function engagementDb() {
  return {
    ...engagementTables(),
    realm: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
    country: { findMany: jest.fn(async () => []) },
    forumCategory: { findFirst: jest.fn(async () => general) },
    forumThread: {
      findUnique: jest.fn(async () => ({
        id: "t1",
        categoryId: general.id,
        title: "Hello",
        authorUserId: "u2",
        authorPersonaId: null,
        importedAuthorName: null,
        xenforoThreadId: null,
        pinned: false,
        locked: false,
        hidden: false,
        archived: false,
        postCount: 3,
        lastPostAt: ago(1),
        createdAt: ago(4),
        category: general,
      })),
      findMany: jest.fn(async () => []),
    },
    forumPost: { findMany: jest.fn(async () => [{ createdAt: ago(2) }]) },
    $transaction: jest.fn(async (ops: Array<Promise<object>>) => Promise.all(ops)),
  };
}

describe("thinkpagesForum read marks", () => {
  // The user logger (info) and authMiddleware's rejection (warn) are not under test.
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("refuses every mark to a signed-out caller", async () => {
    const c = caller(null);
    for (const call of [
      () => c.markThreadRead({ threadId: "t1", page: 1 }),
      () => c.markCategoryRead({ key: "general" }),
      () => c.markRealmBoardRead({ realm: "eurth" }),
    ]) {
      await expect(call()).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    }
  });

  it("marks a thread read through the module", async () => {
    const db = engagementDb();
    await expect(caller(member, db).markThreadRead({ threadId: "t1", page: 1 })).resolves.toEqual({
      readAt: expect.any(Date),
    });
    expect(db.forumThreadRead.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("bounds the inputs", async () => {
    const c = caller(member, engagementDb());
    await expect(c.markThreadRead({ threadId: "t1", page: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(c.markThreadRead({ threadId: "x".repeat(65), page: 1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(c.markCategoryRead({ key: "Not A Key" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("maps a refusal to NOT_FOUND", async () => {
    const db = engagementDb();
    db.forumThread.findUnique.mockResolvedValueOnce(null as never);
    await expect(
      caller(member, db).markThreadRead({ threadId: "t9", page: 1 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("unreadTargetFor", () => {
  it("sends a signed-out visitor, and a thread that cannot be found, to the thread itself", async () => {
    await expect(unreadTargetFor({} as never, null, "t1")).resolves.toBe("/thinkpages/t/t1");
    const db = { ...engagementDb(), user: { findUnique: jest.fn(async () => member) } };
    db.forumThread.findUnique.mockResolvedValue(null as never);
    await expect(unreadTargetFor(db as never, "clerk_1", "t1")).resolves.toBe("/thinkpages/t/t1");
  });

  it("sends an id over the input bound to the forum home", async () => {
    await expect(unreadTargetFor({} as never, "clerk_1", "x".repeat(65))).resolves.toBe(
      "/thinkpages"
    );
  });

  it("sends a signed-in member to the page and anchor of the first post they have not read", async () => {
    const base = engagementDb();
    const db = {
      ...base,
      user: { findUnique: jest.fn(async () => member) },
      forumPost: {
        findMany: base.forumPost.findMany,
        findFirst: jest.fn(async () => ({ id: "p21" })),
        // resolvePostLocation: the post, then how many visible posts come before it (20 fill page 1)
        findUnique: jest.fn(async () => ({
          id: "p21",
          threadId: "t1",
          createdAt: ago(1),
          hidden: false,
          thread: { authorUserId: "u2", hidden: false, category: general },
        })),
        count: jest.fn(async () => 20),
      },
    };
    await expect(unreadTargetFor(db as never, "clerk_1", "t1")).resolves.toBe(
      "/thinkpages/t/t1?page=2#post-p21"
    );
  });

  it("rethrows what is not a forum refusal instead of hiding it behind a redirect", async () => {
    const db = { ...engagementDb(), user: { findUnique: jest.fn(async () => member) } };
    db.forumThreadRead.findUnique.mockRejectedValue(new Error("database down"));
    await expect(unreadTargetFor(db as never, "clerk_1", "t1")).rejects.toThrow("database down");
  });

  it("sends a member with nothing unread to the thread's last post", async () => {
    const base = engagementDb();
    const db = {
      ...base,
      user: { findUnique: jest.fn(async () => member) },
      forumPost: {
        findMany: base.forumPost.findMany,
        // the first call (newer than the read mark) finds nothing, the second (the last post) finds p9
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "p9" }),
        findUnique: jest.fn(async () => ({
          id: "p9",
          threadId: "t1",
          createdAt: ago(1),
          hidden: false,
          thread: { authorUserId: "u2", hidden: false, category: general },
        })),
        count: jest.fn(async () => 2),
      },
    };
    await expect(unreadTargetFor(db as never, "clerk_1", "t1")).resolves.toBe(
      "/thinkpages/t/t1?page=1#post-p9"
    );
  });
});

describe("thinkpagesForum watch, lists and counts", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("refuses every watch and count to a signed-out caller", async () => {
    const c = caller(null);
    for (const call of [
      () => c.watchThread({ threadId: "t1" }),
      () => c.unwatchThread({ threadId: "t1" }),
      () => c.navCounts(),
    ]) {
      await expect(call()).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    }
  });

  it("watches and unwatches through the module", async () => {
    const db = engagementDb();
    const c = caller(member, db);
    await expect(c.watchThread({ threadId: "t1" })).resolves.toEqual({ watching: true });
    await expect(c.unwatchThread({ threadId: "t1" })).resolves.toEqual({ watching: false });
    expect(db.forumThreadWatch.createMany).toHaveBeenCalledTimes(1);
    expect(db.forumThreadWatch.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", threadId: "t1" },
    });
  });

  it("answers navCounts with two numbers", async () => {
    const c = caller(member, engagementDb());
    await expect(c.navCounts()).resolves.toEqual({ realmBoardNew: 0 });
  });
});

describe("thinkpagesForum mentionSuggestions", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("refuses a signed-out caller and a query under two characters or over 25", async () => {
    await expect(caller(null).mentionSuggestions({ q: "ki" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    await expect(caller(member, {}).mentionSuggestions({ q: "k" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller(member, {}).mentionSuggestions({ q: "x".repeat(26) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns the module's suggestions", async () => {
    const db = {
      user: { findMany: jest.fn(async () => [{ handle: "kirsten", clerkUserId: "clerk_k" }]) },
      thinkpagesAccount: { findMany: jest.fn(async () => []) },
    };
    await expect(caller(member, db).mentionSuggestions({ q: "ki" })).resolves.toEqual([
      { kind: "user", name: "kirsten", label: "kirsten", avatarUrl: null },
    ]);
  });
});
