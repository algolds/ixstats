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

  const html = await renderArticleViaMediaWiki("New '''body'''", "My Page");

  expect(html).toBe("<p>fresh</p>");
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
