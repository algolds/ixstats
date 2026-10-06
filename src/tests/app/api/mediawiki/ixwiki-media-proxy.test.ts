/** @jest-environment node */
import { NextRequest } from "next/server";

const mockFindAsset = jest.fn();
const mockRateCheck = jest.fn();
const mockRegisterAsset = jest.fn();
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: {
    findAsset: (...args: unknown[]) => mockFindAsset(...args),
    registerAsset: (...args: unknown[]) => mockRegisterAsset(...args),
  },
}));
jest.mock("~/lib/cache", () => ({
  Cache: class {
    get = jest.fn();
    set = jest.fn();
  },
  externalApiCache: { get: jest.fn(), set: jest.fn() },
  rateLimiter: {
    check: (...args: unknown[]) => mockRateCheck(...args),
  },
}));

import { GET } from "~/app/api/mediawiki/ixwiki/[...path]/route";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";

const ORIGIN = mediaWikiOrigin();
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

interface CallOptions {
  headers?: Record<string, string>;
  /** The raw (still percent-encoded) request path, when it differs from the joined decoded `path`. */
  rawPath?: string;
}

/** `path` is the catch-all as Next hands it over: already percent-decoded once. */
const call = (path: string[], query = "", { headers, rawPath }: CallOptions = {}) =>
  GET(
    new NextRequest(`http://localhost:3000/api/mediawiki/ixwiki/${rawPath ?? path.join("/")}${query}`, {
      headers,
    }),
    { params: Promise.resolve({ path }) }
  );

const fetchedUrl = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

const pngResponse = () =>
  new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/png" } });

const flushAssetRegistration = () => new Promise((resolve) => setImmediate(resolve));

describe("ixwiki media proxy", () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAsset.mockResolvedValue(null);
    mockRegisterAsset.mockResolvedValue(undefined);
    mockRateCheck.mockResolvedValue({ success: true, remaining: 599, resetAt: new Date(Date.now() + 60_000) });
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  const rejectedPaths: Array<[string[], string]> = [
    [["api.php"], "?action=parse&page=Main_Page"],
    [["index.php"], "?title=Special:UserLogin"],
    [["wiki", "Main_Page"], ""],
    [["load.php"], "?modules=startup"],
    [["images", ".."], ""],
    [["images", "a", "..", "api.php"], ""],
    [["images", "a/b"], ""],
    [["wiki", "File:.."], ""],
    [["wiki", "File:."], ""],
    [["wiki", "Special:Redirect", "file", ".."], ""],
    [["wiki", "Special:Redirect", "file"], ""],
    [["wiki", "Special:Redirect", "page", "Foo.png"], ""],
    [["wiki", "Special:Redirect", "file", "a", "b.png"], ""],
    [["thumb.php"], "?f=.."],
    [["wiki", "Special:FilePath"], ""],
    [["Some", "Foo.png"], ""],
    [["wiki", "File:"], ""],
    [["wiki", "File:a", "b.png"], ""],
    [["wiki", "Category:Flags"], ""],
    [["thumb.php"], ""],
    [["thumb.php"], "?width=300"],
    [["thumb.php"], "?f=a/b.png"],
    [["thumb.php"], "?f=..%2Fapi.php"],
    [["thumb.php", "extra"], "?f=Foo.png"],
  ];

  it.each(rejectedPaths)("404s %j without fetching MediaWiki", async (path, query) => {
    const res = await call(path, query);

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches images/... paths from the origin", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    const res = await call(["images", "a", "ab", "Foo.png"]);

    expect(res.status).toBe(200);
    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(`${ORIGIN}/images/a/ab/Foo.png`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800"
    );
  });

  it("serves images/thumb/... as-is and registers the original file, not the thumbnail", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    const res = await call(["images", "thumb", "a", "ab", "Foo.png", "300px-Foo.png"]);
    await flushAssetRegistration();

    expect(res.status).toBe(200);
    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(
      `${ORIGIN}/images/thumb/a/ab/Foo.png/300px-Foo.png`
    );
    expect(mockRegisterAsset).toHaveBeenCalledWith({ filename: "Foo.png", originBaseUrl: ORIGIN });
  });

  it.each([
    [["wiki", "File:Foo.png"], "Foo.png"],
    [["wiki", "Image:Foo.png"], "Foo.png"],
    [["wiki", "file:Foo_bar.png"], "Foo_bar.png"],
    [["wiki", "IMAGE:Foo.png"], "Foo.png"],
    [["wiki", "File:Foo bar.png"], "Foo%20bar.png"],
    [["wiki", "File:100%41.png"], "100%2541.png"],
    [["wiki", "Special:Redirect", "file", "Foo.png"], "Foo.png"],
    [["wiki", "special:redirect", "FILE", "Foo bar.png"], "Foo%20bar.png"],
  ] as Array<[string[], string]>)("rewrites %j to wiki/Special:FilePath/<name>", async (path, encodedName) => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    const res = await call(path, "?width=200&action=raw");

    expect(res.status).toBe(200);
    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(
      `${ORIGIN}/wiki/Special:FilePath/${encodedName}?width=200`
    );
  });

  it("serves thumb.php forwarding only f and a numeric width", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    await call(["thumb.php"], "?f=Foo%20bar.png&width=300&action=raw&evil=1");
    await call(["thumb.php"], "?f=Foo.png&w=120");
    await call(["thumb.php"], "?f=Foo.png&width=abc&w=90");
    await call(["thumb.php"], "?f=Foo.png&width=99999");

    const urls = fetchMock.mock.calls.map(([input]) => fetchedUrl(input));
    expect(urls).toEqual([
      `${ORIGIN}/thumb.php?f=Foo%20bar.png&width=300`,
      `${ORIGIN}/thumb.php?f=Foo.png&width=120`,
      `${ORIGIN}/thumb.php?f=Foo.png&width=90`,
      `${ORIGIN}/thumb.php?f=Foo.png`,
    ]);
  });

  it("registers the thumb.php file as an asset after a 200 image", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    await call(["thumb.php"], "?f=Foo.png&width=300");
    await flushAssetRegistration();

    expect(mockRegisterAsset).toHaveBeenCalledWith({ filename: "Foo.png", originBaseUrl: ORIGIN });
  });

  it("rewrites a bare file name to wiki/Special:FilePath/<name>", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    const res = await call(["Foo.png"]);

    expect(res.status).toBe(200);
    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(`${ORIGIN}/wiki/Special:FilePath/Foo.png`);
  });

  it("serves wiki/Special:FilePath/<name> and forwards only a numeric width", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    await call(["wiki", "Special:FilePath", "Foo.png"], "?width=300&action=raw&evil=1");
    await call(["wiki", "Special:FilePath", "Foo.png"], "?width=300px");

    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(
      `${ORIGIN}/wiki/Special:FilePath/Foo.png?width=300`
    );
    expect(fetchedUrl(fetchMock.mock.calls[1]![0])).toBe(`${ORIGIN}/wiki/Special:FilePath/Foo.png`);
  });

  it("registers the asset only after a 200 image response", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    await call(["images", "a", "ab", "Foo.png"]);
    await flushAssetRegistration();

    expect(mockRegisterAsset).toHaveBeenCalledWith({ filename: "Foo.png", originBaseUrl: ORIGIN });
  });

  it("does not register an asset when the upstream 404s", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("nope", { status: 404 })));

    const res = await call(["images", "a", "ab", "Missing.png"]);
    await flushAssetRegistration();

    expect(res.status).toBe(404);
    expect(mockFindAsset).not.toHaveBeenCalled();
    expect(mockRegisterAsset).not.toHaveBeenCalled();
  });

  it("does not register an asset when the upstream answers 200 with HTML", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("<html/>", { headers: { "content-type": "text/html" } }))
    );

    const res = await call(["images", "a", "ab", "Foo.png"]);
    await flushAssetRegistration();

    expect(res.status).toBe(415);
    expect(mockRegisterAsset).not.toHaveBeenCalled();
  });

  it("does not relay an upstream error body", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response("<script>alert(1)</script>", { status: 500, headers: { "content-type": "text/html" } })
      )
    );

    const res = await call(["images", "a", "ab", "Foo.png"]);

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("");
  });
  it.each([["Foo.bmp"], ["Foo.tif"], ["Foo.tiff"], ["Foo.apng"], ["Foo.TIFF"]])(
    "accepts the bare image name %s",
    async (name) => {
      fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

      const res = await call([name]);

      expect(res.status).toBe(200);
      expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(`${ORIGIN}/wiki/Special:FilePath/${name}`);
    }
  );

  it("does not decode the catch-all a second time: a literal %41 stays %41", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    // The request path is `100%2541.png`; Next hands the route the once-decoded `100%41.png`.
    await call(["images", "a", "100%41.png"], "", { rawPath: "images/a/100%2541.png" });

    expect(fetchedUrl(fetchMock.mock.calls[0]![0])).toBe(`${ORIGIN}/images/a/100%2541.png`);
  });

  it("answers 400, not 500, for a malformed percent-encoding in the request path", async () => {
    const res = await call(["images", "a", "%"], "", { rawPath: "images/a/%" });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is rate limited per client on the wiki_media bucket (600 a minute)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(pngResponse()));

    await call(["images", "a", "ab", "Foo.png"], "", {
      headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9" },
    });

    expect(mockRateCheck).toHaveBeenCalledWith("ip:203.0.113.7", "wiki_media", {
      maxRequests: 600,
      windowMs: 60_000,
    });
  });

  it("answers 429 without fetching when over the limit", async () => {
    mockRateCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date(Date.now() + 30_000) });

    const res = await call(["images", "a", "ab", "Foo.png"]);

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("redirects are followed by hand with a host check on every hop", () => {
    const INTERNAL_HOST = "169.254.169.254";
    const hostsFetched = () => fetchMock.mock.calls.map(([input]) => fetchedUrl(input)).join("\n");

    it("never follows a redirect to a host outside the allowlist, for the main fetch or the fallback", async () => {
      fetchMock.mockImplementation((input) =>
        Promise.resolve(
          fetchedUrl(input).includes("upload.wikimedia.org")
            ? new Response(null, { status: 404 })
            : new Response(null, { status: 302, headers: { location: `http://${INTERNAL_HOST}/x` } })
        )
      );

      const res = await call(["images", "a", "ab", "Foo.png"]);

      expect(res.status).toBe(404);
      expect(hostsFetched()).not.toContain(INTERNAL_HOST);
      for (const [, init] of fetchMock.mock.calls) expect(init).toMatchObject({ redirect: "manual" });
    });

    it("follows an InstantCommons redirect from Special:FilePath to upload.wikimedia.org", async () => {
      fetchMock.mockImplementation((input) => {
        const url = fetchedUrl(input);
        if (url.includes("/images/")) return Promise.resolve(new Response(null, { status: 404 }));
        if (url.startsWith("https://upload.wikimedia.org/")) return Promise.resolve(pngResponse());
        return Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Foo.png" },
          })
        );
      });

      const res = await call(["wiki", "Special:FilePath", "Foo.png"]);

      expect(res.status).toBe(200);
      expect(fetchMock.mock.calls.map(([input]) => fetchedUrl(input))).toEqual([
        `${ORIGIN}/wiki/Special:FilePath/Foo.png`,
        "https://upload.wikimedia.org/wikipedia/commons/a/ab/Foo.png",
      ]);
    });
  });

  describe("SVG is rendered inline only as an image (the app CSP replaces the sandbox CSP)", () => {
    const svgResponse = () =>
      new Response("<svg xmlns='http://www.w3.org/2000/svg'/>", {
        headers: { "content-type": "image/svg+xml" },
      });

    it("serves inline for an <img> load", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(svgResponse()));

      const res = await call(["images", "a", "ab", "Arms.svg"], "", { headers: { "sec-fetch-dest": "image" } });

      expect(res.headers.get("content-disposition")).toBe("inline");
      expect(res.headers.get("vary")).toBe("Sec-Fetch-Dest, Accept");
    });

    it("serves a download for a direct navigation", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(svgResponse()));

      const res = await call(["images", "a", "ab", "Arms.svg"], "", {
        headers: { "sec-fetch-dest": "document", accept: "text/html,*/*" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-disposition")).toBe('attachment; filename="Arms.svg"');
      expect(res.headers.get("content-security-policy")).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; sandbox"
      );
    });

    it("serves a download when Sec-Fetch-Dest is absent and the client asks for HTML", async () => {
      fetchMock.mockImplementation(() => Promise.resolve(svgResponse()));

      const res = await call(["images", "a", "ab", "Arms.svg"], "", { headers: { accept: "text/html" } });

      expect(res.headers.get("content-disposition")).toBe('attachment; filename="Arms.svg"');
    });
  });
});
