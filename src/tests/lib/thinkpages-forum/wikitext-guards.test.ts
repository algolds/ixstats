import {
  guardWikitext,
  MAX_POST_WIKITEXT,
  WikitextRefusal,
} from "~/lib/thinkpages-forum/wikitext-guards";

describe("guardWikitext", () => {
  it("refuses signatures and subst", () => {
    expect(() => guardWikitext("Hello ~~~~")).toThrow(WikitextRefusal);
    expect(() => guardWikitext("{{subst:Foo}}")).toThrow(/subst/i);
    expect(() => guardWikitext("{{ SUBST:Foo}}")).toThrow(WikitextRefusal);
  });
  it("refuses posts over the cap", () => {
    expect(() => guardWikitext("a".repeat(MAX_POST_WIKITEXT + 1))).toThrow(/at most/);
  });
  it("refuses an empty post", () => {
    expect(() => guardWikitext("   \n ")).toThrow(/some text/);
  });
  it("strips categories, behaviour switches and DISPLAYTITLE", () => {
    const out = guardWikitext(
      "Text [[Category:Foo]] __NOINDEX__ __NOTOC__ {{DISPLAYTITLE:Bar}} end"
    );
    expect(out).not.toMatch(/Category:|__NOINDEX__|__NOTOC__|DISPLAYTITLE/);
    expect(out).toContain("Text");
    expect(out).toContain("end");
  });
  it("keeps category links written as [[:Category:Foo]] (a link, not a categorisation)", () => {
    expect(guardWikitext("See [[:Category:Foo]]")).toContain("[[:Category:Foo]]");
  });
  it("keeps three tildes and action tokens", () => {
    expect(guardWikitext("~~~ and [ixaction=abc]")).toBe("~~~ and [ixaction=abc]");
  });
});
