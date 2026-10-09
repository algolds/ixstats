/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";

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

const category = (key: string) => {
  const c = SITE_CATEGORIES.find((x) => x.key === key)!;
  return { id: `cat_${key}`, scope: "site", realmId: null, ...c };
};

interface ItemRow {
  stashId: string;
  pageTitle: string;
  contentType: string;
  note: string | null;
  id?: string;
  savedAt?: Date;
}

/** Just enough Prisma for the thread lookup, the moderator context and the stash tables. */
function stashDb(categoryKey = "general", threadOver: object = {}) {
  const items: ItemRow[] = [];
  const db = {
    forumThread: {
      findUnique: jest.fn(async () => ({
        id: "t1",
        title: "Hello there",
        authorUserId: "u2",
        hidden: false,
        category: category(categoryKey),
        ...threadOver,
      })),
    },
    realm: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
    realmOfficer: { findMany: jest.fn(async () => []) },
    forumCategoryModerator: { findMany: jest.fn(async () => []) },
    stash: {
      findFirst: jest.fn(async () => ({ id: "stash_1" })),
      findMany: jest.fn(async () => [{ id: "stash_1", name: "My Stash", color: null }]),
      create: jest.fn(),
    },
    stashItem: {
      upsert: jest.fn(async ({ create }: { create: ItemRow }) => {
        items.push(create);
        return create;
      }),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () =>
        items.map((i) => ({ ...i, id: "item_1", savedAt: new Date("2026-10-01") }))
      ),
    },
  };
  return { db, items };
}

describe("thinkpagesForum stash procedures", () => {
  // The user logger (info) and authMiddleware's rejection (warn) are not under test.
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("rejects signed-out callers on every procedure", async () => {
    const c = caller(null, stashDb().db);
    await expect(c.stashThread({ threadId: "t1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    await expect(c.unstashThread({ threadId: "t1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    await expect(c.isThreadStashed({ threadId: "t1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    await expect(c.stashedThreads()).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
  });

  it("stashes a visible thread with the server's title", async () => {
    const { db, items } = stashDb();

    await expect(caller(member, db).stashThread({ threadId: "t1" })).resolves.toEqual({
      success: true,
      stashId: "stash_1",
    });
    expect(items).toEqual([
      expect.objectContaining({
        pageTitle: "thinkpages:thread:t1",
        contentType: "forum_thread",
        note: "Hello there",
      }),
    ]);
  });

  it("answers NOT_FOUND for a thread the caller cannot see, writing nothing", async () => {
    const { db, items } = stashDb("staff");

    await expect(caller(member, db).stashThread({ threadId: "t1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Thread not found.",
    });
    expect(items).toEqual([]);
    expect(db.stash.create).not.toHaveBeenCalled();
  });

  it("answers NOT_FOUND for another member's thread in Reports", async () => {
    const { db } = stashDb("reports");

    await expect(caller(member, db).stashThread({ threadId: "t1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("matches the caller's stashes across their user and Clerk ids", async () => {
    const { db } = stashDb();

    await caller(member, db).unstashThread({ threadId: "t1" });

    expect(db.stash.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: { in: ["u1", "clerk_1"] } } })
    );
    expect(db.stashItem.deleteMany).toHaveBeenCalledWith({
      where: {
        stashId: { in: ["stash_1"] },
        pageTitle: "thinkpages:thread:t1",
        contentType: "forum_thread",
      },
    });
  });

  it("reports whether a thread is stashed and lists the native stashed threads", async () => {
    const { db, items } = stashDb();
    const c = caller(member, db);
    await c.stashThread({ threadId: "t1" });
    db.stashItem.findMany.mockResolvedValueOnce([{ stashId: "stash_1" }] as never);

    await expect(c.isThreadStashed({ threadId: "t1" })).resolves.toEqual({
      stashed: true,
      stashes: [{ id: "stash_1", name: "My Stash", color: null }],
    });
    expect(items).toHaveLength(1);
    await expect(c.stashedThreads()).resolves.toEqual([
      {
        id: "item_1",
        threadId: "t1",
        title: "Hello there",
        href: "/thinkpages/t/t1",
        savedAt: new Date("2026-10-01"),
      },
    ]);
  });

  it("bounds the inputs", async () => {
    const c = caller(member, stashDb().db);
    await expect(c.stashThread({ threadId: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(c.stashedThreads({ limit: 1000 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
