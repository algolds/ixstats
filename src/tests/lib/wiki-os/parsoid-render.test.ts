/** @jest-environment node */
/**
 * NEW-3: a saved article is rendered from its Postgres wikitext (`action=parse&text=`), not from
 * MediaWiki's copy of the page (`&page=`), which is stale until the background export lands.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { renderArticleViaMediaWiki } from "~/lib/wiki-os/adapters/mediawiki/parsoid";

const realFetch = globalThis.fetch;
const fetchMock = jest.fn();

const okParse = (text: string) =>
  new Response(JSON.stringify({ parse: { text } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = fetchMock as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

test("renders the given wikitext with text= and the title as context", async () => {
  fetchMock.mockResolvedValue(okParse("<p>fresh</p>"));

  const rendered = await renderArticleViaMediaWiki("New '''body'''", "My Page");

  expect(rendered?.html).toBe("<p>fresh</p>");
  const [, init] = fetchMock.mock.calls[0]!;
  expect(init.method).toBe("POST");
  const body = new URLSearchParams(String(init.body));
  expect(body.get("action")).toBe("parse");
  expect(body.get("text")).toBe("New '''body'''");
  expect(body.get("title")).toBe("My Page");
  expect(body.has("page")).toBe(false);
});

test("returns null when MediaWiki is unreachable or answers with an error", async () => {
  fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
  expect(await renderArticleViaMediaWiki("x", "T")).toBeNull();

  fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
  expect(await renderArticleViaMediaWiki("x", "T")).toBeNull();

  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { info: "bad" } })));
  expect(await renderArticleViaMediaWiki("x", "T")).toBeNull();
});

describe("what MediaWiki reports about the page (plan 406)", () => {
  const okParseWith = (parse: Record<string, unknown>) =>
    new Response(JSON.stringify({ parse: { text: "<p>x</p>", ...parse } }), { status: 200 });

  it("asks for the page's links, templates, images, categories, properties and display title in the same request", async () => {
    fetchMock.mockResolvedValue(okParse("<p>x</p>"));

    await renderArticleViaMediaWiki("x", "T");

    const body = new URLSearchParams(String(fetchMock.mock.calls[0]![1].body));
    expect(body.get("prop")).toBe("text|links|templates|images|categories|properties|displaytitle");
    expect(body.get("formatversion")).toBe("2");
  });

  it("returns the links, templates (modules included), images and categories as MediaWiki reports them", async () => {
    fetchMock.mockResolvedValue(
      okParseWith({
        links: [
          { ns: 0, exists: true, title: "Eurth" },
          { ns: 14, exists: true, title: "Category:Countries" },
        ],
        templates: [
          { ns: 10, exists: true, title: "Template:Infobox country" },
          { ns: 828, exists: true, title: "Module:Infobox" },
        ],
        images: ["Flag_of_Eurth.svg"],
        categories: [
          { sortkey: "", category: "Countries_in_Eurth" },
          { sortkey: "Aurelia", category: "Tracking_category", hidden: true },
          { sortkey: "", category: "Old_style", hidden: "" },
        ],
        properties: { defaultsort: "Aurelia", notoc: "", displaytitle: "<i>Aurelia</i>" },
        displaytitle: "<i>Aurelia</i>",
      })
    );

    const rendered = await renderArticleViaMediaWiki("x", "T");

    expect(rendered?.metadata).toEqual({
      links: [
        { ns: 0, title: "Eurth" },
        { ns: 14, title: "Category:Countries" },
      ],
      templates: [
        { ns: 10, title: "Template:Infobox country" },
        { ns: 828, title: "Module:Infobox" },
      ],
      images: ["Flag_of_Eurth.svg"],
      categories: [
        { name: "Countries_in_Eurth", sortKey: null, hidden: false },
        { name: "Tracking_category", sortKey: "Aurelia", hidden: true },
        { name: "Old_style", sortKey: null, hidden: true },
      ],
      displayTitle: "<i>Aurelia</i>",
      properties: { defaultsort: "Aurelia", notoc: "", displaytitle: "<i>Aurelia</i>" },
    });
  });

  it("has no display title unless the page sets one (MediaWiki always reports the plain title)", async () => {
    fetchMock.mockResolvedValue(
      okParseWith({
        displaytitle: '<span class="mw-page-title-main">Aurelia</span>',
        properties: {},
      })
    );

    expect((await renderArticleViaMediaWiki("x", "T"))?.metadata.displayTitle).toBeNull();
  });

  it("reads a field it cannot understand as not reported (null), and still returns the HTML", async () => {
    fetchMock.mockResolvedValue(
      okParseWith({
        links: "nonsense",
        templates: [{ title: 5 }],
        images: { a: 1 },
        categories: 3,
        properties: [],
      })
    );

    const rendered = await renderArticleViaMediaWiki("x", "T");

    expect(rendered?.html).toBe("<p>x</p>");
    expect(rendered?.metadata).toMatchObject({
      links: null,
      templates: null,
      images: null,
      categories: null,
      properties: {},
    });
  });

  it("an empty list is a report of nothing, not an unknown", async () => {
    fetchMock.mockResolvedValue(
      okParseWith({ links: [], templates: [], images: [], categories: [] })
    );

    expect((await renderArticleViaMediaWiki("x", "T"))?.metadata).toMatchObject({
      links: [],
      templates: [],
      images: [],
      categories: [],
    });
  });
});
