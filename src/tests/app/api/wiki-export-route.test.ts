/** @jest-environment node */
import { load as parseYaml } from "js-yaml";
import { SaxesParser } from "saxes";
import { NextRequest } from "next/server";
import {
  resetStore,
  store,
  type ArticleRow,
  type RevisionRow,
} from "../../lib/wiki-os/xml/fake-wiki-db";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/cache/rate-limiter", () => ({ rateLimiter: { check: jest.fn() } }));
jest.mock("~/server/db", () => {
  const fake = jest.requireActual("../../lib/wiki-os/xml/fake-wiki-db").createFakeDbModule();
  return { db: fake.db };
});

import { auth } from "@clerk/nextjs/server";
import { GET } from "~/app/api/wiki/export/route";
import { rateLimiter } from "~/lib/cache/rate-limiter";

const mockAuth = jest.mocked(auth) as unknown as jest.Mock;
const check = jest.mocked(rateLimiter.check);

const request = (query: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000/api/wiki/export?${query}`, { headers });

const seed = (overrides: Partial<ArticleRow>, revision: Partial<RevisionRow> = {}) => {
  const article: ArticleRow = {
    id: `a${store.articles.length + 1}`,
    source: "ixwiki",
    title: "Alpha",
    slug: "alpha",
    status: "PUBLISHED",
    format: "WIKITEXT",
    namespace: 0,
    namespacePrefix: null,
    wikitext: "alpha text <b>&</b>",
    contentHtml: null,
    htmlSyncedAt: null,
    summary: null,
    wordCount: 3,
    readingTime: 1,
    mwPageId: 11,
    mwLatestRevId: 21,
    redirectTargetSlug: null,
    redirectTargetFragment: null,
    protectionLevel: "ALL",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
  store.articles.push(article);
  store.revisions.push({
    id: `r${store.revisions.length + 1}`,
    articleId: article.id,
    source: "ixwiki",
    mwRevId: 21 + store.revisions.length,
    author: "Jane",
    authorId: null,
    summary: null,
    minor: false,
    textDeleted: false,
    commentDeleted: false,
    userDeleted: false,
    byteSize: 10,
    byteDelta: 10,
    sha1: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    wikitext: article.wikitext,
    format: "WIKITEXT",
    ...revision,
  });
  return article;
};

/** Parse the response body with saxes (throws when it is not well-formed) and collect `<title>`s. */
function titlesIn(xml: string): string[] {
  const parser = new SaxesParser();
  const titles: string[] = [];
  let inTitle = false;
  parser.on("opentag", (tag) => {
    inTitle = tag.name === "title";
    if (inTitle) titles.push("");
  });
  parser.on("text", (text) => {
    if (inTitle) titles[titles.length - 1] += text;
  });
  parser.on("closetag", () => {
    inTitle = false;
  });
  parser.write(xml).close();
  return titles;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  mockAuth.mockResolvedValue({ userId: null });
  check.mockResolvedValue({ success: true, remaining: 9, resetAt: new Date() });
});

describe("GET /api/wiki/export?format=xml", () => {
  it("streams a well-formed export of the current revisions, public, as an attachment", async () => {
    seed({ title: "Alpha" });
    seed({ title: "Beta", slug: "beta", wikitext: "beta text" });

    const res = await GET(request("format=xml&pages=Alpha|Beta"));
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="ixwiki-export.xml"');
    expect(titlesIn(xml).sort()).toEqual(["Alpha", "Beta"]);
    expect(xml).toContain('<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/"');
    expect(xml).toContain("alpha text &lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("exports only PUBLISHED articles", async () => {
    seed({ title: "Alpha" });
    seed({ title: "Draft page", status: "DRAFT", slug: "draft_page" });
    seed({ title: "Archived page", status: "ARCHIVED", slug: "archived_page" });

    const res = await GET(request("format=xml&pages=Alpha|Draft page|Archived page"));

    expect(titlesIn(await res.text())).toEqual(["Alpha"]);
  });

  it("names the file after a single page, with every unsafe character replaced", async () => {
    seed({ title: 'Foo/Bar "x"; rm -rf', slug: "foo_bar" });

    const res = await GET(request(`format=xml&pages=${encodeURIComponent('Foo/Bar "x"; rm -rf')}`));

    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="Foo_Bar__x___rm_-rf.xml"'
    );
    await res.text();
  });

  it("never lets a title put a header break or quote into the file name", async () => {
    const res = await GET(request(`format=xml&pages=${encodeURIComponent('a"\r\nX-Injected: 1')}`));

    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="[A-Za-z0-9._-]+\.xml"$/);
    expect(res.headers.get("x-injected")).toBeNull();
    await res.text();
  });

  it("requires pages, and at most 500 of them", async () => {
    expect((await GET(request("format=xml"))).status).toBe(400);
    expect((await GET(request("format=xml&pages="))).status).toBe(400);

    const many = Array.from({ length: 501 }, (_, i) => `Page ${i}`).join("|");
    const res = await GET(request(`format=xml&pages=${encodeURIComponent(many)}`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Too many pages: at most 500 per export" });

    const exactly = Array.from({ length: 500 }, (_, i) => `Page ${i}`).join("|");
    expect((await GET(request(`format=xml&pages=${encodeURIComponent(exactly)}`))).status).toBe(
      200
    );
  });

  it("counts a title listed twice once", async () => {
    seed({ title: "Alpha" });

    const res = await GET(request("format=xml&pages=Alpha|Alpha|alpha"));

    expect(titlesIn(await res.text())).toEqual(["Alpha"]);
  });

  it("rejects a source that is not a realm name", async () => {
    const res = await GET(request("format=xml&pages=Alpha&source=" + encodeURIComponent("x'; --")));

    expect(res.status).toBe(400);
  });

  describe("history=1", () => {
    it("needs a signed-in user", async () => {
      seed({ title: "Alpha" });

      const res = await GET(request("format=xml&pages=Alpha&history=1"));

      expect(res.status).toBe(401);
      expect(check).not.toHaveBeenCalled();
    });

    it("exports every revision for a signed-in user", async () => {
      mockAuth.mockResolvedValue({ userId: "user_1" });
      seed({ title: "Alpha" });
      store.revisions.push({
        ...(store.revisions[0] as RevisionRow),
        id: "r-old",
        mwRevId: 5,
        createdAt: new Date("2025-06-01T00:00:00Z"),
        wikitext: "older text",
      });

      const res = await GET(request("format=xml&pages=Alpha&history=1"));
      const xml = await res.text();

      expect(res.status).toBe(200);
      expect(xml.match(/<revision>/g)).toHaveLength(2);
      expect(xml.indexOf("older text")).toBeLessThan(xml.indexOf("alpha text"));
    });

    it("allows at most 50 pages", async () => {
      mockAuth.mockResolvedValue({ userId: "user_1" });
      const fifty = Array.from({ length: 50 }, (_, i) => `Page ${i}`).join("|");
      const fiftyOne = `${fifty}|Page 50`;

      expect(
        (await GET(request(`format=xml&history=1&pages=${encodeURIComponent(fifty)}`))).status
      ).toBe(200);
      const res = await GET(request(`format=xml&history=1&pages=${encodeURIComponent(fiftyOne)}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: "Too many pages: at most 50 per export with history",
      });
    });
  });

  describe("rate limit", () => {
    it("is keyed by the signed-in user, else by the client address, in the wiki_export bucket", async () => {
      await (
        await GET(request("format=xml&pages=Alpha", { "cf-connecting-ip": "203.0.113.9" }))
      ).text();
      mockAuth.mockResolvedValue({ userId: "user_7" });
      await (await GET(request("format=xml&pages=Alpha"))).text();

      expect(check.mock.calls[0]?.slice(0, 2)).toEqual(["ip:203.0.113.9", "wiki_export"]);
      expect(check.mock.calls[1]?.slice(0, 2)).toEqual(["user:user_7", "wiki_export"]);
      expect(check.mock.calls[0]?.[2]).toEqual({ maxRequests: 10, windowMs: 60_000 });
    });

    it("answers 429 once the bucket is empty", async () => {
      check.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });

      const res = await GET(request("format=xml&pages=Alpha"));

      expect(res.status).toBe(429);
    });
  });
});

describe("GET /api/wiki/export (single article)", () => {
  it("keeps the JSON and Markdown formats, for published articles only", async () => {
    seed({ title: "Alpha", slug: "alpha", wikitext: "alpha text" });
    seed({ title: "Hidden", slug: "hidden", status: "DRAFT" });

    const json = await GET(request("slug=alpha&format=json"));
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({ title: "Alpha", wikitext: "alpha text" });

    const md = await GET(request("slug=alpha"));
    expect(md.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(md.headers.get("content-disposition")).toBe('attachment; filename="alpha.mdx"');

    expect((await GET(request("slug=hidden&format=json"))).status).toBe(404);
    expect((await GET(request("format=json"))).status).toBe(400);
  });

  it("writes frontmatter values that stay inside their YAML scalar, whatever the title holds", async () => {
    const title = 'He said "hi": a\nb # c --- [d] {e}\\';
    seed({ title, slug: 'slug: "x"\n---\nfoo: bar', wikitext: "body text" });

    const res = await GET(request(`slug=${encodeURIComponent('slug: "x"\n---\nfoo: bar')}`));
    const text = await res.text();
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
    const parsed = parseYaml(frontmatter) as Record<string, unknown>;

    expect(parsed).toMatchObject({
      title,
      slug: 'slug: "x"\n---\nfoo: bar',
      realm: "ixwiki",
      status: "PUBLISHED",
    });
    expect(Object.keys(parsed).sort()).toEqual(
      ["exportedAt", "readingTime", "realm", "slug", "status", "title", "wordCount"].sort()
    );
    expect(text.endsWith("body text")).toBe(true);
  });

  it("sanitises the Markdown file name", async () => {
    seed({ title: "Weird", slug: 'we"ird/../name\r\nX: 1' });

    const res = await GET(request(`slug=${encodeURIComponent('we"ird/../name\r\nX: 1')}`));

    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.mdx"$/
    );
  });
});
