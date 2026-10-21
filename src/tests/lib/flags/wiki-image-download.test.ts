/** @jest-environment node */
/**
 * A realm nation's flag or arms made a local file: the file's URL read from its wiki's imageinfo (redirects and
 * InstantCommons files included), the bytes fetched from an allowlisted host (SHA-1 checked) or, failing that,
 * through wsrv.nl as the media proxy does, at most 5 MB, and an SVG rasterized to PNG so nothing scriptable is served.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  downloadWikiImage,
  MAX_FLAG_BYTES,
  SVG_RASTER_WIDTH,
  toStoredImage,
} from "~/lib/flags/wiki-image-download";

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
describe("downloadWikiImage", () => {
  const url = "https://iiwiki.com/images/e/ea/Flag_of_X.png";

  it("takes the direct download when its SHA-1 matches", async () => {
    const relay = jest.fn();
    const result = await downloadWikiImage(
      { url, sha1: sha1(png), size: png.byteLength },
      { direct: async () => imageResponse(png), relay }
    );
    expect(result.via).toBe("direct");
    expect(sha1(result.buffer)).toBe(sha1(png));
    expect(relay).not.toHaveBeenCalled();
  });

  it("falls back to the relay when the origin refuses or the SHA-1 differs", async () => {
    const refused = await downloadWikiImage(
      { url, sha1: sha1(png), size: png.byteLength },
      {
        direct: async () =>
          new Response("blocked", { status: 403, headers: { "content-type": "text/html" } }),
        relay: async () => imageResponse(png),
      }
    );
    expect(refused.via).toBe("wsrv");
    const altered = await downloadWikiImage(
      { url, sha1: "0".repeat(40), size: png.byteLength },
      { direct: async () => imageResponse(png), relay: async () => imageResponse(png) }
    );
    expect(altered.via).toBe("wsrv");
  });

  it("refuses a host off the allowlist without fetching", async () => {
    const direct = jest.fn();
    await expect(
      downloadWikiImage(
        { url: "https://evil.example/x.png", sha1: "", size: 1 },
        { direct, relay: direct }
      )
    ).rejects.toThrow(/not an allowed wiki host/);
    expect(direct).not.toHaveBeenCalled();
  });

  it("refuses a file the wiki says is over the cap, and non-image or oversized answers", async () => {
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

  it("says why both routes failed when they throw or are blocked", async () => {
    await expect(
      downloadWikiImage(
        { url, sha1: "", size: 10 },
        {
          direct: async () => null,
          relay: async () => {
            throw new Error("timeout");
          },
        }
      )
    ).rejects.toThrow(/direct: redirected off the allowlist; wsrv: timeout/);
  });
});

describe("toStoredImage", () => {
  it("keeps a raster image's bytes and names its type", async () => {
    const stored = await toStoredImage(png);
    expect(stored.ext).toBe("png");
    expect(stored.data).toBe(png);
    const jpeg = await sharp(png).jpeg().toBuffer();
    expect((await toStoredImage(jpeg)).ext).toBe("jpg");
  });

  it("rasterizes an SVG to a PNG, scripts and all left behind", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><script>alert(1)</script><rect width="30" height="20" fill="blue"/></svg>'
    );
    const stored = await toStoredImage(svg);
    expect(stored.ext).toBe("png");
    const meta = await sharp(stored.data).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(SVG_RASTER_WIDTH);
    expect(stored.data.includes(Buffer.from("alert"))).toBe(false);
  });

  it("refuses bytes that are not an image", async () => {
    await expect(toStoredImage(Buffer.from("<html></html>"))).rejects.toThrow(/not an image/);
  });
});
