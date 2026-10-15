import { wikiPageHref, wikiUserHref } from "~/components/lorewards/format";

describe("lorewards wiki links", () => {
  it("builds the canonical WikiOS article path", () => {
    expect(wikiPageHref("Ostrozava City")).toBe("/wiki/Ostrozava_City");
    expect(wikiPageHref("velarc")).toBe("/wiki/Velarc");
  });

  it("builds a user page path", () => {
    expect(wikiUserHref("Ix Nay")).toBe("/wiki/User:Ix_Nay");
  });

  it("falls back to a plain encoded path for a title MediaWiki refuses", () => {
    expect(wikiPageHref("A|B")).toBe("/wiki/A%7CB");
  });
});
