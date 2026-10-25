/** @jest-environment node */
/**
 * Sister wikis (IIWiki, AltHistory): a page is rendered by that wiki's own parser, never IxWiki's, as the revision
 * WikiOS read (`action=parse&oldid=`, a GET through the wiki's configured api.php, so iiwiki's development relay
 * carries it past Cloudflare), transformed and sanitized for the reader with its TemplateStyles scoped to the
 * article. A wiki that cannot be reached throws WikiUnavailableError (upstream-guard.ts); upstream answers (429, a
 * Cloudflare page, a timeout, an API error in a 200) become the right errors and are never cached.
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  renderSisterArticle,
  SisterRenderError,
} from "~/lib/wiki-os/services/sister-render-service";
import type { WikiArticle } from "~/lib/wiki-os/adapters/mediawiki/bridge/types";
import { TRPCError } from "@trpc/server";
import { fetchMediaWikiJson } from "~/lib/wiki-os/upstream-fetch";
import { upstreamGuard, WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { DEFAULT_USER_AGENT, mediaWikiApiUrl } from "~/lib/wiki-os/config";

const PARSED =
  '<div class="mw-parser-output"><table class="infobox"><tr><td><a href="/wiki/Eurth">Eurth</a></td></tr></table>' +
  '<p>Body <a href="/wiki/Gallambria" title="Gallambria">Gallambria</a><script>alert(1)</script></p></div>';

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let now = 1_000_000;
let dateSpy: jest.SpyInstance<number, []>;

/** The title MediaWiki parses under: the page the request named (set by `article`). */
let parsedTitle = "T";
const answer = (text: string = PARSED) => Response.json({ parse: { title: parsedTitle, text } });
const requestedUrl = (call = 0) => new URL(String(fetchSpy.mock.calls[call]![0]));

/** A page with its own title and revision, so the module-level cache never links two tests. */
let counter = 0;
const article = (over: Partial<WikiArticle> = {}): WikiArticle => {
  counter += 1;
  const page = {
    title: `Aurelia ${counter}`,
    pageId: counter,
    wikitext: "'''Aurelia''' {{Infobox country|name=Aurelia}} [[Gallambria]]",
    length: 60,
    revId: 1000 + counter,
    ...over,
  };
  parsedTitle = page.title;
  return page;
};

/** Runs `work` with iiwiki's development relay set to `url`. */
async function withRelay(url: string, work: () => Promise<object>): Promise<void> {
  const previous = process.env.IIWIKI_DEV_PROXY_URL;
  process.env.IIWIKI_DEV_PROXY_URL = url;
  try {
    await work();
  } finally {
    if (previous === undefined) delete process.env.IIWIKI_DEV_PROXY_URL;
    else process.env.IIWIKI_DEV_PROXY_URL = previous;
  }
}

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
  ] as const)("asks %s's own api.php (%s), never IxWiki's", async (source, host) => {
    await renderSisterArticle(source, article());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(requestedUrl().host).toBe(host);
    expect(requestedUrl().pathname).toBe("/api.php");
    expect(requestedUrl().host).not.toMatch(/ixwiki/);
  });

  it("goes through iiwiki's development relay when one is configured, as a GET with no form", async () => {
    await withRelay("http://localhost:3003/api/mediawiki/iiwiki/api.php", () =>
      renderSisterArticle("iiwiki", article())
    );

    expect(requestedUrl().host).toBe("localhost:3003");
    expect(requestedUrl().pathname).toBe("/api/mediawiki/iiwiki/api.php");
    const init = fetchSpy.mock.calls[0]![1];
    expect(init?.method).toBeUndefined();
    expect(init?.body).toBeUndefined();
  });

  it("waits up to 15 seconds for the render, through the guard", async () => {
    const guarded = jest.spyOn(upstreamGuard, "fetch");
    try {
      await renderSisterArticle("iiwiki", article());
      expect(guarded.mock.calls[0]![1]).toEqual({ timeoutMs: 15_000 });
    } finally {
      guarded.mockRestore();
    }
  });

  it("asks that wiki's parser for the revision WikiOS read, never to parse text it sends", async () => {
    await renderSisterArticle(
      "iiwiki",
      article({ title: "Portal:Eurth", wikitext: "{{Eurth portal}}", revId: 77 })
    );

    const query = requestedUrl().searchParams;
    expect(query.get("action")).toBe("parse");
    expect(query.get("oldid")).toBe("77");
    expect(query.get("prop")).toBe("text");
    expect(query.get("disableeditsection")).toBe("1");
    expect(query.get("disablelimitreport")).toBe("1");
    expect(query.get("formatversion")).toBe("2");
    expect(query.get("format")).toBe("json");
    expect(query.has("text")).toBe(false);
    expect(query.has("page")).toBe(false);
  });

  it("asks for the page by title when its revision is unknown", async () => {
    await renderSisterArticle("iiwiki", article({ title: "Gylias", revId: undefined }));

    const query = requestedUrl().searchParams;
    expect(query.get("page")).toBe("Gylias");
    expect(query.has("oldid")).toBe(false);
  });

  it("refuses the parse of another page (a relay that drops `oldid` parses an empty page called API)", async () => {
    const page = article();
    fetchSpy.mockImplementation(async () =>
      Response.json({ parse: { title: "API", text: '<div class="mw-parser-output"></div>' } })
    );

    await expect(renderSisterArticle("iiwiki", page)).rejects.toThrow(
      /iiwiki could not render the page: it parsed "API"/
    );
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

  it("an unreachable wiki throws WikiUnavailableError, not SisterRenderError, and nothing is cached", async () => {
    const page = article();
    fetchSpy.mockImplementation(async () => new Response("down", { status: 503 }));
    const error = await renderSisterArticle("althistory", page).catch((e: Error) => e);
    expect(error).toBeInstanceOf(WikiUnavailableError);
    expect(error).not.toBeInstanceOf(SisterRenderError);
    expect(error).toMatchObject({ wiki: "AltHistory Wiki", trpcCode: "SERVICE_UNAVAILABLE" });

    fetchSpy.mockImplementation(async () =>
      Response.json({ error: { code: "nosuchrevid", info: "There is no revision with ID 1." } })
    );
    const refusal = renderSisterArticle("althistory", page);
    await expect(refusal).rejects.toBeInstanceOf(SisterRenderError);
    await expect(refusal).rejects.toThrow(
      /althistory could not render the page: There is no revision with ID 1/
    );

    fetchSpy.mockImplementation(async () => answer());
    await expect(renderSisterArticle("althistory", page)).resolves.toMatchObject({ toc: [] });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["no parse and no error", {}],
    ["null", null],
  ])("an answer with %s says no parse result", async (_case, body) => {
    fetchSpy.mockImplementation(async () => Response.json(body));

    await expect(renderSisterArticle("iiwiki", article())).rejects.toThrow(
      /iiwiki could not render the page: no parse result/
    );
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

describe("upstream answers", () => {
  function jsonResponse(body: object | null, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function rejection(promise: Promise<object>): Promise<Error> {
    try {
      await promise;
    } catch (error) {
      return error as Error;
    }
    throw new Error("expected the call to reject");
  }

  describe("fetchMediaWikiJson", () => {
    it("refuses IxWiki's own internal and public api.php, so its loopback never meets the guard", async () => {
      const previous = process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
      process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8089/w/api.php";
      try {
        let isolated!: {
          fetch: typeof fetchMediaWikiJson;
          apiUrl: typeof mediaWikiApiUrl;
        };
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const upstream =
            require("~/lib/wiki-os/upstream-fetch") as typeof import("~/lib/wiki-os/upstream-fetch");
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const config = require("~/lib/wiki-os/config") as typeof import("~/lib/wiki-os/config");
          isolated = { fetch: upstream.fetchMediaWikiJson, apiUrl: config.mediaWikiApiUrl };
        });
        const internal = isolated.apiUrl({ internal: true });
        const external = isolated.apiUrl({ internal: false });
        expect(new URL(internal).host).not.toBe(new URL(external).host);

        for (const url of [internal, external]) {
          await expect(isolated.fetch(`${url}?action=query&format=json`)).rejects.toThrow(
            /never IxWiki's own engine/
          );
        }
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        if (previous === undefined) delete process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
        else process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = previous;
      }
    });

    it("the refusal is a programming error, not an unreachable wiki", async () => {
      const error = await rejection(
        fetchMediaWikiJson(`${mediaWikiApiUrl({ internal: false })}?action=query`)
      );
      expect(error).not.toBeInstanceOf(WikiUnavailableError);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("HTTP 429 is busy (TOO_MANY_REQUESTS)", async () => {
      fetchSpy.mockImplementation(async () => jsonResponse({}, 429));
      const error = await rejection(fetchMediaWikiJson("https://busy.test/api.php?429"));
      expect(error).toBeInstanceOf(WikiUnavailableError);
      expect(error).toMatchObject({ reason: "busy", trpcCode: "TOO_MANY_REQUESTS" });
    });

    it("an HTML body (a Cloudflare challenge page) is unavailable (SERVICE_UNAVAILABLE)", async () => {
      fetchSpy.mockImplementation(
        async () => new Response("<html>Just a moment...</html>", { status: 200 })
      );
      const error = await rejection(fetchMediaWikiJson("https://iiwiki.com/api.php?html"));
      expect(error).toBeInstanceOf(WikiUnavailableError);
      expect(error).toMatchObject({ wiki: "IIWiki", trpcCode: "SERVICE_UNAVAILABLE" });
    });

    it("a JSON answer that does not parse is unavailable", async () => {
      fetchSpy.mockImplementation(
        async () => new Response('{"query":', { headers: { "Content-Type": "application/json" } })
      );
      const error = await rejection(fetchMediaWikiJson("https://cut.test/api.php?half"));
      expect(error).toBeInstanceOf(WikiUnavailableError);
      expect(error).toMatchObject({ reason: "unreachable", trpcCode: "SERVICE_UNAVAILABLE" });
    });

    it("a timeout is unavailable", async () => {
      fetchSpy.mockImplementation(async (_url, init) => {
        await new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        );
        return jsonResponse({});
      });
      const error = await rejection(
        fetchMediaWikiJson("https://slow.test/api.php?wait", { timeoutMs: 20 })
      );
      expect(error).toBeInstanceOf(WikiUnavailableError);
      expect(error).toMatchObject({ reason: "unreachable", trpcCode: "SERVICE_UNAVAILABLE" });
    });

    it("sends the caller's user agent", async () => {
      fetchSpy.mockImplementation(async () => jsonResponse({ ok: true }));
      await fetchMediaWikiJson("https://ua.test/api.php?ua", {
        userAgent: "IxStats-Builder/1.0 (contact)",
      });
      const init = fetchSpy.mock.calls[0]![1];
      expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(
        "IxStats-Builder/1.0 (contact)"
      );
    });

    it("a status the wiki answered that is not OK is BAD_GATEWAY with the status", async () => {
      fetchSpy.mockImplementation(async () => jsonResponse({}, 404));
      const error = await rejection(fetchMediaWikiJson("https://gone.test/api.php?404"));
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_GATEWAY");
      expect(error.message).toContain("404");
    });

    it("an API error in a 200 is BAD_GATEWAY with its code; ratelimited and maxlag are TOO_MANY_REQUESTS", async () => {
      fetchSpy.mockImplementation(async () =>
        jsonResponse({ error: { code: "badvalue", info: "bad" } })
      );
      const error = await rejection(fetchMediaWikiJson("https://wiki.test/api.php?badvalue"));
      expect((error as TRPCError).code).toBe("BAD_GATEWAY");
      expect(error.message).toContain("badvalue");

      for (const code of ["ratelimited", "maxlag"]) {
        fetchSpy.mockImplementation(async () => jsonResponse({ error: { code } }));
        const limited = await rejection(fetchMediaWikiJson(`https://wiki.test/api.php?${code}`));
        expect((limited as TRPCError).code).toBe("TOO_MANY_REQUESTS");
      }
    });

    it("waits 8 seconds by default, as IxStats-Builder, through the guard", async () => {
      const guarded = jest.spyOn(upstreamGuard, "fetch");
      try {
        fetchSpy.mockImplementation(async () => jsonResponse({ ok: true }));
        await fetchMediaWikiJson("https://defaults.test/api.php?d");
        await fetchMediaWikiJson("https://defaults.test/api.php?e", { timeoutMs: 3000 });

        expect(guarded.mock.calls.map(([, request]) => request)).toEqual([
          { timeoutMs: 8000, userAgent: DEFAULT_USER_AGENT },
          { timeoutMs: 3000, userAgent: DEFAULT_USER_AGENT },
        ]);
      } finally {
        guarded.mockRestore();
      }
    });

    it("releases the connection of a status it refuses", async () => {
      let cancelled = false;
      fetchSpy.mockImplementation(
        async () =>
          new Response(new ReadableStream({ cancel: () => void (cancelled = true) }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
      );

      await rejection(fetchMediaWikiJson("https://refused.test/api.php?400"));
      expect(cancelled).toBe(true);
    });

    it.each([
      ["an empty error code", { error: { code: "" } }],
      ["an error code that is not text", { error: { code: 7 } }],
      ["an error with no code", { error: null }],
      ["nothing", null],
    ])("an answer with %s is the wiki's data", async (_case, body) => {
      fetchSpy.mockImplementation(async () => jsonResponse(body));

      await expect(fetchMediaWikiJson("https://odd.test/api.php?x")).resolves.toEqual(body);
    });

    it("a failure is not cached; a success is", async () => {
      fetchSpy
        .mockImplementationOnce(async () => jsonResponse({}, 500))
        .mockImplementationOnce(async () => jsonResponse({ ok: true }));

      await rejection(
        fetchMediaWikiJson("https://wiki.test/api.php?flaky", { cacheTtlMs: 60_000 })
      );
      const data = await fetchMediaWikiJson("https://wiki.test/api.php?flaky", {
        cacheTtlMs: 60_000,
      });
      expect(data).toEqual({ ok: true });
      await fetchMediaWikiJson("https://wiki.test/api.php?flaky", { cacheTtlMs: 60_000 });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
