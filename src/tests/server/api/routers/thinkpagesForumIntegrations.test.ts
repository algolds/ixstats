/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));

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
  it("answers the viewer's realm panel", async () => {
    const out = await caller(member, withBoard().db).realmPanel();
    expect(out).toMatchObject({ realm: { slug: "eurth", name: "Eurth" } });
    expect(out!.messages.map((m) => m.id)).toEqual(["p3", "p2", "p1"]);
  });

  it("refuses the panel to a signed-out caller", async () => {
    await expect(caller(null, withBoard().db).realmPanel()).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
  });

  it("reads a realm's board preview for anyone, and null for a hidden or unknown realm", async () => {
    const store = withBoard();
    const out = await caller(null, store.db).realmBoardPreview({ slug: "eurth" });
    expect(out!.messages.map((m) => m.id)).toEqual(["p3", "p2", "p1"]);
    await expect(caller(null, store.db).realmBoardPreview({ slug: "draft" })).resolves.toBeNull();
    await expect(caller(member, store.db).realmBoardPreview({ slug: "nope" })).resolves.toBeNull();
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
