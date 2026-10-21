/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
const mockBroadcaster = { broadcastBoard: jest.fn(), broadcastMessage: jest.fn() };
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: () => mockBroadcaster,
}));

jest.mock("~/server/modules/thinkpages-forum/after-write", () => ({
  afterThreadStarted: jest.fn(async () => undefined),
  afterReply: jest.fn(async () => undefined),
  afterEdit: jest.fn(async () => undefined),
  afterBoardMessage: jest.fn(async () => undefined),
  afterReaction: jest.fn(async () => undefined),
}));

import { createCallerFactory } from "~/server/api/trpc/init";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { boardPost, boardStore, member, seed } from "~/tests/helpers/forum-board-fake";

const caller = (user: object | null, db: object) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: (user as { clerkUserId: string }).clerkUserId } : null,
      user: user as never,
      db,
    }) as never
  );
const withBoard = () =>
  boardStore(seed({ posts: [boardPost("p1", 1), boardPost("p2", 2, { createdAt: new Date() })] }));

describe("thinkpagesForum board procedures", () => {
  beforeEach(() => {
    // The audit middleware logs every mutation and the auth middleware warns on anonymous calls.
    for (const level of ["log", "info", "warn"] as const)
      jest.spyOn(console, level).mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => mockBroadcaster.broadcastBoard.mockClear());
  it("reads a hidden realm as not found and bounds its inputs", async () => {
    const store = withBoard();
    await expect(caller(member, store.db).getBoard({ realm: "draft" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      caller(null, store.db).getBoard({ realm: "eurth", limit: 101 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
  it("maps refusals to TRPC errors", async () => {
    const store = withBoard();
    await expect(
      caller(member, store.db).updateBoardSettings({ realmId: "r_eurth", slowModeSeconds: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(member, store.db).updateBoardSettings({ realmId: "r_eurth", slowModeSeconds: 45 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(member, store.db).postBoardMessage({
        realm: "eurth",
        html: `<p>${"a".repeat(1001)}</p>`,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses signed-out writes", async () => {
    const store = withBoard();
    await expect(
      caller(null, store.db).postBoardMessage({ realm: "eurth", html: "<p>hi</p>" })
    ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
  });
});
