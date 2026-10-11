/** @jest-environment node */
import { myReactionsOf, withReactions } from "~/server/modules/thinkpages-forum/reaction-attach";

const viewer = { id: "u1", clerkUserId: "clerk_1", countryId: null, role: null };
const db = (rows: Array<{ postId: string; type: string }> = []) => ({
  forumPostReaction: { findMany: jest.fn(async (_args: object) => rows) },
});

describe("myReactionsOf", () => {
  it("asks once for the viewer's reactions on all the posts", async () => {
    const fake = db([
      { postId: "p1", type: "fire" },
      { postId: "p3", type: "discord:pog" },
    ]);
    const mine = await myReactionsOf(fake as never, viewer, ["p1", "p2", "p3"]);
    expect(fake.forumPostReaction.findMany).toHaveBeenCalledTimes(1);
    expect(fake.forumPostReaction.findMany).toHaveBeenCalledWith({
      where: { userId: "u1", postId: { in: ["p1", "p2", "p3"] } },
      select: { postId: true, type: true },
    });
    expect([...mine]).toEqual([
      ["p1", "fire"],
      ["p3", "discord:pog"],
    ]);
  });

  it("asks nothing for a signed-out viewer or no posts", async () => {
    const fake = db();
    expect((await myReactionsOf(fake as never, null, ["p1"])).size).toBe(0);
    expect((await myReactionsOf(fake as never, viewer, [])).size).toBe(0);
    expect(fake.forumPostReaction.findMany).not.toHaveBeenCalled();
  });
});

describe("withReactions", () => {
  const rows = [
    { id: "p1", body: "a", reactionCounts: { fire: 2, like: 1 } },
    { id: "p2", body: "b", reactionCounts: {} },
    { id: "p3", body: "c", reactionCounts: "garbage" },
    { id: "p4", body: "d", reactionCounts: { like: -1, sad: 3 } },
  ];

  it("replaces the raw column with clean counts and the viewer's own reaction", async () => {
    const fake = db([{ postId: "p1", type: "fire" }]);
    const out = await withReactions(fake as never, viewer, rows);
    expect(out).toEqual([
      { id: "p1", body: "a", reactions: { fire: 2, like: 1 }, myReaction: "fire" },
      { id: "p2", body: "b", reactions: {}, myReaction: null },
      { id: "p3", body: "c", reactions: {}, myReaction: null },
      { id: "p4", body: "d", reactions: {}, myReaction: null },
    ]);
    expect(JSON.stringify(out)).not.toContain("reactionCounts");
  });

  it("gives a signed-out viewer the counts and no reaction of their own, without a query", async () => {
    const fake = db();
    const out = await withReactions(fake as never, null, rows);
    expect(out.map((row) => row.myReaction)).toEqual([null, null, null, null]);
    expect(out[0]!.reactions).toEqual({ fire: 2, like: 1 });
    expect(fake.forumPostReaction.findMany).not.toHaveBeenCalled();
  });

  it("reads a row with no counts at all as none", async () => {
    const out = await withReactions(db() as never, null, [{ id: "p9", reactionCounts: null }]);
    expect(out).toEqual([{ id: "p9", reactions: {}, myReaction: null }]);
  });
});
