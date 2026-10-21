/** @jest-environment node */
import { countedPostId, othersOf } from "~/lib/discussed-in";

describe("othersOf", () => {
  it("is the tally itself outside a post", () => {
    const tally = { count: 3, postIds: ["p1", "p2"] };
    expect(othersOf(tally)).toBe(tally);
  });

  it("removes the current post when it is one of the listed ones", () => {
    expect(othersOf({ count: 2, postIds: ["p1", "p2"] }, "p1")).toEqual({
      count: 1,
      postIds: ["p2"],
    });
    expect(othersOf({ count: 1, postIds: ["p1"] }, "p1")).toEqual({ count: 0, postIds: [] });
  });

  it("assumes a saved post is linked when more posts exist than are listed", () => {
    expect(othersOf({ count: 5, postIds: ["p1", "p2"] }, "p9")).toEqual({
      count: 4,
      postIds: ["p1", "p2"],
    });
  });

  it("leaves the count alone when every linking post is listed and the current one is not among them", () => {
    expect(othersOf({ count: 2, postIds: ["p1", "p2"] }, "p9")).toEqual({
      count: 2,
      postIds: ["p1", "p2"],
    });
    expect(othersOf({ count: 0, postIds: [] }, "p9")).toEqual({ count: 0, postIds: [] });
  });

  it("never goes negative", () => {
    expect(othersOf({ count: 0, postIds: [] }, "p1").count).toBe(0);
  });
});
describe("countedPostId", () => {
  it("names the post, except a persona's, which the server never counts", () => {
    expect(countedPostId({ id: "p1", persona: false })).toBe("p1");
    expect(countedPostId({ id: "p1", persona: true })).toBeUndefined();
  });
});
