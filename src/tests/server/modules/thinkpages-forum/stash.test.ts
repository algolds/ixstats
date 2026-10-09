/** @jest-environment node */
import { SITE_CATEGORIES } from "~/lib/thinkpages-forum/categories";
import {
  ForumError,
  isThreadStashed,
  listStashedThreads,
  stashThread,
  unstashThread,
  type StashDb,
  type StashOwner,
} from "~/server/modules/thinkpages-forum";

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
  it("writes the native row into the default stash with the server-side title", async () => {
    const { db, itemRows } = fake({ stashes: [mine] });

    const result = await stashThread(db, member, owner, { threadId: "t1" });

    expect(result).toEqual({ success: true, stashId: "stash_1" });
    expect(itemRows).toEqual([
      expect.objectContaining({
        stashId: "stash_1",
        pageTitle: "thinkpages:thread:t1",
        pageSlug: "/thinkpages/t/t1",
        contentType: "forum_thread",
        contentId: null,
        note: "Hello there",
      }),
    ]);
  });

  it("creates the default stash on demand under the primary id", async () => {
    const { db, stashRows, itemRows } = fake();

    await stashThread(db, member, owner, { threadId: "t1" });

    expect(stashRows).toEqual([
      expect.objectContaining({ userId: "u1", isDefault: true, name: "My Stash" }),
    ]);
    expect(itemRows).toHaveLength(1);
  });

  it("is idempotent: a second call keeps one row", async () => {
    const { db, itemRows } = fake({ stashes: [mine] });

    await stashThread(db, member, owner, { threadId: "t1" });
    await stashThread(db, member, owner, { threadId: "t1" });

    expect(itemRows).toHaveLength(1);
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
      const error = await stashThread(db, member, owner, { threadId: "t1" }).catch((e: Error) => e);
      expect(error).toBeInstanceOf(ForumError);
      expect(error).toMatchObject({ code: "NOT_FOUND", message: "Thread not found." });
      expect(itemRows).toEqual([]);
      expect(stashRows).toEqual([]);
    }
  });

  it("lets the author stash their own Reports thread", async () => {
    const { db, itemRows } = fake({
      threads: { t1: thread({ authorUserId: "u1" }, reports) },
      stashes: [mine],
    });

    await stashThread(db, member, owner, { threadId: "t1" });

    expect(itemRows).toHaveLength(1);
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

  it("removes it from one given stash only", async () => {
    const { db, itemRows } = fake({
      stashes: [mine, second],
      items: [stashed("stash_1"), stashed("stash_2")],
    });

    await unstashThread(db, owner, { threadId: "t1", stashId: "stash_2" });

    expect(itemRows.map((i) => i.stashId)).toEqual(["stash_1"]);
  });

  it("refuses a stash that is not the caller's", async () => {
    const { db, itemRows } = fake({ stashes: [theirs], items: [stashed("stash_x")] });

    await expect(
      unstashThread(db, owner, { threadId: "t1", stashId: "stash_x" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(itemRows).toHaveLength(1);
  });

  it("works after the thread became invisible: it only deletes the caller's own rows", async () => {
    const { db, itemRows, raw } = fake({
      threads: {},
      stashes: [mine],
      items: [stashed("stash_1")],
    });

    await unstashThread(db, owner, { threadId: "t1" });

    expect(itemRows).toEqual([]);
    expect(raw.forumThread.findUnique).not.toHaveBeenCalled();
  });
});

describe("isThreadStashed and listStashedThreads", () => {
  const row = (stashId: string, threadId: string, savedAt: string): Item => ({
    id: `i_${stashId}_${threadId}`,
    stashId,
    pageTitle: `thinkpages:thread:${threadId}`,
    pageSlug: `/thinkpages/t/${threadId}`,
    contentType: "forum_thread",
    contentId: null,
    note: `Title ${threadId}`,
    savedAt: new Date(savedAt),
  });

  it("names the caller's stashes holding the thread", async () => {
    const { db } = fake({
      stashes: [mine, second, theirs],
      items: [row("stash_2", "t1", "2026-10-01"), row("stash_x", "t1", "2026-10-01")],
    });

    await expect(isThreadStashed(db, owner, { threadId: "t1" })).resolves.toEqual({
      stashed: true,
      stashes: [{ id: "stash_2", name: "Reading", color: "#fff" }],
    });
    await expect(isThreadStashed(db, owner, { threadId: "t2" })).resolves.toEqual({
      stashed: false,
      stashes: [],
    });
  });

  it("lists only native items, with their title and thread path", async () => {
    const legacy: Item = {
      ...row("stash_1", "7", "2026-10-02"),
      pageTitle: "forum:thread:7",
      pageSlug: "/forum/thread/7",
    };
    const { db } = fake({ stashes: [mine], items: [row("stash_1", "t1", "2026-10-01"), legacy] });

    const list = await listStashedThreads(db, owner, 50);

    expect(list).toEqual([
      {
        id: "i_stash_1_t1",
        threadId: "t1",
        title: "Title t1",
        href: "/thinkpages/t/t1",
        savedAt: new Date("2026-10-01"),
      },
    ]);
  });
});
