/** @jest-environment node */
import type { BoardLiveEvent } from "~/lib/thinkpages-forum/board-live";
import { getBoard } from "~/server/modules/thinkpages-forum/board";
import {
  boardMessagePayload,
  publishBoardPost,
} from "~/server/modules/thinkpages-forum/board-live";
import { reactToPost } from "~/server/modules/thinkpages-forum/reactions";
import { member, plain, visitor } from "~/tests/helpers/forum-board-fake";
import { reactionStore } from "~/tests/helpers/forum-reaction-fixtures";

const broadcaster = () => ({ broadcastBoard: jest.fn<void, [BoardLiveEvent]>() });

/** b1 has two likes (u_member, u_visitor) and a fire (u_plain). */
async function reactedBoard() {
  const store = reactionStore();
  for (const [viewer, type] of [
    [member, "like"],
    [visitor, "like"],
    [plain, "fire"],
  ] as const) {
    await reactToPost(store.db as never, viewer as never, { postId: "b1", type });
  }
  store.reactionDb.findMany.mockClear();
  return store;
}

const board = (store: Awaited<ReturnType<typeof reactedBoard>>, viewer: object | null) =>
  getBoard(store.db as never, viewer as never, "eurth");
const messageOf = (out: Awaited<ReturnType<typeof getBoard>>, id: string) =>
  out.messages.find((m) => m.id === id)!;

describe("board reads with reactions", () => {
  it("gives each message its counts and the viewer's own reaction from one query", async () => {
    const store = await reactedBoard();
    const out = await board(store, member);
    expect(messageOf(out, "b1")).toMatchObject({
      reactions: { like: 2, fire: 1 },
      myReaction: "like",
    });
    expect(messageOf(out, "b_mine")).toMatchObject({ reactions: {}, myReaction: null });
    expect(store.reactionDb.findMany).toHaveBeenCalledTimes(1);
    expect(store.reactionDb.findMany).toHaveBeenCalledWith({
      where: { userId: "u_member", postId: { in: expect.arrayContaining(["b1", "b_mine"]) } },
      select: { postId: true, type: true },
    });
  });

  it("gives a signed-out reader the counts and no reaction of their own, without a query", async () => {
    const store = await reactedBoard();
    const out = await board(store, null);
    expect(messageOf(out, "b1")).toMatchObject({
      reactions: { like: 2, fire: 1 },
      myReaction: null,
    });
    expect(store.reactionDb.findMany).not.toHaveBeenCalled();
  });

  it("reads a corrupt counts column as no reactions", async () => {
    const store = await reactedBoard();
    store.state.posts.find((p) => p.id === "b1")!.reactionCounts = "garbage";
    expect(messageOf(await board(store, null), "b1").reactions).toEqual({});
    store.state.posts.find((p) => p.id === "b1")!.reactionCounts = {
      like: -2,
      sad: 1,
      fire: 0.5,
    };
    expect(messageOf(await board(store, null), "b1").reactions).toEqual({});
  });
});

describe("the live board payload", () => {
  it("carries the counts and never the viewer's own reaction", async () => {
    const store = await reactedBoard();
    const message = messageOf(await board(store, member), "b1");
    expect(message.myReaction).toBe("like");
    const change = boardMessagePayload(message);
    expect(change).toMatchObject({
      type: "updated",
      message: { id: "b1", reactions: { like: 2, fire: 1 } },
    });
    expect(JSON.stringify(change)).not.toContain("myReaction");
  });

  it("publishes the new counts after a reaction, read as an anonymous reader would see them", async () => {
    const store = await reactedBoard();
    const out = broadcaster();
    await publishBoardPost(store.db as never, out, "b1", "updated");
    expect(out.broadcastBoard).toHaveBeenCalledWith({
      type: "board:updated",
      realmId: "r_eurth",
      change: {
        type: "updated",
        message: expect.objectContaining({ id: "b1", reactions: { like: 2, fire: 1 } }),
      },
    });
    expect(JSON.stringify(out.broadcastBoard.mock.calls)).not.toContain("myReaction");
    expect(store.reactionDb.findMany).not.toHaveBeenCalled();
  });
});
