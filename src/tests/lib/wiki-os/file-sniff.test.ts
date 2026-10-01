/** @jest-environment node */
/**
 * Plan 411: what an upload is is decided by its bytes. Real PNG, JPEG, GIF and WebP headers are built here (no fixture
 * files), a scripted SVG is refused and a clean one accepted, and a hostile SVG costs linear time.
 */
import {
  extensionMatches,
  fileExtension,
  sniffFile,
  svgProblem,
  type SniffResult,
} from "~/lib/wiki-os/core/file-sniff";

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
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

const png = (width: number, height: number) =>
  bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    "IHDR",
    be32(width),
    be32(height),
    [8, 6, 0, 0, 0]
  );

const gif = (width: number, height: number) =>
  bytes("GIF89a", le16(width), le16(height), [0, 0, 0]);

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

const webpLossy = (width: number, height: number) =>
  bytes(
    "RIFF",
    [0, 0, 0, 0],
    "WEBP",
    "VP8 ",
    [0, 0, 0, 0],
    [0, 0, 0],
    [0x9d, 0x01, 0x2a],
    le16(width),
    le16(height)
  );

const webpLossless = (width: number, height: number) => {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return bytes(
    "RIFF",
    [0, 0, 0, 0],
    "WEBP",
    "VP8L",
    [0, 0, 0, 0],
    [0x2f],
    [bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]
  );
};

const webpExtended = (width: number, height: number) =>
  bytes(
    "RIFF",
    [0, 0, 0, 0],
    "WEBP",
    "VP8X",
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    le24(width - 1),
    le24(height - 1)
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

  it("reads a GIF's size (little-endian) for both signatures", () => {
    expect(accepted(sniffFile(gif(120, 80)))).toMatchObject({
      kind: "gif",
      mime: "image/gif",
      width: 120,
      height: 80,
    });
    expect(accepted(sniffFile(bytes("GIF87a", le16(7), le16(9), [0])))).toMatchObject({
      width: 7,
      height: 9,
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

  it("reads the size of a lossy, a lossless and an extended WebP", () => {
    expect(accepted(sniffFile(webpLossy(300, 200)))).toMatchObject({
      kind: "webp",
      mime: "image/webp",
      width: 300,
      height: 200,
    });
    expect(accepted(sniffFile(webpLossless(321, 123)))).toMatchObject({ width: 321, height: 123 });
    expect(accepted(sniffFile(webpExtended(4000, 3000)))).toMatchObject({
      width: 4000,
      height: 3000,
    });
  });

  it("takes a PDF with no pixel size", () => {
    expect(accepted(sniffFile(bytes("%PDF-1.7\n%...")))).toEqual({
      kind: "pdf",
      mime: "application/pdf",
      width: null,
      height: null,
    });
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

  it("takes the size from the viewBox when there is no width or height", () => {
    const file = accepted(
      sniffFile(svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"/>`))
    );
    expect(file).toMatchObject({ width: 200, height: 100 });
  });

  it("converts absolute units and gives no size for percentages", () => {
    expect(accepted(sniffFile(svg(`<svg width="1in" height="12pt"/>`)))).toMatchObject({
      width: 96,
      height: 16,
    });
    expect(accepted(sniffFile(svg(`<svg width="100%" height="100%"/>`)))).toMatchObject({
      width: null,
      height: null,
    });
  });

  it("accepts a byte-order mark and leading whitespace", () => {
    expect(
      accepted(sniffFile(svg(`﻿ \n<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>`)))
        .kind
    ).toBe("svg");
  });

  it("accepts inline raster images and a comment-first document", () => {
    const inline = `<!-- made by hand --><svg xmlns:xlink="http://www.w3.org/1999/xlink" width="4" height="4"><image xlink:href="data:image/png;base64,iVBORw0KGgo="/></svg>`;
    expect(accepted(sniffFile(svg(inline))).kind).toBe("svg");
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

  it("scans a hostile SVG in linear time", () => {
    const started = Date.now();
    const nested = `<svg>${'<g a="'.repeat(30_000)}${" ".repeat(200_000)}</svg>`;
    const spaces = `<svg width="1${" ".repeat(500_000)}x!"/>`;
    const urls = `<svg>${"url( ".repeat(100_000)}</svg>`;
    const refs = `<svg><a href="${"&#x6a;".repeat(100_000)}"/></svg>`;
    for (const text of [nested, spaces, urls, refs]) svgProblem(text);
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe("extension rules", () => {
  it("reads the extension of a name", () => {
    expect(fileExtension("Flag of Eurth.PNG")).toBe("png");
    expect(fileExtension("noextension")).toBe("");
    expect(fileExtension("archive.tar.gz")).toBe("gz");
  });

  it("knows which extensions a kind may carry", () => {
    expect(extensionMatches("jpeg", "a.jpg")).toBe(true);
    expect(extensionMatches("jpeg", "a.JPEG")).toBe(true);
    expect(extensionMatches("png", "a.jpg")).toBe(false);
    expect(extensionMatches("svg", "a.svg.png")).toBe(false);
    expect(extensionMatches("pdf", "a")).toBe(false);
  });
});
