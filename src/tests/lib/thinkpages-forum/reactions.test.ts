/** @jest-environment node */
import {
  applyReactionChange,
  countsFromGroups,
  discordReaction,
  isReactionType,
  readReactionCounts,
  reactionLabel,
  reactionTotal,
  REACTION_TYPE_MAX,
  sortedReactionTypes,
} from "~/lib/thinkpages-forum/reactions";

describe("isReactionType", () => {
  it.each([
    "like",
    "laugh",
    "angry",
    "fire",
    "thumbsup",
    "thumbsdown",
    "discord:ixnay",
    "discord:heky_boi",
    "discord:pog:739969522139209748",
    "discord:ab",
    "discord:A1_b2",
    `discord:${"a".repeat(32)}:${"1".repeat(25)}`,
  ])("accepts %s", (type) => {
    expect(isReactionType(type)).toBe(true);
  });

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

describe("discordReaction and reactionLabel", () => {
  it("splits a Discord type into its name and optional id", () => {
    expect(discordReaction("discord:pog")).toEqual({ name: "pog", id: null });
    expect(discordReaction("discord:pog:739969522139209748")).toEqual({
      name: "pog",
      id: "739969522139209748",
    });
    expect(discordReaction("like")).toBeNull();
    expect(discordReaction("discord:")).toBeNull();
  });

  it("labels a Discord type as :name: and a built-in as itself", () => {
    expect(reactionLabel("discord:pog:1234")).toBe(":pog:");
    expect(reactionLabel("fire")).toBe("fire");
  });
});

describe("readReactionCounts", () => {
  it("keeps valid types with positive integer counts", () => {
    expect(readReactionCounts({ like: 2, fire: 1, "discord:pog": 3 })).toEqual({
      like: 2,
      fire: 1,
      "discord:pog": 3,
    });
  });

  it("reads a JSON string as its object", () => {
    expect(readReactionCounts('{"like":2}')).toEqual({ like: 2 });
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

  it("reads anything that is not an object as no reactions", () => {
    for (const raw of [null, undefined, 7, true, "not json", "[1,2]", '"like"', [1, 2], ["like"]]) {
      expect(readReactionCounts(raw)).toEqual({});
    }
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
  it("adds a first reaction", () => {
    expect(applyReactionChange({}, null, "like")).toEqual({ like: 1 });
    expect(applyReactionChange({ like: 1 }, null, "fire")).toEqual({ like: 1, fire: 1 });
  });

  it("switches one reaction for another, removing a type that reaches zero", () => {
    expect(applyReactionChange({ fire: 1, like: 2 }, "fire", "like")).toEqual({ like: 3 });
    expect(applyReactionChange({ fire: 2 }, "fire", "like")).toEqual({ fire: 1, like: 1 });
  });

  it("removes a reaction", () => {
    expect(applyReactionChange({ fire: 1 }, "fire", null)).toEqual({});
    expect(applyReactionChange({ fire: 3 }, "fire", null)).toEqual({ fire: 2 });
  });

  it("changes nothing when the type is the same, and never goes below zero", () => {
    expect(applyReactionChange({ like: 2 }, "like", "like")).toEqual({ like: 2 });
    expect(applyReactionChange({}, "like", null)).toEqual({});
  });

  it("returns a new object and leaves its input alone", () => {
    const before = { like: 1 };
    const after = applyReactionChange(before, "like", "fire");
    expect(before).toEqual({ like: 1 });
    expect(after).not.toBe(before);
  });
});

describe("sortedReactionTypes and reactionTotal", () => {
  it("orders by count, highest first, then by type", () => {
    expect(sortedReactionTypes({ like: 1, fire: 3, angry: 1, "discord:pog": 3 })).toEqual([
      "discord:pog",
      "fire",
      "angry",
      "like",
    ]);
  });

  it("leaves out types with no count, and totals the rest", () => {
    expect(sortedReactionTypes({ like: 0, fire: 2 })).toEqual(["fire"]);
    expect(reactionTotal({ like: 2, fire: 3 })).toBe(5);
    expect(reactionTotal({})).toBe(0);
  });
});
