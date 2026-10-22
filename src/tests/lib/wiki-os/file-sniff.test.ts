/** @jest-environment node */
/**
 * Plan 411: what an upload is is decided by its bytes. Real PNG, JPEG, GIF and WebP headers are built here (no fixture
 * files), a scripted SVG is refused and a clean one accepted, sizes no database column holds are refused, a hostile SVG
 * costs linear time, and a BlurHash is never decoded from more pixels than an upload may have.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { sniffFile, type SniffResult } from "~/lib/wiki-os/core/file-sniff";
import { scanSvg } from "~/lib/wiki-os/core/svg-scan";
import sharp from "sharp";
import { computeBlurhash } from "~/lib/wiki-os/services/image-blurhash";

/** Why an SVG text is refused, or null. */
const svgProblem = (text: string) => scanSvg(text).problem;

const bytes = (...parts: Array<number | number[] | string>): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === "number"
        ? [part]
        : typeof part === "string"
          ? [...Buffer.from(part, "latin1")]
          : part
    )
  );

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const png = (width: number, height: number) =>
  bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    "IHDR",
    be32(width),
    be32(height),
    [8, 6, 0, 0, 0]
  );
/** SOI, an APP0 segment to skip, then SOF0 with the size (height first), as every JPEG has. */
const jpeg = (width: number, height: number) =>
  bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x10],
    "JFIF\0",
    [1, 1, 0, 0, 1, 0, 1, 0, 0],
    [
      0xff,
      0xc0,
      0x00,
      0x11,
      8,
      (height >> 8) & 255,
      height & 255,
      (width >> 8) & 255,
      width & 255,
      3,
    ]
  );
const svg = (text: string) => new TextEncoder().encode(text);

const accepted = (result: SniffResult) => {
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.reason}`);
  return result.file;
};

describe("sniffFile: the bytes decide the type and the size", () => {
  it("reads a PNG's size from its IHDR chunk", () => {
    expect(accepted(sniffFile(png(640, 480)))).toEqual({
      kind: "png",
      mime: "image/png",
      width: 640,
      height: 480,
    });
  });
  it("reads a JPEG's size from its frame header, past the segments before it", () => {
    expect(accepted(sniffFile(jpeg(1920, 1080)))).toEqual({
      kind: "jpeg",
      mime: "image/jpeg",
      width: 1920,
      height: 1080,
    });
  });

  it("refuses a JPEG that has no frame header", () => {
    const result = sniffFile(bytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xda, 0, 2]));
    expect(result).toMatchObject({ ok: false, code: "corrupt" });
  });
  it("refuses an empty file, an unknown type and an HTML page, whatever the name would say", () => {
    expect(sniffFile(new Uint8Array(0))).toMatchObject({ ok: false, code: "empty-file" });
    expect(sniffFile(bytes("MZ\x90\x00 an exe"))).toMatchObject({
      ok: false,
      code: "filetype-badmime",
    });
    expect(sniffFile(svg("<html><body>hi</body></html>"))).toMatchObject({
      ok: false,
      code: "filetype-badmime",
    });
  });

  it("refuses a header that states a side no database Int holds (the review's 0xFFFFFFFF PNG)", () => {
    expect(sniffFile(png(0xffffffff, 5))).toMatchObject({ ok: false, code: "corrupt" });
    expect(sniffFile(png(5, 0x80000000))).toMatchObject({ ok: false, code: "corrupt" });
    expect(accepted(sniffFile(png(2_147_483_647, 1)))).toMatchObject({ width: 2_147_483_647 });
  });

  it("refuses a PNG with a zero-sized header", () => {
    expect(sniffFile(png(0, 10))).toMatchObject({ ok: false, code: "corrupt" });
  });
});

describe("sniffFile: SVG", () => {
  const clean = `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 10 5"><defs><linearGradient id="g"/></defs><rect width="10" height="5" fill="url(#g)"/><use href="#g"/></svg>`;

  it("accepts a clean SVG and reads its stated size", () => {
    expect(accepted(sniffFile(svg(clean)))).toEqual({
      kind: "svg",
      mime: "image/svg+xml",
      width: 120,
      height: 60,
    });
  });
  it("gives no size for a length or a viewBox no database Int holds, instead of a number that would fail the insert", () => {
    expect(accepted(sniffFile(svg(`<svg width="99999999999" height="12"/>`)))).toMatchObject({
      width: null,
      height: 12,
    });
    expect(accepted(sniffFile(svg(`<svg viewBox="0 0 1e999 5"/>`)))).toMatchObject({
      width: null,
      height: null,
    });
    expect(accepted(sniffFile(svg(`<svg viewBox="0 0 99999999999 5"/>`)))).toMatchObject({
      width: null,
      height: null,
    });
    expect(accepted(sniffFile(svg(`<svg width="2147483647" height="1"/>`)))).toMatchObject({
      width: 2_147_483_647,
    });
  });
  it("refuses an SVG that holds a <script>", () => {
    const result = sniffFile(
      svg(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
    );
    expect(result).toMatchObject({ ok: false, code: "unsafe-svg" });
  });

  const hostile: Array<[string, string]> = [
    [
      "a <script> with a namespace prefix",
      `<svg xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>`,
    ],
    ["an event handler", `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`],
    [
      "an event handler on a child, quoted with a single quote",
      `<svg><rect onclick='x()' width="1"/></svg>`,
    ],
    ["a javascript: URL", `<svg><a href="javascript:alert(1)"><rect/></a></svg>`],
    [
      "a javascript: URL spelled with a character reference and a tab",
      `<svg><a href="jav&#x61;&#9;script:alert(1)"><rect/></a></svg>`,
    ],
    [
      "an xlink:href to another host",
      `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/a.svg#x"/></svg>`,
    ],
    ["an external image", `<svg><image href="https://evil.example/pixel.png"/></svg>`],
    ["a foreignObject", `<svg><foreignObject><div/></foreignObject></svg>`],
    ["an animated href", `<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>`],
    ["an external url() in a style", `<svg><rect style="fill:url(https://evil.example/x)"/></svg>`],
    ["an @import", `<svg><style>@import url(https://evil.example/x.css);</style></svg>`],
    ["an entity declaration", `<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg>&a;</svg>`],
    [
      "an external stylesheet instruction",
      `<?xml version="1.0"?><?xml-stylesheet href="https://evil.example/x.css"?><svg/>`,
    ],
    ["an HTML data: URL", `<svg><a href="data:text/html;base64,PHNjcmlwdD4="><rect/></a></svg>`],
    [
      "a data: URL that is not a raster image",
      `<svg><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>`,
    ],
  ];

  it.each(hostile)("refuses an SVG with %s", (_name, text) => {
    expect(sniffFile(svg(text))).toMatchObject({ ok: false, code: "unsafe-svg" });
  });

  it("does not mistake text that merely looks like an attribute for one", () => {
    expect(svgProblem(`<svg><text>one = 1 and done = 2</text></svg>`)).toBeNull();
    expect(svgProblem(`<svg><!-- <script>alert(1)</script> --><rect/></svg>`)).toBeNull();
  });

  it("refuses a url() that is never closed, however many there are, and does it in linear time", () => {
    // 560 KB of this took 128 s before the scan went forward only (the review's vector: each url( re-read the rest)
    const unclosed = `<svg><style>${"url(#a ".repeat(80_000)}</style></svg>`;
    expect(svgProblem(unclosed)).toBe("it has a url() that is never closed");

    // ... and at the size limit an uploader can send
    const started = Date.now();
    const big = svg(`<svg><style>${"url(#a ".repeat(Math.floor(9_800_000 / 7))}</style></svg>`);
    expect(sniffFile(big)).toMatchObject({ ok: false, code: "unsafe-svg" });
    expect(Date.now() - started).toBeLessThan(3_000 * TIMING_BUDGET_SCALE);
  });

  it("reads ten megabytes of closed url() references in linear time, and accepts them when they stay in the file", () => {
    const started = Date.now();
    const css = "fill:url(#a);".repeat(Math.floor(9_800_000 / 13));
    expect(svgProblem(`<svg><style>${css}</style></svg>`)).toBeNull();
    expect(Date.now() - started).toBeLessThan(3_000 * TIMING_BUDGET_SCALE);
    // one that leaves the file, at the very end, is still found
    expect(svgProblem(`<svg><style>${css}a{fill:url(//evil.example/a)}</style></svg>`)).toBe(
      "it refers to something outside the file (url())"
    );
  });
});

describe("the SVG size limit (review)", () => {
  const sized = (bytes: number) => {
    const shell = `<svg xmlns="http://www.w3.org/2000/svg"><!----></svg>`;
    return svg(
      `<svg xmlns="http://www.w3.org/2000/svg"><!--${"x".repeat(bytes - shell.length)}--></svg>`
    );
  };

  it("refuses an SVG over the limit before it is scanned, and takes one at it", () => {
    const limit = 100_000;
    expect(sized(limit + 1).length).toBe(limit + 1);
    expect(sniffFile(sized(limit + 1), limit)).toMatchObject({
      ok: false,
      code: "file-too-large",
      reason: "The SVG is larger than the 0.1 MB limit for SVG files.",
    });
    expect(sniffFile(sized(limit), limit)).toMatchObject({ ok: true });
  });

  it("holds only an SVG to it, and sets no limit of its own by default", () => {
    expect(sniffFile(sized(100_000))).toMatchObject({ ok: true });
    expect(sniffFile(new Uint8Array(200_000).fill(120), 1_000)).toMatchObject({
      ok: false,
      code: "filetype-badmime",
    });
  });
});

describe("BlurHash", () => {
  const picture = (
    width: number,
    height: number,
    background: { r: number; g: number; b: number; alpha?: number },
    channels: 3 | 4 = 3
  ) => sharp({ create: { width, height, channels, background } });
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warn.mockRestore();
    delete process.env.WIKIOS_MAX_IMAGE_AREA;
  });

  describe("computeBlurhash", () => {
    it("gives null, not an error, for bytes that are not a picture", async () => {
      expect(await computeBlurhash(Buffer.from("not a png at all"), "image/png")).toBeNull();
      expect(await computeBlurhash(new Uint8Array(0), "image/png")).toBeNull();
    });

    it("refuses to decode a picture of more pixels than an upload may have", async () => {
      const bytes = await picture(100, 100, { r: 9, g: 9, b: 9 }).png().toBuffer();
      process.env.WIKIOS_MAX_IMAGE_AREA = "5000";
      expect(await computeBlurhash(bytes, "image/png")).toBeNull();
    });
  });
});
