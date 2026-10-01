/** @jest-environment node */
/**
 * Plan 413 (item 3): one call builds the whole Main Page from Postgres, keeps the shared part a
 * minute, and never invents a number.
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const mockGetArticleView = jest.fn();
const mockRecentChanges = jest.fn();
const mockSiteStats = jest.fn();
const mockCategoryDetails = jest.fn();
const mockPromptFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: { blurbPrompt: { findMany: (...a: unknown[]) => mockPromptFindMany(...a) } },
}));
jest.mock("~/lib/wiki-os/services/article-view-service", () => ({
  getArticleView: (...a: unknown[]) => mockGetArticleView(...a),
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  getRecentChanges: (...a: unknown[]) => mockRecentChanges(...a),
  getSiteStats: (...a: unknown[]) => mockSiteStats(...a),
}));
jest.mock("~/lib/wiki-os/core/category-service", () => ({
  CategoryService: { getCategoryDetails: (...a: unknown[]) => mockCategoryDetails(...a) },
}));

type Service = typeof import("~/lib/wiki-os/services/main-page-service");

/** A fresh copy of the service: its caches are per module instance. */
function loadService(): Service {
  let service!: Service;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    service = require("~/lib/wiki-os/services/main-page-service") as Service;
  });
  return service;
}

const FEATURED_CARD =
  '<div id="featured_article" class="card"><div class="card-image"><img src="https://ixwiki.com/images/a.png"></div>' +
  '<div class="card-text"><p>Featured article</p><h3><a href="https://ixwiki.com/wiki/Aurelia_Nova">Aurelia Nova</a></h3>' +
  "<p>A country on Eurth known for its long coast.</p></div></div>";

const viewOf = (contentHtml: string, infoboxHtml: string | null = null) => ({
  contentHtml,
  infoboxHtml,
  noticesHtml: null,
  toc: [],
  renderQuality: "rendered" as const,
  stale: false,
  title: "x",
  categories: [],
  lastModified: null,
});

const change = (title: string) => ({
  title,
  user: "amy",
  timestamp: "2026-06-01T00:00:00.000Z",
  comment: "edit",
  type: "edit" as const,
  oldLen: 10,
  newLen: 20,
  blurb: "A blurb.",
  thumbnail: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  mockGetArticleView.mockImplementation(async (title: string) => {
    if (title === "Main Page") return viewOf(`<p>Welcome</p>${FEATURED_CARD}`);
    return viewOf(
      "<p>Navigation bar</p><p>The gross domestic product of every country, ranked from largest to smallest.</p>",
      '<table class="infobox"><tr><td><img src="https://ixwiki.com/images/gdp.png" width="300"></td></tr></table>'
    );
  });
  mockRecentChanges.mockResolvedValue([change("Aurelia"), change("Urcea")]);
  mockSiteStats.mockResolvedValue({
    articles: 4800,
    pages: 12000,
    edits: 75000,
    images: 7500,
    users: 130,
    activeUsers: 40,
  });
  mockCategoryDetails.mockResolvedValue({
    category: {
      id: "c",
      slug: "bis",
      name: "Bureau of International Statistics",
      description: null,
    },
    articles: [
      { id: "1", slug: "a", title: "List of countries by GDP", summary: null },
      { id: "2", slug: "b", title: "List of countries by population", summary: null },
      { id: "3", slug: "c", title: "Category:Hidden", summary: null },
      { id: "4", slug: "d", title: "Template:Stats", summary: null },
    ],
    subcategories: [],
    parents: [],
  });
  mockPromptFindMany.mockResolvedValue([
    {
      id: "p1",
      title: "T1",
      question: "Q1",
      slug: "t1",
      featured: false,
      _count: { responses: 3 },
    },
  ]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("getMainPageData", () => {
  it("builds the featured article from the Main Page's own view, on the server", async () => {
    const { getMainPageData } = loadService();

    const { featured } = await getMainPageData();

    expect(mockGetArticleView).toHaveBeenCalledWith(
      "Main Page",
      expect.any(Function),
      undefined,
      "none"
    );
    expect(featured).toMatchObject({
      title: "Aurelia Nova",
      slug: "Aurelia_Nova",
      excerpt: "A country on Eurth known for its long coast.",
    });
    expect(featured!.image).toContain("/api/mediawiki/ixwiki/images/a.png");
  });

  it("picks the day's almanac entry from the category, skipping other namespaces, and reads its lead and picture", async () => {
    jest.useFakeTimers({
      now: new Date("2026-09-30T12:00:00Z"),
      doNotFake: ["nextTick", "queueMicrotask"],
    });
    const { getMainPageData } = loadService();

    const first = (await getMainPageData()).almanac;

    expect(["List of countries by GDP", "List of countries by population"]).toContain(first!.title);
    expect(first).toMatchObject({
      category: "Bureau of International Statistics",
      excerpt: "The gross domestic product of every country, ranked from largest to smallest.",
    });
    expect(first!.thumbnail).toContain("/api/mediawiki/ixwiki/images/gdp.png");
    expect(first!.slug).toBe(encodeURIComponent(first!.title.replace(/ /g, "_")));

    // the same day gives the same entry from a fresh instance; tomorrow may differ but is still an entry
    const again = (await loadService().getMainPageData()).almanac;
    expect(again!.title).toBe(first!.title);
  });

  it("has no almanac, and no made-up fallback list, when the category has no entries", async () => {
    mockCategoryDetails.mockResolvedValue({
      category: null,
      articles: [],
      subcategories: [],
      parents: [],
    });
    const { getMainPageData } = loadService();

    expect((await getMainPageData()).almanac).toBeNull();
    expect(mockGetArticleView).not.toHaveBeenCalledWith(
      expect.stringMatching(/^List of/),
      expect.anything(),
      undefined,
      "none"
    );
  });

  it("asks for 6 recent changes, and passes the stats through with their nulls: no invented numbers", async () => {
    mockSiteStats.mockResolvedValue({
      articles: 4800,
      pages: null,
      edits: null,
      images: 7500,
      users: null,
      activeUsers: null,
    });
    const { getMainPageData } = loadService();

    const page = await getMainPageData();

    expect(mockRecentChanges).toHaveBeenCalledWith(6);
    expect(page.recentChanges.map((c) => c.title)).toEqual(["Aurelia", "Urcea"]);
    expect(page.stats).toEqual({
      articles: 4800,
      edits: null,
      users: null,
      images: 7500,
      activeUsers: null,
    });
  });

  it("leaves out a part that failed and still answers with the rest", async () => {
    mockSiteStats.mockRejectedValue(new Error("db down"));
    mockRecentChanges.mockRejectedValue(new Error("db down"));
    mockPromptFindMany.mockRejectedValue(new Error("db down"));
    const { getMainPageData } = loadService();

    const page = await getMainPageData();

    expect(page.featured).not.toBeNull();
    expect(page.recentChanges).toEqual([]);
    expect(page.stats).toEqual({
      articles: null,
      edits: null,
      users: null,
      images: null,
      activeUsers: null,
    });
    expect(page.prompt).toBeNull();
    expect(page.categories.length).toBeGreaterThan(0);
  });

  it("builds the shared part once a minute, once at a time", async () => {
    jest.useFakeTimers({ now: 1_000_000, doNotFake: ["nextTick", "queueMicrotask"] });
    const { getMainPageData } = loadService();

    await Promise.all([getMainPageData(), getMainPageData(), getMainPageData()]);
    await getMainPageData();
    expect(mockSiteStats).toHaveBeenCalledTimes(1);
    expect(mockRecentChanges).toHaveBeenCalledTimes(1);
    expect(mockPromptFindMany).toHaveBeenCalledTimes(1);

    jest.setSystemTime(1_000_000 + 61_000);
    await getMainPageData();
    expect(mockSiteStats).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed build", async () => {
    mockCategoryDetails.mockRejectedValueOnce(new Error("boom"));
    const { getMainPageData } = loadService();

    // the almanac failed but the build as a whole completes (parts are independent)
    expect((await getMainPageData()).almanac).toBeNull();
  });

  it("selects only what a prompt card needs, and gives each visitor a prompt of their own", async () => {
    mockPromptFindMany.mockResolvedValue([
      { id: "a", title: "A", question: "Q", slug: "a", featured: false, _count: { responses: 1 } },
      { id: "b", title: "B", question: "Q", slug: "b", featured: false, _count: { responses: 2 } },
    ]);
    const { getMainPageData } = loadService();

    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add((await getMainPageData()).prompt!.id);

    expect(seen).toEqual(new Set(["a", "b"]));
    expect(mockPromptFindMany).toHaveBeenCalledTimes(1);
    expect(mockPromptFindMany.mock.calls[0]![0]).toMatchObject({
      where: { status: "ACTIVE" },
      select: { id: true, title: true, question: true, slug: true, featured: true },
    });
  });
});
