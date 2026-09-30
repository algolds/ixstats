/** @jest-environment node */
import { NextRequest } from "next/server";

const mockFindAsset = jest.fn();
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
}));

import { GET } from "~/app/api/mediawiki/ixwiki/[...path]/route";
import { DEFAULT_MEDIAWIKI_URL } from "~/lib/wiki-os/config";

const ORIGIN = DEFAULT_MEDIAWIKI_URL.replace(/\/+$/, "");
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const call = (path: string[], query = "") =>
  GET(
    new NextRequest(`http://localhost:3000/api/mediawiki/ixwiki/${path.join("/")}${query}`),
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
    [["images", "%2e%2e", "api.php"], ""],
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
    [["wiki", "File%3AFoo.png"], "Foo.png"],
    [["wiki", "File:Foo%20bar.png"], "Foo%20bar.png"],
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
});
