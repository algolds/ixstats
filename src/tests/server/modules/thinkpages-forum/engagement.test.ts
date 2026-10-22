/** @jest-environment node */
import type { Prisma } from "@prisma/client";
import { ForumError } from "~/server/modules/thinkpages-forum";
import { markCategoryRead, markThreadRead } from "~/server/modules/thinkpages-forum/read-marks";
import { advertGate } from "~/server/modules/thinkpages-forum/advert-access";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";
import { withUnreadCounts } from "~/server/modules/thinkpages-forum/unread-attach";
import { unwatchThread, watchThread } from "~/server/modules/thinkpages-forum/watch";
import { SITE_CATEGORIES } from "~/tests/helpers/forum-site-categories";
import {
  stashThread,
  unstashThread,
  type StashDb,
  type StashOwner,
} from "~/server/modules/thinkpages-forum";
import { readableThreadTitles } from "~/server/modules/thinkpages-forum/stash";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
};

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
    $executeRaw: jest.fn(async (_query: Prisma.Sql) => 0),
  };
}

describe("markThreadRead", () => {
  it("reads up to the newest post of the page shown, monotonically", async () => {
    const t3 = ago(2);
    const db = markDb(threadRow({ lastPostAt: ago(1) }), [
      { createdAt: ago(4) },
      { createdAt: t3 },
    ]);
    await expect(markThreadRead(db as never, member, { threadId: "t1", page: 1 })).resolves.toEqual(
      {
        readAt: t3,
      }
    );
    expect(db.forumThreadRead.createMany).toHaveBeenCalledWith({
      data: [{ userId: "u1", threadId: "t1", readAt: t3 }],
      skipDuplicates: true,
    });
    expect(db.forumThreadRead.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", threadId: "t1", readAt: { lt: t3 } },
      data: { readAt: t3 },
    });
  });
  it("never reads past the thread's last post, whatever page the client names", async () => {
    const lastPostAt = ago(2);
    const db = markDb(threadRow({ lastPostAt }), [{ createdAt: ago(0.1) }]);
    await expect(markThreadRead(db as never, member, { threadId: "t1", page: 1 })).resolves.toEqual(
      {
        readAt: lastPostAt,
      }
    );
  });
  it("answers NOT_FOUND for a thread the member cannot see, and for the realm board", async () => {
    const staff = { ...general, id: "cat_staff", key: "staff", visibility: "staff" };
    await expect(
      markThreadRead(markDb(threadRow({}, staff)) as never, member, { threadId: "t1", page: 1 })
    ).rejects.toBeInstanceOf(ForumError);
    const board = {
      ...general,
      id: "cat_board",
      scope: "realm",
      realmId: "r1",
      key: "board",
      style: "board",
    };
    const db = markDb(threadRow({}, board), [{ createdAt: ago(1) }]);
    await expect(
      markThreadRead(db as never, member, { threadId: "t1", page: 1 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.forumThreadRead.createMany).not.toHaveBeenCalled();
  });
});

describe("markCategoryRead", () => {
  it("writes a chunk as one bound upsert that only moves a read time forward", async () => {
    const lastPostAt = ago(2);
    const db = markDb(null);
    db.forumThread.findMany.mockResolvedValue([
      { id: "t_a", lastPostAt },
      { id: "t_b", lastPostAt },
    ] as never);
    await markCategoryRead(db as never, member, { key: "general" });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const [[query]] = db.$executeRaw.mock.calls as never as [[Prisma.Sql]];
    const text = query.sql.replace(/\s+/g, " ");
    expect(text).toContain(
      'INSERT INTO forum_thread_reads ("userId", "threadId", "readAt") VALUES'
    );
    expect(text).toContain("VALUES (?, ?, ?),(?, ?, ?) ON CONFLICT");
    expect(text).toContain(
      'ON CONFLICT ("userId", "threadId") DO UPDATE SET "readAt" = EXCLUDED."readAt" WHERE forum_thread_reads."readAt" < EXCLUDED."readAt"'
    );
    expect(query.values).toEqual(["u1", "t_a", lastPostAt, "u1", "t_b", lastPostAt]);
  });
  it("leaves a hidden realm's adverts out of what it marks and counts, on every chunk", async () => {
    const find = { ...general, id: "cat_find", key: "find-a-realm", name: "Find a Realm" };
    const db = markDb(null);
    db.forumCategory.findFirst.mockResolvedValue(find as never);
    db.forumThread.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, i) => ({ id: `t${i}`, lastPostAt: ago(1) })) as never
      )
      .mockResolvedValueOnce([] as never);
    await markCategoryRead(db as never, member, { key: "find-a-realm" });
    const [[first], [second]] = db.forumThread.findMany.mock.calls as never as [
      [{ where: { AND: object[] } }],
      [{ where: { AND: object[] } }],
    ];
    const gate = advertGate(member);
    expect(first.where.AND).toEqual([gate]);
    expect(second.where.AND[0]).toEqual(gate);
    expect(JSON.stringify(gate)).toContain('"notIn":["draft","generating"]');
  });
  it("walks a busy board in chunks of 500 by keyset, stopping at the first short chunk", async () => {
    const chunk = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `t${from + i}`,
        lastPostAt: ago(1 + (from + i) / 1000),
      }));
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
          // The advert gate stays beside the cursor: neither replaces the other.
          AND: [
            advertGate(member),
            {
              OR: [
                { lastPostAt: { lt: last.lastPostAt } },
                { lastPostAt: last.lastPostAt, id: { lt: last.id } },
              ],
            },
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
});
describe("unread counts", () => {
  const member = {
    id: "u1",
    clerkUserId: "clerk_1",
    countryId: null,
    role: { name: "user", level: 100 },
  };
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
  });
});

describe("watching", () => {
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
  function watchDb(
    categoryOver: object = {},
    threadOver: object = {},
    realm: object | null = null
  ) {
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
  });
  describe("unwatchThread, isWatching and autoWatch", () => {
    it("deletes only the member's own row", async () => {
      const db = engagementTables();
      await expect(unwatchThread(db as never, "u1", "t1")).resolves.toEqual({ watching: false });
      expect(db.forumThreadWatch.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u1", threadId: "t1" },
      });
    });
  });
});

describe("stashes", () => {
  const categories = SITE_CATEGORIES.map((c, i) => ({
    id: `cat_${c.key}`,
    scope: "site",
    realmId: null,
    ...c,
    order: i,
  }));
  const general = categories.find((c) => c.key === "general")!;
  const reports = categories.find((c) => c.visibility === "reporter_staff")!;
  const staff = categories.find((c) => c.key === "staff")!;
  const member = {
    id: "u1",
    clerkUserId: "clerk_1",
    countryId: null,
    role: { name: "user", level: 100 },
  };
  const owner: StashOwner = { primaryId: "u1", ids: ["u1", "clerk_1"] };
  interface Item {
    id: string;
    stashId: string;
    pageTitle: string;
    pageSlug: string;
    contentType: string;
    contentId: number | null;
    note: string | null;
    savedAt: Date;
  }
  interface StashRow {
    id: string;
    userId: string;
    name: string;
    color: string | null;
    isDefault: boolean;
  }
  interface Setup {
    threads?: Record<string, object>;
    stashes?: StashRow[];
    items?: Item[];
  }
  const thread = (over: object = {}, category: object = general) => ({
    id: "t1",
    title: "Hello there",
    authorUserId: "u2",
    hidden: false,
    category,
    ...over,
  });
  function fake({ threads = { t1: thread() }, stashes = [], items = [] }: Setup = {}) {
    const stashRows = [...stashes];
    const itemRows = [...items];
    let counter = 0;
    const db = {
      forumThread: {
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) => threads[where.id] ?? null
        ),
        findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.flatMap((id) => (threads[id] ? [threads[id]] : []))
        ),
      },
      realm: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null) },
      stash: {
        findFirst: jest.fn(
          async ({
            where,
          }: {
            where: { id?: string; isDefault?: boolean; userId: { in: string[] } };
          }) =>
            stashRows.find(
              (s) =>
                where.userId.in.includes(s.userId) &&
                (where.id === undefined || s.id === where.id) &&
                (where.isDefault === undefined || s.isDefault === where.isDefault)
            ) ?? null
        ),
        findMany: jest.fn(async ({ where }: { where: { userId: { in: string[] } } }) =>
          stashRows.filter((s) => where.userId.in.includes(s.userId))
        ),
        create: jest.fn(async ({ data }: { data: Omit<StashRow, "id" | "color"> }) => {
          const row = { id: `stash_new${++counter}`, color: null, ...data };
          stashRows.push(row);
          return row;
        }),
      },
      stashItem: {
        upsert: jest.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: {
              stashId_contentType_pageTitle: {
                stashId: string;
                contentType: string;
                pageTitle: string;
              };
            };
            create: Omit<Item, "id" | "savedAt">;
            update: object;
          }) => {
            const key = where.stashId_contentType_pageTitle;
            const existing = itemRows.find(
              (i) =>
                i.stashId === key.stashId &&
                i.contentType === key.contentType &&
                i.pageTitle === key.pageTitle
            );
            if (existing) return Object.assign(existing, update);
            const row = { id: `item_${++counter}`, savedAt: new Date(), ...create };
            itemRows.push(row);
            return row;
          }
        ),
        deleteMany: jest.fn(
          async ({
            where,
          }: {
            where: { stashId: string | { in: string[] }; pageTitle: string; contentType: string };
          }) => {
            const ids = typeof where.stashId === "string" ? [where.stashId] : where.stashId.in;
            const before = itemRows.length;
            for (let i = itemRows.length - 1; i >= 0; i--) {
              const r = itemRows[i]!;
              if (
                ids.includes(r.stashId) &&
                r.pageTitle === where.pageTitle &&
                r.contentType === where.contentType
              )
                itemRows.splice(i, 1);
            }
            return { count: before - itemRows.length };
          }
        ),
        findMany: jest.fn(
          async ({
            where,
            take,
          }: {
            where: { stashId: { in: string[] }; pageTitle?: unknown; contentType: string };
            take?: number;
          }) => {
            const prefix =
              (where.pageTitle as { startsWith?: string } | string | undefined) ?? undefined;
            return itemRows
              .filter(
                (i) => where.stashId.in.includes(i.stashId) && i.contentType === where.contentType
              )
              .filter((i) =>
                prefix === undefined
                  ? true
                  : typeof prefix === "string"
                    ? i.pageTitle === prefix
                    : i.pageTitle.startsWith(prefix.startsWith ?? "")
              )
              .slice(0, take);
          }
        ),
      },
    };
    return { db: db as unknown as StashDb, raw: db, stashRows, itemRows };
  }
  const mine: StashRow = {
    id: "stash_1",
    userId: "u1",
    name: "My Stash",
    color: null,
    isDefault: true,
  };
  const second: StashRow = {
    id: "stash_2",
    userId: "clerk_1",
    name: "Reading",
    color: "#fff",
    isDefault: false,
  };
  const theirs: StashRow = {
    id: "stash_x",
    userId: "u9",
    name: "Theirs",
    color: null,
    isDefault: true,
  };
  describe("stashThread", () => {
    it("uses the default stash a racing first stash created, instead of failing on the name (I6)", async () => {
      const { db, raw, stashRows, itemRows } = fake();
      raw.stash.create.mockImplementationOnce(async () => {
        stashRows.push({ ...mine, id: "stash_raced" });
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      });

      await expect(stashThread(db, member, owner, { threadId: "t1" })).resolves.toEqual({
        success: true,
        stashId: "stash_raced",
      });
      expect(itemRows).toEqual([expect.objectContaining({ stashId: "stash_raced" })]);
    });
    it("uses a given stash of the caller's and refuses someone else's as NOT_FOUND", async () => {
      const { db, itemRows } = fake({ stashes: [mine, second, theirs] });

      await stashThread(db, member, owner, { threadId: "t1", stashId: "stash_2" });
      expect(itemRows.map((i) => i.stashId)).toEqual(["stash_2"]);

      await expect(
        stashThread(db, member, owner, { threadId: "t1", stashId: "stash_x" })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(itemRows).toHaveLength(1);
    });

    it("stashes only a thread the caller can see, and never names why it refuses", async () => {
      const cases: Array<[string, Record<string, object>]> = [
        ["a missing thread", {}],
        ["a hidden thread", { t1: thread({ hidden: true }) }],
        ["a staff-category thread", { t1: thread({}, staff) }],
        ["another member's thread in Reports", { t1: thread({}, reports) }],
      ];
      for (const [, threads] of cases) {
        const { db, itemRows, stashRows } = fake({ threads });
        const error = await stashThread(db, member, owner, { threadId: "t1" }).catch(
          (e: Error) => e
        );
        expect(error).toBeInstanceOf(ForumError);
        expect(error).toMatchObject({ code: "NOT_FOUND", message: "Thread not found." });
        expect(itemRows).toEqual([]);
        expect(stashRows).toEqual([]);
      }
    });
  });
  describe("unstashThread", () => {
    const stashed = (stashId: string): Item => ({
      id: `i_${stashId}`,
      stashId,
      pageTitle: "thinkpages:thread:t1",
      pageSlug: "/thinkpages/t/t1",
      contentType: "forum_thread",
      contentId: null,
      note: "Hello there",
      savedAt: new Date(),
    });
    const legacy: Item = {
      ...stashed("stash_1"),
      id: "i_legacy",
      pageTitle: "forum:thread:7",
      contentId: 7,
    };

    it("removes the thread from every stash of the caller's, leaving legacy and others' rows", async () => {
      const { db, itemRows } = fake({
        stashes: [mine, second, theirs],
        items: [stashed("stash_1"), stashed("stash_2"), stashed("stash_x"), legacy],
      });

      await unstashThread(db, owner, { threadId: "t1" });

      expect(itemRows.map((i) => i.id).sort()).toEqual(["i_legacy", "i_stash_x"]);
    });
  });
  describe("isThreadStashed and readableThreadTitles", () => {
    it("titles only the threads the caller can still read: not hidden, staff-only or gone (I5)", async () => {
      const { db } = fake({
        threads: {
          t1: thread(),
          t_hidden: thread({ id: "t_hidden", hidden: true }),
          t_staff: thread({ id: "t_staff" }, staff),
        },
      });

      const titles = await readableThreadTitles(db, member, [
        "t1",
        "t_hidden",
        "t_staff",
        "t_gone",
      ]);

      expect([...titles]).toEqual([["t1", "Hello there"]]);
    });
  });
});
