/** @jest-environment node */
import { unreadIdsOf } from "~/server/modules/thinkpages-forum/unread";
import { withUnreadCounts } from "~/server/modules/thinkpages-forum/unread-attach";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
};

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

  it("reads the newest threads first, so the cap keeps the most recent", async () => {
    const db = countDb([]);
    await withUnreadCounts(db as never, member, [{ id: "cat_general" }]);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { lastPostAt: "desc" }, take: 5000 })
    );
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
