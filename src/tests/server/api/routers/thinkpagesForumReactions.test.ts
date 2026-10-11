/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
const mockBroadcaster = { broadcastBoard: jest.fn(), broadcastMessage: jest.fn() };
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: () => mockBroadcaster,
}));
jest.mock("~/server/modules/thinkpages-forum/reaction-notify", () => ({
  notifyReaction: jest.fn(async () => undefined),
}));

import { createCallerFactory } from "~/server/api/trpc/init";
import { thinkpagesForumRouter } from "~/server/api/routers/thinkpagesForum";
import { notifyReaction } from "~/server/modules/thinkpages-forum/reaction-notify";
import { member, member2, plain } from "~/tests/helpers/forum-board-fake";
import { reactionStore } from "~/tests/helpers/forum-reaction-fixtures";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const caller = (user: object | null, db: object) =>
  createCallerFactory(thinkpagesForumRouter)(
    createMockRouterContext({
      auth: user ? { userId: (user as { clerkUserId: string }).clerkUserId } : null,
      user: user as never,
      db,
    }) as never
  );

/** The publish and the notice hook after a write are not awaited by the procedure: let them finish. */
const flush = () => new Promise((resolve) => setImmediate(resolve));
const sentEvents = () => mockBroadcaster.broadcastBoard.mock.calls.map(([event]) => event);
const notified = jest.mocked(notifyReaction);

describe("thinkpagesForum reaction procedures", () => {
  beforeEach(() => {
    for (const level of ["log", "info", "warn"] as const)
      jest.spyOn(console, level).mockImplementation(() => undefined);
    mockBroadcaster.broadcastBoard.mockClear();
    notified.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("reacts to a thread post, tells its owner and publishes nothing to a board room", async () => {
    const store = reactionStore();
    const out = await caller(member, store.db).react({ postId: "p_hub", type: "like" });
    expect(out).toEqual({ counts: { like: 1 }, mine: "like" });
    await flush();
    expect(notified).toHaveBeenCalledWith(
      store.db,
      expect.objectContaining({ id: "u_member", clerkUserId: "clerk_u_member" }),
      { postId: "p_hub" }
    );
    expect(sentEvents()).toEqual([]);
  });

  it("publishes a reacted-to board message to its room, in the public shape", async () => {
    const store = reactionStore();
    await caller(member, store.db).react({ postId: "b1", type: "fire" });
    await flush();
    expect(sentEvents()).toEqual([
      {
        type: "board:updated",
        realmId: "r_eurth",
        change: { type: "updated", message: expect.objectContaining({ id: "b1" }) },
      },
    ]);
    expect(JSON.stringify(sentEvents())).not.toContain("myReaction");
  });

  it("asks for a notice only for a new reaction: repeating or switching asks for none", async () => {
    const store = reactionStore();
    const c = caller(member, store.db);
    await c.react({ postId: "p_hub", type: "like" });
    await c.react({ postId: "p_hub", type: "like" });
    await c.react({ postId: "p_hub", type: "fire" });
    expect(notified).toHaveBeenCalledTimes(1);
    expect(store.reactions).toHaveLength(1);
  });

  it("asks again after a toggle off and on: the notice's own dedupe key keeps it to one", async () => {
    const store = reactionStore();
    const c = caller(member, store.db);
    await c.react({ postId: "p_hub", type: "like" });
    await c.unreact({ postId: "p_hub" });
    await c.react({ postId: "p_hub", type: "like" });
    expect(notified).toHaveBeenCalledTimes(2);
    expect(notified).toHaveBeenLastCalledWith(store.db, expect.anything(), { postId: "p_hub" });
  });

  it("is not failed by a notice hook that rejects, and logs it", async () => {
    const store = reactionStore();
    const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
    notified.mockRejectedValueOnce(new Error("hook down"));
    await expect(
      caller(member, store.db).react({ postId: "p_hub", type: "like" })
    ).resolves.toEqual({ counts: { like: 1 }, mine: "like" });
    await flush();
    expect(errors).toHaveBeenCalledWith("[thinkpages-forum] Write hook failed:", expect.any(Error));
  });

  it("takes a reaction back, and publishes the board's new counts", async () => {
    const store = reactionStore();
    const c = caller(member, store.db);
    await c.react({ postId: "b1", type: "like" });
    await flush();
    mockBroadcaster.broadcastBoard.mockClear();
    expect(await c.unreact({ postId: "b1" })).toEqual({ counts: {}, mine: null });
    await flush();
    expect(sentEvents()).toEqual([
      {
        type: "board:updated",
        realmId: "r_eurth",
        change: { type: "updated", message: expect.objectContaining({ id: "b1" }) },
      },
    ]);
  });

  it("maps refusals to TRPC errors and writes nothing", async () => {
    const store = reactionStore();
    await expect(
      caller(member, store.db).react({ postId: "p_mine", type: "like" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(member, store.db).react({ postId: "p_locked", type: "like" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      caller(member, store.db).react({ postId: "p_hidden", type: "like" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.reactions).toHaveLength(0);
    expect(notified).not.toHaveBeenCalled();
    await flush();
    expect(sentEvents()).toEqual([]);
  });

  it("refuses signed-out writes and bounds its inputs", async () => {
    const store = reactionStore();
    await expect(
      caller(null, store.db).react({ postId: "p_hub", type: "like" })
    ).rejects.toMatchObject({ cause: { code: "UNAUTHORIZED" } });
    for (const input of [
      { postId: "p_hub", type: "sad" },
      { postId: "p_hub", type: "discord:" },
      { postId: "p_hub", type: "x".repeat(300) },
      { postId: "p".repeat(65), type: "like" },
      { postId: "", type: "like" },
    ]) {
      await expect(caller(member, store.db).react(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    await expect(caller(member, store.db).unreact({ postId: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lists reactors for anyone who can read the post, signed out included", async () => {
    const store = reactionStore();
    await caller(member, store.db).react({ postId: "b1", type: "like" });
    await caller(plain, store.db).react({ postId: "b1", type: "like" });
    const out = await caller(null, store.db).reactors({ postId: "b1" });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0]).toMatchObject({ type: "like", count: 2 });
    expect(out.groups[0]!.reactors.map((r) => r.handle).sort()).toEqual(["member", "plain"]);
    await expect(
      caller(member2, store.db).reactors({ postId: "b1", type: "sad" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(null, store.db).reactors({ postId: "p_hidden" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
