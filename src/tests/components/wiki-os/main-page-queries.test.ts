/** @jest-environment node */
/**
 * Plan 413 (item 3): the Main Page asks the server once (getMainPage), not for a parsed article, the
 * recent changes, the counts, the category and a prompt each, and carries no invented numbers.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src/components/wiki-os/reader/WikiOSMainPage.tsx"),
  "utf8"
);

describe("WikiOSMainPage data", () => {
  it("uses getMainPage and none of the procedures it replaced", () => {
    expect(source).toContain("api.wikios.getMainPage.useQuery");
    for (const replaced of [
      "api.wikios.getArticleHtml",
      "api.wikios.getRecentChanges",
      "api.wikios.getSiteStats",
      "api.wikios.getCategoryMembers",
      "api.blurbs.getRandomActivePrompt",
    ]) {
      expect(source).not.toContain(replaced);
    }
  });

  it("does not parse a page's HTML on the client any more", () => {
    expect(source).not.toContain("extractFeaturedArticle");
    expect(source).not.toContain("extractLeadImageFromHtml");
    expect(source).not.toContain("FALLBACK_ALMANAC_PAGES");
  });

  it("has no stand-in figures (82 nations, 1,400 articles)", () => {
    expect(source).not.toMatch(/\b82\b/);
    expect(source).not.toContain("1,400");
    const hero = readFileSync(
      join(process.cwd(), "src/components/wiki-os/reader/hero/SculptedEmblemHero.tsx"),
      "utf8"
    );
    expect(hero).not.toContain("1,400");
  });

  it("has a heading level one for the page", () => {
    expect(source).toContain("<h1");
  });
});
