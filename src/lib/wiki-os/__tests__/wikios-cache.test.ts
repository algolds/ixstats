import {
  getCachedArticle,
  setCachedArticle,
  getCachedDraft,
  setCachedDraft,
  clearCachedDraft,
} from "../wikios-cache";

describe("wikios-cache", () => {
  it("saves and retrieves article data from memory cache", async () => {
    const article = {
      title: "Test Article",
      contentHtml: "<p>Hello world</p>",
      infoboxHtml: null,
      noticesHtml: null,
      toc: [],
      categories: ["Test"],
    };

    await setCachedArticle("Test Article", article);
    const retrieved = await getCachedArticle("Test Article");

    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe("Test Article");
    expect(retrieved?.contentHtml).toBe("<p>Hello world</p>");
  });

  it("handles normalized title lookups with spaces and underscores", async () => {
    const article = {
      title: "Republic of Test",
      contentHtml: "<p>Republic</p>",
      infoboxHtml: null,
      noticesHtml: null,
      toc: [],
      categories: [],
    };

    await setCachedArticle("Republic of Test", article);
    const withUnderscores = await getCachedArticle("Republic_of_Test");
    expect(withUnderscores?.title).toBe("Republic of Test");
  });

  it("saves, retrieves, and clears wikitext drafts", async () => {
    await setCachedDraft("Draft Page", "== Test Draft ==");
    const draft = await getCachedDraft("Draft Page");
    expect(draft).toBe("== Test Draft ==");

    await clearCachedDraft("Draft Page");
    const cleared = await getCachedDraft("Draft Page");
    expect(cleared).toBeNull();
  });
});
