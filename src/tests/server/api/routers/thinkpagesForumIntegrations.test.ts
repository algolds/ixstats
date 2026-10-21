/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

import { rateLimiter } from "~/lib/cache";
import { createCallerFactory } from "~/server/api/trpc";
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
  boardStore(seed({ posts: [boardPost("p1", 1), boardPost("p2", 2), boardPost("p3", 3)] }));

describe("thinkpagesForum integrations", () => {
  afterEach(() => jest.restoreAllMocks());

  it("rate limits both reads: the public one on the public bucket, the panel on the read-only bucket", async () => {
    jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
    const check = jest
      .spyOn(rateLimiter, "check")
      .mockResolvedValue({ success: true, remaining: 100, resetAt: new Date() });
    const store = withBoard();
    await caller(null, store.db).realmBoardPreview({ slug: "eurth" });
    expect(check).toHaveBeenLastCalledWith(expect.any(String), "public", {
      maxRequests: 100,
      windowMs: 60000,
    });
    await caller(member, store.db).realmPanel();
    expect(check).toHaveBeenLastCalledWith(expect.any(String), "queries", {
      maxRequests: 120,
      windowMs: 60000,
    });
  });
  it("refuses the panel to a signed-out caller", async () => {
    await expect(caller(null, withBoard().db).realmPanel()).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
  });
  it("bounds the slug", async () => {
    const store = withBoard();
    await expect(caller(null, store.db).realmBoardPreview({ slug: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller(null, store.db).realmBoardPreview({ slug: "x".repeat(101) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
