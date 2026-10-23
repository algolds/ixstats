/** @jest-environment node */
/**
 * The bridge's readers of IIWiki and AltHistory (http-reader.ts): a redirect title reads the page it names (and
 * says where it was redirected from), page images go through the wiki's configured api.php (iiwiki's development
 * relay), and one refusal (a Cloudflare challenge's 403) never takes a host offline.
 */
jest.mock("~/lib/wiki-os/core/article-repository", () => ({
  __esModule: true,
  ArticleRepository: { getArticleBySlug: jest.fn() },
}));

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  althistoryGetWikitext,
  fetchExternalWiki,
  fetchPageImagesHttp,
  iiwikiGetWikitext,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";

let fetchSpy: jest.SpiedFunction<typeof fetch>;
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
  now = 1_000_000;
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
  it.each([
    ["iiwiki", iiwikiGetWikitext],
    ["althistory", althistoryGetWikitext],
  ] as const)("on %s reads the page it names, and where it came from", async (_source, read) => {
    const page = await read("Bashan");

    expect(requestedUrl().searchParams.get("redirects")).toBe("1");
    expect(page).toMatchObject({
      title: "Bashan Protectorate",
      redirectedFrom: "Bashan",
      revId: 900,
      wikitext: BASHAN_TEXT,
    });
  });

  it("is not called redirected when the wiki only normalised the title", async () => {
    fetchSpy.mockImplementation(async () =>
      Response.json({
        query: {
          normalized: [{ from: "bashan Protectorate", to: "Bashan Protectorate" }],
          pages: { "41": { pageid: 41, title: "Bashan Protectorate", revisions: [] } },
        },
      })
    );

    const page = await iiwikiGetWikitext("bashan Protectorate");

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

describe("a host that refuses (403)", () => {
  const refused = () => new Response("Just a moment...", { status: 403 });

  it("is still asked after one refusal (one Cloudflare challenge is not an outage)", async () => {
    fetchSpy.mockImplementation(async () => refused());

    await expect(fetchExternalWiki("https://once.example/api.php?a")).resolves.toBeNull();
    fetchSpy.mockImplementation(async () => Response.json({ ok: true }));
    const second = await fetchExternalWiki("https://once.example/api.php?b");

    expect(second).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("is skipped for a minute after refusing twice in a row, then asked again", async () => {
    fetchSpy.mockImplementation(async () => refused());
    await fetchExternalWiki("https://twice.example/api.php?a");
    await fetchExternalWiki("https://twice.example/api.php?b");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    now += 30_000;
    await expect(fetchExternalWiki("https://twice.example/api.php?c")).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    now += 31_000;
    fetchSpy.mockImplementation(async () => Response.json({ ok: true }));
    await expect(fetchExternalWiki("https://twice.example/api.php?d")).resolves.not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("forgets a refusal once a request succeeds", async () => {
    fetchSpy.mockImplementationOnce(async () => refused());
    await fetchExternalWiki("https://flaky.example/api.php?a");
    fetchSpy.mockImplementationOnce(async () => Response.json({ ok: true }));
    await fetchExternalWiki("https://flaky.example/api.php?b");
    fetchSpy.mockImplementationOnce(async () => refused());
    await fetchExternalWiki("https://flaky.example/api.php?c");

    fetchSpy.mockImplementationOnce(async () => Response.json({ ok: true }));
    await expect(fetchExternalWiki("https://flaky.example/api.php?d")).resolves.not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});
