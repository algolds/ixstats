/** @jest-environment node */
import { NextRequest } from "next/server";

const mockCacheGet = jest.fn();
const mockRateCheck = jest.fn();
jest.mock("~/lib/cache", () => ({
  Cache: class {
    get = jest.fn();
    set = jest.fn();
  },
  externalApiCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: jest.fn().mockResolvedValue(undefined),
  },
  rateLimiter: {
    check: (...args: unknown[]) => mockRateCheck(...args),
  },
}));

import { GET } from "~/app/api/mediawiki/[wiki]/[...path]/route";

const INTERNAL_HOST = "169.254.169.254";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

interface CallOptions {
  headers?: Record<string, string>;
  /** The raw (still percent-encoded) request path, when it differs from the joined decoded `path`. */
  rawPath?: string;
}

/** `path` is the catch-all as Next hands it over: already percent-decoded once. */
const call = (wiki: string, path: string[], { headers, rawPath }: CallOptions = {}) => {
  const url = `http://localhost:3000/api/mediawiki/${wiki}/${rawPath ?? path.join("/")}`;
  return GET(new NextRequest(url, { headers }), { params: Promise.resolve({ wiki, path }) });
};

const fetchedUrl = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

const pngResponse = (headers: Record<string, string> = {}) =>
  new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png", ...headers } });

/** imageinfo lookups answer with `imageUrl`; every other request is answered by `media`. */
const routeFetch = (imageUrl: string, media: () => Response) => (input: Parameters<typeof fetch>[0]) => {
  const url = fetchedUrl(input);
  if (url.includes("prop=imageinfo")) {
    return Promise.resolve(
      Response.json({ query: { pages: [{ imageinfo: [{ url: imageUrl }] }] } })
    );
  }
  return Promise.resolve(media());
};

describe("external wiki media proxy", () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockRateCheck.mockResolvedValue({ success: true, remaining: 599, resetAt: new Date(Date.now() + 60_000) });
    fetchMock = jest.spyOn(global, "fetch");
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    warnSpy.mockRestore();
  });

  const hostsFetched = () => fetchMock.mock.calls.map(([input]) => fetchedUrl(input)).join("\n");

  it.each([
    [["Special:Filepath", "http://169.254.169.254/x"]],
    [["Special:Filepath", "http:", "", "169.254.169.254", "x"]],
    [["Special:Filepath", "http:/169.254.169.254/x"]],
  ] as Array<[string[]]>)("404s a Special:Filepath absolute URL %j without fetching anything", async (path) => {
    const res = await call("iiwiki", path);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a cached resolution that points at a non-allow-listed host", async () => {
    mockCacheGet.mockResolvedValue({ data: { url: `http://${INTERNAL_HOST}/latest/meta-data` } });

    const res = await call("commons", ["Special:Filepath", "Flag.png"]);

    expect(res.status).toBe(400);
    expect(hostsFetched()).not.toContain(INTERNAL_HOST);
  });

  it("serves an image/png upstream as 200 with nosniff", async () => {
    fetchMock.mockImplementation(
      routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.png", () => pngResponse())
    );

    const res = await call("commons", ["Special:Filepath", "Flag.png"]);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
  });

  it("refuses a text/html upstream with 415", async () => {
    fetchMock.mockImplementation(
      routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.png", () =>
        new Response("<script>alert(1)</script>", { headers: { "content-type": "text/html" } })
      )
    );

    const res = await call("commons", ["Special:Filepath", "Flag.png"]);

    expect(res.status).toBe(415);
    expect(await res.text()).toBe("");
  });

  it("refuses a 20 MB Content-Length with 413", async () => {
    fetchMock.mockImplementation(
      routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Big.png", () =>
        pngResponse({ "content-length": String(20 * 1024 * 1024) })
      )
    );

    const res = await call("commons", ["Special:Filepath", "Big.png"]);

    expect(res.status).toBe(413);
  });

  it("stops reading a body past 15 MB when Content-Length is absent", async () => {
    const chunk = new Uint8Array(4 * 1024 * 1024);
    let reads = 0;
    const reader = {
      read: jest.fn(async () => (reads++ < 10 ? { done: false, value: chunk } : { done: true })),
      cancel: jest.fn(async () => undefined),
    };
    const streaming = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      body: { getReader: () => reader, cancel: jest.fn() },
    } as unknown as Response;
    fetchMock.mockImplementation(
      routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Big.png", () => streaming)
    );

    const res = await call("commons", ["Special:Filepath", "Big.png"]);

    expect(res.status).toBe(413);
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.read.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("serves SVG only with a sandboxing CSP and inline disposition", async () => {
    fetchMock.mockImplementation(
      routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Arms.svg", () =>
        new Response("<svg xmlns='http://www.w3.org/2000/svg'/>", {
          headers: { "content-type": "image/svg+xml; charset=utf-8" },
        })
      )
    );

    const res = await call("commons", ["Special:Filepath", "Arms.svg"]);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    );
    expect(res.headers.get("content-disposition")).toBe("inline");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("does not follow a direct-fetch redirect to a non-allow-listed host", async () => {
    fetchMock.mockImplementation((input) => {
      const url = fetchedUrl(input);
      if (url.includes("wsrv.nl")) return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(
        new Response(null, { status: 302, headers: { location: `http://${INTERNAL_HOST}/x` } })
      );
    });

    const res = await call("iiwiki", ["images", "a", "ab", "Flag.png"]);

    expect(res.status).toBe(502);
    expect(hostsFetched()).not.toContain(INTERNAL_HOST);
  });

  it("does not relay an upstream HTML error body from the catch-all", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html><script>alert(1)</script></html>", {
        status: 404,
        headers: { "content-type": "text/html" },
      })
    );

    const res = await call("commons", ["w", "index.php"]);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("refuses non-image content from the catch-all origin fetch", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );

    const res = await call("commons", ["w", "api.php"]);

    expect(res.status).toBe(415);
  });
  describe("SVG is rendered inline only as an image (the app CSP replaces the sandbox CSP)", () => {
    const svgUpstream = () =>
      routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Arms.svg", () =>
        new Response("<svg xmlns='http://www.w3.org/2000/svg'/>", {
          headers: { "content-type": "image/svg+xml" },
        })
      );

    it.each([
      ["an <img> load (Sec-Fetch-Dest: image)", { "sec-fetch-dest": "image" }],
      ["a client without Sec-Fetch-Dest that does not ask for HTML", { accept: "image/svg+xml,image/*;q=0.8" }],
      ["a client without Sec-Fetch-Dest or Accept", {}],
    ])("serves inline for %s", async (_label, headers) => {
      fetchMock.mockImplementation(svgUpstream());

      const res = await call("commons", ["Special:Filepath", "Arms.svg"], { headers });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toBe("inline");
      expect(res.headers.get("vary")).toBe("Sec-Fetch-Dest, Accept");
    });

    it.each([
      ["a navigation (Sec-Fetch-Dest: document)", { "sec-fetch-dest": "document", accept: "text/html" }],
      ["an iframe", { "sec-fetch-dest": "iframe" }],
      ["an <object>", { "sec-fetch-dest": "object" }],
      ["a script fetch", { "sec-fetch-dest": "empty" }],
      ["a client without Sec-Fetch-Dest that asks for HTML", { accept: "text/html,application/xhtml+xml" }],
    ])("serves a download for %s", async (_label, headers) => {
      fetchMock.mockImplementation(svgUpstream());

      const res = await call("commons", ["Special:Filepath", "Coat of arms (1).svg"], { headers });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toBe('attachment; filename="Coat_of_arms_1_.svg"');
      expect(res.headers.get("content-security-policy")).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      );
      expect(res.headers.get("vary")).toBe("Sec-Fetch-Dest, Accept");
    });

    it("never adds a disposition to a raster image", async () => {
      fetchMock.mockImplementation(
        routeFetch("https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.png", () => pngResponse())
      );

      const res = await call("commons", ["Special:Filepath", "Flag.png"], {
        headers: { "sec-fetch-dest": "document" },
      });

      expect(res.headers.get("content-disposition")).toBeNull();
    });
  });

  it("answers 400, not 500, for a malformed percent-encoding in the request path", async () => {
    const res = await call("iiwiki", ["Special:Filepath", "%"], {
      rawPath: "Special:Filepath/%",
    });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not decode the catch-all a second time: a literal %41 stays %41", async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        fetchedUrl(input).includes("wsrv.nl") ? new Response(null, { status: 500 }) : pngResponse()
      )
    );

    // The request path is `100%2541.png`; Next hands the route the once-decoded `100%41.png`.
    const res = await call("iiwiki", ["images", "a", "100%41.png"], { rawPath: "images/a/100%2541.png" });

    expect(res.status).toBe(200);
    const direct = fetchMock.mock.calls.map(([input]) => fetchedUrl(input)).filter((u) => !u.includes("wsrv.nl"));
    expect(direct).toEqual(["https://iiwiki.com/images/a/100%2541.png"]);
  });

  it("never decodes a Special:Filepath name a second time before the imageinfo lookup", async () => {
    let lookedUp = "";
    fetchMock.mockImplementation((input) => {
      const url = new URL(fetchedUrl(input));
      if (url.searchParams.get("prop") === "imageinfo") {
        lookedUp = url.searchParams.get("titles") ?? "";
        return Promise.resolve(Response.json({ query: { pages: [{}] } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    await call("commons", ["Special:Filepath", "100%41.png"], { rawPath: "Special:Filepath/100%2541.png" });

    expect(lookedUp).toBe("File:100%41.png");
  });

  it.each([
    [["images", "..", "api.php"]],
    [["images", ".", "x.png"]],
    [["images", "a/b"]],
  ] as Array<[string[]]>)("404s the unsafe path %j without fetching", async (path) => {
    const res = await call("iiwiki", path);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is rate limited per client on the wiki_media bucket (600 a minute)", async () => {
    await call("commons", ["Special:Filepath", "Flag.png"], {
      headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" },
    });

    expect(mockRateCheck).toHaveBeenCalledWith("ip:203.0.113.7", "wiki_media", {
      maxRequests: 600,
      windowMs: 60_000,
    });
  });

  it("answers 429 without fetching when over the limit", async () => {
    mockRateCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date(Date.now() + 30_000) });

    const res = await call("commons", ["Special:Filepath", "Flag.png"]);

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
