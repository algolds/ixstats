/** @jest-environment node */
/**
 * Flag and arms images: the resolver keeps to its wiki policy (no fictional wiki under commons-only), refuses
 * placeholder URLs and coalesces concurrent lookups; a map image is sized from its header and refused past 64
 * megapixels before a pixel is decoded (decompression bombs); a realm nation's wiki image is fetched only from an
 * allowlisted host, SHA-1 checked, size capped, and an SVG is stored rasterised without its scripts; only a wiki file
 * that can be named is taken, and local file names are folded so they cannot climb out of their folder.
 *
 * Folds: src/tests/lib/flags/flag-resolver.test.ts, src/tests/lib/flags/png-to-svg.test.ts,
 * src/tests/lib/flags/wiki-image-download.test.ts, src/tests/lib/flags/wiki-image-ref.test.ts
 */
jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  fetchMediaWikiImageBatch: jest.fn(),
}));

import { createHash } from "node:crypto";
import sharp from "sharp";
import { ServerFlagResolver } from "~/lib/flags/flag-resolver.server";
import { extractProvincesFromPng } from "~/lib/flags/png-to-svg";
import {
  downloadWikiImage,
  MAX_FLAG_BYTES,
  SVG_RASTER_WIDTH,
  toStoredImage,
} from "~/lib/flags/wiki-image-download";
import { localImageFileName, parseWikiImageRef } from "~/lib/flags/wiki-image-ref";
import { fetchMediaWikiImageBatch } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { pngClaimingSize } from "~/tests/fixtures/png-maps";

const imageBatch = jest.mocked(fetchMediaWikiImageBatch);

beforeEach(() => jest.clearAllMocks());

describe("ServerFlagResolver", () => {
  it("ignores a placeholder URL it is given and resolves through the pipeline", async () => {
    imageBatch.mockResolvedValue(new Map());
    const result = await new ServerFlagResolver().resolve("Valora", {
      providedUrl: "/images/flags/placeholder.svg",
    });
    expect([result.source, result.isPlaceholder]).toEqual(["placeholder", true]);
  });

  it("never asks the fictional wiki under the commons-only policy", async () => {
    imageBatch.mockResolvedValue(new Map());
    const result = await new ServerFlagResolver().resolve("Tretrid", {
      fallbackPolicy: "commons-only",
    });
    expect(result.isPlaceholder).toBe(true);
    expect(imageBatch).toHaveBeenCalledTimes(1); // Commons only
  });

  it("answers concurrent lookups of the same country with one request", async () => {
    const found = new Map([["Flag_of_Germany.svg", "https://upload.wikimedia.org/germany.svg"]]);
    imageBatch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(found), 50))
    );
    const resolver = new ServerFlagResolver();
    const results = await Promise.all([
      resolver.resolve("Germany"),
      resolver.resolve("Germany"),
      resolver.resolve("Germany"),
    ]);
    expect(results.map((r) => r.flagUrl)).toEqual(
      Array(3).fill("https://upload.wikimedia.org/germany.svg")
    );
    expect(imageBatch).toHaveBeenCalledTimes(1);
  });
});

it("refuses a map image claiming more than 64 megapixels from its header, before decoding a pixel", async () => {
  await expect(extractProvincesFromPng(await pngClaimingSize(8193, 8192))).rejects.toMatchObject({
    name: "PngDecodeError",
    message: expect.stringMatching(/64 megapixels.*it is 8193×8192 pixels$/),
  });
});

describe("a realm nation's wiki image", () => {
  const url = "https://iiwiki.com/images/e/ea/Flag_of_X.png";
  const sha1 = (bytes: Uint8Array) => createHash("sha1").update(bytes).digest("hex");
  let png: Buffer;
  beforeAll(async () => {
    png = await sharp({
      create: { width: 30, height: 20, channels: 3, background: { r: 200, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
  });
  const imageResponse = (bytes: Uint8Array, headers: Record<string, string> = {}) =>
    new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { "content-type": "image/png", ...headers },
    });

  it("is never fetched from a host off the allowlist", async () => {
    const direct = jest.fn();
    await expect(
      downloadWikiImage(
        { url: "https://evil.example/x.png", sha1: "", size: 1 },
        { direct, relay: direct }
      )
    ).rejects.toThrow(/not an allowed wiki host/);
    expect(direct).not.toHaveBeenCalled();
  });

  it("whose direct bytes fail the wiki's SHA-1 is taken through the relay instead", async () => {
    const altered = await sharp(png).jpeg().toBuffer();
    const result = await downloadWikiImage(
      { url, sha1: sha1(png), size: png.byteLength },
      { direct: async () => imageResponse(altered), relay: async () => imageResponse(png) }
    );
    expect(result.via).toBe("wsrv");
    expect(sha1(result.buffer)).toBe(sha1(png));
  });

  it("is refused when the wiki says it is over 5 MB, and when the answers are not images or are oversized", async () => {
    await expect(
      downloadWikiImage(
        { url, sha1: "", size: MAX_FLAG_BYTES + 1 },
        { direct: jest.fn(), relay: jest.fn() }
      )
    ).rejects.toThrow(/larger than 5 MB/);
    await expect(
      downloadWikiImage(
        { url, sha1: "", size: 10 },
        {
          direct: async () =>
            new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }),
          relay: async () => imageResponse(png, { "content-length": String(MAX_FLAG_BYTES + 1) }),
        }
      )
    ).rejects.toThrow(/direct: not an image \(text\/html\); wsrv: over 5 MB/);
  });

  it("is stored rasterised to PNG when it is an SVG, its scripts left behind", async () => {
    const stored = await toStoredImage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><script>alert(1)</script><rect width="30" height="20" fill="blue"/></svg>'
      )
    );
    const meta = await sharp(stored.data).metadata();
    expect([stored.ext, meta.format, meta.width]).toEqual(["png", "png", SVG_RASTER_WIDTH]);
    expect(stored.data.includes(Buffer.from("alert"))).toBe(false);
  });
});

describe("wiki image references and local names", () => {
  it("takes no file it cannot name: not a local path, another host, plain http, or a wiki URL without a file", () => {
    const refused = [
      null,
      "",
      "/flags/caphiria.png",
      "/images/uploads/uploaded_1_a.png",
      "https://evil.example/images/a/ab/X.png",
      "http://iiwiki.com/images/a/ab/X.png",
      "/api/mediawiki/commons/wiki/Special:FilePath/X.png",
      "/api/mediawiki/iiwiki/wiki/Special:FilePath/",
      "/api/mediawiki/iiwiki/wiki/Main_Page",
      "/api/mediawiki/iiwiki/images/a/ab/",
    ];
    // each value beside its answer, so a failure names the value
    expect(refused.map((value) => [value, parseWikiImageRef(value)])).toEqual(
      refused.map((value) => [value, null])
    );
  });

  it("folds a slug to [a-z0-9-] so a name cannot climb out of its folder or blur the -- separator", () => {
    expect(localImageFileName("Eurth", "../Côte--d'Or", "flag", "svg")).toBe(
      "eurth--cote-d-or.svg"
    );
    expect(localImageFileName("eurth", "../..", "coatOfArms", "png")).toBeNull();
  });
});
