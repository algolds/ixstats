/** @jest-environment node */
import {
  applyReactionChange,
  isReactionType,
  readReactionCounts
} from "~/lib/thinkpages-forum/reactions";

describe("isReactionType", () => {
  it.each([
    ["sad, which has no icon", "sad"],
    ["a built-in in capitals", "LIKE"],
    ["a 33-letter Discord name", `discord:${"a".repeat(33)}`],
    ["a non-digit Discord id", "discord:name:abc"],
    ["the prototype key", "__proto__"],
    ["the constructor key", "constructor"],
  ])("rejects %s", (_label, type) => {
    expect(isReactionType(type)).toBe(false);
  });
});
describe("readReactionCounts", () => {
  it("drops zero, negative, fractional and non-number counts and unknown types", () => {
    expect(
      readReactionCounts({
        like: 0,
        fire: -1,
        laugh: 1.5,
        angry: "2",
        sad: 4,
        thumbsup: null,
        thumbsdown: 5,
      })
    ).toEqual({ thumbsdown: 5 });
  });
  it("never lets a prototype key through", () => {
    const parsed = readReactionCounts('{"__proto__":{"like":1},"constructor":2,"like":1}');
    expect(parsed).toEqual({ like: 1 });
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(({} as Record<string, number>).like).toBeUndefined();
  });
});
describe("applyReactionChange", () => {
  it("changes nothing when the type is the same, and never goes below zero", () => {
    expect(applyReactionChange({ like: 2 }, "like", "like")).toEqual({ like: 2 });
    expect(applyReactionChange({}, "like", null)).toEqual({});
  });

  it("never reads or writes a prototype key, as either side of the change", () => {
    for (const key of ["constructor", "__proto__"]) {
      expect(applyReactionChange({ like: 1 }, key, "fire")).toEqual({ like: 1, fire: 1 });
      expect(applyReactionChange({ like: 1 }, "like", key)).toEqual({});
      expect(applyReactionChange({}, key, key)).toEqual({});
      expect(Object.getPrototypeOf(applyReactionChange({}, null, key))).toBe(Object.prototype);
    }
  });
});
