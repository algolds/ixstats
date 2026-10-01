/** @jest-environment node */
/** Plan 410: the linear scanners behind action=parse give the answers the old regexes did, on ordinary text. */
import { categoryLinks, externalUrls, linkTargets, visibleText } from "~/lib/wiki-os/api-compat/scan";

describe("linkTargets", () => {
  it("lists distinct targets in order, without fragments or labels, trimmed", () => {
    expect(linkTargets("[[ Beta ]] [[Beta|again]] [[Gamma#Part|g]] [[Delta]] [[Beta#x]]", 100)).toEqual(["Beta", "Gamma", "Delta"]);
  });

  it("skips targets with a line break or longer than a title, and links that never close", () => {
    expect(linkTargets(`[[a\nb]] [[${"x".repeat(400)}]] [[open`, 100)).toEqual([]);
  });

  it("finds a link inside another link's label, and stops at the cap", () => {
    expect(linkTargets("[[File:A.png|thumb|[[Inner]] text]]", 100)).toContain("Inner");
    expect(linkTargets("[[A]][[B]][[C]]", 2)).toEqual(["A", "B"]);
  });
});

describe("categoryLinks", () => {
  it("reads names and sort keys, the first of a name winning, ignoring [[:Category:...]]", () => {
    expect(categoryLinks("[[Category:Cats|zz]] [[ category : Dogs ]] [[:Category:Not]] [[Category:Cats|other]]", 100)).toEqual([
      { name: "Cats", sortKey: "zz" },
      { name: "Dogs", sortKey: "" },
    ]);
  });

  it("stops at the cap and ignores a Category keyword that is not followed by a colon", () => {
    expect(categoryLinks("[[Category:A]][[Category:B]][[Category:C]]", 2).map((c) => c.name)).toEqual(["A", "B"]);
    expect(categoryLinks("[[Categories:A]] [[Category A]]", 10)).toEqual([]);
  });
});

describe("externalUrls and visibleText", () => {
  it("lists distinct addresses up to the cap, ending at the markup", () => {
    expect(externalUrls("see https://a.org/x [http://b.org y] and https://a.org/x again <ref>https://c.org</ref>", 10)).toEqual([
      "https://a.org/x",
      "http://b.org",
      "https://c.org",
    ]);
    expect(externalUrls("http://a http://b http://c", 2)).toEqual(["http://a", "http://b"]);
  });

  it("reads a heading's visible text", () => {
    expect(visibleText("The [[Big cat|lion]] and [[tiger]] ''roar''")).toBe("The lion and tiger roar");
  });
});
