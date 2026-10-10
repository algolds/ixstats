/** @jest-environment node */
import {
  listNewPosts,
  listWatched,
  unreadWatchedCount,
} from "~/server/modules/thinkpages-forum/thread-listing";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
};
const admin = {
  id: "u_admin",
  clerkUserId: "admin",
  countryId: null,
  role: { name: "admin", level: 10 },
};

const category = (over: object = {}) => ({
  id: "cat_general",
  key: "general",
  name: "General",
  style: "ooc",
  scope: "site",
  realmId: null,
  visibility: "public",
  ...over,
});
const row = (id: string, over: object = {}, cat: object = category()) => ({
  id,
  title: `Thread ${id}`,
  authorUserId: "u2",
  authorPersonaId: null,
  importedAuthorName: null,
  xenforoThreadId: null,
  pinned: false,
  locked: false,
  hidden: false,
  postCount: 3,
  lastPostAt: ago(1),
  category: cat,
  reads: [] as Array<{ readAt: Date }>,
  ...over,
});
const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const DRAFT = { id: "r_draft", slug: "draft", name: "Draft", status: "draft", ownerId: "founder" };

function listDb(threads: object[], watched: object[] = [], posts: object[] = []) {
  const tables = engagementTables();
  return {
    ...tables,
    forumThread: { findMany: jest.fn(async (_args?: object) => threads) },
    forumThreadWatch: {
      ...tables.forumThreadWatch,
      findMany: jest.fn(async (_args?: object) => watched.map((thread) => ({ thread }))),
    },
    forumPost: { findMany: jest.fn(async () => posts) },
    realm: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string } }) =>
        where.id === "r_eurth" ? EURTH : where.id === "r_draft" ? DRAFT : null
      ),
    },
  };
}

describe("listNewPosts", () => {
  it("lists the unread threads of the window, newest first, leaving read and old ones out", async () => {
    const seen = ago(0.5);
    const db = listDb([
      row("new", { lastPostAt: ago(0.2) }),
      row("read", { lastPostAt: seen, reads: [{ readAt: seen }] }),
      row("again", { lastPostAt: ago(0.4), reads: [{ readAt: ago(2) }] }),
      row("old", { lastPostAt: ago(40) }),
    ]);
    const out = await listNewPosts(db as never, member, 1);
    expect(out.threads.map((t) => t.id)).toEqual(["new", "again"]);
    expect(out.total).toBe(2);
    expect(out.threads.every((t) => t.unread)).toBe(true);
    expect(out.threads[0]!.board).toEqual({ key: "general", name: "General", realm: null });
  });

  it("asks only for threads outside the realm board and in categories the member may see", async () => {
    const db = listDb([]);
    await listNewPosts(db as never, member, 1);
    const where = (db.forumThread.findMany.mock.calls[0]![0] as { where: Record<string, unknown> })
      .where;
    expect(where.hidden).toBe(false);
    expect(where.category).toEqual({
      style: { not: "board" },
      NOT: { scope: "realm", key: "board" },
      visibility: { in: ["public", "reporter_staff"] },
    });
    await listNewPosts(db as never, admin, 1);
    const adminWhere = (
      db.forumThread.findMany.mock.calls[1]![0] as { where: { category: { visibility: object } } }
    ).where;
    expect(adminWhere.category.visibility).toEqual({ in: ["public", "reporter_staff", "staff"] });
  });

  it("drops a board thread even if the query returned one", async () => {
    const board = category({
      id: "cat_board",
      scope: "realm",
      realmId: "r_eurth",
      key: "board",
      style: "board",
    });
    const db = listDb([row("b1", {}, board), row("t1")]);
    expect((await listNewPosts(db as never, member, 1)).threads.map((t) => t.id)).toEqual(["t1"]);
  });

  it("drops what the member cannot read: staff boards, another member's report, a draft realm", async () => {
    const staff = category({ id: "cat_staff", key: "staff", visibility: "staff" });
    const reports = category({ id: "cat_reports", key: "reports", visibility: "reporter_staff" });
    const draft = category({ id: "cat_draft", scope: "realm", realmId: "r_draft", key: "hub" });
    const open = category({ id: "cat_hub", scope: "realm", realmId: "r_eurth", key: "hub" });
    const db = listDb([
      row("s", {}, staff),
      row("r_other", { authorUserId: "u9" }, reports),
      row("r_mine", { authorUserId: "u1" }, reports),
      row("d", {}, draft),
      row("h", {}, open),
    ]);
    const out = await listNewPosts(db as never, member, 1);
    expect(out.threads.map((t) => t.id).sort()).toEqual(["h", "r_mine"]);
    expect(out.threads.find((t) => t.id === "h")!.board.realm).toEqual({
      slug: "eurth",
      name: "Eurth",
    });
  });

  it("pages by 25 and counts them all", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row(`t${i}`, { lastPostAt: ago(0.1 + i / 1000) })
    );
    const db = listDb(many);
    const second = await listNewPosts(db as never, member, 2);
    expect(second.threads).toHaveLength(5);
    expect(second.total).toBe(30);
  });

  it("shows a persona thread by the persona only, and its last poster without the player", async () => {
    const db = listDb(
      [
        row("p", {
          authorUserId: "u_player",
          authorPersonaId: "pa1",
          importedAuthorName: "Old name",
        }),
      ],
      [],
      [
        {
          threadId: "p",
          authorUserId: "u_player",
          authorPersonaId: "pa1",
          importedAuthorName: "Old name",
        },
      ]
    );
    const [thread] = (await listNewPosts(db as never, member, 1)).threads;
    expect(thread).toMatchObject({
      authorUserId: null,
      authorPersonaId: "pa1",
      importedAuthorName: null,
    });
    expect(thread!.lastPoster).toEqual({
      authorUserId: null,
      authorPersonaId: "pa1",
      importedAuthorName: null,
    });
  });
});

describe("listWatched", () => {
  it("lists unread watched threads first, then by last post, dropping hidden ones", async () => {
    const seen = ago(2);
    const db = listDb(
      [],
      [
        row("read_new", { lastPostAt: ago(1), reads: [{ readAt: ago(1) }] }),
        row("read_old", { lastPostAt: seen, reads: [{ readAt: seen }] }),
        row("unread_old", { lastPostAt: ago(5) }),
        row("hidden", { hidden: true }),
      ]
    );
    const out = await listWatched(db as never, member, 1);
    expect(out.threads.map((t) => [t.id, t.unread])).toEqual([
      ["unread_old", true],
      ["read_new", false],
      ["read_old", false],
    ]);
    expect(out.total).toBe(3);
  });

  it("asks only for the member's watches outside the realm board", async () => {
    const db = listDb([]);
    await listWatched(db as never, member, 1);
    const where = (db.forumThreadWatch.findMany.mock.calls[0]![0] as { where: object }).where;
    expect(where).toEqual({
      userId: "u1",
      thread: {
        hidden: false,
        category: { style: { not: "board" }, NOT: { scope: "realm", key: "board" } },
      },
    });
  });
});

describe("unreadWatchedCount", () => {
  it("counts the unread, readable watched threads since the floor", async () => {
    const floor = ago(30);
    const staff = category({ id: "cat_staff", key: "staff", visibility: "staff" });
    const db = listDb(
      [],
      [row("a"), row("b", { reads: [{ readAt: new Date() }] }), row("c", {}, staff)]
    );
    await expect(unreadWatchedCount(db as never, member, floor)).resolves.toBe(1);
    const where = (
      db.forumThreadWatch.findMany.mock.calls[0]![0] as {
        where: { thread: { lastPostAt: object } };
      }
    ).where;
    expect(where.thread.lastPostAt).toEqual({ gt: floor });
  });
});
