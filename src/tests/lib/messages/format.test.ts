/** @jest-environment node */
import {
  displayNameOf,
  highlightMatches,
  humanizeEnum,
  initialsOf,
  stripTags,
} from "~/lib/messages/format";

describe("highlightMatches", () => {
  it("marks text matches and leaves tags alone", () => {
    expect(highlightMatches('<a href="x-tea">tea</a> time', "tea")).toContain(
      '<a href="x-tea"><mark class="bg-yellow/40 text-label rounded-xs px-0.5">tea</mark></a>'
    );
  });

  it("treats the query literally", () => {
    expect(highlightMatches("a.b axb", "a.b")).toBe(
      '<mark class="bg-yellow/40 text-label rounded-xs px-0.5">a.b</mark> axb'
    );
  });

  it("returns the content unchanged without a query", () => {
    expect(highlightMatches("x", "  ")).toBe("x");
    expect(highlightMatches("x")).toBe("x");
  });
});

describe("names", () => {
  it("shows the handle or the display name as chosen", () => {
    const account = { username: "ana", displayName: "Ana Kova" };
    expect(displayNameOf(account, "account")).toBe("@ana");
    expect(displayNameOf(account, "country")).toBe("Ana Kova");
    expect(displayNameOf({ displayName: "Ana Kova" }, "account")).toBe("Ana Kova");
  });

  it("takes up to two capital initials, ignoring a leading @", () => {
    expect(initialsOf("ana maria kova")).toBe("AM");
    expect(initialsOf("@ben")).toBe("B");
    expect(initialsOf("")).toBe("");
  });

  it("reads enums as phrases and strips tags", () => {
    expect(humanizeEnum("TOP_SECRET")).toBe("Top secret");
    expect(stripTags("<p>hi <b>there</b></p>")).toBe("hi there");
  });
});
