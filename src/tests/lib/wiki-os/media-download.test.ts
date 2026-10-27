/** @jest-environment node */
/**
 * Fetching files from other wikis (plan 416 item 6, realms): only the allowlisted hosts, every redirect hop re-checked,
 * https only, a size cap on the declared and the streamed bytes, image types only, the wiki's SHA-1 checked, the pixel
 * limit read from the header; and file metadata only from the wiki's own hosts, with HTML stripped from it.
 */

import { downloadMedia, MAX_DOWNLOAD_BYTES } from "~/lib/wiki-os/services/media-download";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { type ImageInfoResponse, ImageInfoResponseSchema, metadataText, parseImageInfo, type WikiFileInfo } from "~/lib/realms/sources/wiki-file-info";
import { downloadWikiFileOriginal, MAX_ORIGINAL_BYTES, WikiFileFetchError } from "~/lib/realms/sources/wiki-file-original";
import { mediaWikiOrigin } from "~/lib/wiki-os/config";
import { IIWIKI_FIXTURES } from "~/tests/helpers/iiwiki-fixtures";

const realFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const bytesOf = (n: number, fill = 7): Uint8Array<ArrayBuffer> => new Uint8Array(n).fill(fill);

/** A response whose body arrives in 1 MB chunks, so a size cap has to act on the stream. */
const streamed = (total: number, headers: Record<string, string> = {}): Response => {
  let sent = 0;
  const chunk = 1024 * 1024;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) return controller.close();
      const size = Math.min(chunk, total - sent);
      sent += size;
      controller.enqueue(bytesOf(size));
    },
  });
  return new Response(body, { status: 200, headers });
};

describe("downloadMedia: which hosts it will fetch", () => {
  it.each([
    "https://upload.wikimedia.org/wikipedia/commons/a/ab/Flag.png",
    "https://ixwiki.com/images/a/ab/Flag.png",
    "https://iiwiki.com/images/Flag.png",
    "https://static.wikia.nocookie.net/althistory/images/Flag.png",
    "https://commons.wikimedia.org/w/index.php?title=Special:FilePath/Flag.png",
  ])("fetches %s", async (url) => {
    fetchMock.mockResolvedValue(new Response(bytesOf(4), { status: 200 }));

    const bytes = await downloadMedia(url);

    expect(bytes?.length).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://evil.example/flag.png",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:5433/",
    "https://ixwiki.com.evil.example/flag.png",
    "file:///etc/passwd",
    "ftp://ixwiki.com/flag.png",
    "not a url",
  ])("never fetches %s", async (url) => {
    await expect(downloadMedia(url)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not follow a redirect off the allowlist", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { Location: "http://169.254.169.254/" } })
    );

    await expect(downloadMedia("https://ixwiki.com/images/Flag.png")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("downloadMedia: the 10 MB cap", () => {
  it("refuses a file whose Content-Length is over the cap without reading it", async () => {
    const res = streamed(1024, { "Content-Length": String(MAX_DOWNLOAD_BYTES + 1) });
    const cancel = jest.spyOn(res.body!, "cancel");
    fetchMock.mockResolvedValue(res);

    await expect(downloadMedia("https://ixwiki.com/images/Huge.png")).resolves.toBeNull();

    expect(cancel).toHaveBeenCalled();
  });

  it("stops reading a file that does not declare its size once it passes the cap", async () => {
    fetchMock.mockResolvedValue(streamed(MAX_DOWNLOAD_BYTES * 3));

    await expect(downloadMedia("https://ixwiki.com/images/Huge.png")).resolves.toBeNull();
  });
});

describe("a realm's original file", () => {
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
    png = await sharp({
      create: { width: 64, height: 32, channels: 3, background: { r: 200, g: 10, b: 10 } },
    })
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
    ownAttribution: null,
    holder: "iiwiki",
    attribution: "Eurth political map 2024.png by Cartographer, CC BY-SA 4.0, via IIWiki",
    ...over,
  });

  const image = (bytes: Uint8Array, headers: Record<string, string> = {}) =>
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "content-type": "image/png", ...headers },
    });

  async function failure(promise: Promise<unknown>): Promise<WikiFileFetchError> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(WikiFileFetchError);
    return error as WikiFileFetchError;
  }

  describe("downloadWikiFileOriginal", () => {
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

    it.each([
      "https://evil.example/map.png",
      "https://upload.wikimedia.org/x/map.png",
      "http://169.254.169.254/",
    ])("refuses a redirect off the wiki's hosts (%s) without following it", async (location) => {
      fetchMock.mockResolvedValue(
        new Response(null, { status: 302, headers: { Location: location } })
      );
      const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(png)));
      expect(error.code).toBe("HOST_NOT_ALLOWED");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("refuses a file imageinfo says is over the cap, before downloading", async () => {
      const error = await failure(
        downloadWikiFileOriginal("iiwiki", infoFor(png, { size: MAX_ORIGINAL_BYTES + 1 }))
      );
      expect(error.code).toBe("TOO_LARGE");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a body whose Content-Length or streamed size is over the cap", async () => {
      fetchMock.mockResolvedValue(image(png, { "content-length": String(MAX_ORIGINAL_BYTES + 1) }));
      expect((await failure(downloadWikiFileOriginal("iiwiki", infoFor(png)))).code).toBe(
        "TOO_LARGE"
      );

      fetchMock.mockResolvedValue(image(png));
      const small = await failure(
        downloadWikiFileOriginal("iiwiki", infoFor(png, { size: 10 }), { maxBytes: 100 })
      );
      expect(small.code).toBe("TOO_LARGE");
    });

    it("refuses an answer that is not an image", async () => {
      fetchMock.mockResolvedValue(
        new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } })
      );
      expect((await failure(downloadWikiFileOriginal("iiwiki", infoFor(png)))).code).toBe(
        "NOT_AN_IMAGE"
      );
    });

    it("refuses bytes whose SHA-1 differs from the wiki's", async () => {
      fetchMock.mockResolvedValue(image(png));
      const error = await failure(
        downloadWikiFileOriginal("iiwiki", infoFor(png, { sha1: "0".repeat(40) }))
      );
      expect(error.code).toBe("SHA1_MISMATCH");
    });
    it("refuses a 9000×8000 PNG (72 MP) from its header alone, at the default 64 MP limit", async () => {
      const header = pngHeader(9000, 8000);
      fetchMock.mockResolvedValue(image(header));
      const error = await failure(downloadWikiFileOriginal("iiwiki", infoFor(header)));
      expect(error.code).toBe("TOO_MANY_PIXELS");
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
});

describe("a realm's file information", () => {
  describe("imageinfo parsing", () => {
    const files = parseImageInfo("iiwiki", IIWIKI_FIXTURES.imageinfo as ImageInfoResponse);
    it("says plainly when a file states no licence or author", () => {
      expect(files.get("File:Eurth physical.jpg")).toMatchObject({
        licence: null,
        artist: null,
        attribution: "Eurth physical.jpg, via IIWiki",
      });
    });
    it("drops a file whose URL is not on the wiki or its CDN, or is not https", () => {
      const foreign = parseImageInfo("iiwiki", {
        query: {
          pages: [
            {
              title: "File:A.png",
              imageinfo: [{ url: "https://evil.example/A.png", width: 1, height: 1, size: 1 }],
            },
            {
              title: "File:B.png",
              imageinfo: [{ url: "http://iiwiki.com/images/B.png", width: 1, height: 1, size: 1 }],
            },
            {
              title: "File:C.png",
              imageinfo: [
                { url: "https://iiwiki.com.evil.example/C.png", width: 1, height: 1, size: 1 },
              ],
            },
          ],
        },
      });
      expect(foreign.size).toBe(0);
      // AltHistory's files live on its CDN, which is allowed for it (and only for it).
      const cdn = {
        query: {
          pages: [
            {
              title: "File:D.png",
              imageinfo: [
                {
                  url: "https://static.wikia.nocookie.net/althistory/images/D.png",
                  width: 1,
                  height: 1,
                  size: 1,
                },
              ],
            },
          ],
        },
      };
      expect(parseImageInfo("althistory", cdn).size).toBe(1);
      expect(parseImageInfo("iiwiki", cdn).size).toBe(0);
    });
  });

  describe("helpers", () => {
    it("strips HTML and entities from extmetadata values", () => {
      expect(metadataText('<a href="/wiki/User:X">X&nbsp;&amp;&nbsp;Y</a>')).toBe("X & Y");
      expect(metadataText("")).toBeNull();
      expect(metadataText(42)).toBeNull();
    });
  });

  describe("card source wikis", () => {
    const file = (url: string, extmetadata: object | []) => ({
      query: {
        pages: [
          { title: "File:X.png", imageinfo: [{ url, width: 1, height: 1, size: 1, extmetadata }] },
        ],
      },
    });
    it("reads IxWiki files from IxWiki's own host and Commons files from its upload CDN only", () => {
      const ixwiki = ImageInfoResponseSchema.parse(
        file(`${mediaWikiOrigin()}/images/1/16/X.png`, [])
      );
      expect(parseImageInfo("ixwiki", ixwiki).get("File:X.png")?.attribution).toContain("IxWiki");
      const elsewhere = ImageInfoResponseSchema.parse(file("https://example.com/X.png", {}));
      expect(parseImageInfo("commons", elsewhere).size).toBe(0);
      expect(parseImageInfo("ixwiki", elsewhere).size).toBe(0);
    });
  });
});
