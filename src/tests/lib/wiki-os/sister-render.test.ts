/** @jest-environment node */
/**
 * Sister wikis (IIWiki, AltHistory): a page is rendered by that wiki's own parser, never IxWiki's and never as a page
 * it parses itself, transformed and sanitized for the reader with its TemplateStyles scoped to the article; IIWiki's
 * browser render keeps links in WikiOS and strips scripts; upstream answers (429, a Cloudflare page, an API error in a
 * 200) become the right errors and are never cached.
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { renderSisterArticle, SisterRenderError } from "~/lib/wiki-os/services/sister-render-service";
import type { WikiArticle } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { renderIiwikiInBrowser } from "~/lib/wiki-os/iiwiki-browser-render";
import { TRPCError } from "@trpc/server";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";

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

  it("calls the sister's api.php directly even when a development proxy is configured (the proxy forwards GET only)", async () => {
    const previous = process.env.IIWIKI_DEV_PROXY_URL;
    process.env.IIWIKI_DEV_PROXY_URL = "http://localhost:3003/api/mediawiki/iiwiki/api.php";
    try {
      await renderSisterArticle("iiwiki", article());
    } finally {
      if (previous === undefined) delete process.env.IIWIKI_DEV_PROXY_URL;
      else process.env.IIWIKI_DEV_PROXY_URL = previous;
    }

    expect(requestedUrl().host).toBe("iiwiki.com");
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

    expect(out.contentHtml).toContain(".mw-parser-output .box{color:red}");
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
  it("does not cache a page whose revision it does not know", async () => {
    const page = article({ revId: undefined });

    await renderSisterArticle("iiwiki", page);
    await renderSisterArticle("iiwiki", page);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("IIWiki's browser render", () => {
  const PARSED =
    '<div class="mw-parser-output"><table class="infobox"><tr><td><a href="/wiki/Eurth">Eurth</a></td></tr></table>' +
    '<p>Body <a href="/wiki/Gallambria" title="Gallambria">Gallambria</a> <a href="/wiki/File:Flag.png">flag</a>' +
    "<script>alert(1)</script></p></div>";

  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => Response.json({ parse: { title: "Gylias", text: PARSED } }));
  });
  afterEach(() => fetchSpy.mockRestore());

  describe("renderIiwikiInBrowser", () => {
    it("keeps article links in WikiOS, sends files to IIWiki and strips scripts", async () => {
      const page = await renderIiwikiInBrowser("Gylias");
      expect(page?.title).toBe("Gylias");
      expect(page?.infoboxHtml).toContain('href="/wiki/Eurth?source=iiwiki"');
      expect(page?.contentHtml).toContain('href="/wiki/Gallambria?source=iiwiki"');
      expect(page?.contentHtml).toContain('href="https://iiwiki.com/wiki/File:Flag.png"');
      expect(page?.contentHtml).not.toContain("<script");
    });
    it("throws when Cloudflare refuses the browser", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("Just a moment...", { status: 403 }));
      await expect(renderIiwikiInBrowser("Gylias")).rejects.toThrow("IIWiki answered 403");
    });
  });
});

describe("upstream answers", () => {
  const realFetch = globalThis.fetch;

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function rejection(promise: Promise<unknown>): Promise<TRPCError> {
    try {
      await promise;
    } catch (error) {
      return error as TRPCError;
    }
    throw new Error("expected the call to reject");
  }

  describe("fetchMediaWikiJson", () => {
    afterEach(() => {
      globalThis.fetch = realFetch;
    });
    it("maps HTTP 429 to TOO_MANY_REQUESTS", async () => {
      globalThis.fetch = jest.fn(async () => jsonResponse({}, 429)) as unknown as typeof fetch;
      const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?429"));
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe("TOO_MANY_REQUESTS");
    });
    it("maps an HTML body (a Cloudflare challenge page) to BAD_GATEWAY", async () => {
      globalThis.fetch = jest.fn(
        async () => new Response("<html>Just a moment...</html>", { status: 200 })
      ) as unknown as typeof fetch;
      const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?html"));
      expect(error.code).toBe("BAD_GATEWAY");
    });

    it("turns an API error with HTTP 200 into BAD_GATEWAY carrying the code", async () => {
      globalThis.fetch = jest.fn(async () =>
        jsonResponse({ error: { code: "badvalue", info: "bad" } })
      ) as unknown as typeof fetch;
      const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?badvalue"));
      expect(error.code).toBe("BAD_GATEWAY");
      expect(error.message).toContain("badvalue");
    });
    it("does not cache a failure", async () => {
      const fetchMock = jest
        .fn()
        .mockImplementationOnce(async () => jsonResponse({}, 500))
        .mockImplementationOnce(async () => jsonResponse({ ok: true }));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await rejection(fetchMediaWikiJson("https://wiki.test/api.php?flaky", { cacheTtlMs: 60_000 }));
      const data = await fetchMediaWikiJson("https://wiki.test/api.php?flaky", { cacheTtlMs: 60_000 });
      expect(data).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
