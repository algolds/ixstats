/** @jest-environment node */
import { forumNavCounts } from "~/server/modules/thinkpages-forum/nav-counts";
import { PREVIEWED_BOARD_MESSAGES } from "~/server/modules/thinkpages-forum/board-thread";
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
function navDb(over: { nations?: object[]; boardPosts?: number; boardRead?: Date | null } = {}) {
  const tables = engagementTables();
  tables.forumThreadRead.findUnique.mockResolvedValue(
    over.boardRead ? { readAt: over.boardRead } : null
  );
  return {
    ...tables,
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
  it("gives a member with no realm no board count", async () => {
    await expect(forumNavCounts(navDb() as never, member)).resolves.toEqual({ realmBoardNew: 0 });
  });

  it("counts the realm board's new messages since the member last read it, not their own", async () => {
    const read = ago(2);
    const db = navDb({
      nations: [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 5 }],
      boardPosts: 4,
      boardRead: read,
    });
    const out = await forumNavCounts(db as never, member);
    expect(out).toEqual({ realmBoardNew: 4 });
    expect(db.forumPost.count).toHaveBeenCalledWith({
      where: {
        threadId: "t_board",
        hidden: false,
        continuedThreadId: null,
        createdAt: { gt: read },
        OR: [{ authorUserId: null }, { authorUserId: { not: "u1" } }],
      },
    });
  });

  it("counts what the Home panel's list can show: no hidden message and no continued placeholder", async () => {
    const db = navDb({
      nations: [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 5 }],
      boardPosts: 1,
    });
    await forumNavCounts(db as never, member);
    const [[query]] = db.forumPost.count.mock.calls as never as [[{ where: object }]];
    expect(query.where).toMatchObject(PREVIEWED_BOARD_MESSAGES);
    expect(PREVIEWED_BOARD_MESSAGES).toEqual({ hidden: false, continuedThreadId: null });
  });

  it("clamps the count at 100 for the sidebar's 99+", async () => {
    const db = navDb({
      nations: [{ id: "c1", realmId: "r_eurth", currentTotalGdp: 5 }],
      boardPosts: 400,
    });
    await expect(forumNavCounts(db as never, member)).resolves.toEqual({ realmBoardNew: 100 });
  });
});
