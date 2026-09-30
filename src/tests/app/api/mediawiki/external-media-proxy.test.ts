/** @jest-environment node */
import { NextRequest } from "next/server";

const mockCacheGet = jest.fn();
jest.mock("~/lib/cache", () => ({
  Cache: class {
    get = jest.fn();
    set = jest.fn();
  },
  externalApiCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

import { GET } from "~/app/api/mediawiki/[wiki]/[...path]/route";

const INTERNAL_HOST = "169.254.169.254";
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const requestFor = (wiki: string, path: string[]) => ({
  request: new NextRequest(`http://localhost:3000/api/mediawiki/${wiki}/${path.join("/")}`),
  context: { params: Promise.resolve({ wiki, path }) },
});

const call = (wiki: string, path: string[]) => {
  const { request, context } = requestFor(wiki, path);
  return GET(request, context);
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
    fetchMock = jest.spyOn(global, "fetch");
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    fetchMock.mockRestore();
    warnSpy.mockRestore();
  });

  const hostsFetched = () => fetchMock.mock.calls.map(([input]) => fetchedUrl(input)).join("\n");

  it("404s a Special:Filepath absolute URL without fetching anything", async () => {
    const res = await call("iiwiki", ["Special:Filepath", "http%3A%2F%2F169.254.169.254%2Fx"]);

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
});
