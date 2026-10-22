/** @jest-environment node */
/**
 * Plan 411: what an upload is is decided by its bytes. Real PNG, JPEG, GIF and WebP headers are built here (no fixture
 * files), sizes no database column holds are refused, a BlurHash is never decoded from more pixels than an upload may
 * have; and the SVG scanner's matrix: every vector a reviewer found refused (scripts, handlers, foreign content,
 * external references, entity and DOCTYPE tricks), clean art accepted, attribute, name and depth bounds held.
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

describe("the SVG scanner", () => {
  /** Why an SVG text is refused, or null. */
  const svgProblem = (text: string) => scanSvg(text).problem;

  const enc = (s: string) => new TextEncoder().encode(s);
  const NS = 'xmlns="http://www.w3.org/2000/svg"';

  // [name, body] : every one of these must be REFUSED (script / external load / injection)
  const mustRefuse: Array<[string, string | Uint8Array]> = [
    ["script element", `<svg ${NS}><script>alert(1)</script></svg>`],
    ["script upper", `<svg ${NS}><SCRIPT>alert(1)</SCRIPT></svg>`],
    [
      "svg:script prefix",
      `<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:script>alert(1)</svg:script></svg:svg>`,
    ],
    [
      "script xlink href",
      `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink"><script xlink:href="data:,alert(1)"/></svg>`,
    ],
    [
      "foreignObject",
      `<svg ${NS}><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x /></body></foreignObject></svg>`,
    ],
    ["onload", `<svg ${NS} onload="alert(1)"/>`],
    ["onload slash", `<svg ${NS}/onload=alert(1)>`],
    ["onload mixed case", `<svg ${NS} OnLoAd="alert(1)"/>`],
    ["onclick on rect", `<svg ${NS}><rect onclick="alert(1)" width="9" height="9"/></svg>`],
    ["use external href", `<svg ${NS}><use href="//evil.example/x.svg#a"/></svg>`],
    ["use external https", `<svg ${NS}><use href="https://evil.example/x.svg#a"/></svg>`],
    [
      "use xlink javascript",
      `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>`,
    ],
    [
      "a href entity-obfuscated",
      `<svg ${NS}><a href="jav&#x61;script:alert(1)"><text>x</text></a></svg>`,
    ],
    ["a href tab/newline", `<svg ${NS}><a href="java&#x09;script:alert(1)"><text>x</text></a></svg>`],
    [
      "a href leading zeros hex ref",
      `<svg ${NS}><a href="j&#x0000061;vascript:alert(1)"><text>x</text></a></svg>`,
    ],
    [
      "a href decimal long",
      `<svg ${NS}><a href="j&#0000097;vascript:alert(1)"><text>x</text></a></svg>`,
    ],
    ["a href named colon", `<svg ${NS}><a href="javascript&colon;alert(1)"><text>x</text></a></svg>`],
    [
      "a href data html",
      `<svg ${NS}><a href="data:text/html,<script>alert(1)</script>"><text>x</text></a></svg>`,
    ],
    ["image href data svg", `<svg ${NS}><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>`],
    [
      "animate href",
      `<svg ${NS}><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>`,
    ],
    [
      "set xlink:href",
      `<svg ${NS}><a><set attributeName="xlink:href" to="javascript:alert(1)"/><text>x</text></a></svg>`,
    ],
    [
      "set onmouseover",
      `<svg ${NS}><rect width="10" height="10"><set attributeName="onmouseover" to="alert(1)"/></rect></svg>`,
    ],
    ["style url external", `<svg ${NS}><style>rect{fill:url(//evil.example/a)}</style></svg>`],
    [
      "style attr url external",
      `<svg ${NS}><rect style="fill:url('https://evil.example/a')"/></svg>`,
    ],
    ["style import", `<svg ${NS}><style>@import url(//evil.example/x.css);</style></svg>`],
    ["style import escaped", `<svg ${NS}><style>@\\69mport "//evil.example/x.css";</style></svg>`],
    [
      "style url escaped fn name",
      `<svg ${NS}><style>rect{fill:\\75rl(//evil.example/a)}</style></svg>`,
    ],
    ["style url spaced", `<svg ${NS}><style>rect{fill:url (//evil.example/a)}</style></svg>`],
    ["style expression", `<svg ${NS}><rect style="width:expression(alert(1))"/></svg>`],
    [
      "xml-stylesheet PI",
      `<?xml version="1.0"?><?xml-stylesheet href="//evil.example/x.xsl" type="text/xsl"?><svg ${NS}/>`,
    ],
    [
      "ENTITY decl",
      `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "<script>alert(1)</script>">]><svg ${NS}>&x;</svg>`,
    ],
    ["ENTITY lower", `<?xml version="1.0"?><!DOCTYPE svg [<!entity x "y">]><svg ${NS}/>`],
    ["DOCTYPE internal subset", `<?xml version="1.0"?><!DOCTYPE svg [ ]><svg ${NS}/>`],
    ["comment split script", `<svg ${NS}><scr<!-- -->ipt>alert(1)</scr<!-- -->ipt></svg>`],
    ["CDATA script", `<svg ${NS}><script><![CDATA[alert(1)]]></script></svg>`],
    ["iframe", `<svg ${NS}><iframe src="javascript:alert(1)"/></svg>`],
    ["object", `<svg ${NS}><object data="//evil.example/x.html"/></svg>`],
    ["embed", `<svg ${NS}><embed src="//evil.example/x.swf"/></svg>`],
    ["handler element", `<svg ${NS}><handler type="application/ecmascript">alert(1)</handler></svg>`],
    ["listener element", `<svg ${NS}><listener event="load" handler="#h"/></svg>`],
    [
      "xhtml root w/ script",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><script>alert(1)</script></body></html>`,
    ],
    [
      "xhtml root w/ onerror",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><img src="x" onerror="alert(1)"/></body></html>`,
    ],
    [
      "xhtml link stylesheet",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="//evil.example/x.css"/></head><body><svg ${NS}/></body></html>`,
    ],
    [
      "xhtml form action js",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><form action="javascript:alert(1)"><button type="submit">go</button></form></body></html>`,
    ],
    [
      "xhtml meta refresh",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="refresh" content="0;url=https://evil.example/"/></head><body><svg ${NS}/></body></html>`,
    ],
    [
      "xhtml formaction",
      `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><svg ${NS}/><form><button type="submit" formaction="https://evil.example/x">go</button></form></body></html>`,
    ],
    [
      "UTF-7 declared",
      `<?xml version="1.0" encoding="UTF-7"?><svg ${NS}>+ADw-script+AD4-alert(1)+ADw-/script+AD4-</svg>`,
    ],
    ["UTF-16 declared ascii body", `<?xml version="1.0" encoding="UTF-16"?><svg ${NS}/>`],
    [
      "UTF-16LE with BOM",
      Uint8Array.from([
        0xff,
        0xfe,
        ...Array.from(`<svg ${NS}><script>alert(1)</script></svg>`).flatMap((c) => [
          c.charCodeAt(0),
          0,
        ]),
      ]),
    ],
    [
      "UTF-16BE with BOM",
      Uint8Array.from([
        0xfe,
        0xff,
        ...Array.from(`<svg ${NS}><script>alert(1)</script></svg>`).flatMap((c) => [
          0,
          c.charCodeAt(0),
        ]),
      ]),
    ],
    [
      "UTF-8 BOM + script",
      Uint8Array.from([0xef, 0xbb, 0xbf, ...enc(`<svg ${NS}><script>alert(1)</script></svg>`)]),
    ],
    ["HTML renamed svg", `<html><body><script>alert(1)</script></body></html>`],
    [
      "HTML doctype w/ svg",
      `<!DOCTYPE html><html><body><svg/><script>alert(1)</script></body></html>`,
    ],
    ["svg w/ trailing html script", `<svg ${NS}/><script>alert(1)</script>`],
    ["leading comment then html", `<!-- x --><html><body onload="alert(1)"><svg/></body></html>`],
    ["attr unquoted onload", `<svg ${NS} onload=alert(1)>`],
    ["attr backtick", "<svg " + NS + " a=`b` onload=alert(1)>"],
    ["attr unterminated quote then onload", `<svg ${NS} a="x onload="alert(1)">`],
    ["tab in tag name", `<svg ${NS}><script\talert(1)></script></svg>`],
    ["newline in tag", `<svg ${NS}><script\n>alert(1)</script></svg>`],
    ["svg/ trick", `<svg/xmlns="http://www.w3.org/2000/svg"/onload=alert(1)>`],
    [
      "mathml xlink",
      `<svg ${NS}><math xmlns="http://www.w3.org/1998/Math/MathML"><maction actiontype="statusline#" xlink:href="javascript:alert(1)">x</maction></math></svg>`,
    ],
    ["xlink:href case", `<svg ${NS}><a XLINK:HREF="javascript:alert(1)"><text>x</text></a></svg>`],
    ["href case", `<svg ${NS}><a HREF="javascript:alert(1)"><text>x</text></a></svg>`],
    [
      "feImage external",
      `<svg ${NS}><filter id="f"><feImage href="https://evil.example/x.png"/></filter></svg>`,
    ],
    ["link rel import", `<svg ${NS}><link rel="import" href="//evil.example/x.html"/></svg>`],
    [
      "xml:base javascript",
      `<svg ${NS} xml:base="javascript:" ><a href="alert(1)"><text>x</text></a></svg>`,
    ],
    ["pi containing script (PI hides?)", `<svg ${NS}><?x <script>alert(1)</script> ?></svg>`],
    ["cdata hiding open tag", `<svg ${NS}><![CDATA[ ]]><script>alert(1)</script></svg>`],
    ["comment end trick", `<svg ${NS}><!-- a --!><script>alert(1)</script> --></svg>`],
    [
      "root in the XHTML namespace",
      `<svg xmlns="http://www.w3.org/1999/xhtml"><meta http-equiv="refresh" content="0;url=https://evil.example/"/></svg>`,
    ],
    ["root namespace written with a reference", `<svg xmlns="http://www.w3.org/1999/&#x78;html"/>`],
    ["root with no valid namespace value", `<svg xmlns=""/>`],
    [
      "nested default namespace of XHTML",
      `<svg ${NS}><g xmlns="http://www.w3.org/1999/xhtml"><meta http-equiv="refresh" content="0;url=https://evil.example/"/></g></svg>`,
    ],
    ["prefixed root in the XHTML namespace", `<svg:svg xmlns:svg="http://www.w3.org/1999/xhtml"/>`],
    [
      "XHTML declared under a prefix",
      `<svg ${NS}><x:meta xmlns:x="http://www.w3.org/1999/xhtml" http-equiv="refresh" content="0;url=https://evil.example/"/></svg>`,
    ],
    [
      "style import with a long-zeros reference",
      `<svg ${NS}><style>@&#x0000069;mport "//evil.example/x.css";</style></svg>`,
    ],
    [
      "style url with a long-zeros decimal reference",
      `<svg ${NS}><style>a{fill:&#0000000117;rl(//evil.example/a)}</style></svg>`,
    ],
    [
      "javascript: href with a long-zeros reference",
      `<svg ${NS}><a href="&#x000000006a;avascript:alert(1)"><text>x</text></a></svg>`,
    ],
    [
      "encoding declared after 300 characters of declaration",
      `<?xml version="1.0"${" ".repeat(300)}encoding="UTF-16"?><svg ${NS}/>`,
    ],
    [
      "XML declaration longer than 1024 characters",
      `<?xml version="1.0"${" ".repeat(1100)}encoding="UTF-8"?><svg ${NS}/>`,
    ],
    ["an end tag that closes another element", `<svg ${NS}><g><rect></g></rect></svg>`],
    ["an end tag with the wrong case", `<svg ${NS}><g></G></svg>`],
    ["svg only in comment", `<!-- <svg> --><html><script>alert(1)</script></html>`],
  ];

  // legit SVGs that MUST be accepted (no false positives on normal art)
  const mustAccept: Array<[string, string]> = [
    [
      "plain",
      `<svg ${NS} width="40" height="20" viewBox="0 0 40 20"><rect width="40" height="20" fill="#2a7"/></svg>`,
    ],
    [
      "xml decl + gradient",
      `<?xml version="1.0" encoding="UTF-8"?><svg ${NS}><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect fill="url(#g)" width="5" height="5"/></svg>`,
    ],
    [
      "xlink local use",
      `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink"><defs><g id="a"/></defs><use xlink:href="#a"/></svg>`,
    ],
    ["inline png image", `<svg ${NS}><image href="data:image/png;base64,iVBORw0KGgo="/></svg>`],
    ["style block", `<svg ${NS}><style>.a{fill:red}</style><rect class="a"/></svg>`],
    [
      "w3c doctype external",
      `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg ${NS}/>`,
    ],
    [
      "inkscape-style namespaces and a metadata block",
      `<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg ${NS} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><sodipodi:namedview inkscape:zoom="1"/><metadata><rdf:RDF><dc:title>flag</dc:title></rdf:RDF></metadata><g xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2"/></g></svg>`,
    ],
    ["onwards word in text", `<svg ${NS}><text>online</text></svg>`],
  ];

  describe("SVG scan vectors", () => {
    it.each(mustRefuse)("refuses: %s", (_name, body) => {
      const result = sniffFile(typeof body === "string" ? enc(body) : body);
      expect(result.ok).toBe(false);
    });

    it.each(mustAccept)("accepts: %s", (_name, body) => {
      expect(sniffFile(enc(body))).toMatchObject({ ok: true });
    });
  });

  describe("SVG scan bounds and reasons", () => {
    it("names what is wrong with the file it refuses", () => {
      const reasons: Array<[string, string]> = [
        [
          `<svg ${NS}><set attributeName="onmouseover" to="x"/></svg>`,
          "it sets an event handler (onmouseover)",
        ],
        [
          `<svg ${NS}><set attributeName="on&#x6d;ouseover" to="x"/></svg>`,
          "it sets an event handler (onmouseover)",
        ],
        [`<svg ${NS}><style>@\\69mport "x";</style></svg>`, "it imports a stylesheet"],
        [
          `<svg ${NS}><style>a{fill:\\75rl(//e.example/a)}</style></svg>`,
          "it refers to something outside the file (url())",
        ],
        [
          `<svg ${NS}><style>a{fill:url (//e.example/a)}</style></svg>`,
          "it refers to something outside the file (url())",
        ],
        [
          `<?xml version="1.0" encoding="UTF-16"?><svg ${NS}/>`,
          "it declares the encoding UTF-16, not UTF-8",
        ],
        [
          `<html xmlns="http://www.w3.org/1999/xhtml"><body><svg/></body></html>`,
          "its root element is <html>, not <svg>",
        ],
        [
          `<svg ${NS}><!-- a --!><script/> --></svg>`,
          "it is not well-formed XML (a comment contains --)",
        ],
        [
          `<svg ${NS} a="x onload="y"/>`,
          "it is not well-formed XML (two attributes are not separated by white space)",
        ],
      ];
      for (const [text, reason] of reasons) expect(svgProblem(text)).toBe(reason);
    });

    it("refuses a tag with more than 256 attributes and a name past 128 characters", () => {
      const attributes = (count: number) =>
        Array.from({ length: count }, (_, i) => `a${i}="1"`).join(" ");
      expect(svgProblem(`<svg ${NS} ${attributes(255)}/>`)).toBeNull();
      expect(svgProblem(`<svg ${NS} ${attributes(256)}/>`)).toBe(
        "it is not well-formed XML (a tag has more than 256 attributes)"
      );
      expect(svgProblem(`<svg ${NS} ${"a".repeat(128)}="1"/>`)).toBeNull();
      expect(svgProblem(`<svg ${NS} ${"a".repeat(129)}="1"/>`)).toBe(
        "it is not well-formed XML (an attribute name is longer than 128 characters)"
      );
    });

    it("refuses a document nested deeper than 2048 elements", () => {
      expect(svgProblem(`<svg>${"<g>".repeat(2_000)}${"</g>".repeat(2_000)}</svg>`)).toBeNull();
      expect(svgProblem(`<svg>${"<g>".repeat(3_000)}${"</g>".repeat(3_000)}</svg>`)).toBe(
        "it is not well-formed XML (elements are nested deeper than 2048)"
      );
    });

    it("does not take a > or a [ inside the quotes of a DOCTYPE for its end or an internal subset", () => {
      expect(svgProblem(`<!DOCTYPE svg SYSTEM "a>[b"><svg/>`)).toBeNull();
      expect(svgProblem(`<!DOCTYPE svg SYSTEM "a>b" [ ]><svg/>`)).toBe(
        "its DOCTYPE has an internal subset"
      );
    });

    it("takes a prefixed root in the SVG namespace and matching end tags, and names a mismatch", () => {
      expect(
        svgProblem(
          `<svg:svg xmlns:svg="http://www.w3.org/2000/svg"><svg:rect width="1" height="1"/></svg:svg>`
        )
      ).toBeNull();
      expect(svgProblem(`<svg ${NS}><g><rect/></g></svg>`)).toBeNull();
      expect(svgProblem(`<svg ${NS}><g><rect></g></rect></svg>`)).toBe(
        "it is not well-formed XML (</g> does not close <rect>)"
      );
      expect(svgProblem(`<svg xmlns="http://www.w3.org/1999/xhtml"/>`)).toBe(
        "its default namespace is not the SVG namespace"
      );
      expect(
        svgProblem(
          `<svg:svg xmlns:svg="http://www.w3.org/2000/svg" xmlns:h="http://www.w3.org/1999/xhtml"/>`
        )
      ).toBe("it declares the XHTML namespace");
      expect(svgProblem(`<svg:svg xmlns:svg="urn:other"/>`)).toBe(
        "its root element is not in the SVG namespace"
      );
    });
  });
});
