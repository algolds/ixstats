/** @jest-environment node */
/**
 * The MediaWiki proxy routes. Plan 418: the read-only api.php proxy forwards nothing to IxWiki's MediaWiki (WikiOS
 * serves /w/api.php itself, and the proxy could return a page WikiOS has deleted); a sister wiki's allowed reads
 * still go through, unchanged. The two media proxies: /api/mediawiki/<sister wiki>/... (iiwiki, Commons) and
 * /api/mediawiki/ixwiki/....
 * Both are rate limited per client on the wiki_media bucket, read the catch-all exactly once, never relay an upstream
 * error body, and render SVG inline only as an image (a navigation downloads it, under a sandboxing CSP). The sister-
 * wiki proxy refuses absolute URLs, a cached or redirected hop to a host off its allowlist, non-image bodies and
 * oversized ones. The IxWiki proxy serves only image paths (no api.php, index.php, pages or traversal), forwards only
 * the file and a numeric width, checks the host on every redirect hop, and registers an asset only after a real image.
 * A Commons picture is proxied by its file name: a stored lead image whose tracking query was encoded into the name
 * 404'd (Economy of Urcea and 12 other articles).
 *
 * Folds mediawiki-api-proxy, ixwiki-media-proxy and commons-proxy-url.
 */
import { NextRequest } from "next/server";

const mockCacheGet = jest.fn();
const mockRateCheck = jest.fn();
const mockFindAsset = jest.fn();
const mockRegisterAsset = jest.fn();
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  Cache: class {
    get = jest.fn();
    set = jest.fn();
  },
  externalApiCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: jest.fn().mockResolvedValue(undefined),
  },
  rateLimiter: { check: (...args: unknown[]) => mockRateCheck(...args) },
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: {
    findAsset: (...args: unknown[]) => mockFindAsset(...args),
    registerAsset: (...args: unknown[]) => mockRegisterAsset(...args),
  },
}));

import { GET as apiPhpGet } from "~/app/api/mediawiki/[wiki]/api.php/route";
import { GET as sisterGet } from "~/app/api/mediawiki/[wiki]/[...path]/route";
import { GET as ixwikiGet } from "~/app/api/mediawiki/ixwiki/[...path]/route";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import {
  extractLeadImage,
  getCommonsProxyUrl,
  normalizeWikiImageUrl,
} from "~/lib/wiki-os/transformers/image-url";

const ORIGIN = mediaWikiOrigin();
const INTERNAL_HOST = "169.254.169.254";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const SANDBOX = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

interface CallOptions {
  headers?: Record<string, string>;
  /** The raw (still percent-encoded) request path, when it differs from the joined decoded `path`. */
  rawPath?: string;
}

/** `path` is the catch-all as Next hands it over: already percent-decoded once. */
const sister = (wiki: string, path: string[], { headers, rawPath }: CallOptions = {}) =>
  sisterGet(
    new NextRequest(`http://localhost:3000/api/mediawiki/${wiki}/${rawPath ?? path.join("/")}`, {
      headers,
    }),
    { params: Promise.resolve({ wiki, path }) }
  );
const ixwiki = (path: string[], query = "", { headers, rawPath }: CallOptions = {}) =>
  ixwikiGet(
    new NextRequest(
      `http://localhost:3000/api/mediawiki/ixwiki/${rawPath ?? path.join("/")}${query}`,
      { headers }
    ),
    { params: Promise.resolve({ path }) }
  );

const fetchedUrl = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
const pngResponse = (headers: Record<string, string> = {}) =>
  new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png", ...headers } });
const svgResponse = () =>
  new Response("<svg xmlns='http://www.w3.org/2000/svg'/>", {
    headers: { "content-type": "image/svg+xml" },
  });
const flushAssetRegistration = () => new Promise((resolve) => setImmediate(resolve));

/** imageinfo lookups answer with `imageUrl`; every other request is answered by `media`. */
const routeFetch =
  (imageUrl: string, media: () => Response) => (input: Parameters<typeof fetch>[0]) =>
    Promise.resolve(
      fetchedUrl(input).includes("prop=imageinfo")
        ? Response.json({ query: { pages: [{ imageinfo: [{ url: imageUrl }] }] } })
        : media()
    );
const COMMONS_FILE = (name: string) =>
  `https://upload.wikimedia.org/wikipedia/commons/a/ab/${name}`;

let fetchMock: jest.SpiedFunction<typeof fetch>;
const hostsFetched = () => fetchMock.mock.calls.map(([input]) => fetchedUrl(input)).join("\n");

beforeEach(() => {
  jest.clearAllMocks();
  mockCacheGet.mockResolvedValue(null);
  mockFindAsset.mockResolvedValue(null);
  mockRegisterAsset.mockResolvedValue(undefined);
  mockRateCheck.mockResolvedValue({
    success: true,
    remaining: 599,
    resetAt: new Date(Date.now() + 60_000),
  });
  fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("the api.php proxy", () => {
  const apiPhp = (wiki: string, query: string) =>
    apiPhpGet(new NextRequest(`http://localhost:3000/api/mediawiki/${wiki}/api.php?${query}`), {
      params: Promise.resolve({ wiki }),
    });

  it.each([
    "action=query&list=allpages",
    "action=query&titles=Deleted_page&prop=revisions&rvprop=content",
  ])("answers 410 to IxWiki's %s, asking no wiki", async (query) => {
    const res = await apiPhp("ixwiki", query);
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "IxWiki's api.php is not proxied here" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a read-only query to iiwiki, a sister wiki, with its params unchanged", async () => {
    fetchMock.mockResolvedValue(Response.json({ query: { pages: [] } }));
    const res = await apiPhp(
      "iiwiki",
      "action=query&generator=search&gsrsearch=flag&gsrnamespace=6&continue=-%7C%7C&gcmtype=file"
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ query: { pages: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = new URL(fetchedUrl(fetchMock.mock.calls[0]![0]));
    expect(sent.hostname).toBe("iiwiki.com");
    expect(
      Object.fromEntries(
        ["gsrsearch", "gsrnamespace", "continue", "gcmtype"].map((k) => [
          k,
          sent.searchParams.get(k),
        ])
      )
    ).toEqual({
      gsrsearch: "flag",
      gsrnamespace: "6",
      continue: "-||",
      gcmtype: "file",
    });
  });

  it("forwards a render of one revision and a page's image list (sister-render-service, page images)", async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ parse: { title: "Afropa", text: "" } })
    );
    await apiPhp(
      "iiwiki",
      "action=parse&oldid=1072575&prop=text&disableeditsection=1&disablelimitreport=1&formatversion=2"
    );
    await apiPhp("iiwiki", "action=parse&page=Afropa&prop=text");
    await apiPhp("iiwiki", "action=query&titles=Afropa&prop=images&imlimit=50");

    const sent = fetchMock.mock.calls.map(([url]) => new URL(fetchedUrl(url)).searchParams);
    expect(Object.fromEntries(sent[0]!)).toMatchObject({
      action: "parse",
      oldid: "1072575",
      disableeditsection: "1",
      disablelimitreport: "1",
    });
    expect(sent[1]!.get("page")).toBe("Afropa");
    expect(sent[2]!.get("imlimit")).toBe("50");
  });

  it("refuses an action iiwiki's list does not allow, and an unknown wiki", async () => {
    expect((await apiPhp("iiwiki", "action=edit")).status).toBe(400);
    expect((await apiPhp("nowhere", "action=query")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** One image request through each proxy, answered by `media`. */
const PROXIES = [
  {
    name: "the sister-wiki proxy",
    get: (options?: CallOptions) => sister("commons", ["Special:Filepath", "Arms.svg"], options),
    answer: (media: () => Response) =>
      fetchMock.mockImplementation(routeFetch(COMMONS_FILE("Arms.svg"), media)),
  },
  {
    name: "the IxWiki proxy",
    get: (options?: CallOptions) => ixwiki(["images", "a", "ab", "Arms.svg"], "", options),
    answer: (media: () => Response) => fetchMock.mockImplementation(() => Promise.resolve(media())),
  },
];

describe.each(PROXIES)("$name", ({ get, answer }) => {
  it("is rate limited per client on the wiki_media bucket (600 a minute), keyed off the trusted IP", async () => {
    await get({
      headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" },
    });
    expect(mockRateCheck).toHaveBeenCalledWith("ip:203.0.113.7", "wiki_media", {
      maxRequests: 600,
      windowMs: 60_000,
    });
  });

  it("answers 429 without fetching when over the limit", async () => {
    mockRateCheck.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
    });
    const res = await get();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["an <img> load (Sec-Fetch-Dest: image)", { "sec-fetch-dest": "image" }, "inline"],
    [
      "a client without Sec-Fetch-Dest that does not ask for HTML",
      { accept: "image/svg+xml,image/*;q=0.8" },
      "inline",
    ],
    [
      "a navigation (Sec-Fetch-Dest: document)",
      { "sec-fetch-dest": "document", accept: "text/html" },
      'attachment; filename="Arms.svg"',
    ],
    ["an iframe", { "sec-fetch-dest": "iframe" }, 'attachment; filename="Arms.svg"'],
    [
      "a client without Sec-Fetch-Dest that asks for HTML",
      { accept: "text/html,application/xhtml+xml" },
      'attachment; filename="Arms.svg"',
    ],
  ])("serves SVG to %s as %s, under the sandboxing CSP", async (_label, headers, disposition) => {
    answer(svgResponse);
    const res = await get({ headers });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(disposition);
    expect(res.headers.get("content-security-policy")).toBe(SANDBOX);
    expect(res.headers.get("vary")).toBe("Sec-Fetch-Dest, Accept");
  });
});

describe.each([
  [
    "the sister-wiki proxy",
    () => sister("iiwiki", ["Special:Filepath", "%"], { rawPath: "Special:Filepath/%" }),
  ],
  ["the IxWiki proxy", () => ixwiki(["images", "a", "%"], "", { rawPath: "images/a/%" })],
])("%s, on a malformed percent-encoding", (_name, get) => {
  it("answers 400, not 500, without fetching", async () => {
    expect((await get()).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the sister-wiki proxy", () => {
  it.each([
    [["Special:Filepath", "http://169.254.169.254/x"]],
    [["Special:Filepath", "http:", "", "169.254.169.254", "x"]],
    [["Special:Filepath", "http:/169.254.169.254/x"]],
    [["images", "..", "api.php"]],
    [["images", ".", "x.png"]],
    [["images", "a/b"]],
  ] as Array<[string[]]>)("404s %j without fetching anything", async (path) => {
    expect((await sister("iiwiki", path)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cached resolution that points at a non-allow-listed host", async () => {
    mockCacheGet.mockResolvedValue({ data: { url: `http://${INTERNAL_HOST}/latest/meta-data` } });
    expect((await sister("commons", ["Special:Filepath", "Flag.png"])).status).toBe(400);
    expect(hostsFetched()).not.toContain(INTERNAL_HOST);
  });

  it("does not follow a direct-fetch redirect to a non-allow-listed host", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        fetchedUrl(input).includes("wsrv.nl")
          ? new Response(null, { status: 500 })
          : new Response(null, { status: 302, headers: { location: `http://${INTERNAL_HOST}/x` } })
      )
    );
    expect((await sister("iiwiki", ["images", "a", "ab", "Flag.png"])).status).toBe(502);
    expect(hostsFetched()).not.toContain(INTERNAL_HOST);
  });

  it("serves an image as 200 with nosniff and a day's cache, and never a disposition for a raster", async () => {
    fetchMock.mockImplementation(routeFetch(COMMONS_FILE("Flag.png"), () => pngResponse()));
    const res = await sister("commons", ["Special:Filepath", "Flag.png"], {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
    expect(res.headers.get("content-disposition")).toBeNull();
  });

  it.each([
    [
      "a text/html image",
      () => sister("commons", ["Special:Filepath", "Flag.png"]),
      () => new Response("<script>alert(1)</script>", { headers: { "content-type": "text/html" } }),
    ],
    [
      "JSON from the catch-all origin fetch",
      () => sister("commons", ["w", "api.php"]),
      () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    ],
  ])("refuses %s with 415 and an empty body", async (_case, get, upstream) => {
    fetchMock.mockImplementation(routeFetch(COMMONS_FILE("Flag.png"), upstream));
    const res = await get();
    expect(res.status).toBe(415);
    expect(await res.text()).toBe("");
  });

  it("does not relay an upstream HTML error body from the catch-all", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html><script>alert(1)</script></html>", {
        status: 404,
        headers: { "content-type": "text/html" },
      })
    );
    const res = await sister("commons", ["w", "index.php"]);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("refuses a 20 MB Content-Length with 413", async () => {
    fetchMock.mockImplementation(
      routeFetch(COMMONS_FILE("Big.png"), () =>
        pngResponse({ "content-length": String(20 * 1024 * 1024) })
      )
    );
    expect((await sister("commons", ["Special:Filepath", "Big.png"])).status).toBe(413);
  });

  it("stops reading a body past 15 MB when Content-Length is absent", async () => {
    const chunk = new Uint8Array(4 * 1024 * 1024);
    let reads = 0;
    const reader = {
      read: jest.fn(async () => (reads++ < 10 ? { done: false, value: chunk } : { done: true })),
      cancel: jest.fn(async () => undefined),
    };
    const body = new ReadableStream<Uint8Array>();
    jest
      .spyOn(body, "getReader")
      .mockReturnValue(reader as unknown as ReadableStreamDefaultReader<Uint8Array>);
    const streaming = new Response(body, { status: 200, headers: { "content-type": "image/png" } });
    fetchMock.mockImplementation(routeFetch(COMMONS_FILE("Big.png"), () => streaming));

    expect((await sister("commons", ["Special:Filepath", "Big.png"])).status).toBe(413);
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.read.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("does not decode the catch-all a second time: a literal %41 stays %41", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        fetchedUrl(input).includes("wsrv.nl") ? new Response(null, { status: 500 }) : pngResponse()
      )
    );
    // The request path is `100%2541.png`; Next hands the route the once-decoded `100%41.png`.
    const res = await sister("iiwiki", ["images", "a", "100%41.png"], {
      rawPath: "images/a/100%2541.png",
    });
    expect(res.status).toBe(200);
    expect(
      hostsFetched()
        .split("\n")
        .filter((u) => !u.includes("wsrv.nl"))
    ).toEqual(["https://iiwiki.com/images/a/100%2541.png"]);
  });

  it("never decodes a Special:Filepath name a second time before the imageinfo lookup", async () => {
    let lookedUp = "";
    fetchMock.mockImplementation((input) => {
      const url = new URL(fetchedUrl(input));
      if (url.searchParams.get("prop") !== "imageinfo")
        return Promise.resolve(new Response(null, { status: 404 }));
      lookedUp = url.searchParams.get("titles") ?? "";
      return Promise.resolve(Response.json({ query: { pages: [{}] } }));
    });
    await sister("commons", ["Special:Filepath", "100%41.png"], {
      rawPath: "Special:Filepath/100%2541.png",
    });
    expect(lookedUp).toBe("File:100%41.png");
  });
});

describe("the IxWiki proxy", () => {
  it.each([
    [["api.php"], "?action=parse&page=Main_Page"],
    [["index.php"], "?title=Special:UserLogin"],
    [["wiki", "Main_Page"], ""],
    [["load.php"], "?modules=startup"],
    [["images", "a", "..", "api.php"], ""],
    [["images", "a/b"], ""],
    [["wiki", "File:.."], ""],
    [["wiki", "Special:Redirect", "page", "Foo.png"], ""],
    [["wiki", "Category:Flags"], ""],
    [["thumb.php"], ""],
    [["thumb.php"], "?f=..%2Fapi.php"],
    [["thumb.php", "extra"], "?f=Foo.png"],
  ] as Array<[string[], string]>)("404s %j%s without fetching MediaWiki", async (path, query) => {
    expect((await ixwiki(path, query)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only f and a numeric width to thumb.php and Special:FilePath", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));
    await ixwiki(["thumb.php"], "?f=Foo%20bar.png&width=300&action=raw&evil=1");
    await ixwiki(["thumb.php"], "?f=Foo.png&w=120");
    await ixwiki(["thumb.php"], "?f=Foo.png&width=abc&w=90");
    await ixwiki(["thumb.php"], "?f=Foo.png&width=99999");
    await ixwiki(["wiki", "Special:FilePath", "Foo.png"], "?width=300&action=raw&evil=1");
    await ixwiki(["wiki", "Special:FilePath", "Foo.png"], "?width=300px");
    expect(fetchMock.mock.calls.map(([input]) => fetchedUrl(input))).toEqual([
      `${ORIGIN}/thumb.php?f=Foo%20bar.png&width=300`,
      `${ORIGIN}/thumb.php?f=Foo.png&width=120`,
      `${ORIGIN}/thumb.php?f=Foo.png&width=90`,
      `${ORIGIN}/thumb.php?f=Foo.png`,
      `${ORIGIN}/wiki/Special:FilePath/Foo.png?width=300`,
      `${ORIGIN}/wiki/Special:FilePath/Foo.png`,
    ]);
  });

  it("serves images/thumb/... as-is and registers the original file, not the thumbnail", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));
    const res = await ixwiki(["images", "thumb", "a", "ab", "Foo.png", "300px-Foo.png"]);
    await flushAssetRegistration();
    expect(res.status).toBe(200);
    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(
      `${ORIGIN}/images/thumb/a/ab/Foo.png/300px-Foo.png`
    );
    expect(mockRegisterAsset).toHaveBeenCalledWith({ filename: "Foo.png", originBaseUrl: ORIGIN });
  });

  it.each([
    ["a 404", () => new Response("nope", { status: 404 }), 404],
    [
      "a 200 with HTML",
      () => new Response("<html/>", { headers: { "content-type": "text/html" } }),
      415,
    ],
    [
      "a 500 with a script body",
      () =>
        new Response("<script>alert(1)</script>", {
          status: 500,
          headers: { "content-type": "text/html" },
        }),
      500,
    ],
  ])("registers no asset and relays no body after %s upstream", async (_case, upstream, status) => {
    fetchMock.mockImplementation(() => Promise.resolve(upstream()));
    const res = await ixwiki(["images", "a", "ab", "Foo.png"]);
    await flushAssetRegistration();
    expect(res.status).toBe(status);
    expect(await res.text()).toBe("");
    expect(mockRegisterAsset).not.toHaveBeenCalled();
  });

  it("does not decode the catch-all a second time: a literal %41 stays %41", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));
    await ixwiki(["images", "a", "100%41.png"], "", { rawPath: "images/a/100%2541.png" });
    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(`${ORIGIN}/images/a/100%2541.png`);
  });

  it("never follows a redirect to a host outside the allowlist, for the main fetch or the fallback", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        fetchedUrl(input).includes("upload.wikimedia.org")
          ? new Response(null, { status: 404 })
          : new Response(null, { status: 302, headers: { location: `http://${INTERNAL_HOST}/x` } })
      )
    );
    expect((await ixwiki(["images", "a", "ab", "Foo.png"])).status).toBe(404);
    expect(hostsFetched()).not.toContain(INTERNAL_HOST);
    for (const [, init] of fetchMock.mock.calls) expect(init).toMatchObject({ redirect: "manual" });
  });

  it("follows an InstantCommons redirect from Special:FilePath to upload.wikimedia.org", async () => {
    fetchMock.mockImplementation((input) => {
      const url = fetchedUrl(input);
      if (url.includes("/images/")) return Promise.resolve(new Response(null, { status: 404 }));
      if (url.startsWith("https://upload.wikimedia.org/")) return Promise.resolve(pngResponse());
      return Promise.resolve(
        new Response(null, { status: 302, headers: { location: COMMONS_FILE("Foo.png") } })
      );
    });
    expect((await ixwiki(["wiki", "Special:FilePath", "Foo.png"])).status).toBe(200);
    expect(fetchMock.mock.calls.map(([input]) => fetchedUrl(input))).toEqual([
      `${ORIGIN}/wiki/Special:FilePath/Foo.png`,
      COMMONS_FILE("Foo.png"),
    ]);
  });
});

describe("the Commons proxy URL of a stored picture", () => {
  /** The exact `src` stored in Economy of Urcea's rendered HTML (the `&amp;` is the HTML's own). */
  const STORED =
    "https://upload.wikimedia.org/wikipedia/commons/7/7f/Tugrik_symbol.svg?utm_source=commons.wikimedia.org&amp;utm_campaign=imageinfo&amp;utm_content=original";
  const TUGRIK = "/api/mediawiki/commons/Special:Filepath/Tugrik_symbol.svg";
  const notice = encodeURIComponent("Bild_1c_–_Baustelle,_StVO_1953.svg");
  const thumb =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Tugrik_symbol.svg/200px-Tugrik_symbol.svg.png";

  it.each([
    ["Economy of Urcea's lead image, its tracking query dropped", STORED, TUGRIK],
    ["the same with a fragment", `${STORED}#filelinks`, TUGRIK],
    [
      "the page-top ambox's notice icon, percent-encoded once",
      "https://upload.wikimedia.org/wikipedia/commons/b/b9/Bild_1c_%E2%80%93_Baustelle%2C_StVO_1953.svg?utm_source=commons.wikimedia.org&amp;utm_campaign=imageinfo",
      `/api/mediawiki/commons/Special:Filepath/${notice}`,
    ],
    ["a rasterised thumbnail, back to the vector file", `${thumb}?utm_source=x`, TUGRIK],
    [
      "a Special:Filepath link, encoded once",
      "https://commons.wikimedia.org/wiki/Special:Filepath/%C3%89cole.svg?utm_source=x",
      `/api/mediawiki/commons/Special:Filepath/${encodeURIComponent("École.svg")}`,
    ],
    ["an already proxied URL", TUGRIK, TUGRIK],
  ])("%s", (_case, stored, proxied) => {
    expect(getCommonsProxyUrl(stored)).toBe(proxied);
  });

  it("is what the article's normalised image URL and its lead image load from", () => {
    expect(normalizeWikiImageUrl(STORED)).toBe(TUGRIK);
    const infobox = `<table class="infobox"><tr><td><span typeof="mw:File"><a href="/wiki/File:Tugrik_symbol.svg"><img src="${STORED}" width="50" height="50"></a></span></td></tr></table>`;
    expect(extractLeadImage(infobox)?.url).toBe(TUGRIK);
  });
});
