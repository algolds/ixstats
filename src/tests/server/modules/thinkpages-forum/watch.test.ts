/** @jest-environment node */
import {
  autoWatch,
  isWatching,
  unwatchThread,
  watchThread,
} from "~/server/modules/thinkpages-forum/watch";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
};
const category = {
  id: "cat_general",
  scope: "site",
  realmId: null,
  key: "general",
  style: "ooc",
  visibility: "public",
};

function watchDb(categoryOver: object = {}, threadOver: object = {}, realm: object | null = null) {
  return {
    ...engagementTables(),
    forumThread: {
      findUnique: jest.fn(async () => ({
        id: "t1",
        categoryId: category.id,
        title: "Hello",
        authorUserId: "u2",
        authorPersonaId: null,
        importedAuthorName: null,
        xenforoThreadId: null,
        pinned: false,
        locked: false,
        hidden: false,
        archived: false,
        postCount: 2,
        lastPostAt: new Date(),
        createdAt: new Date(),
        category: { ...category, ...categoryOver },
        ...threadOver,
      })),
    },
    realm: { findUnique: jest.fn(async () => realm) },
  };
}

describe("watchThread", () => {
  it("watches a thread the member may read, idempotently", async () => {
    const db = watchDb();
    await expect(watchThread(db as never, member, "t1")).resolves.toEqual({ watching: true });
    expect(db.forumThreadWatch.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t1" }],
      skipDuplicates: true,
    });
  });

  it("answers NOT_FOUND for a thread the member cannot read, and for the realm board", async () => {
    await expect(
      watchThread(watchDb({ visibility: "staff" }) as never, member, "t1")
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const board = watchDb({ scope: "realm", realmId: "r1", key: "board", style: "board" });
    await expect(watchThread(board as never, member, "t1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(board.forumThreadWatch.createMany).not.toHaveBeenCalled();
  });
});

describe("watchThread, what the member may not read", () => {
  it("refuses a hidden thread to a member who does not moderate it", async () => {
    const db = watchDb({}, { hidden: true });
    await expect(watchThread(db as never, member, "t1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.forumThreadWatch.createMany).not.toHaveBeenCalled();
  });

  it("refuses a thread in a realm the member cannot see", async () => {
    const draft = {
      id: "r_draft",
      slug: "draft",
      name: "Draft",
      status: "draft",
      ownerId: "founder",
    };
    const db = watchDb({ scope: "realm", realmId: "r_draft", key: "hub" }, {}, draft);
    await expect(watchThread(db as never, member, "t1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.forumThreadWatch.createMany).not.toHaveBeenCalled();
  });
});

describe("unwatchThread, isWatching and autoWatch", () => {
  it("deletes only the member's own row", async () => {
    const db = engagementTables();
    await expect(unwatchThread(db as never, "u1", "t1")).resolves.toEqual({ watching: false });
    expect(db.forumThreadWatch.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", threadId: "t1" },
    });
  });

  it("answers whether the member watches", async () => {
    const db = engagementTables();
    await expect(isWatching(db as never, "u1", "t1")).resolves.toBe(false);
    db.forumThreadWatch.count.mockResolvedValue(1);
    await expect(isWatching(db as never, "u1", "t1")).resolves.toBe(true);
  });

  it("auto-watches without a visibility check and without duplicating", async () => {
    const db = engagementTables();
    await autoWatch(db as never, "u1", "t1");
    expect(db.forumThreadWatch.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t1" }],
      skipDuplicates: true,
    });
  });
});
