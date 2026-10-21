/** @jest-environment node */
import { mentionNamesIn } from "~/lib/thinkpages-forum/mentions";

describe("mentionNamesIn", () => {
  it("finds @name of 3 to 24 letters, digits and underscores, lower-cased, once each, in order", () => {
    expect(mentionNamesIn("Hi @Kir and @aria_v, also @kir again and (@bob).")).toEqual([
      "kir",
      "aria_v",
      "bob",
    ]);
  });
  it("ignores an @ that is glued to a word or another @", () => {
    expect(mentionNamesIn("mail me at kir@example.com")).toEqual([]);
    expect(mentionNamesIn("@@kir")).toEqual([]);
    expect(mentionNamesIn("x@kir")).toEqual([]);
  });
});
