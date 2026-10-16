/** @jest-environment node */
import { unreadWatchedCount } from "~/server/modules/thinkpages-forum/thread-listing";
import { advertGate } from "~/server/modules/thinkpages-forum/advert-access";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
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

function listDb(watched: object[] = []) {
  const tables = engagementTables();
  return {
    ...tables,
    forumThreadWatch: {
      ...tables.forumThreadWatch,
      findMany: jest.fn(async (_args?: object) => watched.map((thread) => ({ thread }))),
    },
    realm: {
      // The realms of the watched threads come by id; the other read lists the unpublished ones.
      findMany: jest.fn(async (args?: { where?: { id?: { in?: string[] } } }) => {
        const wanted = args?.where?.id?.in;
        return wanted ? [EURTH, DRAFT].filter((r) => wanted.includes(r.id)) : [{ id: "r_draft" }];
      }),
      findUnique: jest.fn(async ({ where }: { where: { id?: string } }) =>
        where.id === "r_eurth" ? EURTH : where.id === "r_draft" ? DRAFT : null
      ),
    },
  };
}

describe("unreadWatchedCount", () => {
  it("counts the unread, readable watched threads since the floor", async () => {
    const floor = ago(30);
    const staff = category({ id: "cat_staff", key: "staff", visibility: "staff" });
    const db = listDb([
      row("a"),
      row("b", { reads: [{ readAt: new Date() }] }),
      row("c", {}, staff),
    ]);
    await expect(unreadWatchedCount(db as never, member, floor)).resolves.toBe(1);
    const [[query]] = db.forumThreadWatch.findMany.mock.calls as never as [
      [{ where: { thread: { lastPostAt: object } } }],
    ];
    expect(query.where.thread.lastPostAt).toEqual({ gt: floor });
  });

  it("asks only for the member's watches outside the realm board, quietest dropped first", async () => {
    const floor = ago(30);
    const db = listDb();
    await unreadWatchedCount(db as never, member, floor);
    const [[query]] = db.forumThreadWatch.findMany.mock.calls as never as [
      [{ where: object; orderBy: object; take: number }],
    ];
    expect(query.where).toEqual({
      userId: "u1",
      thread: {
        hidden: false,
        ...advertGate(member),
        OR: [{ category: { visibility: { not: "reporter_staff" } } }, { authorUserId: "u1" }],
        category: {
          style: { not: "board" },
          NOT: { scope: "realm", key: "board" },
          AND: [{ NOT: { scope: "realm", realmId: { in: ["r_draft"] } } }],
        },
        lastPostAt: { gt: floor },
      },
    });
    expect(query.orderBy).toEqual({ thread: { lastPostAt: "desc" } });
    expect(query.take).toBe(500);
  });

  it("does not count what the member cannot read: a draft realm, a staff board, another member's report, the board", async () => {
    const staff = category({ id: "cat_staff", key: "staff", visibility: "staff" });
    const reports = category({ id: "cat_reports", key: "reports", visibility: "reporter_staff" });
    const draft = category({ id: "cat_draft", scope: "realm", realmId: "r_draft", key: "hub" });
    const board = category({
      id: "cat_board",
      scope: "realm",
      realmId: "r_eurth",
      key: "board",
      style: "board",
    });
    const db = listDb([
      row("ok"),
      row("s", {}, staff),
      row("r_other", { authorUserId: "u9" }, reports),
      row("r_mine", { authorUserId: "u1" }, reports),
      row("d", {}, draft),
      row("b", {}, board),
      row("hidden", { hidden: true }),
    ]);
    await expect(unreadWatchedCount(db as never, member, ago(30))).resolves.toBe(2);
  });

  it("leaves a hidden realm's advert out, and its founder still counts it", async () => {
    const find = category({ id: "cat_find", key: "find-a-realm" });
    const look = { thumbnail: "/t.png", emblemUrl: "/e.png" };
    const threads = () => [
      row("hidden_ad", { advertRealm: { ...DRAFT, ...look } }, find),
      row("shown_ad", { advertRealm: { ...EURTH, ...look } }, find),
      row("plain"),
    ];
    await expect(unreadWatchedCount(listDb(threads()) as never, member, ago(30))).resolves.toBe(2);
    const founder = { ...member, id: "u_founder", clerkUserId: "founder" };
    await expect(unreadWatchedCount(listDb(threads()) as never, founder, ago(30))).resolves.toBe(3);
  });
});
