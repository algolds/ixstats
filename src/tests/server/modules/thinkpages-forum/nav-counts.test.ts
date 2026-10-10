/** @jest-environment node */
import { forumNavCounts } from "~/server/modules/thinkpages-forum/nav-counts";
import { engagementTables } from "~/tests/helpers/forum-engagement-fake";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const member = {
  id: "u1",
  clerkUserId: "clerk_1",
  countryId: null,
  role: { name: "user", level: 100 },
};
const EURTH = { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" };
const general = {
  id: "cat_general",
  key: "general",
  name: "General",
  style: "ooc",
  scope: "site",
  realmId: null,
  visibility: "public",
};
const watched = (id: string) => ({
  id,
  title: id,
  authorUserId: "u2",
  authorPersonaId: null,
  importedAuthorName: null,
  xenforoThreadId: null,
  pinned: false,
  locked: false,
  hidden: false,
  postCount: 2,
  lastPostAt: ago(1),
  category: general,
  reads: [],
});

function navDb(
  over: { nations?: object[]; boardPosts?: number; boardRead?: Date | null; watches?: number } = {}
) {
  const tables = engagementTables();
  tables.forumThreadRead.findUnique.mockResolvedValue(
    over.boardRead ? { readAt: over.boardRead } : null
  );
  return {
    ...tables,
    forumThreadWatch: {
      ...tables.forumThreadWatch,
      findMany: jest.fn(async () =>
        Array.from({ length: over.watches ?? 2 }, (_, i) => ({ thread: watched(`w${i}`) }))
      ),
    },
    country: { findMany: jest.fn(async () => over.nations ?? []) },
    realm: { findUnique: jest.fn(async () => EURTH), findMany: jest.fn(async () => []) },
    forumThread: { findFirst: jest.fn(async () => ({ id: "t_board", categoryId: "cat_board" })) },
    forumPost: {
      count: jest.fn(async () => over.boardPosts ?? 0),
      findMany: jest.fn(async () => []),
    },
  };
}

describe("forumNavCounts", () => {
  it("counts unread watched threads, and gives a member with no realm no board count", async () => {
    await expect(forumNavCounts(navDb() as never, member)).resolves.toEqual({
      watchedUnread: 2,
      realmBoardNew: 0,
    });
  });

  it("counts the realm board's new messages since the member last read it, not their own", async () => {
    const read = ago(2);
    const db = navDb({
      nations: [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 5 }],
      boardPosts: 4,
      boardRead: read,
    });
    const out = await forumNavCounts(db as never, member);
    expect(out).toEqual({ watchedUnread: 2, realmBoardNew: 4 });
    expect(db.forumPost.count).toHaveBeenCalledWith({
      where: {
        threadId: "t_board",
        hidden: false,
        createdAt: { gt: read },
        OR: [{ authorUserId: null }, { authorUserId: { not: "u1" } }],
      },
    });
  });

  it("clamps both counts at 100 for the sidebar's 99+", async () => {
    const db = navDb({
      nations: [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 5 }],
      boardPosts: 400,
      watches: 150,
    });
    await expect(forumNavCounts(db as never, member)).resolves.toEqual({
      watchedUnread: 100,
      realmBoardNew: 100,
    });
  });
});
