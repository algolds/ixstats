/** @jest-environment node */
import {
  chooseReaction,
  patchBoard,
  patchThread,
  readBoard,
  readThread,
  settledReaction,
} from "~/components/thinkpages-forum/reactions/reaction-cache";

const row = (
  id: string,
  reactions: Record<string, number> = {},
  myReaction: string | null = null
) => ({
  id,
  reactions,
  myReaction,
  contentHtml: `<p>${id}</p>`,
});
const thread = (...posts: object[]) =>
  ({ thread: { id: "t1" }, posts, total: posts.length }) as never;
const board = (...messages: object[]) =>
  ({ realm: { id: "r1" }, messages, hasMore: false }) as never;

describe("chooseReaction", () => {
  it("adds, switches and removes a reaction in the counts and in mine", () => {
    expect(chooseReaction("fire")({ counts: { like: 1 }, mine: null })).toEqual({
      counts: { like: 1, fire: 1 },
      mine: "fire",
    });
    expect(chooseReaction("like")({ counts: { fire: 2 }, mine: "fire" })).toEqual({
      counts: { fire: 1, like: 1 },
      mine: "like",
    });
    expect(chooseReaction(null)({ counts: { fire: 1 }, mine: "fire" })).toEqual({
      counts: {},
      mine: null,
    });
  });
});

describe("settledReaction", () => {
  it("replaces the counts and mine with the server's", () => {
    expect(settledReaction({ like: 4 }, "like")({ counts: { fire: 1 }, mine: "fire" })).toEqual({
      counts: { like: 4 },
      mine: "like",
    });
  });
});

describe("patchThread and patchBoard", () => {
  it("patches only the named post and keeps the other posts by reference", () => {
    const other = row("p2", { fire: 1 });
    const page = thread(row("p1", { like: 1 }), other);
    const next = patchThread(page, "p1", chooseReaction("fire"))!;
    expect(next.posts[0]).toMatchObject({
      id: "p1",
      reactions: { like: 1, fire: 1 },
      myReaction: "fire",
    });
    expect(next.posts[0]).toHaveProperty("contentHtml", "<p>p1</p>");
    expect(next.posts[1]).toBe(other);
    expect(next).not.toBe(page);
  });

  it("returns the same page when the post is not on it, and passes undefined through", () => {
    const page = thread(row("p1"));
    expect(patchThread(page, "nope", chooseReaction("fire"))).toBe(page);
    expect(patchThread(undefined, "p1", chooseReaction("fire"))).toBeUndefined();
  });

  it("patches a board page's messages the same way", () => {
    const page = board(row("b1", { like: 2 }, "like"), row("b2"));
    const next = patchBoard(page, "b1", chooseReaction(null))!;
    expect(next.messages[0]).toMatchObject({ reactions: { like: 1 }, myReaction: null });
    expect(patchBoard(page, "nope", chooseReaction(null))).toBe(page);
    expect(patchBoard(undefined, "b1", chooseReaction(null))).toBeUndefined();
  });
});

describe("readThread and readBoard", () => {
  it("reads a post's counts and mine, or null when it is not there", () => {
    expect(readThread(thread(row("p1", { fire: 1 }, "fire")), "p1")).toEqual({
      counts: { fire: 1 },
      mine: "fire",
    });
    expect(readThread(thread(row("p1")), "p9")).toBeNull();
    expect(readThread(undefined, "p1")).toBeNull();
    expect(readBoard(board(row("b1", { like: 1 })), "b1")).toEqual({
      counts: { like: 1 },
      mine: null,
    });
    expect(readBoard(undefined, "b1")).toBeNull();
  });
});
