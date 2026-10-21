/** @jest-environment node */
import {
  applyReactionChange,
  countsFromGroups,
  isReactionType,
  readReactionCounts,
  REACTION_TYPE_MAX,
} from "~/lib/thinkpages-forum/reactions";

describe("isReactionType", () => {
  it.each([
    ["an empty string", ""],
    ["sad, which has no icon", "sad"],
    ["a built-in in capitals", "LIKE"],
    ["a padded built-in", " like"],
    ["a built-in with a trailing newline", "like\n"],
    ["a Discord type with no name", "discord:"],
    ["a one-letter Discord name", "discord:a"],
    ["a 33-letter Discord name", `discord:${"a".repeat(33)}`],
    ["a dash in the Discord name", "discord:no-dash"],
    ["a space in the Discord name", "discord:no space"],
    ["a non-digit Discord id", "discord:name:abc"],
    ["an empty Discord id", "discord:name:"],
    ["two Discord ids", "discord:name:1:2"],
    ["a 26-digit Discord id", `discord:name:${"1".repeat(26)}`],
    ["a capitalised prefix", "Discord:name"],
    ["a trailing newline after a Discord name", "discord:name\n"],
    ["the prototype key", "__proto__"],
    ["the constructor key", "constructor"],
  ])("rejects %s", (_label, type) => {
    expect(isReactionType(type)).toBe(false);
  });

  it("allows for the longest valid Discord type", () => {
    expect(REACTION_TYPE_MAX).toBeGreaterThanOrEqual(
      `discord:${"a".repeat(32)}:${"1".repeat(25)}`.length
    );
  });
});
describe("readReactionCounts", () => {
  it("drops a count above the safe-integer limit", () => {
    expect(
      readReactionCounts({
        like: Number.MAX_SAFE_INTEGER + 2,
        fire: Number.MAX_SAFE_INTEGER,
        laugh: 1,
      })
    ).toEqual({
      fire: Number.MAX_SAFE_INTEGER,
      laugh: 1,
    });
  });

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

describe("countsFromGroups", () => {
  it("builds the map from grouped rows and drops what is not a valid positive count", () => {
    expect(
      countsFromGroups([
        { type: "like", count: 2 },
        { type: "fire", count: 0 },
        { type: "sad", count: 3 },
        { type: "discord:pog", count: 1 },
      ])
    ).toEqual({ like: 2, "discord:pog": 1 });
    expect(countsFromGroups([])).toEqual({});
  });
});

describe("applyReactionChange", () => {
  it("switches one reaction for another, removing a type that reaches zero", () => {
    expect(applyReactionChange({ fire: 1, like: 2 }, "fire", "like")).toEqual({ like: 3 });
    expect(applyReactionChange({ fire: 2 }, "fire", "like")).toEqual({ fire: 1, like: 1 });
  });
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
