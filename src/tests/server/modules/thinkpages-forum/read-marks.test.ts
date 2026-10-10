/** @jest-environment node */
import { ForumError } from "~/server/modules/thinkpages-forum";
import {
  markAllRead,
  markCategoryRead,
  markRealmBoardRead,
  markThreadRead,
} from "~/server/modules/thinkpages-forum/read-marks";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = { id: "u1", clerkUserId: "clerk_1", countryId: null, role: { name: "user", level: 100 } };

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
const threadRow = (over: object = {}, category: object = general) => ({
  id: "t1",
  categoryId: (category as { id: string }).id,
  title: "Hello",
  authorUserId: "u2",
  authorPersonaId: null,
  importedAuthorName: null,
  xenforoThreadId: null,
  pinned: false,
  locked: false,
  hidden: false,
  archived: false,
  postCount: 5,
  lastPostAt: ago(1),
  createdAt: ago(3),
  category,
  ...over,
});

function markDb(thread: object | null, posts: Array<{ createdAt: Date }> = []) {
  return {
    ...engagementTables(),
    forumThread: {
      findUnique: jest.fn(async () => thread),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
    },
    forumPost: { findMany: jest.fn(async () => posts) },
    forumCategory: { findFirst: jest.fn(async () => general) },
    realm: { findUnique: jest.fn(async () => null) },
    $transaction: jest.fn(async (ops: Array<Promise<object>>) => Promise.all(ops)),
  };
}

describe("markThreadRead", () => {
  it("reads up to the newest post of the page shown, monotonically", async () => {
    const t3 = ago(2);
    const db = markDb(threadRow({ lastPostAt: ago(1) }), [{ createdAt: ago(4) }, { createdAt: t3 }]);
    await expect(markThreadRead(db as never, member, { threadId: "t1", page: 1 })).resolves.toEqual({
      readAt: t3,
    });
    expect(db.forumThreadRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t1", readAt: t3 }],
      skipDuplicates: true,
    });
    expect(db.forumThreadRead.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", threadId: "t1", readAt: { lt: t3 } },
      data: { readAt: t3 },
    });
  });

  it("pages the posts the way the thread page does", async () => {
    const db = markDb(threadRow(), [{ createdAt: ago(2) }]);
    await markThreadRead(db as never, member, { threadId: "t1", page: 3 });
    expect(db.forumPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 })
    );
  });

  it("never reads past the thread's last post, whatever page the client names", async () => {
    const lastPostAt = ago(2);
    const db = markDb(threadRow({ lastPostAt }), [{ createdAt: ago(0.1) }]);
    await expect(markThreadRead(db as never, member, { threadId: "t1", page: 1 })).resolves.toEqual({
      readAt: lastPostAt,
    });
  });

  it("does nothing for a page past the end", async () => {
    const db = markDb(threadRow(), []);
    await expect(markThreadRead(db as never, member, { threadId: "t1", page: 99 })).resolves.toEqual({
      readAt: null,
    });
    expect(db.forumThreadRead.createMany).not.toHaveBeenCalled();
  });

  it("clears the watch's notified mark so the next reply notifies again", async () => {
    const db = markDb(threadRow(), [{ createdAt: ago(2) }]);
    await markThreadRead(db as never, member, { threadId: "t1", page: 1 });
    expect(db.forumThreadWatch.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", threadId: "t1", notifiedAt: { not: null } },
      data: { notifiedAt: null },
    });
  });

  it("answers NOT_FOUND for a thread the member cannot see, and for the realm board", async () => {
    const staff = { ...general, id: "cat_staff", key: "staff", visibility: "staff" };
    await expect(
      markThreadRead(markDb(threadRow({}, staff)) as never, member, { threadId: "t1", page: 1 })
    ).rejects.toBeInstanceOf(ForumError);
    const board = { ...general, id: "cat_board", scope: "realm", realmId: "r1", key: "board", style: "board" };
    const db = markDb(threadRow({}, board), [{ createdAt: ago(1) }]);
    await expect(markThreadRead(db as never, member, { threadId: "t1", page: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.forumThreadRead.createMany).not.toHaveBeenCalled();
  });
});

describe("markCategoryRead", () => {
  it("marks the unread threads of the board, not the read ones", async () => {
    const fresh = { id: "t_new", lastPostAt: ago(1) };
    const seen = { id: "t_seen", lastPostAt: ago(1) };
    const db = markDb(null);
    db.forumThread.findMany.mockResolvedValue([fresh, seen] as never);
    db.forumThreadRead.findMany.mockResolvedValue([{ threadId: "t_seen", readAt: seen.lastPostAt }]);
    await expect(markCategoryRead(db as never, member, { key: "general" })).resolves.toEqual({
      marked: 1,
    });
    expect(db.forumThreadRead.createMany).toHaveBeenCalledTimes(1);
    expect(db.forumThreadRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t_new", readAt: fresh.lastPostAt }],
      skipDuplicates: true,
    });
    expect(db.forumThreadRead.updateMany).toHaveBeenCalledTimes(1);
    expect(db.forumThreadRead.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", threadId: "t_new", readAt: { lt: fresh.lastPostAt } },
      data: { readAt: fresh.lastPostAt },
    });
  });

  it("never lowers a read time that a concurrent mark advanced after the unread check", async () => {
    const lastPostAt = ago(2);
    const newer = ago(1);
    const store = new Map<string, Date>([["t_new", newer]]);
    const db = markDb(null);
    db.forumThread.findMany.mockResolvedValue([{ id: "t_new", lastPostAt }] as never);
    // The unread check saw no read mark; by the write the store holds a newer one.
    db.forumThreadRead.createMany.mockImplementation((async (args: {
      data: Array<{ threadId: string; readAt: Date }>;
    }) => {
      for (const row of args.data) if (!store.has(row.threadId)) store.set(row.threadId, row.readAt);
      return { count: 0 };
    }) as never);
    db.forumThreadRead.updateMany.mockImplementation((async (args: {
      where: { threadId: string; readAt: { lt: Date } };
      data: { readAt: Date };
    }) => {
      const current = store.get(args.where.threadId);
      if (current && current < args.where.readAt.lt) store.set(args.where.threadId, args.data.readAt);
      return { count: 0 };
    }) as never);
    await markCategoryRead(db as never, member, { key: "general" });
    expect(store.get("t_new")).toEqual(newer);
  });

  it("asks only for visible threads inside the thirty-day window, newest first", async () => {
    const db = markDb(null);
    await markCategoryRead(db as never, member, { key: "general" });
    const call = db.forumThread.findMany.mock.calls[0]![0] as {
      where: { lastPostAt: { gt: Date } };
    };
    expect(call).toEqual(
      expect.objectContaining({
        where: { categoryId: "cat_general", hidden: false, lastPostAt: { gt: expect.any(Date) } },
      })
    );
    const age = Date.now() - call.where.lastPostAt.gt.getTime();
    expect(age).toBeGreaterThan(29.9 * DAY);
    expect(age).toBeLessThan(30.1 * DAY);
  });

  it("marks only a member's own threads in a Reports category, all of them for a moderator", async () => {
    const reports = { ...general, id: "cat_reports", key: "reports", visibility: "reporter_staff" };
    const own = markDb(null);
    own.forumCategory.findFirst.mockResolvedValue(reports as never);
    await markCategoryRead(own as never, member, { key: "reports" });
    expect(own.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: "cat_reports", authorUserId: "u1" }),
      })
    );
    const admin = { ...member, id: "u9", clerkUserId: "clerk_9", role: { name: "admin", level: 10 } };
    const all = markDb(null);
    all.forumCategory.findFirst.mockResolvedValue(reports as never);
    await markCategoryRead(all as never, admin, { key: "reports" });
    expect(all.forumThread.findMany.mock.calls[0]![0]).not.toHaveProperty("where.authorUserId");
  });

  it("walks a busy board in chunks of 500 by keyset, stopping at the first short chunk", async () => {
    const chunk = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `t${from + i}`, lastPostAt: ago(1 + (from + i) / 1000) }));
    const first = chunk(0, 500);
    const db = markDb(null);
    db.forumThread.findMany
      .mockResolvedValueOnce(first as never)
      .mockResolvedValueOnce(chunk(500, 3) as never);
    await expect(markCategoryRead(db as never, member, { key: "general" })).resolves.toEqual({
      marked: 503,
    });
    expect(db.forumThread.findMany).toHaveBeenCalledTimes(2);
    const last = first.at(-1)!;
    expect(db.forumThread.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 500, orderBy: [{ lastPostAt: "desc" }, { id: "desc" }] })
    );
    expect(db.forumThread.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { OR: [{ lastPostAt: { lt: last.lastPostAt } }, { lastPostAt: last.lastPostAt, id: { lt: last.id } }] },
          ],
        }),
      })
    );
  });

  it("stops after 5000 threads however busy the board is", async () => {
    const db = markDb(null);
    db.forumThread.findMany.mockImplementation((async () =>
      Array.from({ length: 500 }, (_, i) => ({ id: `t${i}`, lastPostAt: ago(1) }))) as never);
    const result = await markCategoryRead(db as never, member, { key: "general" });
    expect(db.forumThread.findMany).toHaveBeenCalledTimes(10);
    expect(result.marked).toBe(5000);
  });

  it("refuses a board the member cannot see", async () => {
    const db = markDb(null);
    db.forumCategory.findFirst.mockResolvedValue({ ...general, visibility: "staff" } as never);
    await expect(markCategoryRead(db as never, member, { key: "staff" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses the realm board's category", async () => {
    const db = markDb(null);
    db.forumCategory.findFirst.mockResolvedValue({
      ...general,
      scope: "realm",
      realmId: "r1",
      key: "board",
      style: "board",
    } as never);
    await expect(markCategoryRead(db as never, member, { key: "board" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("markAllRead", () => {
  it("sets the member's mark-all-read time", async () => {
    const db = engagementTables();
    const now = new Date("2026-10-15T00:00:00Z");
    await expect(markAllRead(db as never, "u1", now)).resolves.toEqual({ allReadAt: now });
    expect(db.forumReader.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", allReadAt: now },
      update: { allReadAt: now },
    });
  });
});

describe("markRealmBoardRead", () => {
  const eurth = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };

  it("advances the realm board thread's read row to its last post", async () => {
    const lastPostAt = ago(1);
    const db = markDb(null);
    db.realm.findUnique.mockResolvedValue(eurth as never);
    db.forumThread.findFirst.mockResolvedValue({ id: "t_board", categoryId: "cat_board" } as never);
    db.forumThread.findUnique.mockResolvedValue({ lastPostAt } as never);
    await expect(markRealmBoardRead(db as never, member, "eurth")).resolves.toEqual({ readAt: lastPostAt });
    expect(db.forumThreadRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t_board", readAt: lastPostAt }],
      skipDuplicates: true,
    });
  });

  it("answers NOT_FOUND for a realm hidden from the member", async () => {
    const db = markDb(null);
    db.realm.findUnique.mockResolvedValue({ ...eurth, status: "draft" } as never);
    await expect(markRealmBoardRead(db as never, member, "eurth")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
