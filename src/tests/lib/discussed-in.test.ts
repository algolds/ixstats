/** @jest-environment node */
import { countedPostId, discussedLabel, othersOf, placeLine } from "~/lib/discussed-in";

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

describe("discussedLabel", () => {
  it.each([
    [1, false, "Discussed in 1 post"],
    [3, false, "Discussed in 3 posts"],
    [1, true, "Also discussed in 1 other post"],
    [4, true, "Also discussed in 4 other posts"],
  ])("labels %s (others: %s) as %j", (count, others, expected) => {
    expect(discussedLabel(count, others)).toBe(expected);
  });
});

describe("placeLine", () => {
  const ann = { name: "ann" };
  it("names the category and realm of a thread post", () => {
    expect(
      placeLine({ kind: "thread", author: ann, categoryName: "General", realmName: null })
    ).toBe("ann in General");
    expect(
      placeLine({ kind: "thread", author: ann, categoryName: "Hub", realmName: "Eurth" })
    ).toBe("ann in Hub, Eurth");
  });

  it("puts a board message on the board", () => {
    expect(placeLine({ kind: "board", author: ann, categoryName: null, realmName: "Eurth" })).toBe(
      "ann on the Eurth board"
    );
  });

  it("falls back to the author alone", () => {
    expect(placeLine({ kind: "thread", author: ann, categoryName: null, realmName: null })).toBe(
      "ann"
    );
  });
});

describe("countedPostId", () => {
  it("names the post, except a persona's, which the server never counts", () => {
    expect(countedPostId({ id: "p1", persona: false })).toBe("p1");
    expect(countedPostId({ id: "p1", persona: true })).toBeUndefined();
  });
});
