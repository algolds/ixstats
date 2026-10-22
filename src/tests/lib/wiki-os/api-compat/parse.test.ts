/** @jest-environment node */
/** Plan 410: action=parse (stored render vs private renderer), action=compare and action=opensearch. */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";
import { diffTableHtml } from "~/lib/wiki-os/api-compat/diff-table";
import { DiffTooLargeError, diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";

/** The table the compare action answers for two texts: plan 413's engine at two lines of context, laid out as MediaWiki's rows. */
const tableOf = (from: string, to: string) => diffTableHtml(diffWikitext(from, to, { context: 2 }), 2 * 1024 * 1024);

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

/** The same request from a bot-password session: `parse&text=` needs one. */
async function runBot(params: string, version = "formatversion=2") {
  const wiki = await makeWikiDeps(data());
  await loggedIn(wiki.bot);
  const body = (await wiki.bot.get(Object.fromEntries(new URLSearchParams(`${params}&${version}`)))) as Body;
  return { body, calls: wiki.calls };
}

describe("action=parse", () => {
  it("serves the stored rendering of a page without calling the renderer", async () => {
    const { body, calls } = await run("action=parse&page=Alpha&prop=text|revid");
    expect(body.parse).toEqual({ title: "Alpha", pageid: 1, text: "<p>stored html of Alpha</p>", revid: 12 });
    expect(calls.filter((c) => c.name === "renderWikitext")).toHaveLength(0);
  });
  it("renders the page's wikitext through the private renderer when the stored one is stale", async () => {
    const { body, calls } = await run("action=parse&page=Stale&prop=text");
    expect(body.parse.text).toBe("<p>rendered(Stale): stale wikitext</p>");
    // the render service renders and stores it (single-flight); the response is what it stored
    expect(calls.find((c) => c.name === "ensureRendered")!.args).toEqual(["art:Stale"]);
    expect(calls.filter((c) => c.name === "renderWikitext")).toHaveLength(0);
  });
  it("refuses text= without a bot-password session (permissiondenied), and past 200,000 characters (toobig)", async () => {
    const anonymous = await run("action=parse&text=%27%27hi%27%27&prop=text");
    expect(anonymous.body.error.code).toBe("permissiondenied");
    expect(anonymous.calls.filter((c) => c.name === "renderWikitext")).toHaveLength(0);
    expect((await runBot(`action=parse&text=${"a".repeat(200_001)}&prop=text`)).body.error.code).toBe("toobig");
    expect((await runBot(`action=parse&text=${"a".repeat(200_000)}&prop=text`)).body.parse.text).toContain("rendered(API)");
  });

  it("keeps page=, pageid= and oldid= open to everyone", async () => {
    expect((await run("action=parse&page=Alpha&prop=text")).body.parse.title).toBe("Alpha");
    expect((await run("action=parse&pageid=1&prop=text")).body.parse.title).toBe("Alpha");
    expect((await run("action=parse&oldid=11&prop=text")).body.parse.title).toBe("Alpha");
  });

  it("limits what one parse lists and renders old revisions of anonymous callers through the render bucket", async () => {
    const wiki = await makeWikiDeps(data(), {
      extra: { rateLimit: async (_key, bucket) => ({ success: bucket !== "wiki_api_render", resetAt: new Date(0) }) },
    });
    const refused = (await call(wiki.deps, "action=parse&oldid=11&prop=text&formatversion=2")).body as Body;
    expect(refused.error.code).toBe("ratelimited");
    // a page with a fresh stored rendering costs no render and no bucket
    expect(((await call(wiki.deps, "action=parse&page=Alpha&prop=text&formatversion=2")).body as Body).parse.text).toBe("<p>stored html of Alpha</p>");
  });

  it("answers renderunavailable, never the compiler's output, when the private renderer fails", async () => {
    const down = { renderWikitext: async () => null, ensureRendered: async () => undefined };
    const wiki = await makeWikiDeps(data(), { services: down });
    await loggedIn(wiki.bot);
    // bot text=
    const text = (await wiki.bot.get({ action: "parse", text: "[[".repeat(1000), prop: "text", formatversion: "2" })) as Body;
    expect(text.error.code).toBe("renderunavailable");
    // anonymous oldid=
    const old = (await call(wiki.deps, "action=parse&oldid=11&prop=text&formatversion=2")).body as Body;
    expect(old.error.code).toBe("renderunavailable");
    // a stale page whose render failed and that has no stored rendering
    const stale = (await call(wiki.deps, "action=parse&page=Stale&prop=text&formatversion=2")).body as Body;
    expect(stale.error.code).toBe("renderunavailable");
    // props that need no rendering still work
    expect(((await call(wiki.deps, "action=parse&oldid=11&prop=wikitext|revid&formatversion=2")).body as Body).parse.revid).toBe(11);
    // an empty text is empty html, with no renderer call
    expect((await runBot("action=parse&text=%20&prop=text")).body.parse.text).toBe("");
  });
  it("follows a redirect when asked, and refuses a missing page or no source", async () => {
    expect((await run("action=parse&page=Gamma&redirects&prop=revid")).body.parse.title).toBe("Alpha");
    expect((await run("action=parse&page=Gamma&prop=revid")).body.parse.title).toBe("Gamma");
    expect((await run("action=parse&page=Nope")).body.error.code).toBe("missingtitle");
    expect((await run("action=parse&pageid=99")).body.error.code).toBe("nosuchpageid");
    expect((await run("action=parse")).body.error.code).toBe("missingparam");
    expect((await run("action=parse&pageid=1&prop=revid")).body.parse.title).toBe("Alpha");
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
      body: tableOf("old text", PAGE_TEXT),
    });
    expect(body.compare.body).toContain('<td class="diff-deletedline">');
    expect(body.compare.body).toContain("Intro with [[Beta]] and"); // the new text's lines
    expect(calls.find((c) => c.name === "diff")!.args).toEqual(["old text", PAGE_TEXT, { context: 2 }]);
    const v1 = await run("action=compare&fromrev=11&torev=21", "format=json");
    expect(v1.body.compare["*"]).toBe(tableOf("old text", "beta"));
    expect(v1.body.compare.body).toBeUndefined();
  });

  it("refuses fromtext or totext over 200,000 characters, and a diff over 2 MB, with toobig", async () => {
    const big = "a".repeat(200_001);
    const post = (params: Record<string, string>, services = {}) =>
      makeWikiDeps(data(), { services }).then(async (wiki) => (await call(wiki.deps, "action=compare&formatversion=2", { method: "POST", body: params })).body as Body);
    expect((await post({ fromtext: big, totext: "b" })).error.code).toBe("toobig");
    expect((await post({ fromtext: "a", totext: big })).error.code).toBe("toobig");
    expect((await post({ fromtext: "a".repeat(200_000), totext: "b" })).error).toBeUndefined();
    // the engine's own refusals: a text over 2 MB, and one over 20,000 lines
    expect((await post({ fromtext: "a", totext: "b" }, { diff: () => { throw new DiffTooLargeError(); } })).error.code).toBe("toobig");
    const manyLines = Array.from({ length: 25_000 }, (_, i) => `l${i}`).join("\n");
    expect(manyLines.length).toBeLessThan(200_000);
    expect((await post({ fromtext: manyLines, totext: `${manyLines}\nmore` })).error.code).toBe("toobig");
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
