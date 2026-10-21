/** @jest-environment node */
/**
 * Plan 412 step 6: the sitemap index, the sitemap files, robots.txt and the raw-wikitext route.
 */
import { SaxesParser } from "saxes";
import { NextRequest } from "next/server";

const mockCount = jest.fn();
const mockList = jest.fn();
jest.mock("~/lib/wiki-os/core/sitemap-service", () => ({
  __esModule: true,
  SITEMAP_PAGE_SIZE: 50_000,
  countSitemapPages: (...args: unknown[]) => mockCount(...args),
  listSitemapPage: (...args: unknown[]) => mockList(...args),
}));

const mockFindBySlug = jest.fn();
jest.mock("~/lib/wiki-os/core", () => ({
  __esModule: true,
  ArticleRepository: { findBySlug: (...args: unknown[]) => mockFindBySlug(...args) },
}));
const mockRevision = jest.fn();
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getRevisionWikitext: (...args: unknown[]) => mockRevision(...args),
}));
const mockArchived = jest.fn();
jest.mock("~/lib/wiki-os/core/archived-titles", () => ({
  __esModule: true,
  archivedTitlesAmong: (...args: unknown[]) => mockArchived(...args),
}));
const mockRateCheck = jest.fn();
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: (...args: unknown[]) => mockRateCheck(...args) },
}));
import { GET as sitemapPage } from "~/app/wiki-sitemap/[page]/route";
import { GET as raw } from "~/app/api/wiki/raw/route";
import { escapeXml, sitemapPageXml } from "~/lib/wiki-os/sitemap-xml";

/** Parse `xml` with saxes (throws when it is not well-formed) and collect the text of each `tag`. */
function textsOf(xml: string, tag: string): string[] {
  const parser = new SaxesParser();
  const texts: string[] = [];
  let inside = false;
  parser.on("opentag", (node) => {
    inside = node.name === tag;
  });
  parser.on("text", (text) => {
    if (inside) texts.push(text);
  });
  parser.on("closetag", () => {
    inside = false;
  });
  parser.on("error", (error) => {
    throw error;
  });
  parser.write(xml).close();
  return texts;
}

const page = (n: string) => ({ params: Promise.resolve({ page: n }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockRateCheck.mockResolvedValue({ success: true });
  mockArchived.mockResolvedValue(new Set());
  mockCount.mockResolvedValue(120_001); // three files
});
describe("sitemap file", () => {
  it("lists each page's canonical URL with its last revision's time, escaped and well-formed", async () => {
    mockList.mockResolvedValue([
      { title: "Aurelia", lastModified: new Date("2026-09-01T10:00:00Z") },
      { title: "Tom & Jerry's <Treaty>", lastModified: new Date("2026-09-02T10:00:00Z") },
      { title: "Template:Foo/doc", lastModified: new Date("2026-09-03T10:00:00Z") },
      { title: "a[b", lastModified: new Date("2026-09-04T10:00:00Z") }, // not a title: left out
    ]);
    const response = await sitemapPage(new Request("http://x/wiki-sitemap/1"), page("1"));
    const xml = await response.text();

    expect(mockList).toHaveBeenCalledWith(1);
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
    // `<` and `>` are illegal in a title, so they never get as far as the XML: the entry is dropped.
    expect(textsOf(xml, "loc")).toEqual([
      "https://ixwiki.com/wiki/Aurelia",
      "https://ixwiki.com/wiki/Template:Foo/doc",
    ]);
    expect(textsOf(xml, "lastmod")).toEqual([
      "2026-09-01T10:00:00.000Z",
      "2026-09-03T10:00:00.000Z",
    ]);
  });

  it("escapes the five XML characters in a URL", () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
    const xml = sitemapPageXml("https://ixwiki.com", [
      { title: "Tom & Jerry's", lastModified: new Date("2026-01-01T00:00:00Z") },
    ]);
    expect(textsOf(xml, "loc")).toEqual(["https://ixwiki.com/wiki/Tom_%26_Jerry's"]);
    expect(xml).toContain("Tom_%26_Jerry&apos;s");
  });
});
describe("/api/wiki/raw", () => {
  const request = (query: string, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost:3000/api/wiki/raw?${query}`, { headers });
  it("accepts the header only for a request that carries action=raw", async () => {
    mockFindBySlug.mockResolvedValue({ wikitext: "text" });

    expect((await raw(request("", { "x-wikios-raw-path": "Pelaxia" }))).status).toBe(400);
    expect(
      (await raw(request("oldid=7&path=Foo", { "x-wikios-raw-path": "Pelaxia" }))).status
    ).toBe(400);
    expect(mockFindBySlug).not.toHaveBeenCalled();

    // Without the header, ?path= of a direct request is the page (the redirect fallback of the route).
    expect((await raw(request("path=Foo&action=raw"))).status).toBe(200);
    expect(mockFindBySlug).toHaveBeenCalledWith("Foo");
  });

  it("serves a subpage by its whole path, decoded once", async () => {
    mockFindBySlug.mockResolvedValue({ wikitext: "doc" });
    await raw(request("path=Template%253AFoo%2Fdoc&action=raw"));
    expect(mockFindBySlug).toHaveBeenCalledWith("Template:Foo/doc");
  });
  it("is a 404 for a missing page, a revision of another page, and a revision whose text is hidden", async () => {
    mockFindBySlug.mockResolvedValue(null);
    expect((await raw(request("path=Nowhere&action=raw"))).status).toBe(404);

    mockRevision.mockResolvedValue({ wikitext: "x", title: "Other", timestamp: "t" });
    expect((await raw(request("path=Foo&action=raw&oldid=77"))).status).toBe(404);

    mockRevision.mockResolvedValue({ wikitext: null, title: "Foo", timestamp: "t" });
    expect((await raw(request("path=Foo&action=raw&oldid=78"))).status).toBe(404);
  });

  it("hides a deleted page: the current text comes from a lookup that leaves it out, the revisions are checked", async () => {
    mockFindBySlug.mockResolvedValue(null); // ArticleRepository.findBySlug leaves ARCHIVED rows out (plan 409)
    expect((await raw(request("path=Deleted&action=raw"))).status).toBe(404);
    expect(mockFindBySlug).toHaveBeenCalledWith("Deleted"); // no includeArchived

    mockRevision.mockResolvedValue({ wikitext: "old text", title: "Deleted", timestamp: "t" });
    mockArchived.mockResolvedValue(new Set(["Deleted"]));
    expect((await raw(request("path=Deleted&action=raw&oldid=9"))).status).toBe(404);
    expect(mockArchived).toHaveBeenCalledWith(["Deleted"]);
  });
  it("is a 429 past the caller's budget", async () => {
    mockRateCheck.mockResolvedValue({ success: false });
    expect((await raw(request("path=Foo&action=raw"))).status).toBe(429);
    expect(mockFindBySlug).not.toHaveBeenCalled();
  });
});
