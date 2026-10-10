/** @jest-environment node */
import {
  MENTION_MAX_PER_POST,
  MENTION_SUGGEST_MAX,
  MENTION_SUGGEST_MIN,
  mentionNamesIn,
} from "~/lib/thinkpages-forum/mentions";

describe("mentionNamesIn", () => {
  it("finds @name of 3 to 24 letters, digits and underscores, lower-cased, once each, in order", () => {
    expect(mentionNamesIn("Hi @Kir and @aria_v, also @kir again and (@bob).")).toEqual([
      "kir",
      "aria_v",
      "bob",
    ]);
  });

  it("ignores names that are too short or too long", () => {
    expect(mentionNamesIn("@ab @abc")).toEqual(["abc"]);
    expect(mentionNamesIn(`@${"a".repeat(24)}`)).toEqual(["a".repeat(24)]);
    expect(mentionNamesIn(`@${"a".repeat(25)}`)).toEqual([]);
  });

  it("ignores an @ that is glued to a word or another @", () => {
    expect(mentionNamesIn("mail me at kir@example.com")).toEqual([]);
    expect(mentionNamesIn("@@kir")).toEqual([]);
    expect(mentionNamesIn("x@kir")).toEqual([]);
  });

  it("keeps the constants the spec names", () => {
    expect(MENTION_MAX_PER_POST).toBe(50);
    expect(MENTION_SUGGEST_MIN).toBe(2);
    expect(MENTION_SUGGEST_MAX).toBe(6);
  });
});
