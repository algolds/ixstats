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

import { GET as sitemapIndex } from "~/app/wiki-sitemap/route";
import { GET as sitemapPage } from "~/app/wiki-sitemap/[page]/route";
import { GET as robots } from "~/app/robots.txt/route";
import { GET as raw } from "~/app/api/wiki/raw/route";
import { escapeXml, sitemapIndexXml, sitemapPageXml } from "~/lib/wiki-os/sitemap-xml";

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

describe("sitemap index", () => {
  it("lists one file per 50,000 pages, at least one", async () => {
    mockCount.mockResolvedValue(120_001);
    const response = await sitemapIndex();
    const xml = await response.text();

    expect(response.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(textsOf(xml, "loc")).toEqual([
      "https://ixwiki.com/wiki-sitemap/1",
      "https://ixwiki.com/wiki-sitemap/2",
      "https://ixwiki.com/wiki-sitemap/3",
    ]);

    mockCount.mockResolvedValue(0);
    expect(textsOf(await (await sitemapIndex()).text(), "loc")).toHaveLength(1);
    mockCount.mockResolvedValue(50_000);
    expect(textsOf(await (await sitemapIndex()).text(), "loc")).toHaveLength(1);
  });
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

  it("holds at most 50,000 URLs: the index never lists more files than the pages need", () => {
    const xml = sitemapIndexXml("https://ixwiki.com", 3);
    expect(textsOf(xml, "loc")).toHaveLength(3);
    const big = sitemapPageXml(
      "https://ixwiki.com",
      Array.from({ length: 50_000 }, (_, i) => ({
        title: `Page ${i}`,
        lastModified: new Date("2026-01-01T00:00:00Z"),
      }))
    );
    expect(textsOf(big, "loc")).toHaveLength(50_000);
  });

  it("a number past the last file is a 404; page 1 is always there, even for an empty wiki", async () => {
    mockList.mockResolvedValue([]);
    mockCount.mockResolvedValue(120_001); // ceil(120001 / 50000) = 3 files
    expect((await sitemapPage(new Request("http://x"), page("3"))).status).toBe(200);
    expect((await sitemapPage(new Request("http://x"), page("4"))).status).toBe(404);
    expect(mockList).toHaveBeenCalledTimes(1);

    mockCount.mockResolvedValue(50_000); // exactly one file
    expect((await sitemapPage(new Request("http://x"), page("2"))).status).toBe(404);

    mockCount.mockResolvedValue(0);
    expect((await sitemapPage(new Request("http://x"), page("1"))).status).toBe(200);
    expect((await sitemapPage(new Request("http://x"), page("2"))).status).toBe(404);
  });

  it("is cacheable by a shared cache for an hour", async () => {
    mockList.mockResolvedValue([]);
    const response = await sitemapPage(new Request("http://x"), page("1"));
    expect(response.headers.get("cache-control")).toMatch(/^public\b.*\bs-maxage=3600\b/);
  });

  it("reads page 1 from '1' or '1.xml', and refuses anything else", async () => {
    mockList.mockResolvedValue([]);
    expect((await sitemapPage(new Request("http://x"), page("2.xml"))).status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(2);
    for (const bad of ["0", "abc", "1.txt", "-1", "9999999", "1;drop"]) {
      expect((await sitemapPage(new Request("http://x"), page(bad))).status).toBe(404);
    }
  });
});

describe("robots.txt", () => {
  it("allows the articles, keeps out the tools and the non-reading views, and names the sitemap", async () => {
    const response = robots();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(body).toContain("Sitemap: https://ixwiki.com/wiki-sitemap\n");
    expect(body).toContain("Allow: /wiki/");
    expect(body).toContain("Disallow: /util/");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /*?action=");
    expect(body).toContain("Disallow: /*?oldid=");
    expect(body).toContain("Disallow: /*?diff=");
  });
});

describe("/api/wiki/raw", () => {
  const request = (query: string, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost:3000/api/wiki/raw?${query}`, { headers });

  it("serves a page's wikitext as text/x-wiki", async () => {
    mockFindBySlug.mockResolvedValue({ title: "Foo bar", wikitext: "'''Foo''' <b>bar</b> & more" });
    const response = await raw(request("path=foo_bar&action=raw"));

    expect(mockFindBySlug).toHaveBeenCalledWith("Foo bar");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/x-wiki; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("'''Foo''' <b>bar</b> & more");
  });

  it("reads the page from the proxy's x-wikios-raw-path header first (Next keeps the original query for a rewrite)", async () => {
    mockFindBySlug.mockResolvedValue({ wikitext: "pelaxia text" });
    // What a rewritten /wiki/Pelaxia?action=raw looks like to the route: the original query only.
    const response = await raw(request("action=raw", { "x-wikios-raw-path": "Pelaxia" }));

    expect(response.status).toBe(200);
    expect(mockFindBySlug).toHaveBeenCalledWith("Pelaxia");
    expect(await response.text()).toBe("pelaxia text");

    // Header first, then ?path=; the oldid of the original query still applies.
    mockRevision.mockResolvedValue({ wikitext: "r7", title: "Pelaxia", timestamp: "t" });
    const revision = await raw(
      request("action=raw&oldid=7&path=Other", { "x-wikios-raw-path": "Pelaxia" })
    );
    expect(mockRevision).toHaveBeenCalledWith("7");
    expect(await revision.text()).toBe("r7");
  });

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

  it("serves the text of ?oldid= when it belongs to the page", async () => {
    mockRevision.mockResolvedValue({ wikitext: "old text", title: "Foo", timestamp: "t" });
    const response = await raw(request("path=Foo&action=raw&oldid=77"));

    expect(mockRevision).toHaveBeenCalledWith("77");
    expect(await response.text()).toBe("old text");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
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

  it("is a 400 when it is not a raw request for a page", async () => {
    for (const query of [
      "",
      "path=Foo",
      "path=Special:Random&action=raw",
      "path=Foo&action=raw&oldid=a%20b",
    ]) {
      expect((await raw(request(query))).status).toBe(400);
    }
    expect(mockFindBySlug).not.toHaveBeenCalled();
  });

  it("is a 429 past the caller's budget", async () => {
    mockRateCheck.mockResolvedValue({ success: false });
    expect((await raw(request("path=Foo&action=raw"))).status).toBe(429);
    expect(mockFindBySlug).not.toHaveBeenCalled();
  });
});
