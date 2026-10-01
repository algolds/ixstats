/** @jest-environment node */
/** Plan 410: action=parse (stored render vs private renderer), action=compare and action=opensearch. */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, makeWikiDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const PAGE_TEXT = [
  "{{DISPLAYTITLE:alpha}}",
  "Intro with [[Beta]] and [[Missing page|label]] and [[Template:Foo]].",
  "See https://example.org/page too.",
  "",
  "== First ==",
  "body [[Category:Cats|zz]]",
  "=== Nested ===",
  "more",
  "== Second ==",
  "[[Category:Dogs]]",
].join("\n");

const data = (): FakeWikiData => ({
  pages: [
    { pageId: 1, title: "Alpha", wikitext: PAGE_TEXT },
    { pageId: 2, title: "Beta" },
    { pageId: 3, title: "Gamma", redirect: "Alpha" },
    { pageId: 4, title: "Stale", wikitext: "stale wikitext" },
    { pageId: 10, title: "Template:Foo", namespace: 10 },
  ],
  revisions: [
    { revId: 11, page: "Alpha", timestamp: "2026-01-01T10:00:00Z", user: "Heku", comment: "first", content: "old text" },
    { revId: 12, page: "Alpha", timestamp: "2026-01-02T10:00:00Z", user: "Tester", comment: "second <b>", content: PAGE_TEXT },
    { revId: 21, page: "Beta", timestamp: "2026-01-03T10:00:00Z", content: "beta" },
    { revId: 31, page: "Gamma", timestamp: "2026-01-04T10:00:00Z", content: "#REDIRECT [[Alpha]]" },
    { revId: 41, page: "Stale", timestamp: "2026-01-05T10:00:00Z", content: "stale wikitext", textHidden: false },
    { revId: 42, page: "Stale", timestamp: "2026-01-06T10:00:00Z", content: "hidden", textHidden: true },
  ],
  categories: { Alpha: ["Cats", "Dogs"] },
  html: { Alpha: "<p>stored html of Alpha</p>" },
});

async function run(params: string, version = "formatversion=2") {
  const wiki = await makeWikiDeps(data());
  const body = (await call(wiki.deps, `${params}&${version}`)).body as Body;
  return { body, calls: wiki.calls };
}

describe("action=parse", () => {
  it("serves the stored rendering of a page without calling the renderer", async () => {
    const { body, calls } = await run("action=parse&page=Alpha&prop=text|revid");
    expect(body.parse).toEqual({ title: "Alpha", pageid: 1, text: "<p>stored html of Alpha</p>", revid: 12 });
    expect(calls.filter((c) => c.name === "renderWikitext")).toHaveLength(0);
  });

  it("wraps text in {'*': ...} for formatversion=1", async () => {
    const { body } = await run("action=parse&page=Alpha&prop=text|wikitext", "format=json");
    expect(body.parse.text).toEqual({ "*": "<p>stored html of Alpha</p>" });
    expect(body.parse.wikitext).toEqual({ "*": PAGE_TEXT });
  });

  it("renders the page's wikitext through the private renderer when the stored one is stale", async () => {
    const { body, calls } = await run("action=parse&page=Stale&prop=text");
    expect(body.parse.text).toBe("<p>rendered(Stale): stale wikitext</p>");
    expect(calls.find((c) => c.name === "renderWikitext")!.args).toEqual(["stale wikitext", "Stale"]);
  });

  it("renders given text with a title (default API), and refuses another content model", async () => {
    const { body, calls } = await run("action=parse&text=%27%27hi%27%27&title=Sandbox&contentmodel=wikitext&prop=text");
    expect(body.parse).toEqual({ title: "Sandbox", pageid: 0, text: "<p>rendered(Sandbox): ''hi''</p>" });
    expect(calls.filter((c) => c.name === "renderWikitext")).toHaveLength(1);
    expect((await run("action=parse&text=x&prop=text")).body.parse.title).toBe("API");
    expect((await run("action=parse&text=x&contentmodel=json")).body.error.code).toBe("badvalue");
  });

  it("renders an old revision", async () => {
    const { body, calls } = await run("action=parse&oldid=11&prop=text|revid|wikitext");
    expect(body.parse).toMatchObject({ title: "Alpha", pageid: 1, revid: 11, wikitext: "old text" });
    expect(calls.find((c) => c.name === "renderWikitext")!.args).toEqual(["old text", "Alpha"]);
    expect((await run("action=parse&oldid=999")).body.error.code).toBe("nosuchrevid");
    expect((await run("action=parse&oldid=42")).body.error.code).toBe("missingcontent");
  });

  it("follows a redirect when asked, and refuses a missing page or no source", async () => {
    expect((await run("action=parse&page=Gamma&redirects&prop=revid")).body.parse.title).toBe("Alpha");
    expect((await run("action=parse&page=Gamma&prop=revid")).body.parse.title).toBe("Gamma");
    expect((await run("action=parse&page=Nope")).body.error.code).toBe("missingtitle");
    expect((await run("action=parse&pageid=99")).body.error.code).toBe("nosuchpageid");
    expect((await run("action=parse")).body.error.code).toBe("missingparam");
    expect((await run("action=parse&pageid=1&prop=revid")).body.parse.title).toBe("Alpha");
  });

  it("lists categories (v2 and v1 shapes) from the stored page", async () => {
    const v2 = await run("action=parse&page=Alpha&prop=categories");
    expect(v2.body.parse.categories).toEqual([
      { sortkey: "", category: "Cats", hidden: false },
      { sortkey: "", category: "Dogs", hidden: false },
    ]);
    const v1 = await run("action=parse&page=Alpha&prop=categories", "format=json");
    expect(v1.body.parse.categories).toEqual([{ sortkey: "", "*": "Cats" }, { sortkey: "", "*": "Dogs" }]);
    // given text has no stored page: categories come from its links, with their sort keys
    const text = await run(`action=parse&text=${encodeURIComponent("[[Category:Big cats|zz]] [[:Category:Not a member]] [[Category:Big cats]]")}&prop=categories`);
    expect(text.body.parse.categories).toEqual([{ sortkey: "zz", category: "Big_cats", hidden: false }]);
  });

  it("lists links with their namespace and whether the page exists", async () => {
    const v2 = await run("action=parse&page=Alpha&prop=links");
    expect(v2.body.parse.links).toEqual([
      { ns: 0, exists: true, title: "Beta" },
      { ns: 0, exists: false, title: "Missing page" },
      { ns: 10, exists: true, title: "Template:Foo" },
    ]);
    const v1 = await run("action=parse&page=Alpha&prop=links", "format=json");
    expect(v1.body.parse.links).toEqual([
      { ns: 0, exists: "", "*": "Beta" },
      { ns: 0, "*": "Missing page" },
      { ns: 10, exists: "", "*": "Template:Foo" },
    ]);
  });

  it("lists sections with MediaWiki's numbering, levels and anchors", async () => {
    const { body } = await run("action=parse&page=Alpha&prop=sections");
    expect(body.parse.sections).toEqual([
      expect.objectContaining({ toclevel: 1, level: "2", line: "First", number: "1", index: "1", fromtitle: "Alpha", anchor: "First" }),
      expect.objectContaining({ toclevel: 2, level: "3", line: "Nested", number: "1.1", index: "2", anchor: "Nested" }),
      expect.objectContaining({ toclevel: 1, level: "2", line: "Second", number: "2", index: "3" }),
    ]);
    expect(body.parse.sections[0].byteoffset).toBe(Buffer.byteLength(PAGE_TEXT.slice(0, PAGE_TEXT.indexOf("== First =="))));
  });

  it("answers displaytitle, properties, external links and the empty link lists", async () => {
    const { body } = await run("action=parse&page=Alpha&prop=displaytitle|properties|externallinks|langlinks|iwlinks|parsewarnings");
    expect(body.parse.displaytitle).toBe("alpha");
    expect(body.parse.properties).toEqual([{ name: "displaytitle", value: "alpha" }]);
    expect(body.parse.externallinks).toEqual(["https://example.org/page"]);
    expect(body.parse.langlinks).toEqual([]);
    expect((await run("action=parse&page=Beta&prop=displaytitle")).body.parse.displaytitle).toBe("Beta");
    const v1 = await run("action=parse&page=Alpha&prop=properties", "format=json");
    expect(v1.body.parse.properties).toEqual([{ name: "displaytitle", "*": "alpha" }]);
  });

  it("returns the default props without templates and images", async () => {
    const { body } = await run("action=parse&page=Alpha");
    expect(Object.keys(body.parse).sort()).toEqual(
      ["categories", "displaytitle", "externallinks", "iwlinks", "langlinks", "links", "pageid", "parsewarnings", "properties", "revid", "sections", "text", "title"].sort()
    );
  });

  it("answers badvalue for templates and images (plan 406) and unknown props", async () => {
    for (const prop of ["templates", "images"]) {
      const { body } = await run(`action=parse&page=Alpha&prop=${prop}`);
      expect(body.error.code).toBe("badvalue");
      expect(body.error.info).toContain("plan 406");
    }
    expect((await run("action=parse&page=Alpha&prop=nonsense")).body.error.code).toBe("badvalue");
  });
});

describe("action=compare", () => {
  it("diffs two revisions in the diff table format, with ids and titles", async () => {
    const { body, calls } = await run("action=compare&fromrev=11&torev=12");
    expect(body.compare).toEqual({
      fromid: 1,
      fromrevid: 11,
      fromns: 0,
      fromtitle: "Alpha",
      toid: 1,
      torevid: 12,
      tons: 0,
      totitle: "Alpha",
      body: "<tr><td>old text</td><td>" + PAGE_TEXT + "</td></tr>",
    });
    expect(calls.find((c) => c.name === "diff")!.args).toEqual(["old text", PAGE_TEXT]);
    const v1 = await run("action=compare&fromrev=11&torev=21", "format=json");
    expect(v1.body.compare["*"]).toBe("<tr><td>old text</td><td>beta</td></tr>");
    expect(v1.body.compare.body).toBeUndefined();
  });

  it("compares the newest revisions of two titles and adds the requested props", async () => {
    const { body } = await run("action=compare&fromtitle=Beta&totitle=alpha&prop=diff|user|comment|parsedcomment|size|timestamp|diffsize");
    expect(body.compare).toMatchObject({
      fromuser: "Heku",
      fromuserid: 7,
      touser: "Tester",
      tocomment: "second <b>",
      toparsedcomment: "second &lt;b&gt;",
      fromsize: 4,
      tosize: Buffer.byteLength(PAGE_TEXT),
      fromtimestamp: "2026-01-03T10:00:00Z",
      totimestamp: "2026-01-02T10:00:00Z",
    });
    expect(body.compare.diffsize).toBeGreaterThan(0);
    expect(body.compare.fromid).toBeUndefined(); // ids was not asked for
  });

  it("supports a page id, torelative and bare text", async () => {
    expect((await run("action=compare&fromid=1&toid=2&prop=ids")).body.compare).toMatchObject({ fromrevid: 12, torevid: 21 });
    expect((await run("action=compare&fromrev=12&torelative=prev&prop=ids")).body.compare).toMatchObject({ fromrevid: 12, torevid: 11 });
    expect((await run("action=compare&fromrev=11&torelative=next&prop=ids")).body.compare).toMatchObject({ fromrevid: 11, torevid: 12 });
    expect((await run("action=compare&fromrev=11&torelative=cur&prop=ids")).body.compare).toMatchObject({ fromrevid: 11, torevid: 12 });
    const text = await run("action=compare&fromtext=a&totext=b");
    expect(text.body.compare).toEqual({ body: "<tr><td>a</td><td>b</td></tr>" });
  });

  it("refuses missing sides, unknown revisions, hidden text and missing pages", async () => {
    expect((await run("action=compare")).body.error.code).toBe("missingparam");
    expect((await run("action=compare&fromrev=11")).body.error.code).toBe("missingparam");
    expect((await run("action=compare&fromrev=11&torev=999")).body.error.code).toBe("nosuchrevid");
    expect((await run("action=compare&fromrev=11&torev=42")).body.error.code).toBe("missingcontent");
    expect((await run("action=compare&fromtitle=Nope&totitle=Alpha")).body.error.code).toBe("missingtitle");
    expect((await run("action=compare&fromrev=11&torelative=prev")).body.error.code).toBe("nosuchrevid");
  });
});

describe("action=opensearch", () => {
  it("answers [query, titles, descriptions, urls] with no object around it", async () => {
    const search = jest.fn(async () => ({ hits: [{ title: "Alpha", snippet: "x" }, { title: "Template:Foo", snippet: "y" }], total: 2 }));
    const wiki = await makeWikiDeps(data(), { extra: { search } });
    const body = (await call(wiki.deps, "action=opensearch&search=alp&limit=5")).body;
    expect(body).toEqual([
      "alp",
      ["Alpha", "Template:Foo"],
      ["", ""],
      ["https://ixwiki.com/wiki/Alpha", "https://ixwiki.com/wiki/Template:Foo"],
    ]);
    expect(search).toHaveBeenCalledWith("alp", "title", 5, 0);
  });

  it("needs a search term and caps the limit", async () => {
    const search = jest.fn(async () => ({ hits: [], total: 0 }));
    const wiki = await makeWikiDeps(data(), { extra: { search } });
    expect(((await call(wiki.deps, "action=opensearch")).body as Body).error.code).toBe("missingparam");
    await call(wiki.deps, "action=opensearch&search=a&limit=9999");
    expect(search).toHaveBeenCalledWith("a", "title", 100, 0);
  });
});
