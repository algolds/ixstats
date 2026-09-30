/** @jest-environment node */
import { isSamePage, pageRefPath, recentArticlesSchema } from "~/lib/wiki-os/page-ref";

describe("remembered WikiOS pages (ruling E-l″)", () => {
  it("reads stored recent articles, including bare titles saved before sources were recorded", () => {
    expect(
      recentArticlesSchema.parse([
        "Aurelia",
        { title: "Portal:Eurth", source: "iiwiki" },
        { title: "Borea", source: "nonsense" },
      ])
    ).toEqual([
      { title: "Aurelia" },
      { title: "Portal:Eurth", source: "iiwiki" },
      { title: "Borea", source: "ixwiki" },
    ]);
    expect(recentArticlesSchema.safeParse([{ nope: 1 }]).success).toBe(false);
  });

  it("reopens a page on its own wiki; no wiki means IxWiki", () => {
    expect(pageRefPath({ title: "Portal:Eurth", source: "iiwiki" })).toBe(
      "/wiki/Portal%3AEurth?source=iiwiki"
    );
    expect(pageRefPath({ title: "United Kingdom of Aurelia" })).toBe(
      "/wiki/United_Kingdom_of_Aurelia"
    );
  });

  it("the same title on two wikis is two pages", () => {
    expect(isSamePage({ title: "Gallambria", source: "iiwiki" }, "Gallambria", "iiwiki")).toBe(
      true
    );
    expect(isSamePage({ title: "Gallambria", source: "iiwiki" }, "Gallambria", "ixwiki")).toBe(
      false
    );
    expect(isSamePage({ title: "Gallambria" }, "Gallambria", "ixwiki")).toBe(true);
  });
});
