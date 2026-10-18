/** @jest-environment node */
/** Realms as places: the directory reports real nation counts, forum activity and board messages. */
jest.mock("~/server/db", () => ({ db: {} }));

import { realmsRouter } from "~/server/api/routers/realms";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;

const OWNER = "clerk_owner";

const makeDb = (): Db => createMockPrisma({ $queryRaw: jest.fn(async () => []) });

function callerAs(clerkUserId: string, db: Db) {
  return realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId },
    }) as never
  );
}

describe("realms.directory", () => {
  it("lists open realms with nation counts, the viewer's holdings and forum activity", async () => {
    const db = makeDb();
    const lastPostAt = new Date("2026-09-29T12:00:00Z");
    db.realm.findMany.mockResolvedValue([
      {
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        description: null,
        thumbnail: null,
        settings: { maxNationsPerUser: 3 },
        _count: { countries: 4 },
      },
      {
        id: "quiet",
        slug: "quiet",
        name: "Quiet",
        description: null,
        thumbnail: null,
        settings: null,
        _count: { countries: 1 },
      },
    ]);
    db.country.groupBy.mockImplementation(async ({ where }: any) =>
      where.ownerUserId === null
        ? [{ realmId: "eurth", _count: { _all: 2 } }]
        : [{ realmId: "eurth", _count: { _all: 1 } }]
    );
    db.forumCategory.findMany.mockResolvedValue([{ id: "cat_eurth", realmId: "eurth" }]);
    db.forumThread.groupBy.mockResolvedValue([{ categoryId: "cat_eurth", _max: { lastPostAt } }]);
    db.$queryRaw.mockResolvedValue([{ categoryId: "cat_eurth", posts: 5 }]);

    const rows = await callerAs(OWNER, db).directory();

    expect(db.realm.findMany.mock.calls[0]![0].where).toEqual(DIRECTORY_REALM_WHERE);
    // Generated scenery slots are no nations of the realm: neither counted nor open.
    expect(db.realm.findMany.mock.calls[0]![0].select._count).toEqual({
      select: { countries: { where: { claimable: true } } },
    });
    expect(db.country.groupBy.mock.calls[0]![0].where).toEqual({
      realmId: { in: ["eurth", "quiet"] },
      ownerUserId: null,
      claimable: true,
    });
    // The sections: every listed realm's public categories, never the board.
    expect(db.forumCategory.findMany).toHaveBeenCalledTimes(1);
    expect(db.forumCategory.findMany.mock.calls[0]![0].where).toEqual({
      scope: "realm",
      realmId: { in: ["eurth", "quiet"] },
      visibility: "public",
      style: { not: "board" },
      NOT: { scope: "realm", key: "board" },
    });
    // U12: an archived thread (the Realm Board archive) is never the realm's latest activity; posts still count.
    expect(db.forumThread.groupBy).toHaveBeenCalledWith({
      by: ["categoryId"],
      where: { categoryId: { in: ["cat_eurth"] }, hidden: false, archived: false },
      _max: { lastPostAt: true },
    });
    // The week's posts: one grouped count over the sections, hidden threads and posts left out.
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings, categoryList, since] = db.$queryRaw.mock.calls[0]!;
    const sql = strings.join("?");
    expect(sql).toMatch(/GROUP BY t\."categoryId"/);
    expect(sql).toMatch(/t\.hidden = false AND p\.hidden = false/);
    expect(categoryList.values).toEqual(["cat_eurth"]);
    expect(since).toBeInstanceOf(Date);
    expect(rows).toEqual([
      expect.objectContaining({
        id: "eurth",
        nationCount: 4,
        openNationCount: 2,
        myNationCount: 1,
        maxNationsPerUser: 3,
        board: { recentPosts: 5, lastPostAt },
      }),
      expect.objectContaining({
        id: "quiet",
        nationCount: 1,
        openNationCount: 0,
        myNationCount: 0,
        maxNationsPerUser: 1,
        board: { recentPosts: 0, lastPostAt: null },
      }),
    ]);
    expect(db.realmBoard.findMany).not.toHaveBeenCalled();
    expect(rows[0]).not.toHaveProperty("settings");
  });

  it("counts board messages as their own figure, in two queries however many realms there are", async () => {
    const db = makeDb();
    const row = (id: string) => ({
      id,
      slug: id,
      name: id,
      description: null,
      thumbnail: null,
      settings: null,
      _count: { countries: 1 },
    });
    db.realm.findMany.mockResolvedValue([row("eurth"), row("quiet"), row("empty")]);
    db.country.groupBy.mockResolvedValue([]);
    db.forumCategory.findMany.mockResolvedValue(
      ["eurth", "quiet", "empty"].map((realmId) => ({ id: `cat_${realmId}`, realmId }))
    );
    db.forumThread.groupBy.mockResolvedValue([]);
    db.$queryRaw.mockResolvedValue(
      ["eurth", "quiet", "empty"].map((r) => ({ categoryId: `cat_${r}`, posts: 5 }))
    );
    db.forumThread.findMany.mockResolvedValue([
      { id: "t_eurth", category: { realmId: "eurth" } },
      { id: "t_quiet", category: { realmId: "quiet" } },
    ]);
    db.forumPost.groupBy.mockResolvedValue([
      { threadId: "t_eurth", _count: { _all: 7 } },
      { threadId: "t_quiet", _count: { _all: 2 } },
    ]);

    const rows = await callerAs(OWNER, db).directory();

    expect(rows.map((r) => [r.id, r.board.recentPosts, r.boardMessagesThisWeek])).toEqual([
      ["eurth", 5, 7],
      ["quiet", 5, 2],
      ["empty", 5, 0],
    ]);
    // Board-week figure: one thread lookup and one grouped count for the whole directory.
    const boardLookups = db.forumThread.findMany.mock.calls.filter(
      ([args]: [any]) => "category" in args.where
    );
    expect(boardLookups).toHaveLength(1);
    expect(db.forumPost.groupBy).toHaveBeenCalledTimes(1);
    // The forum counts are batched too: the same three forum-activity queries however many realms there are.
    expect(db.forumCategory.findMany).toHaveBeenCalledTimes(1);
    expect(db.forumThread.groupBy).toHaveBeenCalledTimes(1);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.forumThread.findMany).toHaveBeenCalledTimes(1);
    expect(db.forumCategory.findMany.mock.calls[0]![0].where).toMatchObject({
      style: { not: "board" },
      NOT: { scope: "realm", key: "board" },
    });
    expect(db.forumCategory.findMany.mock.calls[0]![0].where.OR).toBeUndefined();
    const [[threadQuery]] = boardLookups as [
      [{ where: { hidden: boolean; category: Record<string, object | string> } }],
    ];
    expect(threadQuery.where).toMatchObject({
      hidden: false,
      category: {
        scope: "realm",
        realmId: { in: ["eurth", "quiet", "empty"] },
        visibility: "public",
        OR: [{ style: "board" }, { scope: "realm", key: "board" }],
      },
    });
    expect(threadQuery.where.category.style).toBeUndefined();
    const [[groupQuery]] = db.forumPost.groupBy.mock.calls as [
      [{ by: string[]; where: { createdAt: { gte: Date } } }],
    ];
    expect(groupQuery).toMatchObject({
      by: ["threadId"],
      where: {
        threadId: { in: ["t_eurth", "t_quiet"] },
        hidden: false,
        continuedThreadId: null,
      },
    });
    expect(groupQuery.where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("skips the grouped count when no realm has a board thread", async () => {
    const db = makeDb();
    db.realm.findMany.mockResolvedValue([
      {
        id: "eurth",
        slug: "eurth",
        name: "Eurth",
        description: null,
        thumbnail: null,
        settings: null,
        _count: { countries: 1 },
      },
    ]);
    db.country.groupBy.mockResolvedValue([]);
    db.forumCategory.findMany.mockResolvedValue([]);
    db.forumThread.findMany.mockResolvedValue([]);

    const [row] = await callerAs(OWNER, db).directory();

    expect(row).toMatchObject({ boardMessagesThisWeek: 0 });
    expect(db.forumPost.groupBy).not.toHaveBeenCalled();
  });
});
