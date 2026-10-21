/** @jest-environment node */
import { getBoard } from "~/server/modules/thinkpages-forum/board";
import { boardMessagePayload } from "~/server/modules/thinkpages-forum/board-live";
import { reactToPost } from "~/server/modules/thinkpages-forum/reactions";
import { admin, member, plain, visitor } from "~/tests/helpers/forum-board-fake";
import { reactionStore } from "~/tests/helpers/forum-reaction-fixtures";

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
  it("says who may react: a member, not a reader who cannot post, and not anyone in an archived realm", async () => {
    const store = await reactedBoard();
    expect((await board(store, member)).canReact).toBe(true);
    expect((await board(store, null)).canReact).toBe(false);
    const archived = (viewer: object) =>
      getBoard(store.db as never, viewer as never, "old").then((out) => ({
        canPost: out.access.canPost,
        canReact: out.canReact,
      }));
    // A site admin may post in an archived realm, yet the server refuses their reactions there.
    expect(await archived(admin)).toEqual({ canPost: true, canReact: false });
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
});
