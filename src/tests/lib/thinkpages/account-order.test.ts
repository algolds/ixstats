import { mergeVisibleOrder, moveId, orderByIds } from "~/lib/thinkpages/account-order";

const items = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("orderByIds", () => {
  it("follows the given ids and puts unlisted items last, in their own order", () => {
    expect(orderByIds(items, ["c", "a"]).map((i) => i.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("keeps the items as they are when there is no override", () => {
    expect(orderByIds(items, null).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("mergeVisibleOrder", () => {
  it("reorders the visible ids inside the slots they hold, leaving hidden ones in place", () => {
    expect(mergeVisibleOrder(["a", "x", "b", "y", "c"], ["c", "a", "b"])).toEqual([
      "c",
      "x",
      "a",
      "y",
      "b",
    ]);
  });
});

describe("moveId", () => {
  it("moves one place up or down", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("stops at the ends and ignores an unknown id", () => {
    expect(moveId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
});
