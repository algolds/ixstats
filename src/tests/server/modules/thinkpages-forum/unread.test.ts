/** @jest-environment node */
import { unreadIdsOf } from "~/server/modules/thinkpages-forum/unread";
import { markUnreadThreads, withUnreadCounts } from "~/server/modules/thinkpages-forum/unread-attach";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = { id: "u1", clerkUserId: "clerk_1", countryId: null, role: { name: "user", level: 100 } };

describe("unreadIdsOf", () => {
  it("counts a recent unopened thread, not an old one, not a read one, in two queries", async () => {
    const db = engagementTables();
    const yesterday = ago(1);
    db.forumThreadRead.findMany.mockResolvedValue([{ threadId: "read", readAt: yesterday }]);
    const unread = await unreadIdsOf(db as never, "u1", [
      { id: "new", lastPostAt: yesterday },
      { id: "old", lastPostAt: ago(40) },
      { id: "read", lastPostAt: yesterday },
      { id: "again", lastPostAt: ago(0.5) },
    ]);
    expect([...unread].sort()).toEqual(["again", "new"]);
    expect(db.forumThreadRead.findMany).toHaveBeenCalledTimes(1);
  });

  it("uses a floor the caller already has instead of the thirty-day window", async () => {
    const db = engagementTables();
    const unread = await unreadIdsOf(
      db as never,
      "u1",
      [
        { id: "before", lastPostAt: ago(3) },
        { id: "after", lastPostAt: ago(1) },
      ],
      ago(2)
    );
    expect([...unread]).toEqual(["after"]);
  });

  it("asks nothing for an empty list", async () => {
    const db = engagementTables();
    expect((await unreadIdsOf(db as never, "u1", [])).size).toBe(0);
    expect(db.forumThreadRead.findMany).not.toHaveBeenCalled();
  });
});

describe("markUnreadThreads", () => {
  it("flags unread threads for a member and none, without a query, for an anonymous visitor", async () => {
    const db = engagementTables();
    const threads = [{ id: "t1", lastPostAt: ago(1) }];
    await expect(markUnreadThreads(db as never, member, threads)).resolves.toEqual([
      { id: "t1", lastPostAt: threads[0]!.lastPostAt, unread: true },
    ]);
    db.forumThreadRead.findMany.mockClear();
    await expect(markUnreadThreads(db as never, null, threads)).resolves.toEqual([
      { id: "t1", lastPostAt: threads[0]!.lastPostAt, unread: false },
    ]);
    expect(db.forumThreadRead.findMany).not.toHaveBeenCalled();
  });
});

describe("withUnreadCounts", () => {
  const category = (id: string, over: object = {}) => ({
    id,
    scope: "site",
    realmId: null,
    visibility: "public",
    ...over,
  });

  function countDb(threads: object[], categories = [category("cat_general")]) {
    return {
      ...engagementTables(),
      forumCategory: { findMany: jest.fn(async () => categories) },
      forumThread: { findMany: jest.fn(async () => threads) },
    };
  }

  it("counts each category's unread threads from one grouped read, leaving read ones out", async () => {
    const yesterday = ago(1);
    const db = countDb([
      { categoryId: "cat_general", lastPostAt: yesterday, reads: [] },
      { categoryId: "cat_general", lastPostAt: yesterday, reads: [{ readAt: yesterday }] },
      { categoryId: "cat_general", lastPostAt: ago(2), reads: [{ readAt: ago(3) }] },
    ]);
    const rows = await withUnreadCounts(db as never, member, [{ id: "cat_general", name: "General" }]);
    expect(rows).toEqual([{ id: "cat_general", name: "General", unreadThreads: 2 }]);
    expect(db.forumThread.findMany).toHaveBeenCalledTimes(1);
  });

  it("reads the newest threads first, so the cap keeps the most recent", async () => {
    const db = countDb([]);
    await withUnreadCounts(db as never, member, [{ id: "cat_general" }]);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { lastPostAt: "desc" }, take: 5000 })
    );
  });

  it("gives an anonymous visitor zeros and runs no query", async () => {
    const db = countDb([]);
    await expect(withUnreadCounts(db as never, null, [{ id: "cat_general" }])).resolves.toEqual([
      { id: "cat_general", unreadThreads: 0 },
    ]);
    expect(db.forumCategory.findMany).not.toHaveBeenCalled();
  });

  it("never counts the realm board: the category lookup leaves board categories out", async () => {
    const db = countDb([]);
    await withUnreadCounts(db as never, member, [{ id: "cat_board" }]);
    expect(db.forumCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          style: { not: "board" },
          NOT: { scope: "realm", key: "board" },
        }),
      })
    );
  });

  it("counts only the member's own threads in a reports category", async () => {
    const db = countDb([], [category("cat_reports", { visibility: "reporter_staff" })]);
    await withUnreadCounts(db as never, member, [{ id: "cat_reports" }]);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ categoryId: "cat_reports", authorUserId: "u1" }],
        }),
      })
    );
  });
});
