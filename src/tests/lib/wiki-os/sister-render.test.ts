/** @jest-environment node */
// Plan 415 (BUG-09): a sister wiki's page is rendered by that wiki's own parser, not by IxWiki's. The request
// goes to the sister wiki's api.php (the host is asserted), carries the allow-listed user agent and the page's
// title, and the answer is transformed, sanitized and cached per (source, title, revision).
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderSisterArticle, SisterRenderError } from "~/lib/wiki-os/services/sister-render-service";
import type { WikiArticle } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";

const PARSED =
  '<div class="mw-parser-output"><table class="infobox"><tr><td><a href="/wiki/Eurth">Eurth</a></td></tr></table>' +
  '<p>Body <a href="/wiki/Gallambria" title="Gallambria">Gallambria</a><script>alert(1)</script></p></div>';

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let now = 1_000_000;
let dateSpy: jest.SpyInstance<number, []>;

const answer = (text: string = PARSED) => Response.json({ parse: { title: "T", text } });
const requestedUrl = (call = 0) => new URL(String(fetchSpy.mock.calls[call]![0]));
const sentForm = (call = 0) => new URLSearchParams(String(fetchSpy.mock.calls[call]![1]!.body));

/** A page with its own title and revision, so the module-level cache never links two tests. */
let counter = 0;
const article = (over: Partial<WikiArticle> = {}): WikiArticle => {
  counter += 1;
  return {
    title: `Aurelia ${counter}`,
    pageId: counter,
    wikitext: "'''Aurelia''' {{Infobox country|name=Aurelia}} [[Gallambria]]",
    length: 60,
    revId: 1000 + counter,
    ...over,
  };
};

beforeEach(() => {
  now = 1_000_000;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
  fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => answer());
});

afterEach(() => {
  fetchSpy.mockRestore();
  dateSpy.mockRestore();
});

describe("renderSisterArticle: the request", () => {
  it.each([
    ["iiwiki", "iiwiki.com"],
    ["althistory", "althistory.fandom.com"],
  ] as const)("posts %s's wikitext to %s's own api.php, never to IxWiki", async (source, host) => {
    const page = article();

    await renderSisterArticle(source, page);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(requestedUrl().host).toBe(host);
    expect(requestedUrl().pathname).toBe("/api.php");
    expect(requestedUrl().host).not.toMatch(/ixwiki/);
    expect(fetchSpy.mock.calls[0]![1]!.method).toBe("POST");
  });

  it("asks that wiki's parser to render the text under the page's title, and never to parse a page of its own", async () => {
    const page = article({ title: "Portal:Eurth", wikitext: "{{Eurth portal}}" });

    await renderSisterArticle("iiwiki", page);

    const form = sentForm();
    expect(form.get("action")).toBe("parse");
    expect(form.get("text")).toBe("{{Eurth portal}}");
    expect(form.get("title")).toBe("Portal:Eurth");
    expect(form.get("contentmodel")).toBe("wikitext");
    expect(form.get("prop")).toBe("text");
    expect(form.get("format")).toBe("json");
    expect(form.has("page")).toBe(false);
    expect(form.has("wrapoutputclass")).toBe(false);
  });

  it("sends the allow-listed IxStats-Builder user agent", async () => {
    await renderSisterArticle("iiwiki", article());

    const headers = fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("IxStats-Builder");
    expect(headers["Api-User-Agent"]).toBe("IxStats-Builder");
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });
});

describe("renderSisterArticle: the answer", () => {
  it("is transformed for the reader and sanitized", async () => {
    const out = await renderSisterArticle("iiwiki", article());

    expect(out.infoboxHtml).toContain('href="/wiki/Eurth?source=iiwiki"');
    expect(out.contentHtml).toContain('href="/wiki/Gallambria?source=iiwiki"');
    expect(out.contentHtml).not.toContain("<script");
    expect(out.contentHtml).not.toContain("alert(1)");
    expect(out.noticesHtml).toBeNull();
  });

  it("keeps a TemplateStyles block of the sister wiki, scoped to the article", async () => {
    fetchSpy.mockImplementation(async () =>
      answer(
        '<div class="mw-parser-output"><style data-mw-deduplicate="TemplateStyles:r1">.mw-parser-output .box{color:red}</style><p>x</p></div>'
      )
    );

    const out = await renderSisterArticle("althistory", article());

    expect(out.contentHtml).toContain(".wikios-article .box{color:red}");
  });

  it("fails by name when the wiki does not answer, says what the parser said, and never caches a failure", async () => {
    const page = article();
    fetchSpy.mockImplementation(async () => new Response("down", { status: 503 }));
    await expect(renderSisterArticle("althistory", page)).rejects.toThrow(SisterRenderError);
    await expect(renderSisterArticle("althistory", page)).rejects.toThrow(/althistory could not render the page: it did not answer/);

    fetchSpy.mockImplementation(async () => Response.json({ error: { info: "The text you tried to parse is too long." } }));
    await expect(renderSisterArticle("althistory", page)).rejects.toThrow(/too long/);

    fetchSpy.mockImplementation(async () => answer());
    await expect(renderSisterArticle("althistory", page)).resolves.toMatchObject({ toc: [] });
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});

describe("renderSisterArticle: the cache", () => {
  it("renders a revision once, whoever asks", async () => {
    const page = article();

    const first = await renderSisterArticle("iiwiki", page);
    const second = await renderSisterArticle("iiwiki", { ...page });

    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("renders again for a new revision, another wiki or another title", async () => {
    const page = article();
    await renderSisterArticle("iiwiki", page);

    await renderSisterArticle("iiwiki", { ...page, revId: page.revId! + 500 });
    await renderSisterArticle("althistory", page);
    await renderSisterArticle("iiwiki", { ...page, title: `${page.title} II` });

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("does not cache a page whose revision it does not know", async () => {
    const page = article({ revId: undefined });

    await renderSisterArticle("iiwiki", page);
    await renderSisterArticle("iiwiki", page);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("costs one request for two readers at once", async () => {
    const page = article();

    const [a, b] = await Promise.all([
      renderSisterArticle("iiwiki", page),
      renderSisterArticle("iiwiki", page),
    ]);

    expect(a).toBe(b);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps a render ten minutes", async () => {
    const page = article();
    await renderSisterArticle("iiwiki", page);

    now += 10 * 60 * 1000 - 1;
    await renderSisterArticle("iiwiki", page);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    now += 2;
    await renderSisterArticle("iiwiki", page);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
