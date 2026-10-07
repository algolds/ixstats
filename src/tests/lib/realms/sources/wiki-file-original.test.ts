/** @jest-environment node */
/**
 * P2.3: the original of a wiki file for a map import. Only the realm's wiki and its CDN, every redirect re-checked,
 * never wsrv.nl, 40 MB, the SHA-1 imageinfo gave, and 64 megapixels read from the header before any decode.
 */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { createDiscoveryClient } from "~/lib/realms/sources/wiki-discovery-client";
import type { WikiFileInfo } from "~/lib/realms/sources/wiki-file-info";
import {
  downloadWikiFileOriginal,
  fetchWikiFileOriginal,
  MAX_ORIGINAL_BYTES,
  WikiFileFetchError,
} from "~/lib/realms/sources/wiki-file-original";
import { fakeIiwiki } from "~/tests/helpers/iiwiki-fixtures";

const realFetch = globalThis.fetch;
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const sha1 = (bytes: Uint8Array) => createHash("sha1").update(bytes).digest("hex");
let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 64, height: 32, channels: 3, background: { r: 200, g: 10, b: 10 } } })
    .png()
    .toBuffer();
});

const infoFor = (bytes: Uint8Array, over: Partial<WikiFileInfo> = {}): WikiFileInfo => ({
  fileTitle: "File:Eurth political map 2024.png",
  url: "https://iiwiki.com/images/3/3a/Eurth_political_map_2024.png",
  descriptionUrl: "https://iiwiki.com/wiki/File:Eurth_political_map_2024.png",
  thumbUrl: null,
  width: 64,
  height: 32,
  size: bytes.byteLength,
  mime: "image/png",
  sha1: sha1(bytes),
  licence: "CC BY-SA 4.0",
  licenceUrl: null,
  artist: "Cartographer",
  credit: null,
  attribution: "Eurth political map 2024.png by Cartographer, CC BY-SA 4.0, via IIWiki",
  ...over,
});

const image = (bytes: Uint8Array, headers: Record<string, string> = {}) =>
  new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png", ...headers } });

async function failure(promise: Promise<unknown>): Promise<WikiFileFetchError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(WikiFileFetchError);
  return error as WikiFileFetchError;
}

describe("downloadWikiFileOriginal", () => {
  it("returns the bytes with their header dimensions, type, SHA-1 and credit, fetched from the wiki itself", async () => {
    fetchMock.mockResolvedValue(image(png));
    const original = await downloadWikiFileOriginal("iiwiki", infoFor(png));

    expect(original).toMatchObject({
      mime: "image/png",
      width: 64,
      height: 32,
      size: png.byteLength,
      sha1: sha1(png),
      licence: "CC BY-SA 4.0",
      attribution: expect.stringContaining("Cartographer"),
    });
    expect(original.buffer.equals(png)).toBe(true);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(["https://iiwiki.com/images/3/3a/Eurth_political_map_2024.png"]);
    expect(urls.some((url) => url.includes("wsrv.nl"))).toBe(false);
  });

  it.each([
    "https://evil.example/map.png",
    "http://iiwiki.com/images/map.png",
    // Allowlisted for the media proxy, but Commons' CDN, not iiwiki's.
    "https://upload.wikimedia.org/wikipedia/commons/a/ab/map.png",
  ])("refuses a file URL that is not https on the realm's wiki: %s", async (url) => {
    const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png, { url })));
    expect(error.code).toBe("HOST_NOT_ALLOWED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["https://evil.example/map.png", "https://upload.wikimedia.org/x/map.png", "http://169.254.169.254/"])(
    "refuses a redirect off the wiki's hosts (%s) without following it",
    async (location) => {
      fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { Location: location } }));
      const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png)));
      expect(error.code).toBe("HOST_NOT_ALLOWED");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("follows a redirect that stays on the wiki", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: "/images/3/3a/moved.png" } }))
      .mockResolvedValueOnce(image(png));
    const original = await downloadWikiFileOriginal("iiwiki", infoFor(png));
    expect(original.width).toBe(64);
    expect(String(fetchMock.mock.calls[1]![0])).toBe("https://iiwiki.com/images/3/3a/moved.png");
  });

  it("refuses a file imageinfo says is over the cap, before downloading", async () => {
    const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png, { size: MAX_ORIGINAL_BYTES + 1 })));
    expect(error.code).toBe("TOO_LARGE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a body whose Content-Length or streamed size is over the cap", async () => {
    fetchMock.mockResolvedValue(image(png, { "content-length": String(MAX_ORIGINAL_BYTES + 1) }));
    expect((await failure(downloadWikiFileOriginal("iiwiki", infoFor(png)))).code).toBe("TOO_LARGE");

    fetchMock.mockResolvedValue(image(png));
    const small = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png, { size: 10 }), { maxBytes: 100 }));
    expect(small.code).toBe("TOO_LARGE");
  });

  it("refuses an answer that is not an image", async () => {
    fetchMock.mockResolvedValue(new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } }));
    expect((await failure(downloadWikiFileOriginal("iiwiki", infoFor(png)))).code).toBe("NOT_AN_IMAGE");
  });

  it("refuses bytes whose SHA-1 differs from the wiki's", async () => {
    fetchMock.mockResolvedValue(image(png));
    const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png, { sha1: "0".repeat(40) })));
    expect(error.code).toBe("SHA1_MISMATCH");
  });

  it("refuses an image over the pixel limit, read from its header", async () => {
    fetchMock.mockResolvedValue(image(png));
    const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png), { maxPixels: 1000 }));
    expect(error.code).toBe("TOO_MANY_PIXELS");
  });

  it("refuses a 9000×8000 PNG (72 MP) from its header alone, at the default 64 MP limit", async () => {
    const header = pngHeader(9000, 8000);
    fetchMock.mockResolvedValue(image(header));
    const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(header)));
    expect(error.code).toBe("TOO_MANY_PIXELS");
  });
});

describe("fetchWikiFileOriginal", () => {
  it("reads the file's imageinfo on the realm's wiki first, then checks the download against it", async () => {
    // The recorded imageinfo gives a SHA-1 these test bytes do not have.
    const wiki = fakeIiwiki();
    const query = createDiscoveryClient("iiwiki", { fetchImpl: wiki.fetch, apiUrl: "https://iiwiki.com/api.php" }).query;
    fetchMock.mockResolvedValue(image(png));

    const error = await failure(fetchWikiFileOriginal("iiwiki", "Eurth_political_map_2024.png", { query }));
    expect(error.code).toBe("SHA1_MISMATCH");
    expect(wiki.calls[0]!.searchParams.get("titles")).toContain("File:Eurth political map 2024.png");
  });

  it("says when the wiki has no such file", async () => {
    const wiki = fakeIiwiki();
    const query = createDiscoveryClient("iiwiki", { fetchImpl: wiki.fetch, apiUrl: "https://iiwiki.com/api.php" }).query;
    const error = await failure(fetchWikiFileOriginal("iiwiki", "File:Rostervania locator.png", { query }));
    expect(error.code).toBe("NOT_FOUND");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/** A PNG signature, IHDR (8-bit RGB), a token IDAT and IEND: a header claiming `width`×`height`, almost no pixel data. */
function pngHeader(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.alloc(1))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
