/** @jest-environment node */
/**
 * The bridge's readers of IIWiki and AltHistory (http-reader.ts): a redirect title reads the page it names (and
 * says where it was redirected from), page images go through the wiki's configured api.php (iiwiki's development
 * relay), and so do category members and authors. A missing page is null and a search with no match is empty, but a
 * wiki that cannot be reached throws WikiUnavailableError (upstream-guard.ts), and one refusal (a Cloudflare
 * challenge's 403) never takes a host offline.
 */
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { getArticleBySlug: jest.fn() },
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  fetchMediaWikiPageAuthorsAndRevisions,
  fetchPageImagesHttp,
  httpGetCategoryMembers,
  readSisterWikitext,
  searchSisterWiki,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { upstreamGuard, WikiUnavailableError } from "~/lib/wiki-os/upstream-guard";
import { getBatchWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge/batch-reader";
import {
  getArticleWikitext,
  getCategoryMembers,
  getPageImages,
  searchPages,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/dispatchers";
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
/**
 * The clock moves an hour on per test, past any cooldown, so a circuit a test opened on a shared host (iiwiki.com)
 * lets the next test's first call through as its probe (the guard's state lives as long as the module).
 */
let now = 1_000_000;
let dateSpy: jest.SpyInstance<number, []>;

const requestedUrl = (call = 0) => new URL(String(fetchSpy.mock.calls[call]![0]));

const BASHAN_TEXT =
  "{{Infobox country\n|conventional_long_name = Bashan Protectorate\n|capital = Aurelia\n}}\n" +
  "'''Bashan''' is a protectorate on Eurth.";

/** `action=query` with `redirects=1` for "Bashan": MediaWiki follows the redirect and says so. */
const redirectedQuery = () =>
  Response.json({
    query: {
      redirects: [{ from: "Bashan", to: "Bashan Protectorate" }],
      pages: {
        "41": {
          pageid: 41,
          title: "Bashan Protectorate",
          revisions: [{ revid: 900, slots: { main: { "*": BASHAN_TEXT } } }],
        },
      },
    },
  });

/** The redirect page itself, which a query without `redirects=1` reads. */
const redirectPage = () =>
  Response.json({
    query: {
      pages: {
        "40": {
          pageid: 40,
          title: "Bashan",
          revisions: [
            { revid: 899, slots: { main: { "*": "#REDIRECT [[Bashan Protectorate]]" } } },
          ],
        },
      },
    },
  });

beforeEach(() => {
  now += 3_600_000;
  dateSpy = jest.spyOn(Date, "now").mockImplementation(() => now);
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (input) =>
      new URL(String(input)).searchParams.get("redirects") === "1"
        ? redirectedQuery()
        : redirectPage()
    );
});

afterEach(() => {
  fetchSpy.mockRestore();
  dateSpy.mockRestore();
});

describe("a redirect title", () => {
  it.each(["iiwiki", "althistory"] as const)(
    "on %s reads the page it names, and where it came from",
    async (source) => {
      const page = await readSisterWikitext(source, "Bashan");

      expect(requestedUrl().searchParams.get("redirects")).toBe("1");
      expect(page).toMatchObject({
        title: "Bashan Protectorate",
        redirectedFrom: "Bashan",
        revId: 900,
        wikitext: BASHAN_TEXT,
      });
    }
  );

  it("is not called redirected when the wiki only normalised the title", async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({
        query: {
          normalized: [{ from: "bashan Protectorate", to: "Bashan Protectorate" }],
          pages: { "41": { pageid: 41, title: "Bashan Protectorate", revisions: [] } },
        },
      })
    );

    const page = await readSisterWikitext("iiwiki", "bashan Protectorate");

    expect(page?.title).toBe("Bashan Protectorate");
    expect(page?.redirectedFrom).toBeUndefined();
  });

  it("gives an Eurth country profile the infobox of the page it names (wikiCache.getCountryProfile)", async () => {
    const profile = await wikiCacheService.getCountryProfile("Bashan", "iiwiki");

    expect(profile?.infobox).not.toBeNull();
    expect(profile?.infobox?.capital).toBe("Aurelia");
    expect(profile?.sections[0]?.content).not.toMatch(/#REDIRECT/i);
  });
});

describe("page images", () => {
  it("go through iiwiki's development relay when one is configured", async () => {
    const previous = process.env.IIWIKI_DEV_PROXY_URL;
    process.env.IIWIKI_DEV_PROXY_URL = "http://localhost:3003/api/mediawiki/iiwiki/api.php";
    fetchSpy.mockImplementation(async () => Response.json({ query: { pages: { "1": {} } } }));
    try {
      await fetchPageImagesHttp("Relay Images Land", "iiwiki");
    } finally {
      if (previous === undefined) delete process.env.IIWIKI_DEV_PROXY_URL;
      else process.env.IIWIKI_DEV_PROXY_URL = previous;
    }

    expect(requestedUrl().host).toBe("localhost:3003");
    expect(requestedUrl().searchParams.get("titles")).toBe("Relay Images Land");
    expect(requestedUrl().searchParams.get("prop")).toBe("images");
  });
});

describe("a missing page and an unreachable wiki", () => {
  const missing = () =>
    Response.json({ query: { pages: { "-1": { ns: 0, title: "Nowhere Land", missing: "" } } } });

  it.each([
    ["iiwiki", "IIWiki"],
    ["althistory", "AltHistory Wiki"],
  ] as const)(
    "on %s: a missing page is null; an unreachable wiki throws WikiUnavailableError naming it",
    async (source, name) => {
      fetchSpy.mockImplementation(async () => missing());
      await expect(readSisterWikitext(source, "Nowhere Land")).resolves.toBeNull();

      fetchSpy.mockImplementation(async () => new Response("down", { status: 503 }));
      const error = await readSisterWikitext(source, "Nowhere Land").catch((e: Error) => e);
      expect(error).toBeInstanceOf(WikiUnavailableError);
      expect(error).toMatchObject({ wiki: name, trpcCode: "SERVICE_UNAVAILABLE" });
    }
  );

  it.each([
    [
      "a status that is not OK (the wiki's api.php is not there)",
      () => new Response("{}", { status: 404, headers: { "content-type": "application/json" } }),
    ],
    [
      "a JSON answer that does not parse",
      () => new Response('{"query":', { headers: { "content-type": "application/json" } }),
    ],
  ])("%s is unreachable, never a missing page", async (_case, reply) => {
    fetchSpy.mockImplementation(async () => reply());

    const error = await readSisterWikitext("althistory", "Nowhere Land").catch((e: Error) => e);

    expect(error).toBeInstanceOf(WikiUnavailableError);
    expect(error).toMatchObject({ wiki: "AltHistory Wiki", reason: "unreachable" });
  });

  it.each([
    ["ratelimited", "busy"],
    ["maxlag", "busy"],
    ["readapidenied", "unreachable"],
    ["", "unreachable"],
  ])(
    "an API error in a 200 (%p) is WikiUnavailableError (%s), never a missing page or an empty list",
    async (code, reason) => {
      fetchSpy.mockImplementation(async () => Response.json({ error: { code, info: "x" } }));

      for (const read of [
        readSisterWikitext("iiwiki", "Nowhere Land"),
        searchSisterWiki("iiwiki", "Gyl"),
        httpGetCategoryMembers("Eurth", 10, undefined, "iiwiki"),
      ]) {
        const error = await read.catch((e: Error) => e);
        expect(error).toBeInstanceOf(WikiUnavailableError);
        expect(error).toMatchObject({ wiki: "IIWiki", reason });
      }
    }
  );

  it("a search with no match is empty; an unreachable wiki throws", async () => {
    fetchSpy.mockImplementation(async () => Response.json(["Zzyzx", [], [], []]));
    await expect(searchSisterWiki("iiwiki", "Zzyzx")).resolves.toEqual([]);

    fetchSpy.mockImplementation(async () =>
      Response.json(["Gyl", ["Gylias", "Gylian Navy"], [], []])
    );
    await expect(searchSisterWiki("althistory", "Gyl", 5)).resolves.toEqual([
      { title: "Gylias", pageId: 0, length: 0 },
      { title: "Gylian Navy", pageId: 1, length: 0 },
    ]);
    expect(requestedUrl(1).searchParams.get("action")).toBe("opensearch");
    expect(requestedUrl(1).searchParams.get("limit")).toBe("5");

    fetchSpy.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(searchSisterWiki("iiwiki", "Gyl")).rejects.toBeInstanceOf(WikiUnavailableError);
  });

  it("page images: none is null; an unreachable wiki throws", async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ query: { pages: { "7": { title: "Imageless Land" } } } })
    );
    await expect(fetchPageImagesHttp("Imageless Land", "althistory")).resolves.toBeNull();

    fetchSpy.mockImplementation(async () => new Response("<html>Just a moment...</html>"));
    await expect(fetchPageImagesHttp("Imageless Land", "althistory")).rejects.toBeInstanceOf(
      WikiUnavailableError
    );
  });
});

describe("category members and authors", () => {
  const RELAY = "http://localhost:3003/api/mediawiki/iiwiki/api.php";

  async function withRelay<T>(work: () => Promise<T>): Promise<T> {
    const previous = process.env.IIWIKI_DEV_PROXY_URL;
    process.env.IIWIKI_DEV_PROXY_URL = RELAY;
    try {
      return await work();
    } finally {
      if (previous === undefined) delete process.env.IIWIKI_DEV_PROXY_URL;
      else process.env.IIWIKI_DEV_PROXY_URL = previous;
    }
  }

  const members = () =>
    Response.json({
      query: {
        categorymembers: [
          { pageid: 1, title: "Gylias", ns: 0 },
          { pageid: 2, title: "Category:Gylian cities", ns: 14 },
          { pageid: 3, title: "File:Flag of Gylias.svg", ns: 6 },
        ],
      },
    });

  const revisions = () =>
    Response.json({
      query: {
        pages: {
          "12": {
            pageid: 12,
            title: "Gylias",
            revisions: [
              {
                revid: 30,
                timestamp: "2026-03-01T00:00:00Z",
                user: "Ana",
                comment: "c",
                size: 300,
              },
              { revid: 20, timestamp: "2026-02-01T00:00:00Z", user: "Ben", comment: "", size: 200 },
              { revid: 10, timestamp: "2026-01-01T00:00:00Z", user: "Ana", size: 100 },
            ],
          },
        },
      },
    });

  it("go through the wiki's configured api.php (the development relay for iiwiki)", async () => {
    fetchSpy.mockImplementation(async () => members());
    const listed = await withRelay(() =>
      httpGetCategoryMembers("Category:Gylias", 500, "page", "iiwiki")
    );

    expect(requestedUrl(0).href.startsWith(RELAY)).toBe(true);
    expect(requestedUrl(0).searchParams.get("list")).toBe("categorymembers");
    expect(requestedUrl(0).searchParams.get("cmtitle")).toBe("Category:Gylias");
    expect(requestedUrl(0).searchParams.get("cmlimit")).toBe("100");
    expect(requestedUrl(0).searchParams.get("cmtype")).toBe("page");
    expect(listed.members).toEqual([
      { pageid: 1, title: "Gylias", type: "page" },
      { pageid: 2, title: "Category:Gylian cities", type: "subcat" },
      { pageid: 3, title: "File:Flag of Gylias.svg", type: "file" },
    ]);

    fetchSpy.mockImplementation(async () => revisions());
    const authors = await withRelay(() =>
      fetchMediaWikiPageAuthorsAndRevisions("Gylias_(country)", "iiwiki", 900, 2500)
    );

    expect(requestedUrl(1).href.startsWith(RELAY)).toBe(true);
    expect(requestedUrl(1).searchParams.get("titles")).toBe("Gylias (country)");
    expect(requestedUrl(1).searchParams.get("rvlimit")).toBe("500");
    expect(requestedUrl(1).searchParams.get("rvdir")).toBe("older");
    expect(authors).toMatchObject({
      creator: { username: "Ana", timestamp: "2026-01-01T00:00:00Z" },
      lastEditor: { username: "Ana", timestamp: "2026-03-01T00:00:00Z" },
      contributors: [
        { username: "Ana", editCount: 2, lastContributedAt: "2026-03-01T00:00:00Z" },
        { username: "Ben", editCount: 1, lastContributedAt: "2026-02-01T00:00:00Z" },
      ],
      totalContributors: 2,
    });
    expect(authors?.revisions[2]).toEqual({
      revid: 10,
      timestamp: "2026-01-01T00:00:00Z",
      user: "Ana",
      comment: "",
      size: 100,
    });
  });

  it("ask AltHistory's own api.php, with no member type unless one is asked for", async () => {
    fetchSpy.mockImplementation(async () => members());
    await httpGetCategoryMembers("Nations", 20, undefined, "althistory");

    expect(requestedUrl().origin + requestedUrl().pathname).toBe(
      "https://althistory.fandom.com/api.php"
    );
    expect(requestedUrl().searchParams.get("cmtitle")).toBe("Category:Nations");
    expect(requestedUrl().searchParams.has("cmtype")).toBe(false);
  });

  it("a page with no revisions has no authors; a missing page has none either", async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ query: { pages: { "-1": { title: "Nowhere", missing: "" } } } })
    );
    await expect(
      fetchMediaWikiPageAuthorsAndRevisions("Nowhere", "althistory")
    ).resolves.toBeNull();

    fetchSpy.mockImplementation(async () =>
      Response.json({ query: { pages: { "5": { title: "Stub", revisions: [] } } } })
    );
    await expect(fetchMediaWikiPageAuthorsAndRevisions("Stub", "althistory")).resolves.toBeNull();
  });

  it("an unreachable wiki throws, never an empty list or no authors", async () => {
    fetchSpy.mockImplementation(async () => new Response("down", { status: 502 }));

    await expect(
      httpGetCategoryMembers("Nations", 20, "page", "althistory")
    ).rejects.toBeInstanceOf(WikiUnavailableError);
    await expect(
      fetchMediaWikiPageAuthorsAndRevisions("Gylias", "althistory")
    ).rejects.toBeInstanceOf(WikiUnavailableError);
  });
});

describe("the request", () => {
  it("asks for JSON from any origin, on the wiki's api.php", async () => {
    await readSisterWikitext("althistory", "Bashan");

    expect(requestedUrl().origin + requestedUrl().pathname).toBe(
      "https://althistory.fandom.com/api.php"
    );
    expect(requestedUrl().searchParams.get("format")).toBe("json");
    expect(requestedUrl().searchParams.get("origin")).toBe("*");
  });

  it("waits as long as each read allows: authors and page images briefly, the rest 12 s", async () => {
    const guarded = jest.spyOn(upstreamGuard, "fetch");
    try {
      fetchSpy.mockImplementation(async () => Response.json({ query: { pages: {} } }));
      await readSisterWikitext("iiwiki", "Wait A");
      await fetchMediaWikiPageAuthorsAndRevisions("Wait B", "iiwiki");
      await fetchMediaWikiPageAuthorsAndRevisions("Wait C", "iiwiki", 10, 2500);
      await fetchPageImagesHttp("Wait D", "iiwiki");

      expect(guarded.mock.calls.map(([, request]) => request.timeoutMs)).toEqual([
        12_000, 8000, 2500, 5000,
      ]);
    } finally {
      guarded.mockRestore();
    }
  });

  it("releases the connection of an answer it cannot use", async () => {
    let cancelled = false;
    fetchSpy.mockImplementation(
      async () =>
        new Response(new ReadableStream({ cancel: () => void (cancelled = true) }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
    );

    await expect(readSisterWikitext("althistory", "Gone")).rejects.toBeInstanceOf(
      WikiUnavailableError
    );
    expect(cancelled).toBe(true);
  });

  it("a page id below zero is a missing page", async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ query: { pages: { "-1": { pageid: -1, title: "Nowhere" } } } })
    );

    await expect(readSisterWikitext("iiwiki", "Nowhere")).resolves.toBeNull();
  });

  it("a search answered with null finds nothing (an API error throws: see above)", async () => {
    fetchSpy.mockImplementation(async () => Response.json(null));

    await expect(searchSisterWiki("althistory", "Anything")).resolves.toEqual([]);
  });
});

describe("page images", () => {
  const imagesOf = (images: string[]) =>
    Response.json({ query: { pages: { "9": { images: images.map((title) => ({ title })) } } } });
  const info = (pages: Record<string, object>) => Response.json({ query: { pages } });

  it("keeps real images of at least 100 px, less the patterns left out, once, and remembers them", async () => {
    fetchSpy.mockImplementation(async (input) => {
      const query = new URL(String(input)).searchParams;
      if (query.get("prop") === "images") {
        return imagesOf(["File:Map.png", "File:Flag of Aurelia.svg", "File:Tiny.png"]);
      }
      return info({
        "1": {
          title: "File:Map.png",
          imageinfo: [
            { url: "https://iiwiki.com/Map.png", width: 800, height: 50, mime: "image/png" },
          ],
        },
        "2": {
          title: "File:Tiny.png",
          imageinfo: [{ url: "https://iiwiki.com/Tiny.png", width: 99, height: 99 }],
        },
        "3": {
          title: "File:Clip.ogg",
          imageinfo: [
            { url: "https://iiwiki.com/Clip.ogg", width: 400, height: 400, mime: "audio/ogg" },
          ],
        },
        "4": {
          title: "File:Lost.png",
          missing: true,
          imageinfo: [{ url: "https://commons/Lost.png", width: 400, height: 400 }],
        },
        "5": { title: "File:Nothing.png" },
        "6": {
          imageinfo: [
            {
              url: "https://iiwiki.com/Anon.png",
              thumburl: "https://iiwiki.com/t/Anon.png",
              width: 300,
              height: 300,
            },
          ],
        },
      });
    });

    const images = await fetchPageImagesHttp("Image Rules Land", "iiwiki", {
      excludePatterns: [/Flag_of|Flag of/],
      thumbWidth: 320,
      limit: 7,
    });

    expect(images).toEqual([
      {
        title: "File:Map.png",
        url: "https://iiwiki.com/Map.png",
        thumbUrl: "https://iiwiki.com/Map.png",
        width: 800,
        height: 50,
      },
      {
        title: "",
        url: "https://iiwiki.com/Anon.png",
        thumbUrl: "https://iiwiki.com/t/Anon.png",
        width: 300,
        height: 300,
      },
    ]);
    expect(requestedUrl(0).searchParams.get("imlimit")).toBe("7");
    expect(requestedUrl(0).searchParams.get("redirects")).toBe("1");
    expect(requestedUrl(1).searchParams.get("titles")).toBe("File:Map.png|File:Tiny.png");
    expect(requestedUrl(1).searchParams.get("iiurlwidth")).toBe("320");
    expect(requestedUrl(1).searchParams.get("iiprop")).toBe("url|size|mime");

    await fetchPageImagesHttp("Image Rules Land", "iiwiki");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("asks for 50 files at 200 px by default, and at most as many as it lists", async () => {
    fetchSpy.mockImplementation(async (input) =>
      new URL(String(input)).searchParams.get("prop") === "images"
        ? imagesOf(["File:A.png", "File:B.png", "File:C.png"])
        : info({})
    );

    await expect(fetchPageImagesHttp("Default Images Land", "althistory")).resolves.toBeNull();
    expect(requestedUrl(0).searchParams.get("imlimit")).toBe("50");
    expect(requestedUrl(1).searchParams.get("iiurlwidth")).toBe("200");

    await fetchPageImagesHttp("Two Images Land", "althistory", { limit: 2 });
    expect(requestedUrl(3).searchParams.get("titles")).toBe("File:A.png|File:B.png");
  });

  it("a page whose every image is left out asks no more", async () => {
    fetchSpy.mockImplementation(async () => imagesOf(["File:Flag of Aurelia.svg"]));

    await expect(
      fetchPageImagesHttp("Flags Only Land", "iiwiki", { excludePatterns: [/Flag of/] })
    ).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("authors of revisions that hide their fields", () => {
  it("are a contributor by a stand-in name, dated now, with no comment and no size", async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({ query: { pages: { "8": { revisions: [{}] } } } })
    );

    const authors = await fetchMediaWikiPageAuthorsAndRevisions("Hidden", "althistory");

    const when = authors?.revisions[0]?.timestamp;
    expect(when).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(authors?.revisions).toEqual([
      { revid: 0, timestamp: when, user: "MediaWiki Contributor", comment: "", size: 0 },
    ]);
    expect(authors?.creator).toEqual({ username: "MediaWiki Contributor", timestamp: when });
  });
});

describe("a batch read", () => {
  it("remembers the titles a wiki lacks, but none when the wiki cannot be reached", async () => {
    fetchSpy.mockImplementation(async () => new Response("down", { status: 503 }));
    await expect(getBatchWikitext(["Batch Down"], "althistory")).resolves.toEqual(new Map());
    expect(intelligentLoreCache.isKnownMissingPage("althistory", "Batch Down")).toBe(false);

    fetchSpy.mockImplementation(async () =>
      Response.json({ query: { pages: { "-1": { title: "Batch Gone", missing: "" } } } })
    );
    await getBatchWikitext(["Batch Gone"], "althistory");
    expect(intelligentLoreCache.isKnownMissingPage("althistory", "Batch Gone")).toBe(true);
    expect(requestedUrl(1).origin).toBe("https://althistory.fandom.com");
  });
});

describe("the dispatchers", () => {
  it("send each sister read to that wiki", async () => {
    fetchSpy.mockImplementation(async () => Response.json({ query: { pages: {} } }));

    await getArticleWikitext("Dispatched Page", "althistory");
    await searchPages("Dispatched", 5, "althistory");
    await getCategoryMembers("Dispatched", 5, "page", "althistory");
    await getPageImages("Dispatched Images", { wiki: "althistory" });

    expect(fetchSpy.mock.calls.map(([input]) => new URL(String(input)).host)).toEqual([
      "althistory.fandom.com",
      "althistory.fandom.com",
      "althistory.fandom.com",
      "althistory.fandom.com",
    ]);
    expect(requestedUrl(1).searchParams.get("action")).toBe("opensearch");
  });
});

describe("a host that refuses (403)", () => {
  it("one 403 does not take the host offline (one Cloudflare challenge is not an outage)", async () => {
    fetchSpy.mockImplementation(async () => new Response("Just a moment...", { status: 403 }));
    await expect(
      upstreamGuard.fetch("https://once.example/api.php?a", { timeoutMs: 1000 })
    ).rejects.toBeInstanceOf(WikiUnavailableError);

    fetchSpy.mockImplementation(async () => Response.json({ ok: true }));
    const second = await upstreamGuard.fetch("https://once.example/api.php?b", { timeoutMs: 1000 });

    expect(second.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
